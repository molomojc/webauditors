import { normaliseTarget, ScanError } from './_lib/guard.js'
import { collectSite } from './_lib/collect.js'
import { deriveChecks } from './_lib/checks.js'
import { readJsonBody } from './_lib/http.js'

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
