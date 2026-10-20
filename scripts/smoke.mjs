import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const CHANNEL =
  process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined)
const OUT = process.env.SMOKE_OUT ?? path.join(process.cwd(), '.smoke')

fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: CHANNEL, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  acceptDownloads: true,
})
const page = await context.newPage()
const errors = []

page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

// Client-side routing updates the URL before React paints the next route, so
// every content assertion waits for the text to actually appear.
async function expectText(scope, pattern, timeout = 8000) {
  await scope.waitForFunction(
    ({ source, flags }) =>
      new RegExp(source, flags).test(document.body.innerText),
    { source: pattern.source, flags: pattern.flags },
    { timeout },
  )
}

async function bodyText(scope) {
  return scope.locator('body').innerText()
}

try {
  // 1. Homepage
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await expectText(page, /What your site tells the internet about itself\./)
  assert.match(
    await bodyText(page),
    /no site is contacted/i,
  )
  await page.screenshot({ path: path.join(OUT, '01-home.png'), fullPage: true })

  // 2. URL validation — spaces
  await page.getByLabel('Website URL').fill('not a url')
  await page.getByRole('button', { name: 'Analyse website' }).click()
  await expectText(page, /URLs cannot contain spaces\./)

  // 3. URL validation — unsupported scheme
  await page.getByLabel('Website URL').fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Analyse website' }).click()
  await expectText(page, /Only HTTP and HTTPS URLs are supported\./)

  // 4. Start demo scan from a bare domain
  await page.getByLabel('Website URL').fill('demo.example.com')
  await page.getByRole('button', { name: 'Analyse website' }).click()
  await page.waitForURL(/\/scan\/demo\?url=/)
  await expectText(page, /No requests are sent to demo\.example\.com\./)

  // 5. Scan progress
  await page.getByRole('button', { name: 'Skip animation and show results' }).click()
  await page
    .getByRole('heading', { name: 'Demo scan complete' })
    .waitFor({ timeout: 10000 })
  assert.match(
    await bodyText(page),
    /12 simulated checks completed with 1 high, 2 medium and 2 informational findings\./,
  )
  await page.screenshot({
    path: path.join(OUT, '02-scan-complete.png'),
    fullPage: true,
  })

  // 6. Open the report
  await page.getByRole('link', { name: 'View security report' }).click()
  await page.waitForURL(/\/reports\//)
  await expectText(page, /No live security scan was performed/)
  const reportText = await bodyText(page)
  assert.match(reportText, /DEMO DATA/)
  assert.match(reportText, /Needs attention/)
  assert.match(reportText, /Showing 5 of 5 findings/)
  await page.screenshot({ path: path.join(OUT, '03-report.png'), fullPage: true })

  // 7. Filter to high severity
  await page.getByRole('button', { name: /^High/ }).click()
  await expectText(page, /Showing 1 of 5 findings/)
  assert.match(
    await bodyText(page),
    /Potentially sensitive file publicly accessible/,
  )

  // 8. Search with no matches
  await page.getByLabel('Search findings').fill('zzzz-no-match')
  await expectText(page, /No findings match these filters/)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expectText(page, /Showing 5 of 5 findings/)

  // 9. Open finding detail
  await page
    .getByRole('button', {
      name: 'Potentially sensitive file publicly accessible',
    })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  const dialogText = await dialog.innerText()
  assert.match(dialogText, /EXAMPLE_API_SECRET=REDACTED_DEMO_VALUE/)
  assert.match(dialogText, /limitations and possible false positives/i)
  assert.match(dialogText, /how to verify the fix/i)
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })

  // 10. Export the report
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export report' }).click()
  const download = await downloadPromise
  assert.match(download.suggestedFilename(), /^webauditors-demo-report-.+\.md$/)
  const markdown = fs.readFileSync(await download.path(), 'utf8')
  assert.match(markdown, /DEMO DATA — No live security scan was performed/)
  assert.match(markdown, /Potentially sensitive file publicly accessible/)

  // 11. History and comparison in a fresh context (seeded scans only)
  const historyContext = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  })
  await historyContext.addInitScript(() => {})
  const historyPage = await historyContext.newPage()
  historyPage.on('pageerror', (error) =>
    errors.push(`history pageerror: ${error.message}`),
  )
  historyPage.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`history console: ${message.text()}`)
    }
  })

  await historyPage.goto(`${BASE}/history`, { waitUntil: 'networkidle' })
  await expectText(historyPage, /Compare two scans/)
  const checkboxes = historyPage.getByRole('checkbox')
  assert.equal(await checkboxes.count(), 3)
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()
  await historyPage
    .getByRole('button', { name: 'Compare selected (2/2)' })
    .click()
  await expectText(historyPage, /What changed between two demonstration reports\./)
  const compareText = await bodyText(historyPage)
  assert.match(compareText, /Introduced/)
  assert.match(compareText, /Resolved/)
  assert.match(compareText, /Public source map detected/)
  assert.match(compareText, /X-Frame-Options header missing/)
  await historyPage.screenshot({
    path: path.join(OUT, '04-history-compare.png'),
    fullPage: true,
  })

  // 12. Reset demo data restores the seeded scans
  await historyPage
    .getByRole('button', { name: 'Reset demo data' })
    .first()
    .click()
  await historyPage
    .getByRole('button', { name: 'Reset demo data' })
    .last()
    .click()
  await expectText(
    historyPage,
    /The seeded demonstration scans have been restored/,
  )
  assert.equal(await historyPage.getByRole('checkbox').count(), 3)

  // 13. Prototype auth screens validate locally and stay honest
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.waitForURL(/\/sign-in/)
  await expectText(page, /No credentials are sent/i)

  await page.getByLabel('Email address').fill('not-an-email')
  await page.getByLabel('Password').fill('demo-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expectText(page, /Enter a valid email address\./)

  await page.getByLabel('Email address').fill('demo@example.com')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expectText(page, /Prototype only/i)
  assert.match(
    await bodyText(page),
    /No credentials were sent, stored or checked/,
  )

  // Editing a field must withdraw the prototype status until the next submit.
  await page.getByLabel('Email address').fill('demo+edited@example.com')
  await page
    .getByText('No credentials were sent, stored or checked.')
    .waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expectText(page, /Prototype only/i)

  await page.screenshot({
    path: path.join(OUT, '12-signin.png'),
    fullPage: true,
  })

  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.waitForURL(/\/sign-up/)
  await page.getByLabel('Full name').fill('Demo User')
  await page.getByLabel('Email address').fill('demo@example.com')
  await page.getByLabel('Password', { exact: true }).fill('demo-password')
  await page.getByLabel('Confirm password').fill('different-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expectText(page, /Passwords do not match\./)

  await page.getByLabel('Confirm password').fill('demo-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expectText(page, /Prototype only/i)
  assert.match(
    await bodyText(page),
    /No account was created and nothing was stored/,
  )
  await page.screenshot({
    path: path.join(OUT, '13-signup.png'),
    fullPage: true,
  })

  // 14. Dashboard evidence pages
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await expectText(page, /Security dashboard/)
  const dashText = await bodyText(page)
  assert.match(dashText, /Four areas, one site/)
  assert.match(dashText, /Demo data — no live scan/i)
  assert.match(dashText, /Needs attention/)
  await page.screenshot({
    path: path.join(OUT, '08-dashboard.png'),
    fullPage: true,
  })

  await page.getByRole('link', { name: 'DNS configuration' }).click()
  await page.waitForURL(/\/dashboard\/dns/)
  await expectText(page, /Zone summary/)
  const dnsText = await bodyText(page)
  assert.match(dnsText, /203\.0\.113\.10/)
  assert.match(dnsText, /DMARC/)
  await page.screenshot({
    path: path.join(OUT, '09-dashboard-dns.png'),
    fullPage: true,
  })

  await page.getByRole('link', { name: 'HTTPS / TLS' }).click()
  await page.waitForURL(/\/dashboard\/tls/)
  await expectText(page, /TLS 1\.3/)
  assert.match(await bodyText(page), /HSTS/)
  await page.screenshot({
    path: path.join(OUT, '10-dashboard-tls.png'),
    fullPage: true,
  })

  // 15. Mobile navigation, report, history and dashboard
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await expectText(mobile, /What your site tells/)
  await mobile.getByRole('button', { name: 'Open menu' }).click()
  await mobile.getByRole('link', { name: 'How it works' }).first().click()
  await mobile.waitForURL(/\/how-it-works/)
  await expectText(mobile, /How WebAuditors works/)
  await mobile.screenshot({
    path: path.join(OUT, '05-mobile-how.png'),
    fullPage: true,
  })

  await mobile.goto(`${BASE}/reports/demo`, { waitUntil: 'networkidle' })
  await expectText(mobile, /No live security scan was performed/)
  await mobile.screenshot({
    path: path.join(OUT, '06-mobile-report.png'),
    fullPage: true,
  })

  await mobile.goto(`${BASE}/history`, { waitUntil: 'networkidle' })
  await expectText(mobile, /Compare two scans/)
  await mobile.screenshot({
    path: path.join(OUT, '07-mobile-history.png'),
    fullPage: true,
  })

  await mobile.goto(`${BASE}/dashboard/dns`, { waitUntil: 'networkidle' })
  await expectText(mobile, /203\.0\.113\.10/)
  await mobile.screenshot({
    path: path.join(OUT, '11-mobile-dashboard-dns.png'),
    fullPage: true,
  })

  await mobile.goto(`${BASE}/sign-in`, { waitUntil: 'networkidle' })
  await expectText(mobile, /Prototype boundaries/i)
  await mobile.screenshot({
    path: path.join(OUT, '14-mobile-signin.png'),
    fullPage: true,
  })

  // 16. Unknown routes
  await page.goto(`${BASE}/does-not-exist`, { waitUntil: 'networkidle' })
  await expectText(page, /Page not found/)

  if (errors.length > 0) {
    throw new Error(`Browser errors:\n${errors.join('\n')}`)
  }

  console.log('SMOKE TEST PASSED')
  console.log(`Screenshots: ${OUT}`)
} catch (error) {
  console.error('SMOKE TEST FAILED')
  console.error(error)
  if (errors.length > 0) {
    console.error(`Browser errors:\n${errors.join('\n')}`)
  }
  await page
    .screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true })
    .catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
