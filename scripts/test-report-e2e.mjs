import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

// The whole loop with a real server and a real stored run: the agent page
// runs a scan, the run is persisted, and the report page reads it back. The
// model is the scripted mock; the collector, the store and the pages are real.

const PORT = process.env.REPORT_TEST_PORT ?? '5194'
const MOCK_PORT = process.env.REPORT_MOCK_PORT ?? '5197'
const BASE = `http://localhost:${PORT}`
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

async function expectText(scope, pattern, timeout = 20_000) {
  await scope.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
    { source: pattern.source, flags: pattern.flags },
    { timeout },
  )
}

let browser

try {
  start(process.execPath, ['scripts/mock-llm.mjs'], { MOCK_LLM_PORT: MOCK_PORT })
  await waitFor(`http://127.0.0.1:${MOCK_PORT}/health`)

  start(
    'npx',
    ['vite', '--port', PORT, '--strictPort'],
    {
      LLM_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
      LLM_API_KEY: 'test-key',
      LLM_MODEL: 'mock-1',
      STORE: 'memory',
    },
    { shell: IS_WIN },
  )
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

  // Run a scan from the page, so the session cookie belongs to this browser.
  await page.goto(`${BASE}/scan/agent`, { waitUntil: 'networkidle' })
  await page.getByLabel('Website URL').fill('example.com')
  await page.getByRole('button', { name: 'Assign agent' }).click()
  await expectText(page, /Agent finished/, 75_000)

  const runId = (await page.locator('body').innerText()).match(/run_[a-f0-9]{12}/)
  assert.ok(runId, 'expected a run id on the finished page')

  // The stored report is one click away and shows the same findings.
  await page.getByRole('link', { name: /stored report/i }).click()
  await expectText(page, /HSTS is not enabled/i, 20_000)

  const reportText = await page.locator('body').innerText()
  assert.match(reportText, /No Content-Security-Policy/i)
  assert.match(reportText, /Server header discloses/i)
  assert.match(reportText, /headers/)
  assert.ok(reportText.includes(runId[0]), 'the report should name the run')

  await page.screenshot({
    path: path.join(OUT, '24-agent-report.png'),
    fullPage: true,
  })

  // The runs list knows about the same run. The id is rendered in a
  // uppercased style, so the comparison is case-insensitive.
  await page.goto(`${BASE}/runs`, { waitUntil: 'networkidle' })
  await expectText(page, /example\.com/, 20_000)
  const listText = (await page.locator('body').innerText()).toLowerCase()
  assert.ok(
    listText.includes(runId[0].toLowerCase()),
    'the run should be listed',
  )

  await page.screenshot({
    path: path.join(OUT, '25-agent-runs.png'),
    fullPage: true,
  })

  // Mobile pass over the report. The same browser is reused: a run belongs to
  // the session that created it, so a fresh context would not see it.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}/reports/agent/${runId[0]}`, {
    waitUntil: 'networkidle',
  })
  await expectText(page, /HSTS is not enabled/i, 20_000)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  assert.ok(overflow <= 1, `mobile layout overflows by ${overflow}px`)
  await page.screenshot({
    path: path.join(OUT, '26-agent-report-mobile.png'),
    fullPage: true,
  })

  if (errors.length) throw new Error(errors.join('\n'))

  console.log('AGENT REPORT TEST PASSED')
  console.log(`Screenshots: ${OUT}`)
} catch (error) {
  console.error('AGENT REPORT TEST FAILED')
  throw error
} finally {
  if (browser) await browser.close()
  stopAll()
}
