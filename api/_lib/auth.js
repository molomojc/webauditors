import crypto from 'node:crypto'
import { getStore } from './store/index.js'

// An anonymous session, not an account. There is no sign-up, no password and
// no email address: the cookie only ties a browser to the records it created.
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// In production the cookie is prefixed, which the browser only accepts with
// Secure, Path=/ and no Domain attribute.
export const SESSION_COOKIE = IS_PRODUCTION ? '__Host-wa_sid' : 'wa_sid'

// 180 days.
const SESSION_MAX_AGE = 15552000
const SESSION_SETTING_KEY = 'session_secret'

// Without SESSION_SECRET the secret is generated once and kept in the store,
// so every instance of a deployment shares it. If the store is not shared
// (the file store on serverless) the fallback below is used instead, and the
// session is only valid on the instance that issued it.
const FALLBACK_SECRET = crypto.randomBytes(32).toString('hex')
let storedSecret = null
let initPromise = null

// A session id is only ever meaningful if we minted it, so the shape is
// checked after the signature passes.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

// Called once per process. It resolves the signing secret, which is either
// configured, or generated and persisted so that a challenge issued by one
// instance can be checked by another.
export async function initSessionSecret() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET

    try {
      const store = await getStore()
      const existing = await store.getSetting(SESSION_SETTING_KEY)

      if (existing) {
        storedSecret = existing
        return storedSecret
      }

      const generated = crypto.randomBytes(32).toString('hex')
      await store.setSetting(SESSION_SETTING_KEY, generated)
      storedSecret = generated
      return generated
    } catch {
      if (IS_PRODUCTION) {
        console.error(
          '[auth] SESSION_SECRET is not set and the store is unavailable, so sessions do not survive a restart',
        )
      }
      return null
    }
  })()

  return initPromise
}

function secret() {
  const configured = process.env.SESSION_SECRET
  if (configured && configured.length > 0) return configured
  if (storedSecret) return storedSecret
  return FALLBACK_SECRET
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

// The cookie carries its own expiry, so a captured cookie stops working even
// if the browser keeps sending it. The payload is `<id>.<expiry>` and the
// signature is appended to it.
function sessionPayload(sessionId) {
  const expiry = Date.now() + SESSION_MAX_AGE * 1000
  return `${sessionId}.${expiry}`
}

function readSessionPayload(payload) {
  if (typeof payload !== 'string') return null
  const separator = payload.indexOf('.')
  if (separator <= 0) return null

  const id = payload.slice(0, separator)
  const expiry = Number(payload.slice(separator + 1))
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null
  if (!SESSION_ID_PATTERN.test(id)) return null

  return id
}

// Returns the session id carried by a valid cookie, or a fresh one. It never
// writes to the response: the caller decides whether to persist the id.
export function getSessionId(request) {
  const headers = request?.headers ?? {}
  const header = headers.cookie ?? headers.Cookie ?? null
  const raw = readCookie(header, SESSION_COOKIE)

  if (raw) {
    const verified = verifySignedValue(raw)
    const id = readSessionPayload(verified)
    if (id) return id
  }

  return crypto.randomBytes(24).toString('hex')
}

export function setSessionCookie(response, sessionId) {
  const parts = [
    `${SESSION_COOKIE}=${signValue(sessionPayload(sessionId))}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]

  // Only mark the cookie Secure in production; a local http origin would
  // otherwise drop it entirely. The __Host- prefix requires it.
  if (IS_PRODUCTION) parts.push('Secure')

  response.setHeader('set-cookie', parts.join('; '))
}
