import assert from 'node:assert/strict'
import { classifyIp, normaliseTarget, resolvePublicHost } from '../api/_lib/guard.js'
import { deriveChecks } from '../api/_lib/checks.js'
import { CHECKS } from '../src/data/demo.js'

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

const expectsError = (fn, code) => {
  try {
    fn()
  } catch (error) {
    assert.equal(error.code, code)
    return
  }
  assert.fail(`expected ${code} to be thrown`)
}

console.log('guard: address classification')

for (const address of [
  '127.0.0.1',
  '127.1.2.3',
  '10.0.0.5',
  '172.16.4.2',
  '192.168.1.1',
  '169.254.169.254',
  '100.64.0.1',
  '0.0.0.0',
  '224.0.0.1',
  '::1',
  'fc00::1',
  'fe80::1',
  '::ffff:127.0.0.1',
]) {
  test(`blocks ${address}`, () => {
    assert.equal(classifyIp(address).blocked, true)
  })
}

for (const address of ['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111']) {
  test(`allows ${address}`, () => {
    assert.equal(classifyIp(address).blocked, false)
  })
}

test('blocks non-IP input', () => {
  assert.equal(classifyIp('example.com').blocked, true)
})

console.log('guard: target normalisation')

test('bare domain becomes https', () => {
  assert.equal(normaliseTarget('example.com').href, 'https://example.com/')
})

test('rejects spaces', () => {
  expectsError(() => normaliseTarget('not a url'), 'invalid_url')
})

test('rejects non-http schemes', () => {
  expectsError(() => normaliseTarget('javascript:alert(1)'), 'invalid_scheme')
  expectsError(() => normaliseTarget('ftp://example.com'), 'invalid_scheme')
})

test('rejects credentials in the url', () => {
  expectsError(() => normaliseTarget('https://user:pass@example.com'), 'invalid_url')
})

test('rejects arbitrary ports', () => {
  expectsError(() => normaliseTarget('http://example.com:8080'), 'blocked_port')
})

test('allows explicit 80 and 443', () => {
  assert.equal(normaliseTarget('https://example.com:443').href, 'https://example.com/')
  assert.equal(normaliseTarget('http://example.com:80').href, 'http://example.com/')
})

console.log('guard: hostname resolution')

await testAsync('rejects localhost', async () => {
  await assert.rejects(resolvePublicHost('localhost'), { code: 'blocked_host' })
})

await testAsync('rejects internal suffixes', async () => {
  await assert.rejects(resolvePublicHost('printer.internal'), { code: 'blocked_host' })
})

await testAsync('rejects loopback literals', async () => {
  await assert.rejects(resolvePublicHost('127.0.0.1'), { code: 'blocked_host' })
})

console.log('checks: derivation')

const secureEvidence = {
  target: 'https://example.com/',
  finalUrl: 'https://example.com/',
  redirects: [],
  tls: {
    protocol: 'TLSv1.3',
    cipher: 'TLS_AES_128_GCM_SHA256',
    authorized: true,
    authorizationError: null,
    daysRemaining: 90,
  },
  cookies: { count: 0, missing: [] },
  response: {
    headers: {
      'strict-transport-security': 'max-age=63072000',
      'content-security-policy': "default-src 'self'; script-src 'self'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'DENY',
    },
  },
  document: { hasSourceMap: false, mixedContentCount: 0, debugSignals: false },
  probes: [{ path: '/.env.example', status: 404 }],
  probeBodies: {},
}

test('secure evidence passes every check', () => {
  const checks = deriveChecks(secureEvidence)
  assert.equal(checks.length, 12)
  for (const item of checks) {
    assert.equal(item.status, 'pass', `${item.id} was ${item.status}: ${item.observed}`)
  }
})

const weakEvidence = {
  target: 'http://example.com/',
  finalUrl: 'http://example.com/',
  redirects: [],
  tls: null,
  cookies: { count: 2, missing: ['Secure', 'HttpOnly'] },
  response: { headers: { server: 'nginx/1.25.3' } },
  document: { hasSourceMap: true, mixedContentCount: 2, debugSignals: true },
  probes: [{ path: '/.env.example', status: 200 }],
  probeBodies: { '/.env.example': 'API_KEY=demo\nDB_URL=postgres://x' },
}

test('weak evidence flags the right checks', () => {
  const byId = Object.fromEntries(deriveChecks(weakEvidence).map((item) => [item.id, item.status]))

  assert.equal(byId['https-redirect'], 'warn')
  assert.equal(byId.tls, 'warn')
  assert.equal(byId.hsts, 'warn')
  assert.equal(byId.csp, 'warn')
  assert.equal(byId.headers, 'warn')
  assert.equal(byId.cookies, 'warn')
  assert.equal(byId['mixed-content'], 'warn')
  assert.equal(byId['source-map'], 'review')
  assert.equal(byId['config-files'], 'review')
  assert.equal(byId.debug, 'review')
  assert.equal(byId['server-header'], 'review')
  assert.equal(byId['cert-expiry'], 'warn')
})

test('check ids match the UI contract', () => {
  const ids = deriveChecks(secureEvidence).map((item) => item.id)
  assert.deepEqual(ids, CHECKS.map((item) => item.id))
})

console.log(`\n${passed} assertions passed`)
