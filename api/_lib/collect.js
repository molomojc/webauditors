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

function requestOnce(url, address, { maxBytes = MAX_BODY_BYTES, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ScanError(499, 'The run was cancelled.', 'aborted'))
      return
    }

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
    let deadline
    let onAbort = null

    const cleanup = () => {
      if (deadline) clearTimeout(deadline)
      if (signal && onAbort) signal.removeEventListener('abort', onAbort)
    }

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      cleanup()
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

    // A socket idle timeout does not stop a peer that drips one byte at a time.
    // The deadline is wall-clock, and it is cleared by finish().
    deadline = setTimeout(() => {
      request.destroy(
        new ScanError(504, 'The site did not respond in time.', 'timeout'),
      )
    }, REQUEST_TIMEOUT_MS)

    if (signal) {
      onAbort = () => {
        request.destroy(new ScanError(499, 'The run was cancelled.', 'aborted'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    request.on('error', (error) => finish(reject, error))
    request.end()
  })
}

async function fetchHop(url, options) {
  const addresses = await resolvePublicHost(url.hostname)
  return requestOnce(url, addresses[0], options)
}

// Follows redirects one hop at a time, validating every destination. Returns
// the final response plus the chain, so callers cannot accidentally skip the
// guard by letting a client library follow redirects for them.
export async function fetchWithRedirects(
  startUrl,
  { maxBytes, signal, allowedOrigin } = {},
) {
  const redirects = []
  let current = startUrl
  let response = null

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    response = await fetchHop(current, { maxBytes, signal })

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

    const nextPort = next.port || (next.protocol === 'https:' ? '443' : '80')
    if (!['80', '443'].includes(nextPort)) {
      throw new ScanError(
        502,
        'The site redirected to an unsupported port.',
        'blocked_port',
      )
    }

    if (allowedOrigin && next.origin !== allowedOrigin) {
      throw new ScanError(
        502,
        'The request left the target origin.',
        'off_origin_redirect',
      )
    }

    redirects.push({
      from: current.href.slice(0, 300),
      status: response.statusCode,
      to: next.href.slice(0, 300),
    })
    current = next
  }

  return { response, redirects, finalUrl: current }
}

export function pickHeaders(headers) {
  const picked = {}
  for (const name of PICKED_HEADERS) {
    const value = headers[name]
    if (value === undefined) continue
    const text = Array.isArray(value) ? value.join(', ') : String(value)
    picked[name] = text.slice(0, 400)
  }
  return picked
}

export function summarizeCookies(rawHeaders) {
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

function absolute(reference, baseUrl) {
  try {
    return new URL(reference, baseUrl).href
  } catch {
    return null
  }
}

function collectRefs(html, pattern, baseUrl, limit) {
  const found = []
  for (const match of html.matchAll(pattern)) {
    const resolved = absolute(match[1], baseUrl)
    // Drop oversized references outright: a truncated URL is not fetchable,
    // and a site-controlled 200KB "URL" is an injection surface, not evidence.
    if (resolved && resolved.length <= 300) found.push(resolved)
  }
  return [...new Set(found)].slice(0, limit)
}

export function documentSignals(body, baseUrl) {
  if (!body) return null

  const titleMatch = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(body)
  const generatorMatch =
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.exec(body)
  const mixedContent = body.match(/(?:src|href)=["']http:\/\//gi) ?? []
  const sourceMapRef = /\/\/[#@]\s*sourceMappingURL=([^\s*'"]+)/i.exec(body)
  const sourceMap = sourceMapRef ? absolute(sourceMapRef[1], baseUrl) : null

  return {
    title: titleMatch ? titleMatch[1].trim().slice(0, 120) : null,
    generator: generatorMatch ? generatorMatch[1].trim().slice(0, 80) : null,
    hasSourceMap: /sourceMappingURL=/i.test(body),
    sourceMapUrl: sourceMap && sourceMap.length <= 300 ? sourceMap : null,
    mixedContentCount: mixedContent.length,
    debugSignals:
      /(stack trace|traceback \(most recent call last\)|whoops|laravel_|debug mode|django debug)/i.test(
        body,
      ),
    scriptSrcs: collectRefs(
      body,
      /<script[^>]+src=["']([^"']+)["']/gi,
      baseUrl,
      25,
    ),
    stylesheetHrefs: collectRefs(
      body,
      /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi,
      baseUrl,
      10,
    ),
    inlineScriptCount: (body.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) ?? []).length,
    hasPasswordInput: /<input[^>]+type=["']password["']/i.test(body),
  }
}

export async function collectDocument(url, { signal } = {}) {
  const startedAt = Date.now()
  const { response, redirects, finalUrl } = await fetchWithRedirects(url, { signal })

  if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
    throw new ScanError(504, 'The site took too long to answer.', 'timeout')
  }

  const html = /html|xhtml/i.test(response.contentType) ? response.body : ''

  return {
    target: url.href,
    finalUrl: finalUrl.href,
    fetchedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    redirects,
    status: response.statusCode,
    headers: pickHeaders(response.headers),
    contentType: response.contentType,
    bodyBytes: response.bodyBytes,
    truncated: response.truncated,
    tls: response.tls,
    cookies: summarizeCookies(response.headers),
    document: documentSignals(html, finalUrl.href),
  }
}

// A caller-controlled path on the target origin. The agent chooses the path;
// it cannot choose the host, scheme or port.
export async function probePath(
  origin,
  requestPath,
  { maxBytes = 64 * 1024, signal, sameOrigin = false } = {},
) {
  if (typeof requestPath !== 'string' || !requestPath.startsWith('/')) {
    throw new ScanError(400, 'Probe paths must start with a slash.', 'invalid_path')
  }
  // `//host` and backslashes resolve to another authority under WHATWG URL
  // rules. Refuse both rather than trust the string test above.
  if (requestPath.startsWith('//') || requestPath.includes('\\')) {
    throw new ScanError(400, 'Probe paths must stay on the target origin.', 'invalid_path')
  }
  if (requestPath.length > 200) {
    throw new ScanError(400, 'Probe path is too long.', 'invalid_path')
  }

  const url = new URL(requestPath, origin)
  if (url.origin !== new URL(origin).origin) {
    throw new ScanError(400, 'Probe paths must stay on the target origin.', 'invalid_path')
  }

  const { response, redirects, finalUrl } = await fetchWithRedirects(url, {
    maxBytes,
    signal,
    allowedOrigin: sameOrigin ? new URL(origin).origin : undefined,
  })

  return {
    path: requestPath,
    status: response.statusCode,
    bytes: response.bodyBytes,
    contentType: response.contentType,
    truncated: response.truncated,
    redirectedTo: redirects.length ? finalUrl.href.slice(0, 300) : null,
    body: response.body.slice(0, 4096),
    headers: pickHeaders(response.headers),
  }
}

async function runProbes(origin) {
  const results = []

  for (const probePathName of PROBE_PATHS) {
    try {
      const probe = await probePath(origin, probePathName)
      results.push({
        path: probe.path,
        status: probe.status,
        bytes: probe.bytes,
        body: probe.body,
        contentType: probe.contentType,
      })
    } catch {
      results.push({ path: probePathName, status: null, error: 'unreachable' })
    }
  }

  return results
}

export async function collectSite(url) {
  const document = await collectDocument(url)
  const probes = document.document
    ? await runProbes(document.finalUrl)
    : []

  return {
    ok: true,
    target: document.target,
    finalUrl: document.finalUrl,
    fetchedAt: document.fetchedAt,
    durationMs: document.durationMs,
    redirects: document.redirects,
    response: {
      status: document.status,
      headers: document.headers,
      contentType: document.contentType,
      bodyBytes: document.bodyBytes,
      truncated: document.truncated,
    },
    tls: document.tls,
    cookies: document.cookies,
    document: document.document,
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
