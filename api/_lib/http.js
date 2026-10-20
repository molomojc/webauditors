import { ScanError } from './guard.js'

const DEFAULT_MAX_BYTES = 8 * 1024

// Vercel parses JSON bodies for Node functions; the dev middleware hands us the
// raw stream instead, so both shapes are supported.
export function readJsonBody(request, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
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
      if (raw.length > maxBytes) {
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
