// In-process store. Used by tests and by any deployment that wants runs to
// stay ephemeral. Everything lives in memory, so a restart loses the history.

const MAX_RUNS = 200
const MAX_JOBS = 50
const LEASE_MS = 120_000

function now() {
  return new Date().toISOString()
}

export function createMemoryStore() {
  const runs = new Map()
  const jobs = new Map()
  const ownership = new Map()
  const settings = new Map()

  function prune() {
    if (runs.size <= MAX_RUNS) return

    const ordered = [...runs.values()].sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt)),
    )

    for (const run of ordered.slice(0, runs.size - MAX_RUNS)) {
      if (run.status === 'running' || run.status === 'queued') continue
      runs.delete(run.id)
    }
  }

  function pruneJobs() {
    if (jobs.size <= MAX_JOBS) return

    const ordered = [...jobs.values()].sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt)),
    )

    for (const job of ordered.slice(0, jobs.size - MAX_JOBS)) {
      if (job.status === 'running') continue
      jobs.delete(job.id)
    }
  }

  return {
    kind: 'memory',
    durable: false,

    async init() {
      return this
    },

    async createRun(run) {
      runs.set(run.id, structuredClone(run))
      prune()
      return run
    },

    async getRun(id) {
      const run = runs.get(id)
      return run ? structuredClone(run) : null
    },

    async updateRun(id, patch) {
      const run = runs.get(id)
      if (!run) return null
      const updated = { ...run, ...patch, updatedAt: now() }
      runs.set(id, updated)
      return structuredClone(updated)
    },

    async appendEvent(id, event) {
      const run = runs.get(id)
      if (!run) return null
      run.events = run.events ?? []
      run.events.push(event)
      if (run.events.length > 400) run.events.splice(0, run.events.length - 400)
      run.updatedAt = now()
      return structuredClone(run)
    },

    async listRuns({ sessionHash, limit = 50 } = {}) {
      const all = [...runs.values()]
        .filter((run) => (run.sessionHash ?? null) === (sessionHash ?? null))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      return structuredClone(all.slice(0, limit))
    },

    async findRuns({ status, olderThan, limit = 100 } = {}) {
      const cutoff = olderThan ? Date.parse(olderThan) : null

      return [...runs.values()]
        .filter((run) => {
          if (status && run.status !== status) return false
          if (cutoff && Date.parse(run.updatedAt) > cutoff) return false
          return true
        })
        .slice(0, limit)
        .map((run) => structuredClone(run))
    },

    async createJob(job) {
      jobs.set(job.id, structuredClone(job))
      pruneJobs()
      return job
    },

    async claimJob() {
      const moment = Date.now()

      const job = [...jobs.values()]
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
      jobs.set(job.id, claimed)
      return structuredClone(claimed)
    },

    async finishJob(id, patch) {
      const job = jobs.get(id)
      if (!job) return null
      const updated = { ...job, ...patch, leaseUntil: null, finishedAt: now() }
      jobs.set(id, updated)
      return structuredClone(updated)
    },

    async listJobs({ status, limit = 50 } = {}) {
      const all = [...jobs.values()]
        .filter((job) => !status || job.status === status)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      return structuredClone(all.slice(0, limit))
    },

    async setOwnership(key, value) {
      ownership.set(key, structuredClone(value))
      return value
    },

    async getOwnership(key) {
      const record = ownership.get(key)
      return record ? structuredClone(record) : null
    },

    async setSetting(key, value) {
      settings.set(key, structuredClone(value))
      return value
    },

    async getSetting(key) {
      const value = settings.get(key)
      return value === undefined ? null : structuredClone(value)
    },
  }
}
