// Client helpers for the persisted agent run endpoints. The server owns run
// storage; this module only talks to it and normalises failures so pages can
// branch on a stable error code.

const RUNS_ENDPOINT = '/api/agent/runs'

// Presentation constants shared by the run index and the run report so a
// severity reads the same in both places.
export const SEVERITY_TONE = {
  high: 'border-red-400/40 text-red-300',
  medium: 'border-amber-300/40 text-amber-300',
  info: 'border-signal/40 text-signal',
}

export const SEVERITY_LABEL = { high: 'High', medium: 'Medium', info: 'Info' }

export const STATUS_TONE = {
  queued: 'border-rule text-ink-soft',
  running: 'border-signal/40 text-signal',
  completed: 'border-emerald-400/30 text-emerald-300',
  failed: 'border-red-400/40 text-red-300',
}

export const STATUS_LABEL = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
}

function failure(message, code, status) {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

function abortError() {
  const error = new Error('The run poll was cancelled.')
  error.name = 'AbortError'
  error.code = 'aborted'
  return error
}

async function request(url, signal) {
  let response

  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal,
    })
  } catch (error) {
    // An abort is a caller decision, so it is passed through untouched.
    if (error?.name === 'AbortError') throw error
    throw failure('The run service could not be reached.', 'network_error', 0)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.ok) {
    throw failure(
      payload?.error ?? 'The run service returned an unexpected response.',
      payload?.code ?? 'request_failed',
      response.status,
    )
  }

  return payload
}

export async function fetchRun(id, { signal } = {}) {
  const url = `${RUNS_ENDPOINT}?id=${encodeURIComponent(id)}`
  const payload = await request(url, signal)

  if (!payload.run) {
    throw failure('That run does not exist.', 'not_found', 404)
  }

  return payload.run
}

export async function fetchRuns({ signal } = {}) {
  const payload = await request(RUNS_ENDPOINT, signal)
  return Array.isArray(payload.runs) ? payload.runs : []
}

export function runPath(id) {
  return `/reports/agent/${encodeURIComponent(id)}`
}

export function pollRun(
  id,
  { onUpdate, intervalMs = 1500, timeoutMs = 120000, signal } = {},
) {
  const controller = new AbortController()
  let timer = null
  let settled = false

  return new Promise((resolve, reject) => {
    function settle(handler, value) {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.clearTimeout(deadline)
      handler(value)
    }

    const deadline = window.setTimeout(() => {
      // The in-flight request is aborted so the browser is not left holding an
      // open connection after the caller has given up waiting.
      controller.abort()
      settle(reject, failure('The run did not finish in time.', 'timeout', 408))
    }, timeoutMs)

    if (signal) {
      if (signal.aborted) {
        controller.abort()
        settle(reject, abortError())
        return
      }
      signal.addEventListener(
        'abort',
        () => {
          controller.abort()
          settle(reject, abortError())
        },
        { once: true },
      )
    }

    async function tick() {
      try {
        const run = await fetchRun(id, { signal: controller.signal })
        onUpdate?.(run)

        if (run.status === 'completed' || run.status === 'failed') {
          settle(resolve, run)
          return
        }

        timer = window.setTimeout(tick, intervalMs)
      } catch (error) {
        if (controller.signal.aborted) {
          settle(reject, abortError())
          return
        }
        settle(reject, error)
      }
    }

    tick()
  })
}
