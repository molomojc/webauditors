import { AgentError, isAgentConfigured } from '../_lib/agent/provider.js'
import { runAgentScan } from '../_lib/agent/run.js'
import {
  normaliseTarget,
  resolvePublicHost,
  ScanError,
} from '../_lib/guard.js'
import { readJsonBody } from '../_lib/http.js'

// A per-instance ceiling. Serverless gives each instance its own counter, so
// this is not a global rate limit — it stops one instance being pinned by a
// burst until auth and a shared limiter exist.
const MAX_CONCURRENT = 2
let activeRuns = 0

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')

  if (request.method !== 'POST') {
    response.statusCode = 405
    response.setHeader('allow', 'POST')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({ ok: false, code: 'method_not_allowed', error: 'Use POST.' }),
    )
    return
  }

  // Requiring JSON forces a CORS preflight for cross-origin callers, so a
  // hostile page cannot spend credits with a simple form or text/plain POST.
  const contentType = String(request.headers['content-type'] ?? '')
  if (!contentType.toLowerCase().includes('application/json')) {
    response.statusCode = 415
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: 'unsupported_media_type',
        error: 'Send application/json.',
      }),
    )
    return
  }

  let target
  try {
    const payload = await readJsonBody(request)
    target = normaliseTarget(payload?.url)
    // Resolve before streaming: a blocked or dead host should be a plain JSON
    // error, not a 200 NDJSON stream that fails after an LLM turn is billed.
    await resolvePublicHost(target.hostname)
  } catch (error) {
    response.statusCode = error instanceof ScanError ? error.status : 400
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: error?.code ?? 'invalid_request',
        error: error?.message ?? 'Invalid request.',
      }),
    )
    return
  }

  if (!isAgentConfigured()) {
    response.statusCode = 503
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: 'agent_not_configured',
        error:
          'The agent is not configured. Set LLM_API_KEY and LLM_MODEL in the environment.',
      }),
    )
    return
  }

  if (activeRuns >= MAX_CONCURRENT) {
    response.statusCode = 429
    response.setHeader('retry-after', '5')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: 'agent_busy',
        error: 'The agent is already running the maximum number of scans.',
      }),
    )
    return
  }

  activeRuns += 1

  response.statusCode = 200
  response.setHeader('content-type', 'application/x-ndjson; charset=utf-8')
  response.setHeader('x-accel-buffering', 'no')
  response.flushHeaders?.()

  let closed = false
  const emit = (event) => {
    if (closed || response.writableEnded) return
    response.write(`${JSON.stringify(event)}\n`)
  }

  const controller = new AbortController()
  response.on('close', () => {
    if (!response.writableEnded) {
      closed = true
      controller.abort()
    }
  })

  try {
    const result = await runAgentScan({
      url: target,
      emit,
      signal: controller.signal,
    })
    emit({
      event: 'agent.completed',
      ...result,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (!(error instanceof AgentError)) {
      console.error(
        '[agent] run failed',
        error?.name ?? 'Error',
        error?.code ?? 'no_code',
      )
    }
    emit({
      event: 'agent.failed',
      code: error?.code ?? 'agent_failed',
      status: error instanceof AgentError ? error.status : 502,
      error:
        error instanceof AgentError
          ? error.message
          : 'The agent run failed.',
    })
  } finally {
    activeRuns = Math.max(0, activeRuns - 1)
    closed = true
    if (!response.writableEnded) response.end()
  }
}
