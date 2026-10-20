import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

// Exercises the real collector through the browser. Needs network access to the
// target site, so it is kept out of the offline smoke suite.
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const CHANNEL =
  process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined)
const OUT = process.env.SMOKE_OUT ?? path.join(process.cwd(), '.smoke')

fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: CHANNEL, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const page = await context.newPage()
const errors = []

page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() !== 'error') return
  // The refusal path deliberately returns HTTP 400, which Chromium logs as a
  // failed resource load. That is the expected behaviour being tested.
  if (/Failed to load resource/.test(message.text())) return
  errors.push(`console: ${message.text()}`)
})

async function expectText(scope, pattern, timeout = 8000) {
  await scope.waitForFunction(
    ({ source, flags }) =>
      new RegExp(source, flags).test(document.body.innerText),
    { source: pattern.source, flags: pattern.flags },
    { timeout },
  )
}

try {
  await page.goto(`${BASE}/scan/live`, { waitUntil: 'networkidle' })
  await expectText(page, /Live check/)
  await expectText(page, /Only check sites you own or have permission to test\./)

  await page.getByLabel('Website URL').fill('example.com')
  await page.getByRole('button', { name: 'Run live check' }).click()

  await expectText(page, /Collecting evidence/)
  await expectText(page, /Live check complete/, 45_000)

  const text = await page.locator('body').innerText()
  assert.match(text, /01 \/ checks/i)
  assert.match(text, /02 \/ collector transcript/i)
  assert.match(text, /03 \/ raw evidence/i)
  assert.match(text, /live capture/i)
  assert.match(text, /TLSv1\.3/)
  assert.match(text, /cloudflare/i)
  assert.match(text, /12 checks/i)

  // Scroll the transcript into view and wait for an actual typed line (not the
  // screen-reader copy) before the screenshot.
  const card = page.locator('figure', { hasText: 'webauditors collect' })
  await card.scrollIntoViewIfNeeded()
  await card
    .locator('div[aria-hidden="true"] p', { hasText: 'cert-expiry' })
    .waitFor({ timeout: 10_000 })

  const checks = page.locator('ol li')
  assert.equal(await checks.count(), 12, 'expected twelve derived checks')

  await page.screenshot({
    path: path.join(OUT, '10-live-check.png'),
    fullPage: true,
  })

  // Mobile pass: the auto-run query string exercises the same code path.
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const mobile = await mobileContext.newPage()
  await mobile.goto(
    `${BASE}/scan/live?url=${encodeURIComponent('https://example.com')}`,
    { waitUntil: 'networkidle' },
  )
  await expectText(mobile, /Live check complete/, 45_000)
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  assert.ok(overflow <= 1, `mobile layout overflows by ${overflow}px`)
  await mobile.screenshot({
    path: path.join(OUT, '11-live-mobile.png'),
    fullPage: true,
  })
  await mobileContext.close()

  // Refusal path: loopback must never be requested.
  await page.getByRole('button', { name: 'Run another check' }).click()
  await page.getByLabel('Website URL').fill('http://127.0.0.1')
  await page.getByRole('button', { name: 'Run live check' }).click()
  await expectText(page, /private or reserved IPv4 address/i)
  await expectText(page, /refuses private, loopback and reserved addresses/i)

  if (errors.length) throw new Error(errors.join('\n'))

  console.log('LIVE CHECK PASSED')
  console.log(`Screenshot: ${path.join(OUT, '10-live-check.png')}`)
} catch (error) {
  console.error('LIVE CHECK FAILED')
  await page.screenshot({ path: path.join(OUT, 'live-failure.png'), fullPage: true })
  throw error
} finally {
  await browser.close()
}
