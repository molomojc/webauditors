import crypto from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { fetchWithRedirects } from './collect.js'
import { normaliseTarget, resolvePublicHost } from './guard.js'
import { hashSession, signValue } from './auth.js'

// A site owner proves control of a domain by publishing a token we issued.
// The proof is stateless: the token carries its own signature, so nothing has
// to be stored server-side to check it.
const VERIFICATION_PATH = '/.well-known/webauditors-verification'
const DNS_PREFIX = '_webauditors'
const DEFAULT_TTL_MINUTES = 60
const FILE_TIMEOUT_MS = 5000
const FILE_MAX_BYTES = 8192
const INVALID_TOKEN_DETAIL = 'The verification token is invalid or expired.'

// The session secret is not exported, but signValue exposes the signature it
// produced. Reusing it keeps one secret for the whole application.
function signPayload(payload) {
  const signed = signValue(payload)
  return signed.slice(signed.lastIndexOf('.') + 1)
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''), 'utf8')
  const b = Buffer.from(String(right ?? ''), 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Ownership is a property of a domain, not of a URL, so the canonical form
// is the hostname alone. The origin is kept separately for the file request.
function resolveTarget(target) {
  const url = normaliseTarget(target)
  return {
    hostname: url.hostname.toLowerCase(),
    origin: url.origin,
  }
}

function parseToken(token) {
  if (typeof token !== 'string') return null

  const parts = token.trim().split('.')
  if (parts.length !== 3) return null

  const [nonce, expiry, signature] = parts
  if (!/^[a-f0-9]{32}$/.test(nonce)) return null
  if (!/^\d{1,12}$/.test(expiry)) return null
  if (!/^[a-f0-9]{64}$/.test(signature)) return null

  return { nonce, expiry: Number(expiry), signature }
}

export function createChallenge({
  sessionId,
  target,
  ttlMinutes = DEFAULT_TTL_MINUTES,
  now = Date.now(),
}) {
  const { hostname, origin } = resolveTarget(target)

  const nonce = crypto.randomBytes(16).toString('hex')
  const expiry = Math.floor(now / 1000) + Math.round(ttlMinutes * 60)
  // The origin is signed, not just the hostname, so a token issued for
  // https://example.com cannot be used to authorise http://example.com.
  const signature = signPayload(
    `${nonce}|${expiry}|${hashSession(sessionId)}|${origin}`,
  )
  const token = `${nonce}.${expiry}.${signature}`
  const dnsName = `${DNS_PREFIX}.${hostname}`
  const expiresAt = new Date(expiry * 1000).toISOString()

  return {
    token,
    path: VERIFICATION_PATH,
    dnsName,
    expiresAt,
    instructions:
      `Publish this token in one of two places. ` +
      `File: serve ${VERIFICATION_PATH} on ${origin} with ${token} as plain text. ` +
      `DNS: add a TXT record at ${dnsName} containing ${token}. ` +
      `The token expires at ${expiresAt}.`,
  }
}

// The default file request goes through the same guard as the collector: the
// hostname is resolved and vetted, the port is limited to 80/443, redirects
// may not leave the origin, and the request is cut off after five seconds.
async function guardedFetch(url) {
  await resolvePublicHost(url.hostname)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FILE_TIMEOUT_MS)

  try {
    const { response } = await fetchWithRedirects(url, {
      maxBytes: FILE_MAX_BYTES,
      signal: controller.signal,
      allowedOrigin: url.origin,
    })

    return {
      status: response.statusCode,
      body: response.body,
      contentType: response.contentType,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function defaultDnsLookup(name) {
  return resolveTxt(name)
}

async function readBody(result) {
  if (result == null) return ''
  if (typeof result === 'string') return result
  if (typeof result.body === 'string') return result.body
  if (typeof result.text === 'function') return String(await result.text())
  return ''
}

async function checkFile({ origin, path, token, fetchImpl }) {
  const url = new URL(path, origin)

  let result
  try {
    result = await fetchImpl(url, { timeoutMs: FILE_TIMEOUT_MS })
  } catch {
    return { ok: false, reason: 'unreachable' }
  }

  const status = Number(result?.status)
  if (Number.isFinite(status) && status >= 400) return { ok: false, reason: 'not_found' }

  const body = await readBody(result)
  if (body.trim() === token) return { ok: true, reason: 'matched' }

  // The collector only reads textual bodies, so a file served as binary
  // arrives empty. Say so rather than reporting a plain mismatch.
  const contentType = String(result?.contentType ?? '')
  if (contentType && !/text\/|json|xml|javascript|xhtml/i.test(contentType)) {
    return { ok: false, reason: 'unreadable' }
  }

  return { ok: false, reason: 'not_found' }
}

function flattenTxt(records) {
  if (!Array.isArray(records)) return []
  return records.map((record) => {
    if (Array.isArray(record)) return record.map((part) => String(part)).join('')
    return String(record)
  })
}

async function checkDns({ dnsName, token, dnsImpl }) {
  let records
  try {
    records = await dnsImpl(dnsName)
  } catch {
    return { ok: false, reason: 'no_record' }
  }

  const values = flattenTxt(records)
  if (values.some((value) => value.includes(token))) return { ok: true }
  return { ok: false, reason: 'no_record' }
}

export async function verifyChallenge({
  token,
  sessionId,
  target,
  fetchImpl = guardedFetch,
  dnsImpl = defaultDnsLookup,
  now = Date.now(),
}) {
  const parsed = parseToken(token)
  if (!parsed) {
    return { verified: false, method: null, detail: INVALID_TOKEN_DETAIL }
  }

  let resolved
  try {
    resolved = resolveTarget(target)
  } catch {
    return {
      verified: false,
      method: null,
      detail: 'The target domain could not be read.',
    }
  }

  const expected = signPayload(
    `${parsed.nonce}|${parsed.expiry}|${hashSession(sessionId)}|${resolved.origin}`,
  )

  // A tampered token is rejected before any request leaves the server.
  if (!safeEqual(parsed.signature, expected)) {
    return { verified: false, method: null, detail: INVALID_TOKEN_DETAIL }
  }

  if (parsed.expiry * 1000 < now) {
    return { verified: false, method: null, detail: INVALID_TOKEN_DETAIL }
  }

  const file = await checkFile({
    origin: resolved.origin,
    path: VERIFICATION_PATH,
    token,
    fetchImpl,
  })

  if (file.ok) {
    return {
      verified: true,
      method: 'file',
      detail: 'The verification file was found on the site.',
    }
  }

  const dns = await checkDns({ dnsName: `${DNS_PREFIX}.${resolved.hostname}`, token, dnsImpl })

  if (dns.ok) {
    return {
      verified: true,
      method: 'dns',
      detail: 'The verification record was found in DNS.',
    }
  }

  if (file.reason === 'unreadable') {
    return {
      verified: false,
      method: null,
      detail:
        'The verification file was found but was not served as readable text. Publish it as text/plain.',
    }
  }

  if (file.reason === 'unreachable') {
    return {
      verified: false,
      method: null,
      detail:
        'The verification file could not be reached. Check the site answers, or publish the token in DNS instead.',
    }
  }

  return {
    verified: false,
    method: null,
    detail: 'No verification file or DNS record matched this token yet.',
  }
}
