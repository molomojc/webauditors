import assert from 'node:assert/strict'
import http from 'node:http'
import { documentSignals, fetchWithRedirects, pickHeaders, probePath, summarizeCookies } from '../api/_lib/collect.js'

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

// A test that hangs is worse than a test that fails: cap every network-adjacent
// assertion so CI cannot stall on a missing rejection.
function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms: ${label}`)),
      ms,
    )
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

console.log('collector: document signals')

const BASE = 'https://example.com/app/page.html'

const DOCUMENT = `<!doctype html>
<html lang="en">
  <head>
    <title>  Example Shop  </title>
    <meta name="generator" content="WordPress 6.4">
    <link rel="stylesheet" href="/assets/site.css">
    <link rel="stylesheet" href="https://cdn.example.net/theme.css">
    <script src="/js/app.js"></script>
    <script src="vendor.js"></script>
    <script src="/js/app.js"></script>
    <script src="https://cdn.example.net/lib.js?v=2"></script>
    <script>window.inline = true</script>
  </head>
  <body>
    <input type="password" name="password">
  </body>
</html>
//# sourceMappingURL=app.js.map
`

const signals = documentSignals(DOCUMENT, BASE)

test('extracts and trims the title', () => {
  assert.equal(signals.title, 'Example Shop')
})

test('extracts the generator meta tag', () => {
  assert.equal(signals.generator, 'WordPress 6.4')
})

test('extracts script sources without inline scripts', () => {
  assert.equal(signals.scriptSrcs.length, 3)
  assert.ok(signals.scriptSrcs.includes('https://example.com/js/app.js'))
  assert.equal(signals.inlineScriptCount, 1)
})

test('resolves relative script urls against the base url', () => {
  assert.ok(
    signals.scriptSrcs.includes('https://example.com/app/vendor.js'),
    `expected vendor.js to resolve, got ${signals.scriptSrcs.join(', ')}`,
  )
})

test('keeps absolute script urls and their query strings', () => {
  assert.ok(
    signals.scriptSrcs.includes('https://cdn.example.net/lib.js?v=2'),
    'expected the CDN script to be kept verbatim',
  )
})

test('deduplicates repeated script urls', () => {
  const appScripts = signals.scriptSrcs.filter(
    (url) => url === 'https://example.com/js/app.js',
  )
  assert.equal(appScripts.length, 1)
  assert.equal(signals.scriptSrcs.length, 3)
})

test('extracts and resolves stylesheet hrefs', () => {
  assert.deepEqual(signals.stylesheetHrefs, [
    'https://example.com/assets/site.css',
    'https://cdn.example.net/theme.css',
  ])
})

test('detects sourceMappingURL and resolves it', () => {
  assert.equal(signals.hasSourceMap, true)
  assert.equal(signals.sourceMapUrl, 'https://example.com/app/app.js.map')
})

test('reports no source map when absent', () => {
  const plain = documentSignals('<html><head><title>Plain</title></head></html>', BASE)
  assert.equal(plain.hasSourceMap, false)
  assert.equal(plain.sourceMapUrl, null)
})

test('counts mixed-content http references only', () => {
  const mixed = documentSignals(
    `<html><head>
      <script src="http://insecure.example.com/app.js"></script>
      <link rel="stylesheet" href="http://insecure.example.com/site.css">
      <script src="https://secure.example.com/app.js"></script>
    </head></html>`,
    BASE,
  )

  assert.equal(mixed.mixedContentCount, 2)
})

test('detects debug signal text', () => {
  const debug = documentSignals(
    '<html><body><pre>Traceback (most recent call last): KeyError</pre></body></html>',
    BASE,
  )

  assert.equal(debug.debugSignals, true)
})

test('does not flag debug signals in a clean page', () => {
  assert.equal(signals.debugSignals, false)
})

test('detects a password input', () => {
  assert.equal(signals.hasPasswordInput, true)
})

test('reports no password input when absent', () => {
  const plain = documentSignals('<html><body><input type="text"></body></html>', BASE)
  assert.equal(plain.hasPasswordInput, false)
})

test('returns null for an empty body', () => {
  assert.equal(documentSignals('', BASE), null)
})

test('returns null for a missing body', () => {
  assert.equal(documentSignals(null, BASE), null)
})

console.log('collector: cookie summarisation')

test('returns zero cookies when no header is present', () => {
  assert.deepEqual(summarizeCookies({}), { count: 0, missing: [] })
})

test('counts Set-Cookie headers', () => {
  const result = summarizeCookies({
    'set-cookie': ['a=1; Secure; HttpOnly; SameSite=Lax', 'b=2', 'c=3'],
  })
  assert.equal(result.count, 3)
})

test('reports missing flags across several cookies without duplicates', () => {
  const result = summarizeCookies({
    'set-cookie': [
      'a=1; Secure; HttpOnly; SameSite=Lax',
      'b=2',
      'c=3; Secure; SameSite=None',
    ],
  })

  assert.deepEqual(result.missing, ['Secure', 'HttpOnly', 'SameSite'])
})

test('accepts a single set-cookie string', () => {
  const result = summarizeCookies({
    'set-cookie': 'sid=abc; Secure; HttpOnly; SameSite=Strict',
  })

  assert.equal(result.count, 1)
  assert.deepEqual(result.missing, [])
})

test('reports only SameSite when Secure and HttpOnly are set', () => {
  const result = summarizeCookies({
    'set-cookie': ['sid=abc; Secure; HttpOnly; Path=/'],
  })

  assert.equal(result.count, 1)
  assert.deepEqual(result.missing, ['SameSite'])
})

console.log('collector: header picking')

test('keeps only the chosen headers', () => {
  const picked = pickHeaders({
    server: 'nginx/1.25.3',
    'content-type': 'text/html; charset=utf-8',
    'x-custom-debug': 'yes',
    'set-cookie': ['a=1'],
  })

  assert.deepEqual(picked, {
    'content-type': 'text/html; charset=utf-8',
    server: 'nginx/1.25.3',
  })
})

test('joins array header values', () => {
  const picked = pickHeaders({
    'cache-control': ['no-store', 'must-revalidate'],
    'content-security-policy': ["default-src 'self'", "img-src 'self'"],
  })

  assert.equal(picked['cache-control'], 'no-store, must-revalidate')
  assert.equal(
    picked['content-security-policy'],
    "default-src 'self', img-src 'self'",
  )
})

test('drops headers that are absent', () => {
  const picked = pickHeaders({ server: 'caddy' })

  assert.equal('strict-transport-security' in picked, false)
  assert.equal('x-frame-options' in picked, false)
  assert.deepEqual(Object.keys(picked), ['server'])
})

test('stringifies non-array header values', () => {
  const picked = pickHeaders({ 'x-powered-by': 'PHP/8.3', 'x-frame-options': 0 })

  assert.equal(picked['x-powered-by'], 'PHP/8.3')
  assert.equal(picked['x-frame-options'], '0')
})

console.log('collector: probe path validation')

const ORIGIN = 'https://example.com/'

await testAsync('rejects a path without a leading slash', async () => {
  await assert.rejects(probePath(ORIGIN, 'robots.txt'), { code: 'invalid_path' })
})

await testAsync('rejects an empty path', async () => {
  await assert.rejects(probePath(ORIGIN, ''), { code: 'invalid_path' })
})

await testAsync('rejects a non-string path', async () => {
  await assert.rejects(probePath(ORIGIN, null), { code: 'invalid_path' })
})

await testAsync('rejects a path over 200 characters', async () => {
  const longPath = `/${'a'.repeat(200)}`

  await assert.rejects(probePath(ORIGIN, longPath), (error) => {
    assert.equal(error.code, 'invalid_path')
    assert.equal(error.status, 400)
    return true
  })
})

console.log('collector: ssrf guard blocks loopback')

let serverHits = 0
const server = http.createServer((request, response) => {
  serverHits += 1
  response.end('this should never be reached')
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const localOrigin = `http://127.0.0.1:${port}`

try {
  await testAsync('fetchWithRedirects refuses a loopback target', async () => {
    await withTimeout(
      assert.rejects(fetchWithRedirects(new URL(`${localOrigin}/`)), {
        code: 'blocked_host',
      }),
      5000,
      'fetchWithRedirects loopback',
    )
  })

  await testAsync('probePath refuses a loopback target instead of hanging', async () => {
    await withTimeout(
      assert.rejects(probePath(`${localOrigin}/`, '/robots.txt'), {
        code: 'blocked_host',
      }),
      5000,
      'probePath loopback',
    )
  })

  await testAsync('never opens a connection to the blocked server', async () => {
    assert.equal(serverHits, 0)
  })
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

console.log(`\n${passed} assertions passed`)
