import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

// Self-contained: starts the mock model, starts a dev server pointed at it,
// drives the agent page, then tears both down. No API key required.

const PORT = process.env.AGENT_TEST_PORT ?? '5180'
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`
const MOCK_PORT = process.env.MOCK_LLM_PORT ?? '5199'
const CHANNEL =
  process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined)
const OUT = process.env.SMOKE_OUT ?? path.join(process.cwd(), '.smoke')
const IS_WIN = process.platform === 'win32'

fs.mkdirSync(OUT, { recursive: true })

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

async function expectText(scope, pattern, timeout = 10_000) {
  await scope.waitForFunction(
    ({ source, flags }) =>
      new RegExp(source, flags).test(document.body.innerText),
    { source: pattern.source, flags: pattern.flags },
    { timeout },
  )
}

let browser

try {
  start(process.execPath, ['scripts/mock-llm.mjs'], {
    MOCK_LLM_PORT: MOCK_PORT,
  })
  await waitFor(`http://127.0.0.1:${MOCK_PORT}/health`)

  start('npx', ['vite', '--port', PORT, '--strictPort'], {
    LLM_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
    LLM_API_KEY: 'test-key',
    LLM_MODEL: 'mock-1',
    // The run store is exercised by scripts/test-store.mjs; here it must not
    // leave files behind in the repository.
    STORE: 'memory',
  }, { shell: IS_WIN })
  await waitFor(`${BASE}/`)

  browser = await chromium.launch({ channel: CHANNEL, headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  })
  const page = await context.newPage()
  const errors = []

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    if (/Failed to load resource/.test(message.text())) return
    errors.push(`console: ${message.text()}`)
  })

  await page.goto(`${BASE}/scan/agent`, { waitUntil: 'networkidle' })
  await expectText(page, /Assign an agent/)
  await expectText(page, /Tool output is treated as untrusted data/)

  await page.getByLabel('Website URL').fill('example.com')
  await page.getByRole('button', { name: 'Assign agent' }).click()

  await expectText(page, /investigating/i, 15_000)
  await expectText(page, /Agent finished/, 75_000)

  const text = await page.locator('body').innerText()

  assert.match(text, /agent assigned/i)
  assert.match(text, /fetch_page/)
  assert.match(text, /probe_path \/\.env/)
  assert.match(text, /probe_path \/\.git\/config/)
  assert.match(text, /fetch_asset/)
  assert.match(text, /dns_lookup TXT/)
  assert.match(text, /HSTS is not enabled/i)
  assert.match(text, /Server header discloses/i)
  assert.match(text, /agent summary/i)
  assert.match(text, /headers/)
  assert.match(text, /every item cites captured evidence/i)

  const findings = page.locator('article')
  assert.ok(
    (await findings.count()) >= 3,
    `expected at least three findings, saw ${await findings.count()}`,
  )

  // The run is persisted: the id appears in the transcript and the run can be
  // read back through the runs API with the same session cookie.
  const runIdMatch = text.match(/run_[a-f0-9]{12}/)
  assert.ok(runIdMatch, 'expected a run id in the transcript')
  const runId = runIdMatch[0]

  const cookies = await context.cookies()
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')

  const runResponse = await fetch(`${BASE}/api/agent/runs?id=${runId}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
  const runPayload = await runResponse.json()

  assert.equal(runResponse.status, 200, JSON.stringify(runPayload))
  assert.equal(runPayload.ok, true)
  assert.equal(runPayload.run.id, runId)
  assert.equal(runPayload.run.status, 'completed')
  assert.ok(runPayload.run.findings.length >= 3)
  assert.ok(runPayload.run.events.length > 0)

  const listResponse = await fetch(`${BASE}/api/agent/runs`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
  const listPayload = await listResponse.json()
  assert.equal(listResponse.status, 200, JSON.stringify(listPayload))
  assert.ok(
    listPayload.runs.some((run) => run.id === runId),
    'the run should appear in the session list',
  )

  // The queue path: the run is enqueued, and the worker endpoint picks it up.
  const queuedResponse = await fetch(`${BASE}/api/agent/scan`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ url: 'https://example.com', async: true }),
  })
  const queuedPayload = await queuedResponse.json()

  assert.equal(queuedResponse.status, 202, JSON.stringify(queuedPayload))
  assert.equal(queuedPayload.status, 'queued')
  assert.ok(queuedPayload.runId)

  const workerResponse = await fetch(`${BASE}/api/agent/worker`, { method: 'POST' })
  const workerPayload = await workerResponse.json()

  assert.equal(workerResponse.status, 200, JSON.stringify(workerPayload))
  assert.equal(workerPayload.processed, 1)

  const queuedRunResponse = await fetch(
    `${BASE}/api/agent/runs?id=${queuedPayload.runId}`,
    { headers: cookieHeader ? { cookie: cookieHeader } : {} },
  )
  const queuedRun = await queuedRunResponse.json()

  assert.equal(queuedRunResponse.status, 200, JSON.stringify(queuedRun))
  assert.equal(queuedRun.run.status, 'completed')
  assert.ok(queuedRun.run.findings.length >= 3)
  assert.ok(queuedRun.run.events.length > 0)

  await page.screenshot({
    path: path.join(OUT, '20-agent.png'),
    fullPage: true,
  })

  // Mobile pass through the query-string auto-run path.
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const mobile = await mobileContext.newPage()
  await mobile.goto(
    `${BASE}/scan/agent?url=${encodeURIComponent('https://example.com')}`,
    { waitUntil: 'networkidle' },
  )
  await expectText(mobile, /Agent finished/, 75_000)
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  assert.ok(overflow <= 1, `mobile layout overflows by ${overflow}px`)
  await mobile.screenshot({
    path: path.join(OUT, '21-agent-mobile.png'),
    fullPage: true,
  })
  await mobileContext.close()

  if (errors.length) throw new Error(errors.join('\n'))

  console.log('AGENT TEST PASSED')
  console.log(`Screenshots: ${OUT}`)
} catch (error) {
  console.error('AGENT TEST FAILED')
  throw error
} finally {
  if (browser) await browser.close()
  stopAll()
}
