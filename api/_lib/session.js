import {
  getSessionId as readSessionId,
  initSessionSecret,
  setSessionCookie as writeSessionCookie,
} from './auth.js'

// The session secret is resolved once per process, so every call waits for it.
// Without that, a challenge signed before the secret was ready would not
// verify afterwards.

export async function getSessionId(request) {
  await initSessionSecret()
  return readSessionId(request)
}

export async function setSessionCookie(response, sessionId) {
  if (!sessionId) return
  await initSessionSecret()
  writeSessionCookie(response, sessionId)
}
