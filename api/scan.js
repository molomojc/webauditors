import { normaliseTarget, ScanError } from './_lib/guard.js'
import { collectSite } from './_lib/collect.js'
import { deriveChecks } from './_lib/checks.js'

const MAX_REQUEST_BYTES = 8 * 1024

function readJsonBody(request) {
  // Vercel parses JSON bodies for Node functions; the dev middleware hands us
  // the raw stream instead, so both shapes are supported.
  if (request.body && typeof request.body === 'object') {
    return Promise.resolve(request.body)
  }

  if (typeof request.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(request.body))
    } catch {
      return Promise.reject(new ScanError(400, 'Send a JSON body.', 'invalid_body'))
    }
  }

  return new Promise((resolve, reject) => {
    let raw = ''
    let settled = false

    request.on('data', (chunk) => {
      if (settled) return
      raw += chunk
      if (raw.length > MAX_REQUEST_BYTES) {
        settled = true
        reject(new ScanError(413, 'Request body is too large.', 'body_too_large'))
        request.destroy()
      }
    })

    request.on('end', () => {
      if (settled) return
      settled = true
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new ScanError(400, 'Send a JSON body.', 'invalid_body'))
      }
    })

    request.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

export default async function handler(request, response) {
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')

  if (request.method !== 'POST') {
    response.statusCode = 405
    response.setHeader('allow', 'POST')
    response.end(
      JSON.stringify({ ok: false, code: 'method_not_allowed', error: 'Use POST.' }),
    )
    return
  }

  try {
    const payload = await readJsonBody(request)
    const target = normaliseTarget(payload?.url)
    const evidence = await collectSite(target)

    response.statusCode = 200
    response.end(
      JSON.stringify({
        ...evidence,
        checks: deriveChecks(evidence),
      }),
    )
  } catch (error) {
    const status = error instanceof ScanError ? error.status : 502
    response.statusCode = status
    response.end(
      JSON.stringify({
        ok: false,
        code: error?.code ?? 'scan_failed',
        error:
          error instanceof ScanError
            ? error.message
            : 'The site could not be reached by the collector.',
      }),
    )
  }
}
