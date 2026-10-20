// Postgres-backed store. It mirrors the file store exactly, so the rest of the
// app never needs to know which one it is talking to.
//
// `pg` is not a dependency of this project: there is no database to test
// against here, and shipping an untested driver would be worse than failing
// loudly. Set DATABASE_URL and run `npm install pg` to enable it, then apply
// api/_lib/store/schema.sql.

function now() {
  return new Date().toISOString()
}

export async function createPostgresClient(options = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for the Postgres store. Set it, or unset STORE to use the file store.',
    )
  }

  let Pool
  try {
    ;({ Pool } = await import('pg'))
  } catch {
    throw new Error(
      'The Postgres store needs the "pg" package. Run `npm install pg` and set DATABASE_URL.',
    )
  }

  const pool = new Pool({
    connectionString,
    ssl: options.ssl ?? { rejectUnauthorized: false },
  })

  const query = (text, values) => pool.query(text, values)

  return {
    kind: 'postgres',
    durable: true,

    async init() {
      await query('select 1')
      return this
    },

    async setOwnership(key, value) {
      await query(
        `insert into agent_ownership (key, value, updated_at)
         values ($1, $2, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [key, JSON.stringify(value)],
      )
      return value
    },

    async getOwnership(key) {
      const result = await query(
        'select value from agent_ownership where key = $1',
        [key],
      )
      return result.rows[0] ? result.rows[0].value : null
    },

    async createRun(run) {
      await query(
        `insert into agent_runs (id, session_hash, target, status, created_at, updated_at, completed_at, payload)
         values ($1, $2, $3, $4, $5, $5, $6, $7)
         on conflict (id) do update set payload = excluded.payload, updated_at = excluded.updated_at`,
        [
          run.id,
          run.sessionHash ?? null,
          run.target,
          run.status,
          run.createdAt,
          run.completedAt ?? null,
          JSON.stringify(run),
        ],
      )
      return run
    },

    async getRun(id) {
      const result = await query('select payload from agent_runs where id = $1', [id])
      return result.rows[0] ? result.rows[0].payload : null
    },

    async updateRun(id, patch) {
      const current = await this.getRun(id)
      if (!current) return null

      const updated = { ...current, ...patch, updatedAt: now() }
      await query(
        `update agent_runs
            set payload = $2, status = $3, updated_at = $4, completed_at = $5
          where id = $1`,
        [
          id,
          JSON.stringify(updated),
          updated.status,
          updated.updatedAt,
          updated.completedAt ?? null,
        ],
      )
      return updated
    },

    async appendEvent(id, event) {
      const current = await this.getRun(id)
      if (!current) return null

      current.events = current.events ?? []
      current.events.push(event)
      if (current.events.length > 400) {
        current.events.splice(0, current.events.length - 400)
      }
      current.updatedAt = now()

      await query('update agent_runs set payload = $2, updated_at = $3 where id = $1', [
        id,
        JSON.stringify(current),
        current.updatedAt,
      ])
      return current
    },

    async listRuns({ sessionHash, limit = 50 } = {}) {
      const result = await query(
        `select payload from agent_runs
          where session_hash is not distinct from $1
          order by created_at desc
          limit $2`,
        [sessionHash ?? null, limit],
      )

      return result.rows.map((row) => row.payload)
    },

    async createJob(job) {
      await query(
        `insert into agent_jobs (id, run_id, type, status, attempts, created_at, payload)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do nothing`,
        [
          job.id,
          job.runId,
          job.type,
          job.status ?? 'queued',
          job.attempts ?? 0,
          job.createdAt,
          JSON.stringify(job),
        ],
      )
      return job
    },

    async claimJob() {
      const result = await query(
        `update agent_jobs
            set status = 'running',
                attempts = attempts + 1,
                started_at = now()
          where id = (
            select id from agent_jobs
             where status = 'queued'
             order by created_at
             limit 1
             for update skip locked
          )
          returning *`,
      )

      const job = result.rows[0]
      if (!job) return null

      return {
        id: job.id,
        runId: job.run_id,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        createdAt: job.created_at,
        startedAt: job.started_at,
        payload: job.payload,
      }
    },

    async finishJob(id, patch) {
      const result = await query(
        `update agent_jobs
            set status = $2, finished_at = now(), payload = payload || $3::jsonb
          where id = $1
          returning *`,
        [id, patch.status ?? 'done', JSON.stringify(patch.payload ?? {})],
      )

      const job = result.rows[0]
      if (!job) return null

      return {
        id: job.id,
        runId: job.run_id,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        createdAt: job.created_at,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        payload: job.payload,
      }
    },

    async listJobs({ status, limit = 50 } = {}) {
      const result = status
        ? await query(
            'select * from agent_jobs where status = $1 order by created_at desc limit $2',
            [status, limit],
          )
        : await query(
            'select * from agent_jobs order by created_at desc limit $1',
            [limit],
          )

      return result.rows.map((job) => ({
        id: job.id,
        runId: job.run_id,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        createdAt: job.created_at,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        payload: job.payload,
      }))
    },
  }
}
