import { runAgentScan } from '../_lib/agent/run.js'
import {
  appendEvent,
  claimJob,
  completeRun,
  failRun,
  finishJob,
  getRun,
  updateRun,
} from '../_lib/runs.js'

// The queue worker. A run created with `{ "async": true }` sits in the store
// until something calls this endpoint, which claims one queued job, executes the
// agent and writes the transcript and findings back to the run.
//
// It is deliberately a pull model: a platform cron, a deploy hook or a browser
// poll can all call it, and the store decides what is next. A push queue (SQS,
// QStash) can replace it later without touching the run API.

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')

  if (request.method !== 'POST' && request.method !== 'GET') {
    response.statusCode = 405
    response.setHeader('allow', 'GET, POST')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: 'method_not_allowed',
        error: 'Use GET or POST.',
      }),
    )
    return
  }

  let job
  try {
    job = await claimJob()
  } catch (error) {
    console.error('[agent] queue unavailable:', error?.message ?? error)
    response.statusCode = 500
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: 'queue_unavailable',
        error: 'The run queue could not be reached.',
      }),
    )
    return
  }

  if (!job) {
    response.statusCode = 200
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ ok: true, processed: 0, message: 'Nothing queued.' }))
    return
  }

  const run = await getRun(job.runId)

  if (!run) {
    await finishJob(job.id, { status: 'failed' })
    response.statusCode = 200
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({ ok: true, processed: 0, message: 'The queued run is gone.' }),
    )
    return
  }

  await updateRun(run.id, { status: 'running' })

  // Events are written through a chain so the store sees them in order, and the
  // chain is awaited before the run is closed.
  let writes = Promise.resolve()
  const emit = (event) => {
    writes = writes.then(() => appendEvent(run.id, event))
  }

  try {
    const result = await runAgentScan({ url: new URL(run.target), emit })

    await writes
    await completeRun(run.id, {
      summary: result.summary,
      findings: result.findings,
      usage: result.usage,
      steps: result.steps,
    })
    await finishJob(job.id, { status: 'done' })

    response.statusCode = 200
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: true,
        processed: 1,
        runId: run.id,
        findings: result.findings.length,
      }),
    )
  } catch (error) {
    await writes
    await failRun(run.id, {
      code: error?.code ?? 'agent_failed',
      message: error?.message ?? 'The agent run failed.',
    })
    await finishJob(job.id, { status: 'failed' })

    console.error(
      '[agent] queued run failed',
      error?.code ?? 'no_code',
      error?.message ?? error,
    )

    response.statusCode = 200
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({ ok: true, processed: 1, runId: run.id, failed: true }),
    )
  }
}
