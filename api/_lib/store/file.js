import fs from 'node:fs/promises'
import path from 'node:path'

// A single JSON file on disk. It survives a dev-server restart, which is what
// makes "the run is still there" demonstrable without provisioning a database.
// It is NOT durable on serverless: the filesystem is per-instance, so a
// production deployment must set DATABASE_URL and use the Postgres store.

function now() {
  return new Date().toISOString()
}

export function createFileStore({ dir, filename = 'store.json' } = {}) {
  const directory = dir ?? path.join(process.cwd(), '.data')
  const file = path.join(directory, filename)

  let state = { runs: {}, jobs: {}, ownership: {} }
  let loaded = false
  let writes = Promise.resolve()

  async function load() {
    if (loaded) return
    loaded = true

    try {
      const raw = await fs.readFile(file, 'utf8')
      const parsed = JSON.parse(raw)
      state = {
        runs: parsed.runs ?? {},
        jobs: parsed.jobs ?? {},
        ownership: parsed.ownership ?? {},
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      await fs.mkdir(directory, { recursive: true })
    }
  }

  // Writes are chained so two concurrent runs cannot interleave and truncate
  // the file. The temporary file plus rename keeps a crash from leaving a
  // half-written store behind.
  function persist() {
    writes = writes
      .then(async () => {
        const snapshot = JSON.stringify(state)
        const temporary = `${file}.tmp`
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(temporary, snapshot)
        try {
          await fs.rename(temporary, file)
        } catch {
          await fs.writeFile(file, snapshot)
        }
      })
      .catch((error) => {
        console.error('[store] write failed:', error?.message ?? error)
      })

    return writes
  }

  return {
    kind: 'file',
    durable: true,
    file,

    async init() {
      await load()
      return this
    },

    async setOwnership(key, value) {
      await load()
      state.ownership[key] = structuredClone(value)
      await persist()
      return value
    },

    async getOwnership(key) {
      await load()
      const record = state.ownership[key]
      return record ? structuredClone(record) : null
    },

    async createRun(run) {
      await load()
      state.runs[run.id] = structuredClone(run)
      await persist()
      return run
    },

    async getRun(id) {
      await load()
      const run = state.runs[id]
      return run ? structuredClone(run) : null
    },

    async updateRun(id, patch) {
      await load()
      const run = state.runs[id]
      if (!run) return null
      const updated = { ...run, ...patch, updatedAt: now() }
      state.runs[id] = updated
      await persist()
      return structuredClone(updated)
    },

    async appendEvent(id, event) {
      await load()
      const run = state.runs[id]
      if (!run) return null
      run.events = run.events ?? []
      run.events.push(event)
      if (run.events.length > 400) {
        run.events.splice(0, run.events.length - 400)
      }
      run.updatedAt = now()
      await persist()
      return structuredClone(run)
    },

    async listRuns({ sessionHash, limit = 50 } = {}) {
      await load()
      return Object.values(state.runs)
        .filter(
          (run) =>
            (run.sessionHash ?? null) === (sessionHash ?? null),
        )
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
        .map((run) => structuredClone(run))
    },

    async createJob(job) {
      await load()
      state.jobs[job.id] = structuredClone(job)
      await persist()
      return job
    },

    async claimJob() {
      await load()
      const job = Object.values(state.jobs)
        .filter((entry) => entry.status === 'queued')
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]

      if (!job) return null

      const claimed = {
        ...job,
        status: 'running',
        attempts: (job.attempts ?? 0) + 1,
        startedAt: now(),
      }
      state.jobs[job.id] = claimed
      await persist()
      return structuredClone(claimed)
    },

    async finishJob(id, patch) {
      await load()
      const job = state.jobs[id]
      if (!job) return null
      const updated = { ...job, ...patch, finishedAt: now() }
      state.jobs[id] = updated
      await persist()
      return structuredClone(updated)
    },

    async listJobs({ status, limit = 50 } = {}) {
      await load()
      return Object.values(state.jobs)
        .filter((job) => !status || job.status === status)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
        .slice(0, limit)
        .map((job) => structuredClone(job))
    },
  }
}
