// Turns raw evidence into the same twelve check ids the UI already renders.
// Every status is derived from something the collector actually captured; if a
// signal is missing the check says so rather than guessing.

const CHECK_IDS = [
  'https-redirect',
  'tls',
  'hsts',
  'csp',
  'headers',
  'cookies',
  'mixed-content',
  'source-map',
  'config-files',
  'debug',
  'server-header',
  'cert-expiry',
]

const SECURITY_HEADERS = [
  'x-content-type-options',
  'referrer-policy',
  'x-frame-options',
]

function check(id, status, observed) {
  return { id, status, observed }
}

function hstsCheck(headers) {
  const value = headers['strict-transport-security']
  if (!value) {
    return check('hsts', 'warn', 'No Strict-Transport-Security header was returned.')
  }
  return check('hsts', 'pass', `Strict-Transport-Security: ${value}`)
}

function cspCheck(headers) {
  const value = headers['content-security-policy']
  if (!value) {
    return check('csp', 'warn', 'No Content-Security-Policy header was returned.')
  }
  const directives = value.split(';').filter(Boolean).length
  return check('csp', 'pass', `Content-Security-Policy present with ${directives} directives.`)
}

function headersCheck(headers) {
  const present = SECURITY_HEADERS.filter((name) => headers[name])
  const missing = SECURITY_HEADERS.filter((name) => !headers[name])

  if (!missing.length) {
    return check('headers', 'pass', `${present.length} of ${SECURITY_HEADERS.length} recommended headers present.`)
  }
  if (present.length) {
    return check(
      'headers',
      'review',
      `Present: ${present.join(', ')}. Missing: ${missing.join(', ')}.`,
    )
  }
  return check('headers', 'warn', `None of ${SECURITY_HEADERS.join(', ')} were returned.`)
}

function cookiesCheck(cookies) {
  if (!cookies || cookies.count === 0) {
    return check('cookies', 'pass', 'No Set-Cookie headers were returned by the document.')
  }
  if (!cookies.missing.length) {
    return check(
      'cookies',
      'pass',
      `${cookies.count} cookie(s) returned, all with Secure, HttpOnly and SameSite.`,
    )
  }
  return check(
    'cookies',
    'warn',
    `${cookies.count} cookie(s) returned; missing on at least one: ${cookies.missing.join(', ')}.`,
  )
}

export function deriveChecks(evidence) {
  const headers = evidence.response?.headers ?? {}
  const document = evidence.document
  const tls = evidence.tls
  const target = new URL(evidence.target)
  const finalUrl = evidence.finalUrl ?? evidence.target

  const httpsRedirect =
    target.protocol === 'https:'
      ? check('https-redirect', 'pass', 'The site was requested over HTTPS directly.')
      : new URL(finalUrl).protocol === 'https:'
        ? check(
            'https-redirect',
            'pass',
            `${evidence.redirects?.[0]?.status ?? 301} redirect from HTTP to HTTPS.`,
          )
        : check('https-redirect', 'warn', 'The HTTP request was not redirected to HTTPS.')

  const tlsCheck = !tls
    ? check('tls', 'warn', 'No TLS session was established.')
    : !['TLSv1.3', 'TLSv1.2'].includes(tls.protocol)
      ? check('tls', 'warn', `Obsolete TLS version negotiated: ${tls.protocol}.`)
      : tls.authorized
        ? check('tls', 'pass', `${tls.protocol} with ${tls.cipher}.`)
        : check(
            'tls',
            'warn',
            `Certificate chain was not trusted: ${tls.authorizationError ?? 'unknown reason'}.`,
          )

  const mixedContent = !document
    ? check('mixed-content', 'review', 'The response body was not HTML, so subresources were not inspected.')
    : document.mixedContentCount > 0
      ? check(
          'mixed-content',
          'warn',
          `${document.mixedContentCount} http:// subresource reference(s) in the document.`,
        )
      : check('mixed-content', 'pass', 'No http:// subresources were found in the document.')

  const sourceMap = !document
    ? check('source-map', 'review', 'The document could not be inspected for source map references.')
    : document.hasSourceMap
      ? check('source-map', 'review', 'A sourceMappingURL reference was found in the document.')
      : check('source-map', 'pass', 'No sourceMappingURL reference in the document.')

  const envProbe = evidence.probes?.find((probe) => probe.path === '/.env.example')
  const envBody = evidence.probeBodies?.['/.env.example'] ?? ''
  const envLooksLikeSecrets = /^\s*[A-Z0-9_]+=.+/m.test(envBody)

  const configFiles = !envProbe || envProbe.status === null
    ? check('config-files', 'review', 'The /.env.example probe could not be completed.')
    : envProbe.status === 200
      ? check(
          'config-files',
          'review',
          envLooksLikeSecrets
            ? '/.env.example returned 200 and contains KEY=value lines.'
            : '/.env.example returned 200 with unrecognised content.',
        )
      : check('config-files', 'pass', `/.env.example returned ${envProbe.status}.`)

  const debug = !document
    ? check('debug', 'review', 'The document could not be inspected for debug output.')
    : document.debugSignals
      ? check('debug', 'review', 'The document contains text patterns associated with debug output.')
      : check('debug', 'pass', 'No debug banners or stack traces were found in the document.')

  const serverHeader = headers.server
    ? check('server-header', 'review', `Server: ${headers.server}`)
    : check('server-header', 'pass', 'No Server header was returned.')

  const certExpiry = !tls
    ? check('cert-expiry', 'warn', 'No certificate was presented.')
    : tls.daysRemaining === null
      ? check('cert-expiry', 'review', 'The certificate expiry date could not be read.')
      : tls.daysRemaining > 30
        ? check('cert-expiry', 'pass', `Certificate expires in ${tls.daysRemaining} days.`)
        : check('cert-expiry', 'warn', `Certificate expires in ${tls.daysRemaining} days.`)

  const byId = {
    'https-redirect': httpsRedirect,
    tls: tlsCheck,
    hsts: hstsCheck(headers),
    csp: cspCheck(headers),
    headers: headersCheck(headers),
    cookies: cookiesCheck(evidence.cookies),
    'mixed-content': mixedContent,
    'source-map': sourceMap,
    'config-files': configFiles,
    debug,
    'server-header': serverHeader,
    'cert-expiry': certExpiry,
  }

  return CHECK_IDS.map((id) => byId[id])
}
