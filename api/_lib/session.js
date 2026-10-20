// Bridges to the signed-session helpers in api/_lib/auth.js.
//
// The agent runtime must keep working even when the session module is absent
// (a deployment that has not enabled sessions yet), so every caller goes
// through here instead of importing auth.js directly.

export async function getSessionId(request) {
  try {
    const auth = await import('./auth.js')
    if (typeof auth.getSessionId === 'function') {
      return auth.getSessionId(request)
    }
  } catch {
    // No session module: runs are stored without an owner.
  }
  return null
}

export async function setSessionCookie(response, sessionId) {
  if (!sessionId) return
  try {
    const auth = await import('./auth.js')
    if (typeof auth.setSessionCookie === 'function') {
      auth.setSessionCookie(response, sessionId)
    }
  } catch {
    // Nothing to set.
  }
}
