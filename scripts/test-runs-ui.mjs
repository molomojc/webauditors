import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

// Drives the persisted run pages against fixture API responses, so the test
// needs no backend, no model provider and no stored run.

const PORT = process.env.RUNS_TEST_PORT ?? '5192'
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`
const CHANNEL =
  process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined)
const OUT = process.env.SMOKE_OUT ?? path.join(process.cwd(), '.smoke')
const IS_WIN = process.platform === 'win32'

fs.mkdirSync(OUT, { recursive: true })

const RUN_FIXTURE = {
  ok: true,
  run: {
    id: 'run_test123',
    status: 'completed',
    target: 'https://example.com/',
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:12.000Z',
    completedAt: '2026-10-20T09:00:12.000Z',
    agent: {
      id: 'web-auditor',
      version: 1,
      name: 'Web Auditor',
      model: 'gpt-4.1-mini',
    },
    owner: {
      sessionId: 'a1b2c3d4',
      verified: true,
      method: 'dns',
      verifiedAt: '2026-10-20T09:00:01.000Z',
    },
    summary:
      'The site serves modern TLS but omits HSTS and discloses its server software.',
    findings: [
      {
        id: 'hsts-is-not-enabled-1',
        title: 'HSTS is not enabled',
        severity: 'high',
        category: 'transport',
        observation: 'The response carried no Strict-Transport-Security header.',
        impact: 'A first request can be downgraded to plain HTTP.',
        fix: 'Send Strict-Transport-Security: max-age=31536000; includeSubDomains.',
        evidence: ['headers', 'tls'],
        confidence: 'high',
        limitations: null,
      },
      {
        id: 'server-header-discloses-1',
        title: 'Server header discloses software version',
        severity: 'medium',
        category: 'headers',
        observation: 'The response carried Server: nginx/1.24.0.',
        impact: 'Version details help an attacker match a known weakness.',
        fix: 'Remove the version from the Server header.',
        evidence: ['headers'],
        confidence: 'medium',
        limitations: null,
      },
      {
        id: 'csp-is-not-set-1',
        title: 'Content security policy is not set',
        severity: 'info',
        category: 'headers',
        observation: 'No Content-Security-Policy header was present.',
        impact: 'A cross-site scripting flaw would have no second line of defence.',
        fix: 'Publish a content security policy that allows only known origins.',
        evidence: ['headers', 'dns:TXT'],
        confidence: 'low',
        limitations: 'Inline scripts were not assessed.',
      },
    ],
    usage: { inputTokens: 4000, outputTokens: 600 },
    steps: 5,
    error: null,
    events: [
      { event: 'agent.assigned', agent: { id: 'web-auditor', version: 1, name: 'Web Auditor', model: 'gpt-4.1-mini' } },
      { event: 'tool.call', name: 'fetch_page', argument: 'https://example.com/' },
      { event: 'tool.result', name: 'fetch_page', ok: true, summary: '200 in 210ms, 14 headers' },
      { event: 'tool.call', name: 'dns_lookup', argument: 'TXT' },
      { event: 'tool.result', name: 'dns_lookup', ok: true, summary: '2 records' },
      { event: 'finding', finding: { id: 'hsts-is-not-enabled-1', title: 'HSTS is not enabled', severity: 'high' } },
      { event: 'agent.completed', steps: 5, usage: { inputTokens: 4000, outputTokens: 600 } },
    ],
  },
}

const LIST_FIXTURE = {
  ok: true,
  runs: [
    {
      id: 'run_test123',
      target: 'https://example.com/',
      status: 'completed',
      createdAt: '2026-10-20T09:00:00.000Z',
      completedAt: '2026-10-20T09:00:12.000Z',
      findingCount: 3,
      severityCounts: { high: 1, medium: 1, info: 1 },
    },
    {
      id: 'run_test456',
      target: 'https://another.example.org/',
      status: 'failed',
      createdAt: '2026-10-19T14:30:00.000Z',
      completedAt: null,
      findingCount: 0,
      severityCounts: { high: 0, medium: 0, info: 0 },
    },
  ],
}

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
    ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
    { source: pattern.source, flags: pattern.flags },
    { timeout },
  )
}

async function fillFixtures(page) {
  // Both run endpoints are answered from fixtures so the test never depends
  // on a live backend.
  await page.route('**/api/agent/runs*', async (route) => {
    const url = route.request().url()
    const body = url.includes('id=') ? RUN_FIXTURE : LIST_FIXTURE
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

let browser

try {
  start('npx', ['vite', '--port', PORT, '--strictPort'], {}, { shell: IS_WIN })
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

  await fillFixtures(page)

  // Report page for a single stored run.
  await page.goto(`${BASE}/reports/agent/run_test123`, { waitUntil: 'networkidle' })

  const shellText = await page.locator('body').innerText()
  assert.ok(!/page not found/i.test(shellText), 'the /reports/agent/:runId route is registered in App.jsx')

  await expectText(page, /example\.com/)
  await expectText(page, /Web Auditor/)
  await expectText(page, /HSTS is not enabled/)

  const reportText = await page.locator('body').innerText()

  assert.match(reportText, /example\.com/, 'the report shows the target host')
  assert.match(reportText, /Web Auditor/, 'the report names the agent')
  assert.match(reportText, /HSTS is not enabled/, 'the report shows the first finding')
  assert.match(reportText, /Server header discloses software version/, 'the report shows the second finding')
  assert.match(reportText, /Content security policy is not set/, 'the report shows the third finding')
  assert.match(reportText, /run_test123/, 'the report shows the run id')
  assert.match(reportText, /completed/i, 'the report shows the run status')
  assert.match(reportText, /modern TLS but omits HSTS/, 'the report shows the agent summary')
  assert.match(reportText, /web-auditor v1/, 'the report shows the agent id and version')
  assert.match(reportText, /agent assigned/, 'the report shows the transcript')

  const findings = page.locator('article')
  const findingCount = await findings.count()
  assert.equal(findingCount, 3, `expected three finding cards, saw ${findingCount}`)

  const evidence = page.locator('article code')
  const evidenceCount = await evidence.count()
  assert.ok(evidenceCount >= 3, `expected evidence chips on every finding, saw ${evidenceCount}`)
  assert.match(reportText, /dns:TXT/, 'the evidence chips list the evidence ids')
  assert.match(reportText, /high confidence/i, 'the report shows the confidence of a finding')

  await page.screenshot({ path: path.join(OUT, '22-agent-report.png'), fullPage: true })

  // Index of stored runs.
  await page.goto(`${BASE}/runs`, { waitUntil: 'networkidle' })

  const runsShellText = await page.locator('body').innerText()
  assert.ok(!/page not found/i.test(runsShellText), 'the /runs route is registered in App.jsx')

  await expectText(page, /Stored agent runs/)

  const listText = await page.locator('body').innerText()
  const reportLinks = page.locator('a[href^="/reports/agent/"]')

  assert.match(listText, /example\.com/, 'the list shows the first target')
  assert.match(listText, /another\.example\.org/, 'the list shows the second target')
  assert.match(listText, /run_test123/i, 'the list shows the first run id')
  assert.match(listText, /run_test456/i, 'the list shows the second run id')
  assert.match(listText, /1 high/i, 'the list shows severity counts')
  assert.match(listText, /failed/i, 'the list shows a failed run')

  const linkCount = await reportLinks.count()
  assert.equal(linkCount, 2, `expected two report links, saw ${linkCount}`)
  assert.equal(
    await reportLinks.first().getAttribute('href'),
    '/reports/agent/run_test123',
    'the first row links to its report',
  )

  await page.screenshot({ path: path.join(OUT, '23-agent-runs.png'), fullPage: true })

  // Narrow viewport: neither page may scroll sideways.
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const mobile = await mobileContext.newPage()
  await fillFixtures(mobile)

  await mobile.goto(`${BASE}/reports/agent/run_test123`, {
    waitUntil: 'networkidle',
  })
  await expectText(mobile, /HSTS is not enabled/)
  const reportOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  assert.ok(
    reportOverflow <= 1,
    `report layout overflows by ${reportOverflow}px at 390px`,
  )

  await mobile.goto(`${BASE}/runs`, { waitUntil: 'networkidle' })
  await expectText(mobile, /Stored agent runs/)
  const listOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  assert.ok(
    listOverflow <= 1,
    `runs layout overflows by ${listOverflow}px at 390px`,
  )
  await mobileContext.close()

  assert.equal(errors.length, 0, errors.join('\n'))

  console.log('AGENT RUNS UI TEST PASSED')
  console.log(`Screenshots: ${OUT}`)
} catch (error) {
  console.error('AGENT RUNS UI TEST FAILED')
  throw error
} finally {
  if (browser) await browser.close()
  stopAll()
}
