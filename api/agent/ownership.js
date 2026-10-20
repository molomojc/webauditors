import { getSessionId, setSessionCookie } from '../_lib/session.js'
import { createChallenge, verifyChallenge } from '../_lib/ownership.js'
import { normaliseTarget, ScanError } from '../_lib/guard.js'
import { readJsonBody } from '../_lib/http.js'
import { recordOwnership } from '../_lib/runs.js'

function send(response, status, payload) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store')

  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST')
    send(response, 405, {
      ok: false,
      code: 'method_not_allowed',
      error: 'Use POST.',
    })
    return
  }

  let payload
  try {
    payload = await readJsonBody(request)
  } catch (error) {
    send(response, error instanceof ScanError ? error.status : 400, {
      ok: false,
      code: error?.code ?? 'invalid_body',
      error: error?.message ?? 'Send a JSON body.',
    })
    return
  }

  const action = payload?.action
  if (action !== 'create' && action !== 'verify') {
    send(response, 400, {
      ok: false,
      code: 'invalid_action',
      error: 'Use action "create" or action "verify".',
    })
    return
  }

  let target
  try {
    target = normaliseTarget(payload?.url)
  } catch (error) {
    send(response, 400, {
      ok: false,
      code: error?.code ?? 'invalid_url',
      error: error?.message ?? 'Enter a valid URL.',
    })
    return
  }

  // The session is anonymous, but it still has to survive between the create
  // and the verify call, so the cookie is set on both.
  const sessionId = await getSessionId(request)
  await setSessionCookie(response, sessionId)

  if (action === 'create') {
    const challenge = createChallenge({ sessionId, target: target.origin })
    send(response, 200, { ok: true, ...challenge })
    return
  }

  const token = typeof payload?.token === 'string' ? payload.token.trim() : ''
  if (!token) {
    send(response, 400, {
      ok: false,
      code: 'missing_token',
      error: 'Send the verification token.',
    })
    return
  }

  const result = await verifyChallenge({
    token,
    sessionId,
    target: target.origin,
  })

  // A verified domain is remembered for this session, so the next scan of the
  // same site does not ask for the proof again.
  if (result.verified) {
    await recordOwnership({
      sessionId,
      target: target.origin,
      method: result.method,
    })
  }

  send(response, 200, {
    ok: true,
    verified: result.verified,
    method: result.method,
    detail: result.detail,
  })
}
