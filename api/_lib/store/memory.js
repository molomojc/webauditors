// In-process store. Used by tests and by any deployment that wants runs to
// stay ephemeral. Everything lives in memory, so a restart loses the history.

function now() {
  return new Date().toISOString()
}

export function createMemoryStore() {
  const runs = new Map()
  const jobs = new Map()
  const ownership = new Map()

  return {
    kind: 'memory',
    durable: false,

    async init() {
      return this
    },

    async setOwnership(key, value) {
      ownership.set(key, structuredClone(value))
      return value
    },

    async getOwnership(key) {
      const record = ownership.get(key)
      return record ? structuredClone(record) : null
    },

    async createRun(run) {
      runs.set(run.id, structuredClone(run))
      return run
    },

    async getRun(id) {
      const run = runs.get(id)
      return run ? structuredClone(run) : null
    },

    async updateRun(id, patch) {
      const run = runs.get(id)
      if (!run) return null
      const updated = {
        ...run,
        ...patch,
        updatedAt: now(),
      }
      runs.set(id, updated)
      return structuredClone(updated)
    },

    async appendEvent(id, event) {
      const run = runs.get(id)
      if (!run) return null
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

    async createJob(job) {
      jobs.set(job.id, structuredClone(job))
      return job
    },

    async claimJob() {
      const job = [...jobs.values()]
        .filter((entry) => entry.status === 'queued')
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]

      if (!job) return null

      const claimed = {
        ...job,
        status: 'running',
        attempts: (job.attempts ?? 0) + 1,
        startedAt: now(),
      }
      jobs.set(job.id, claimed)
      return structuredClone(claimed)
    },

    async finishJob(id, patch) {
      const job = jobs.get(id)
      if (!job) return null
      const updated = { ...job, ...patch, finishedAt: now() }
      jobs.set(id, updated)
      return structuredClone(updated)
    },

    async listJobs({ status, limit = 50 } = {}) {
      const all = [...jobs.values()]
        .filter((job) => !status || job.status === status)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      return structuredClone(all.slice(0, limit))
    },
  }
}
