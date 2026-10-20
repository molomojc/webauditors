import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {
  SESSION_COOKIE,
  getSessionId,
  hashSession,
  setSessionCookie,
  signValue,
  verifySignedValue,
} from '../api/_lib/auth.js'
import { createChallenge, verifyChallenge } from '../api/_lib/ownership.js'

let passed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.error(`  FAIL  ${name}`)
    throw error
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.error(`  FAIL  ${name}`)
    throw error
  }
}

function fakeResponse() {
  const headers = new Map()
  return {
    headers,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value)
    },
    end() {},
  }
}

function cookieHeaderFor(sessionId) {
  const response = fakeResponse()
  setSessionCookie(response, sessionId)
  return String(response.headers.get('set-cookie')).split(';')[0]
}

// Records every call so a test can prove the network was never touched.
function recordingFetch(body) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(String(url))
    return { status: 200, body }
  }
  return { calls, fetchImpl }
}

const TARGET = 'https://example.com'
const sessionId = crypto.randomBytes(24).toString('hex')
const otherSessionId = crypto.randomBytes(24).toString('hex')

function verifyWith(token, overrides = {}) {
  const { session = sessionId, target = TARGET, fetchImpl, dnsImpl } = overrides
  return verifyChallenge({ token, sessionId: session, target, fetchImpl, dnsImpl })
}

console.log('auth: signed values')

test('signs and verifies a value', () => {
  assert.equal(verifySignedValue(signValue('a-session-id')), 'a-session-id')
})

test('rejects a tampered signature', () => {
  const signed = signValue('a-session-id')
  const tampered = `${signed.slice(0, -1)}${signed.slice(-1) === 'a' ? 'b' : 'a'}`
  assert.equal(verifySignedValue(tampered), null)
})

test('rejects a tampered payload', () => {
  const signed = signValue('a-session-id')
  assert.equal(verifySignedValue(signed.replace('a-session', 'b-session')), null)
})

test('rejects a value signed with a different secret', () => {
  const original = process.env.SESSION_SECRET
  try {
    process.env.SESSION_SECRET = 'secret-one-for-the-test'
    const signed = signValue('a-session-id')
    process.env.SESSION_SECRET = 'secret-two-for-the-test'
    assert.equal(verifySignedValue(signed), null)
  } finally {
    if (original === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = original
  }
})

test('rejects rubbish input', () => {
  assert.equal(verifySignedValue(''), null)
  assert.equal(verifySignedValue('no-signature'), null)
  assert.equal(verifySignedValue('.abc'), null)
  assert.equal(verifySignedValue(null), null)
  assert.equal(verifySignedValue(undefined), null)
})

console.log('auth: session ids')

test('returns a stable id for a valid cookie', () => {
  const header = cookieHeaderFor(sessionId)
  assert.equal(getSessionId({ headers: { cookie: header } }), sessionId)
  assert.equal(getSessionId({ headers: { cookie: header } }), sessionId)
})

test('returns a new id when the cookie is missing', () => {
  const first = getSessionId({ headers: {} })
  const second = getSessionId({ headers: {} })
  assert.match(first, /^[a-f0-9]{48}$/)
  assert.notEqual(first, second)
})

test('returns a new id when the cookie is invalid', () => {
  const header = `${SESSION_COOKIE}=not-a-signed-value`
  const result = getSessionId({ headers: { cookie: header } })
  assert.match(result, /^[a-f0-9]{48}$/)
  assert.notEqual(result, 'not-a-signed-value')
})

test('never throws on a malformed cookie header', () => {
  const headers = [
    '',
    ';;;',
    'wa_sid',
    'wa_sid=',
    '=value',
    'wa_sid=abc.def.ghi',
    'other=1; wa_sid; broken=2',
    'wa_sid=%%%.%%%',
  ]

  for (const header of headers) {
    assert.match(getSessionId({ headers: { cookie: header } }), /^[a-f0-9]{48}$/)
  }
})

test('hashes a session id to a stable hex digest', () => {
  const first = hashSession(sessionId)
  assert.equal(first, hashSession(sessionId))
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.notEqual(first, sessionId)
  assert.notEqual(first, hashSession(otherSessionId))
})

test('writes a hardened session cookie', () => {
  const response = fakeResponse()
  setSessionCookie(response, sessionId)
  const header = String(response.headers.get('set-cookie'))
  assert.match(header, /HttpOnly/)
  assert.match(header, /SameSite=Lax/)
  assert.match(header, /Path=\//)
  assert.match(header, /Max-Age=15552000/)
})

console.log('ownership: challenges')

test('returns the documented shape', () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  assert.equal(challenge.path, '/.well-known/webauditors-verification')
  assert.equal(challenge.dnsName, '_webauditors.example.com')
  assert.equal(challenge.token.split('.').length, 3)
  assert.ok(Number.isFinite(Date.parse(challenge.expiresAt)))
  assert.match(challenge.instructions, /webauditors-verification/)
  assert.ok(challenge.instructions.includes(challenge.token))
})

await testAsync('verifies for the same session and target', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const { fetchImpl } = recordingFetch(challenge.token)
  const result = await verifyWith(challenge.token, { fetchImpl, dnsImpl: async () => [] })
  assert.equal(result.verified, true)
  assert.equal(result.method, 'file')
})

await testAsync('fails for a different session', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const { calls, fetchImpl } = recordingFetch(challenge.token)
  const result = await verifyWith(challenge.token, {
    session: otherSessionId,
    fetchImpl,
    dnsImpl: async () => [],
  })
  assert.equal(result.verified, false)
  assert.equal(calls.length, 0)
})

await testAsync('fails for a different target', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const { calls, fetchImpl } = recordingFetch(challenge.token)
  const result = await verifyWith(challenge.token, {
    target: 'https://example.org',
    fetchImpl,
    dnsImpl: async () => [],
  })
  assert.equal(result.verified, false)
  assert.equal(calls.length, 0)
})

await testAsync('fails for a tampered token', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const parts = challenge.token.split('.')
  parts[0] = `0${parts[0].slice(1)}`
  const { calls, fetchImpl } = recordingFetch(challenge.token)
  const result = await verifyWith(parts.join('.'), { fetchImpl, dnsImpl: async () => [] })
  assert.equal(result.verified, false)
  assert.equal(calls.length, 0)
  assert.ok(!result.detail.includes(challenge.token))
})

await testAsync('fails for an expired token', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET, ttlMinutes: -1 })
  const { calls, fetchImpl } = recordingFetch(challenge.token)
  const result = await verifyWith(challenge.token, { fetchImpl, dnsImpl: async () => [] })
  assert.equal(result.verified, false)
  assert.equal(calls.length, 0)
  assert.equal(result.detail, 'The verification token is invalid or expired.')
})

await testAsync('fails for a token minted in the past', async () => {
  const challenge = createChallenge({
    sessionId,
    target: TARGET,
    ttlMinutes: 60,
    now: Date.now() - 7200_000,
  })
  const result = await verifyWith(challenge.token, {
    fetchImpl: async () => ({ status: 200, body: challenge.token }),
    dnsImpl: async () => [],
  })
  assert.equal(result.verified, false)
})

console.log('ownership: verification')

await testAsync('verifies through the file method', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const result = await verifyWith(challenge.token, {
    fetchImpl: async () => ({ status: 200, body: `${challenge.token}\n` }),
    dnsImpl: async () => [],
  })
  assert.equal(result.verified, true)
  assert.equal(result.method, 'file')
})

await testAsync('does not verify when the file does not match', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const result = await verifyWith(challenge.token, {
    fetchImpl: async () => ({ status: 200, body: 'something else entirely' }),
    dnsImpl: async () => [],
  })
  assert.equal(result.verified, false)
  assert.equal(result.method, null)
})

await testAsync('verifies through the DNS method', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const result = await verifyWith(challenge.token, {
    fetchImpl: async () => ({ status: 404, body: '' }),
    dnsImpl: async () => [[challenge.token]],
  })
  assert.equal(result.verified, true)
  assert.equal(result.method, 'dns')
})

await testAsync('does not call the network for a tampered token', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const { calls, fetchImpl } = recordingFetch(challenge.token)
  const result = await verifyWith(`${challenge.token}x`, {
    fetchImpl,
    dnsImpl: async () => {
      throw new Error('dns must not be reached')
    },
  })
  assert.equal(result.verified, false)
  assert.equal(calls.length, 0)
})

await testAsync('keeps the token out of the failure detail', async () => {
  const challenge = createChallenge({ sessionId, target: TARGET })
  const result = await verifyWith(challenge.token, {
    fetchImpl: async () => ({ status: 404, body: '' }),
    dnsImpl: async () => [],
  })
  assert.equal(result.verified, false)
  assert.ok(!result.detail.includes(challenge.token))
})

console.log(`\n${passed} assertions passed`)
