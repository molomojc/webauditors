import fs from 'node:fs/promises'
import path from 'node:path'

// A single JSON file on disk. It survives a dev-server restart, which is what
// makes "the run is still there" demonstrable without provisioning a database.
// It is NOT durable on serverless: the filesystem is per-instance, so a
// production deployment must set DATABASE_URL and use the Postgres store.

const WRITE_DEBOUNCE_MS = 20
const MAX_RUNS = 200
const MAX_JOBS = 50
const LEASE_MS = 120_000

function now() {
  return new Date().toISOString()
}

// A null-prototype map, so a stored key like "constructor" is an ordinary
// missing key rather than something inherited from Object.
function emptyMap() {
  return Object.create(null)
}

function toMap(value) {
  const map = emptyMap()
  if (!value || typeof value !== 'object') return map
  for (const [key, entry] of Object.entries(value)) map[key] = entry
  return map
}

export function createFileStore({ dir, filename = 'store.json' } = {}) {
  const directory = dir ?? path.join(process.cwd(), '.data')
  const file = path.join(directory, filename)

  let state = { runs: emptyMap(), jobs: emptyMap(), ownership: emptyMap(), settings: emptyMap() }
  let loaded = false
  let version = 0
  let writtenVersion = 0
  let writePromise = null
  let writeTimer = null
  let lastWriteFailed = false

  async function load() {
    if (loaded) return
    loaded = true

    let raw
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      await fs.mkdir(directory, { recursive: true })
      return
    }

    try {
      const parsed = JSON.parse(raw)
      state = {
        runs: toMap(parsed.runs),
        jobs: toMap(parsed.jobs),
        ownership: toMap(parsed.ownership),
        settings: toMap(parsed.settings),
      }
    } catch {
      // A corrupt store must not be silently replaced by an empty one: that
      // would throw away every run the product has. Keep the damaged file and
      // start a new one.
      const backup = `${file}.corrupt-${Date.now()}`
      await fs.rename(file, backup).catch(() => null)
      console.error(`[store] the store file was unreadable and was kept as ${backup}`)
    }
  }

  function markDirty() {
    version += 1
  }

  async function writeSnapshot(snapshot) {
    const temporary = `${file}.${process.pid}.tmp`
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(temporary, snapshot)
    try {
      await fs.rename(temporary, file)
    } catch {
      await fs.writeFile(file, snapshot)
    }
  }

  // Writes are coalesced: a run produces a burst of events, and rewriting the
  // whole file for each one makes the cost quadratic. Callers still await a
  // promise that resolves once their change is on disk.
  function persist() {
    if (writePromise) return writePromise

    writePromise = new Promise((resolve, reject) => {
      writeTimer = setTimeout(() => {
        const target = version
        const snapshot = JSON.stringify(state)

        writeSnapshot(snapshot)
          .then(() => {
            writtenVersion = Math.max(writtenVersion, target)
            lastWriteFailed = false
            resolve()
          })
          .catch((error) => {
            lastWriteFailed = true
            reject(error)
          })
          .finally(() => {
            writeTimer = null
            writePromise = null
            if (!lastWriteFailed && version > writtenVersion) {
              persist().catch(() => null)
            }
          })
      }, WRITE_DEBOUNCE_MS)
    })

    return writePromise
  }

  function prune() {
    const runs = Object.values(state.runs)
    if (runs.length > MAX_RUNS) {
      const ordered = runs.sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt)),
      )
      for (const run of ordered.slice(0, runs.length - MAX_RUNS)) {
        if (run.status === 'running' || run.status === 'queued') continue
        delete state.runs[run.id]
      }
    }

    const jobs = Object.values(state.jobs)
    if (jobs.length > MAX_JOBS) {
      const ordered = jobs.sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt)),
      )
      for (const job of ordered.slice(0, jobs.length - MAX_JOBS)) {
        if (job.status === 'running') continue
        delete state.jobs[job.id]
      }
    }
  }

  return {
    kind: 'file',
    durable: true,
    file,

    async init() {
      await load()
      return this
    },

    async createRun(run) {
      await load()
      state.runs[run.id] = structuredClone(run)
      markDirty()
      prune()
      await persist()
      return run
    },

    async getRun(id) {
      await load()
      if (!Object.hasOwn(state.runs, id)) return null
      const run = state.runs[id]
      return run ? structuredClone(run) : null
    },

    async updateRun(id, patch) {
      await load()
      if (!Object.hasOwn(state.runs, id)) return null
      const run = state.runs[id]
      const updated = { ...run, ...patch, updatedAt: now() }
      state.runs[id] = updated
      markDirty()
      await persist()
      return structuredClone(updated)
    },

    async appendEvent(id, event) {
      await load()
      if (!Object.hasOwn(state.runs, id)) return null
      const run = state.runs[id]
      run.events = run.events ?? []
      run.events.push(event)
      if (run.events.length > 400) {
        run.events.splice(0, run.events.length - 400)
      }
      run.updatedAt = now()
      markDirty()
      await persist()
      return structuredClone(run)
    },

    async listRuns({ sessionHash, limit = 50 } = {}) {
      await load()
      return Object.values(state.runs)
        .filter((run) => (run.sessionHash ?? null) === (sessionHash ?? null))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
        .map((run) => structuredClone(run))
    },

    async findRuns({ status, olderThan, limit = 100 } = {}) {
      await load()
      const cutoff = olderThan ? Date.parse(olderThan) : null

      return Object.values(state.runs)
        .filter((run) => {
          if (status && run.status !== status) return false
          if (cutoff && Date.parse(run.updatedAt) > cutoff) return false
          return true
        })
        .slice(0, limit)
        .map((run) => structuredClone(run))
    },

    async createJob(job) {
      await load()
      state.jobs[job.id] = structuredClone(job)
      markDirty()
      prune()
      await persist()
      return job
    },

    // A job carries a lease. A worker that dies leaves a lease that expires,
    // and the next claim takes the job back instead of stranding it.
    async claimJob() {
      await load()
      const moment = Date.now()

      const job = Object.values(state.jobs)
        .filter(
          (entry) =>
            entry.status === 'queued' ||
            (entry.status === 'running' &&
              entry.leaseUntil &&
              Date.parse(entry.leaseUntil) < moment),
        )
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]

      if (!job) return null

      const claimed = {
        ...job,
        status: 'running',
        attempts: (job.attempts ?? 0) + 1,
        startedAt: now(),
        leaseUntil: new Date(moment + LEASE_MS).toISOString(),
      }
      state.jobs[job.id] = claimed
      markDirty()
      await persist()
      return structuredClone(claimed)
    },

    async finishJob(id, patch) {
      await load()
      if (!Object.hasOwn(state.jobs, id)) return null
      const job = state.jobs[id]
      const updated = { ...job, ...patch, leaseUntil: null, finishedAt: now() }
      state.jobs[id] = updated
      markDirty()
      await persist()
      return structuredClone(updated)
    },

    async listJobs({ status, limit = 50 } = {}) {
      await load()
      return Object.values(state.jobs)
        .filter((job) => !status || job.status === status)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
        .map((job) => structuredClone(job))
    },

    async setOwnership(key, value) {
      await load()
      state.ownership[key] = structuredClone(value)
      markDirty()
      await persist()
      return value
    },

    async getOwnership(key) {
      await load()
      if (!Object.hasOwn(state.ownership, key)) return null
      const record = state.ownership[key]
      return record ? structuredClone(record) : null
    },

    async setSetting(key, value) {
      await load()
      state.settings[key] = structuredClone(value)
      markDirty()
      await persist()
      return value
    },

    async getSetting(key) {
      await load()
      if (!Object.hasOwn(state.settings, key)) return null
      const value = state.settings[key]
      return value === undefined ? null : structuredClone(value)
    },
  }
}
