import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'

// The ownership gate, end to end. A server with REQUIRE_OWNERSHIP=1 must
// refuse to scan a domain the session has not proved it controls, and a
// tampered token must be refused before anything is fetched.

const PORT = process.env.OWNERSHIP_TEST_PORT ?? '5193'
const MOCK_PORT = process.env.OWNERSHIP_MOCK_PORT ?? '5195'
const BASE = `http://localhost:${PORT}`
const IS_WIN = process.platform === 'win32'

const children = []

function start(command, args, env = {}, { shell = false } = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell,
  })
  children.push(child)
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  return child
}

function stopAll() {
  for (const child of children) {
    if (!child.pid) continue
    if (IS_WIN) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
    } else {
      child.kill('SIGTERM')
    }
  }
}

async function waitFor(url, timeout = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function sessionCookie(response) {
  const header = response.headers.get('set-cookie')
  if (!header) return ''
  return header.split(';')[0]
}

let passed = 0

function ok(name) {
  passed += 1
  console.log(`  ok  ${name}`)
}

try {
  start(process.execPath, ['scripts/mock-llm.mjs'], {
    MOCK_LLM_PORT: MOCK_PORT,
  })
  await waitFor(`http://127.0.0.1:${MOCK_PORT}/health`)

  start(
    'npx',
    ['vite', '--port', PORT, '--strictPort'],
    {
      LLM_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
      LLM_API_KEY: 'test-key',
      LLM_MODEL: 'mock-1',
      REQUIRE_OWNERSHIP: '1',
      STORE: 'memory',
    },
    { shell: IS_WIN },
  )
  await waitFor(`${BASE}/`)

  // 1. A challenge is issued for the domain.
  const createResponse = await fetch(`${BASE}/api/agent/ownership`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'create', url: 'example.com' }),
  })
  const challenge = await createResponse.json()

  assert.equal(createResponse.status, 200, JSON.stringify(challenge))
  assert.equal(challenge.ok, true)
  assert.ok(challenge.token)
  assert.equal(challenge.path, '/.well-known/webauditors-verification')
  assert.equal(challenge.dnsName, '_webauditors.example.com')
  ok('a challenge is issued for the domain')

  const cookie = sessionCookie(createResponse)
  assert.ok(cookie, 'the session cookie should be set')
  ok('the session cookie is set on the challenge')

  // 2. Scanning without the token is refused.
  const refused = await fetch(`${BASE}/api/agent/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ url: 'example.com' }),
  })
  const refusedPayload = await refused.json()

  assert.equal(refused.status, 403, JSON.stringify(refusedPayload))
  assert.equal(refusedPayload.code, 'ownership_required')
  ok('a scan without proof of ownership is refused')

  // 3. A tampered token is refused too.
  const tampered = await fetch(`${BASE}/api/agent/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      url: 'example.com',
      ownershipToken: `${challenge.token.slice(0, -4)}0000`,
    }),
  })
  const tamperedPayload = await tampered.json()

  assert.equal(tampered.status, 403, JSON.stringify(tamperedPayload))
  assert.equal(tamperedPayload.code, 'ownership_required')
  ok('a tampered token is refused')

  // 4. A token that was issued but never published does not verify.
  const verify = await fetch(`${BASE}/api/agent/ownership`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      action: 'verify',
      url: 'example.com',
      token: challenge.token,
    }),
  })
  const verifyPayload = await verify.json()

  assert.equal(verify.status, 200, JSON.stringify(verifyPayload))
  assert.equal(verifyPayload.verified, false)
  assert.ok(verifyPayload.detail)
  ok('an unpublished token does not verify')

  // 5. A token from another session is refused.
  const other = await fetch(`${BASE}/api/agent/ownership`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'create', url: 'example.com' }),
  })
  const otherChallenge = await other.json()

  const crossed = await fetch(`${BASE}/api/agent/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      url: 'example.com',
      ownershipToken: otherChallenge.token,
    }),
  })
  const crossedPayload = await crossed.json()

  assert.equal(crossed.status, 403, JSON.stringify(crossedPayload))
  assert.equal(crossedPayload.code, 'ownership_required')
  ok("another session's token is refused")

  console.log(`\n${passed} assertions passed`)
  console.log('OWNERSHIP TEST PASSED')
} catch (error) {
  console.error('OWNERSHIP TEST FAILED')
  throw error
} finally {
  stopAll()
}
