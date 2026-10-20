import { getRun, hashSessionId, listRuns, summariseRun } from '../_lib/runs.js'
import { getSessionId } from '../_lib/session.js'

// Read-only access to persisted agent runs. A run belongs to the session that
// created it; a run id on its own is not a key, so a mismatch is reported as
// "not found" rather than "forbidden" and the id is never confirmed to exist.

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')

  if (request.method !== 'GET') {
    response.statusCode = 405
    response.setHeader('allow', 'GET')
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: 'method_not_allowed',
        error: 'Use GET.',
      }),
    )
    return
  }

  try {
    const sessionId = await getSessionId(request)
    const url = new URL(request.url, 'http://localhost')
    const id = url.searchParams.get('id')

    if (id) {
      const run = await getRun(id)
      const sessionHash = hashSessionId(sessionId)

      if (!run || (run.sessionHash ?? null) !== (sessionHash ?? null)) {
        response.statusCode = 404
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(
          JSON.stringify({
            ok: false,
            code: 'not_found',
            error: 'That run does not exist in this session.',
          }),
        )
        return
      }

      const { sessionHash: _sessionHash, ...rest } = run

      response.statusCode = 200
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(
        JSON.stringify({
          ok: true,
          run: {
            ...rest,
            owner: {
              verified: run.ownership?.verified ?? false,
              method: run.ownership?.method ?? null,
              verifiedAt: run.ownership?.verifiedAt ?? null,
            },
          },
        }),
      )
      return
    }

    const runs = await listRuns({ sessionId })
    response.statusCode = 200
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({ ok: true, runs: runs.map(summariseRun) }),
    )
  } catch (error) {
    console.error('[agent] run store unavailable:', error?.message ?? error)
    response.statusCode = 500
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(
      JSON.stringify({
        ok: false,
        code: 'runs_unavailable',
        error: 'The run store could not be reached.',
      }),
    )
  }
}
