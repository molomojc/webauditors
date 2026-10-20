import crypto from 'node:crypto'

// An anonymous session, not an account. There is no sign-up, no password and
// no email address: the cookie only ties a browser to the records it created.
export const SESSION_COOKIE = 'wa_sid'

// 180 days.
const SESSION_MAX_AGE = 15552000

// Without SESSION_SECRET the process falls back to a random secret generated
// at load, so a restart (or a second instance) invalidates every cookie
// issued before it. Set SESSION_SECRET in production to keep sessions alive.
const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex')

// A session id is only ever meaningful if we minted it, so the shape is
// checked after the signature passes.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

function secret() {
  const configured = process.env.SESSION_SECRET
  return configured && configured.length > 0 ? configured : FALLBACK_SECRET
}

export function signValue(value) {
  const payload = String(value)
  const signature = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('hex')
  return `${payload}.${signature}`
}

export function verifySignedValue(signed) {
  if (typeof signed !== 'string' || !signed) return null

  // The signature is the final dot-free segment, so a payload that itself
  // contains dots still round-trips.
  const separator = signed.lastIndexOf('.')
  if (separator <= 0 || separator === signed.length - 1) return null

  const payload = signed.slice(0, separator)
  const signature = signed.slice(separator + 1)

  const expected = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('hex')

  const given = Buffer.from(signature, 'utf8')
  const wanted = Buffer.from(expected, 'utf8')
  // timingSafeEqual throws on a length mismatch, so compare lengths first.
  if (given.length !== wanted.length) return null
  if (!crypto.timingSafeEqual(given, wanted)) return null

  return payload
}

// Storage keys are derived from the session id, never the raw id, so a leaked
// key cannot be replayed as a cookie.
export function hashSession(sessionId) {
  return crypto
    .createHash('sha256')
    .update(String(sessionId))
    .digest('hex')
}

function readCookie(header, name) {
  if (typeof header !== 'string' || !header) return null

  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() !== name) continue
    const value = part.slice(index + 1).trim()
    if (value) return value
  }

  return null
}

// Returns the session id carried by a valid cookie, or a fresh one. It never
// writes to the response: the caller decides whether to persist the id.
export function getSessionId(request) {
  const headers = request?.headers ?? {}
  const header = headers.cookie ?? headers.Cookie ?? null
  const raw = readCookie(header, SESSION_COOKIE)

  if (raw) {
    const verified = verifySignedValue(raw)
    if (verified && SESSION_ID_PATTERN.test(verified)) return verified
  }

  return crypto.randomBytes(24).toString('hex')
}

export function setSessionCookie(response, sessionId) {
  const parts = [
    `${SESSION_COOKIE}=${signValue(sessionId)}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]

  // Only mark the cookie Secure in production; a local http origin would
  // otherwise drop it entirely.
  if (process.env.NODE_ENV === 'production') parts.push('Secure')

  response.setHeader('set-cookie', parts.join('; '))
}
