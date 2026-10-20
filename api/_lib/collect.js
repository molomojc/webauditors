import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { resolvePublicHost, ScanError } from './guard.js'

const USER_AGENT =
  'WebAuditorsBot/0.1 (+https://github.com/molomojc/webauditors; demonstration collector)'
const MAX_REDIRECTS = 5
const MAX_BODY_BYTES = 256 * 1024
const REQUEST_TIMEOUT_MS = 8000
const TOTAL_BUDGET_MS = 20000
const PROBE_PATHS = ['/robots.txt', '/.well-known/security.txt', '/.env.example']

const PICKED_HEADERS = [
  'content-type',
  'server',
  'x-powered-by',
  'via',
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cache-control',
]

// The connection is pinned to an address we already vetted, so the hostname
// cannot resolve to something else between validation and connect.
function pinnedLookup(address) {
  const family = net.isIP(address)

  return function lookupPinned(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (options && options.all) {
      callback(null, [{ address, family }])
      return
    }
    callback(null, address, family)
  }
}

function readTls(socket) {
  if (!socket || typeof socket.getPeerCertificate !== 'function') return null

  let certificate = {}
  try {
    certificate = socket.getPeerCertificate() ?? {}
  } catch {
    certificate = {}
  }

  const validTo = certificate.valid_to ? new Date(certificate.valid_to) : null
  const validFrom = certificate.valid_from ? new Date(certificate.valid_from) : null

  return {
    protocol: typeof socket.getProtocol === 'function' ? socket.getProtocol() : null,
    cipher:
      typeof socket.getCipher === 'function' ? (socket.getCipher()?.name ?? null) : null,
    authorized: Boolean(socket.authorized),
    authorizationError: socket.authorizationError
      ? String(socket.authorizationError)
      : null,
    issuer: certificate.issuer?.O ?? certificate.issuer?.CN ?? null,
    subject: certificate.subject?.CN ?? null,
    validFrom: validFrom ? validFrom.toISOString() : null,
    validTo: validTo ? validTo.toISOString() : null,
    daysRemaining: validTo
      ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000)
      : null,
    sanCount: certificate.subjectaltname
      ? certificate.subjectaltname.split(',').length
      : 0,
  }
}

function requestOnce(url, address, { maxBytes = MAX_BODY_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'https:'
    const transport = secure ? https : http

    const options = {
      method: 'GET',
      host: url.hostname,
      port: url.port || (secure ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      lookup: pinnedLookup(address),
      // A fresh, non-pooling agent per request. Node caches TLS sessions per
      // agent, and a resumed session hands back an empty peer certificate —
      // which would silently blank out the transport panel.
      agent: secure
        ? new https.Agent({ keepAlive: false, maxCachedSessions: 0 })
        : new http.Agent({ keepAlive: false }),
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en',
        connection: 'close',
      },
    }

    if (secure) options.servername = url.hostname

    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }

    const request = transport.request(options, (response) => {
      // Read the handshake details the moment headers arrive. By the time the
      // body ends the socket may already be torn down, and a closed TLSSocket
      // reports an empty certificate.
      const tls = secure ? readTls(response.socket) : null

      const headers = response.headers
      const contentType = String(headers['content-type'] ?? '')
      const textual = /text\/|json|xml|javascript|xhtml/i.test(contentType)

      const chunks = []
      let size = 0
      let truncated = false

      response.on('data', (chunk) => {
        if (!textual) return
        if (size >= maxBytes) {
          truncated = true
          return
        }
        const slice = chunk.subarray(0, maxBytes - size)
        chunks.push(slice)
        size += slice.length
        if (slice.length < chunk.length) truncated = true
      })

      response.on('end', () => {
        finish(resolve, {
          url: url.href,
          statusCode: response.statusCode ?? 0,
          headers,
          location: headers.location ?? null,
          body: Buffer.concat(chunks).toString('utf8'),
          bodyBytes: size,
          truncated,
          contentType,
          tls,
        })
      })

      response.on('error', (error) => finish(reject, error))
    })

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(
        new ScanError(504, 'The site did not respond in time.', 'timeout'),
      )
    })

    request.on('error', (error) => finish(reject, error))
    request.end()
  })
}

async function fetchHop(url) {
  const addresses = await resolvePublicHost(url.hostname)
  return requestOnce(url, addresses[0])
}

async function followRedirects(startUrl) {
  const redirects = []
  let current = startUrl
  let response = null

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    response = await fetchHop(current)

    const isRedirect = [301, 302, 303, 307, 308].includes(response.statusCode)
    if (!isRedirect || !response.location) break
    if (hop === MAX_REDIRECTS) {
      throw new ScanError(502, 'The site redirected too many times.', 'too_many_redirects')
    }

    let next
    try {
      next = new URL(response.location, current)
    } catch {
      throw new ScanError(502, 'The site returned an invalid redirect.', 'bad_redirect')
    }

    if (next.protocol !== 'http:' && next.protocol !== 'https:') {
      throw new ScanError(502, 'The site redirected to an unsupported scheme.', 'bad_redirect')
    }

    redirects.push({
      from: current.href,
      status: response.statusCode,
      to: next.href,
    })
    current = next
  }

  return { response, redirects, finalUrl: current }
}

async function runProbes(origin) {
  const results = []

  for (const probePath of PROBE_PATHS) {
    const url = new URL(probePath, origin)
    try {
      const response = await fetchHop(url)
      results.push({
        path: probePath,
        status: response.statusCode,
        bytes: response.bodyBytes,
        body: response.body.slice(0, 2048),
        contentType: response.contentType,
      })
    } catch {
      results.push({ path: probePath, status: null, error: 'unreachable' })
    }
  }

  return results
}

function pickHeaders(headers) {
  const picked = {}
  for (const name of PICKED_HEADERS) {
    const value = headers[name]
    if (value === undefined) continue
    picked[name] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return picked
}

function summarizeCookies(rawHeaders) {
  const header = rawHeaders['set-cookie']
  if (!header) return { count: 0, missing: [] }

  const cookies = Array.isArray(header) ? header : [header]
  const missing = []

  for (const cookie of cookies) {
    if (!/;\s*secure\b/i.test(cookie)) missing.push('Secure')
    if (!/;\s*httponly\b/i.test(cookie)) missing.push('HttpOnly')
    if (!/;\s*samesite=/i.test(cookie)) missing.push('SameSite')
  }

  return { count: cookies.length, missing: [...new Set(missing)] }
}

function documentSignals(body) {  if (!body) return null

  const titleMatch = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(body)
  const generatorMatch = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.exec(body)
  const mixedContent = body.match(/(?:src|href)=["']http:\/\//gi) ?? []

  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    generator: generatorMatch ? generatorMatch[1].trim() : null,
    hasSourceMap: /sourceMappingURL=/i.test(body),
    mixedContentCount: mixedContent.length,
    debugSignals: /(stack trace|traceback \(most recent call last\)|whoops|laravel_|debug mode|django debug)/i.test(
      body,
    ),
  }
}

export async function collectSite(url) {
  const startedAt = Date.now()
  const deadline = startedAt + TOTAL_BUDGET_MS

  const { response, redirects, finalUrl } = await followRedirects(url)

  if (Date.now() > deadline) {
    throw new ScanError(504, 'The site took too long to answer.', 'timeout')
  }

  const html = /html|xhtml/i.test(response.contentType) ? response.body : ''
  const probes = html ? await runProbes(new URL(finalUrl)) : []

  return {
    ok: true,
    target: url.href,
    finalUrl: finalUrl.href,
    fetchedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    redirects,
    response: {
      status: response.statusCode,
      headers: pickHeaders(response.headers),
      contentType: response.contentType,
      bodyBytes: response.bodyBytes,
      truncated: response.truncated,
    },
    tls: response.tls,
    cookies: summarizeCookies(response.headers),
    document: documentSignals(html),
    probes: probes.map(({ body, ...rest }) => rest),
    probeBodies: Object.fromEntries(
      probes.filter((probe) => probe.body).map((probe) => [probe.path, probe.body]),
    ),
    limits: [
      'One page was requested, plus three well-known paths. Nothing was fuzzed or crawled.',
      'Only headers, TLS details and the document body were inspected.',
      'A missing header is recorded as an observation, not a vulnerability.',
    ],
  }
}
