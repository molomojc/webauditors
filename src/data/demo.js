// All content in this file is demonstration data. Nothing here is fetched
// from a live website and no network requests are made by the application.

export const DEMO_TARGET = 'https://demo.example.com'

export const SEVERITIES = {
  high: {
    key: 'high',
    label: 'High',
    shortLabel: 'High',
    rank: 0,
    badge: 'bg-red-500/10 text-red-300 ring-red-500/30',
    dot: 'bg-red-500',
    text: 'text-red-300',
    soft: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  medium: {
    key: 'medium',
    label: 'Medium',
    shortLabel: 'Medium',
    rank: 1,
    badge: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
    dot: 'bg-amber-500',
    text: 'text-amber-300',
    soft: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  info: {
    key: 'info',
    label: 'Informational',
    shortLabel: 'Info',
    rank: 2,
    badge: 'bg-blue-500/10 text-blue-300 ring-blue-500/30',
    dot: 'bg-blue-500',
    text: 'text-blue-300',
    soft: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
}

export const CHECK_GROUPS = {
  transport: 'Transport & certificates',
  headers: 'Security headers & cookies',
  exposure: 'Public files & content',
  disclosure: 'Information disclosure',
}

export const CHECKS = [
  {
    id: 'https-redirect',
    name: 'HTTPS redirect behaviour',
    group: 'transport',
    description:
      'Checks whether plain HTTP requests are redirected to HTTPS.',
    results: {
      pass: 'HTTP requests redirect to HTTPS in the simulated response.',
      warn: 'The simulated HTTP response did not redirect to HTTPS.',
    },
  },
  {
    id: 'tls',
    name: 'TLS connection acceptance',
    group: 'transport',
    description:
      'Checks that a TLS connection is accepted with a valid certificate chain.',
    results: {
      pass: 'The simulated TLS handshake succeeded with a valid certificate chain.',
      warn: 'The simulated TLS handshake did not complete.',
    },
  },
  {
    id: 'hsts',
    name: 'HTTP Strict Transport Security (HSTS)',
    group: 'headers',
    description:
      'Checks for the Strict-Transport-Security response header.',
    results: {
      pass: 'Strict-Transport-Security was present in the simulated response.',
      warn: 'Strict-Transport-Security was not present in the simulated HTTPS response.',
    },
  },
  {
    id: 'csp',
    name: 'Content Security Policy',
    group: 'headers',
    description:
      'Checks for a Content-Security-Policy response header.',
    results: {
      pass: 'Content-Security-Policy was present in the simulated response.',
      warn: 'Content-Security-Policy was not present in the simulated response.',
    },
  },
  {
    id: 'headers',
    name: 'Other common security headers',
    group: 'headers',
    description:
      'Checks for X-Content-Type-Options, Referrer-Policy and X-Frame-Options.',
    results: {
      pass: 'X-Content-Type-Options, Referrer-Policy and X-Frame-Options were present (simulated).',
      warn: 'One or more common security headers were missing in the simulated response.',
      review: 'Header presence is mixed; manual review of the simulated response is suggested.',
    },
  },
  {
    id: 'cookies',
    name: 'Cookie security attributes',
    group: 'headers',
    description:
      'Checks Secure, HttpOnly and SameSite flags on cookies in the sample response.',
    results: {
      pass: 'Session cookie flags Secure, HttpOnly and SameSite were present (simulated).',
      warn: 'One or more cookie security attributes were missing in the simulated response.',
    },
  },
  {
    id: 'mixed-content',
    name: 'Mixed content',
    group: 'exposure',
    description:
      'Checks whether HTTPS pages reference insecure HTTP resources.',
    results: {
      pass: 'No HTTP subresources were observed in the simulated response.',
      warn: 'The simulated page referenced an insecure HTTP resource.',
    },
  },
  {
    id: 'source-map',
    name: 'Public source map exposure',
    group: 'exposure',
    description:
      'Looks for JavaScript source maps that are publicly reachable.',
    results: {
      pass: 'No public source map reference was found in the simulated assets.',
      review: 'A simulated asset referenced main.js.map.',
    },
  },
  {
    id: 'config-files',
    name: 'Common public configuration-file exposure',
    group: 'exposure',
    description:
      'Checks common configuration paths such as /.env.example.',
    results: {
      pass: 'No common configuration files were reachable in the simulated responses.',
      review:
        'A simulated /.env.example request returned a 200 response containing a placeholder secret.',
    },
  },
  {
    id: 'debug',
    name: 'Potential debug information exposure',
    group: 'disclosure',
    description:
      'Looks for stack traces, debug banners or verbose errors in sample responses.',
    results: {
      pass: 'No stack traces or debug banners were present in the simulated responses.',
      review: 'The simulated response contained output that may reveal debug details.',
    },
  },
  {
    id: 'server-header',
    name: 'Server technology disclosure',
    group: 'disclosure',
    description:
      'Checks whether responses reveal server software details.',
    results: {
      pass: 'No server identification header was present in the simulated response.',
      review: 'The simulated response included a generic Server header.',
    },
  },
  {
    id: 'cert-expiry',
    name: 'HTTPS certificate expiry',
    group: 'transport',
    description:
      'Checks the remaining lifetime of the certificate in the simulation.',
    results: {
      pass: 'The simulated certificate chain is valid and not close to expiry.',
      warn: 'The simulated certificate is close to expiry.',
    },
  },
]

export const FINDINGS = {
  'exposed-config': {
    id: 'exposed-config',
    severity: 'high',
    title: 'Potentially sensitive file publicly accessible',
    category: 'Public file exposure',
    checkId: 'config-files',
    riskType: 'Confirmed observation',
    kind: 'Confirmed observation (simulated)',
    description:
      'A sample public configuration file contains a placeholder credential.',
    evidence:
      'GET /.env.example → HTTP 200 (simulated)\n\nEXAMPLE_API_SECRET=REDACTED_DEMO_VALUE',
    evidenceNote:
      'Illustrative response only. No request was made to demo.example.com.',
    why:
      'Configuration files are sometimes deployed by mistake. When they contain live credentials, anyone who can reach the file may be able to use those credentials against connected services.',
    impact:
      'If this file existed with real values, exposed API keys or database credentials could allow unauthorised access. In this mockup the value is a placeholder and no real system is affected.',
    recommendation:
      'Remove secrets from public assets, rotate any real exposed credentials, and keep sensitive configuration on the server.',
    verification: [
      'Request the file from a browser or with curl and confirm it returns 404 or 403.',
      'Review build and deployment output to ensure dotfiles and local configuration are excluded.',
      'If a real credential was exposed, rotate it and review provider logs for misuse.',
    ],
    confidence: 'High — the simulated response clearly shows a public 200 response.',
    limitations:
      'This is a simulated observation. The prototype does not verify whether the file exists, whether the value is live, or whether the file is reachable in production. Some public files are intentional, so manual review is required.',
  },
  'csp-missing': {
    id: 'csp-missing',
    severity: 'medium',
    title: 'Content Security Policy missing',
    category: 'Security headers',
    checkId: 'csp',
    riskType: 'Potential risk',
    kind: 'Observation + potential risk (simulated)',
    description:
      'The sample response does not include a Content-Security-Policy header.',
    evidence:
      'Content-Security-Policy: Not present in demonstration response.',
    evidenceNote:
      'Header absence was observed in the simulated response only.',
    why:
      'A CSP limits which scripts, styles, frames and connections a page is allowed to load. Without one, a script-injection flaw is easier to exploit.',
    impact:
      'Potential risk, not a confirmed vulnerability. A missing CSP does not by itself mean the site is exploitable; it removes a defence-in-depth layer that can reduce the impact of other flaws.',
    recommendation:
      "Define an appropriate policy based on the website's scripts, styles, images, and other resources. Test it before enforcing it in production.",
    verification: [
      'Confirm the header appears on HTML responses using browser developer tools or curl -I.',
      'Check the browser console for CSP violations on key pages.',
      'Consider Content-Security-Policy-Report-Only first if rollout risk is high.',
    ],
    confidence:
      'High — the absence of the header in the simulated response is unambiguous.',
    limitations:
      'Header absence is an observation; exploitability depends on application behaviour and other controls. This check does not test for injection flaws and cannot confirm that the site is vulnerable.',
  },
  'hsts-missing': {
    id: 'hsts-missing',
    severity: 'medium',
    title: 'HSTS header missing',
    category: 'Security headers',
    checkId: 'hsts',
    riskType: 'Potential risk',
    kind: 'Observation + potential risk (simulated)',
    description:
      'The sample HTTPS response does not include Strict-Transport-Security.',
    evidence:
      'Strict-Transport-Security: Not present in demonstration response.',
    evidenceNote:
      'Header absence was observed in the simulated HTTPS response only.',
    why:
      'HSTS tells browsers to use HTTPS for future visits, which reduces exposure to protocol downgrade and cookie-hijacking attacks.',
    impact:
      'Potential risk, not a confirmed vulnerability. Without HSTS a browser may still attempt HTTP first, but the practical impact depends on network conditions and existing redirects.',
    recommendation:
      'If the site is HTTPS-only and its subdomains are ready, configure HSTS with a suitable max-age and deployment strategy.',
    verification: [
      'Confirm the header is returned over HTTPS using browser developer tools or curl -I.',
      'Verify the max-age value and whether includeSubDomains is appropriate for every subdomain.',
      'Roll out gradually — browsers cache HSTS, so mistakes are difficult to undo quickly.',
    ],
    confidence:
      'High — the absence of the header in the simulated response is unambiguous.',
    limitations:
      'Missing HSTS does not mean traffic is currently unencrypted, and this check does not attempt a downgrade attack. It reports an observation about one simulated response.',
  },
  'source-map': {
    id: 'source-map',
    severity: 'info',
    title: 'Public source map detected',
    category: 'Public file exposure',
    checkId: 'source-map',
    riskType: 'Observation',
    kind: 'Observation, usually informational (simulated)',
    description:
      'A simulated frontend asset references a source map.',
    evidence:
      'GET /assets/main.js.map → HTTP 200 (simulated)\n\n//# sourceMappingURL=main.js.map',
    evidenceNote:
      'Discovery is simulated. The prototype did not download any asset.',
    why:
      'Source maps make debugging easier, but they can also reveal original source code, internal names and hidden endpoints.',
    impact:
      'Informational. Public source maps are common and are not automatically vulnerabilities. The impact depends on whether the map reveals secrets or sensitive implementation details.',
    recommendation:
      'Review whether the source map reveals source code or internal details that should not be public. Public source maps are not automatically vulnerabilities.',
    verification: [
      'Open browser developer tools → Sources and check whether the map loads.',
      'Request the .map path directly and confirm it returns 404 after removal.',
      'If maps are needed for error reporting, consider uploading them privately instead of serving them publicly.',
    ],
    confidence:
      'Medium — inferred from a simulated sourceMappingURL reference.',
    limitations:
      'The check does not inspect the contents of the map and cannot determine whether secrets or sensitive logic are exposed. Public source maps can be a deliberate choice.',
  },
  'server-disclosure': {
    id: 'server-disclosure',
    severity: 'info',
    title: 'Server technology disclosure',
    category: 'Information disclosure',
    checkId: 'server-header',
    riskType: 'Observation',
    kind: 'Observation, informational (simulated)',
    description:
      'The demonstration response includes a generic server identification header.',
    evidence: 'Server: ExampleServer — simulated response.',
    evidenceNote:
      'The header value is illustrative and does not describe a real server.',
    why:
      'Server banners can help an attacker fingerprint the technology in use and narrow down which known issues to try.',
    impact:
      'Low. Technology disclosure is usually informational unless it is paired with a known vulnerable version, which this check does not assess.',
    recommendation:
      'Review whether the information is necessary. Treat this as informational unless additional evidence demonstrates a meaningful risk.',
    verification: [
      'Inspect response headers in browser developer tools or with curl -I.',
      'If removed, confirm at the proxy or server layer and check that monitoring still works.',
    ],
    confidence:
      'Medium — based on a generic simulated header.',
    limitations:
      'Many servers disclose technology by design, and obscurity is not a security control. This finding should not be treated as a vulnerability on its own.',
  },
  'xframe-missing': {
    id: 'xframe-missing',
    severity: 'medium',
    title: 'X-Frame-Options header missing',
    category: 'Security headers',
    checkId: 'headers',
    riskType: 'Potential risk',
    kind: 'Observation + potential risk (simulated, earlier scan)',
    description:
      'An earlier demonstration response did not include X-Frame-Options.',
    evidence:
      'X-Frame-Options: Not present in earlier demonstration response.',
    evidenceNote:
      'This finding belongs to an earlier simulated scan and is resolved in the latest demonstration.',
    why:
      'Without frame protections, a page may be embedded in another site and used for clickjacking-style attacks.',
    impact:
      'Potential risk, not a confirmed vulnerability. Exploitation requires a plausible user interaction and a page that performs sensitive actions.',
    recommendation:
      'Set X-Frame-Options to DENY or SAMEORIGIN, or define frame-ancestors in a Content Security Policy.',
    verification: [
      'Confirm the header or CSP frame-ancestors directive is returned on HTML responses.',
      'Test that legitimate embedding (if any) still works.',
    ],
    confidence:
      'High — the absence of the header in the earlier simulated response is unambiguous.',
    limitations:
      'This earlier finding only demonstrates change over time. The latest demo scan no longer reports it.',
  },
}

export const SAMPLE_FINDING_KEYS = [
  'exposed-config',
  'csp-missing',
  'hsts-missing',
  'source-map',
  'server-disclosure',
]

export const SEED_FINDING_SETS = {
  latest: SAMPLE_FINDING_KEYS,
  mid: [
    'exposed-config',
    'csp-missing',
    'hsts-missing',
    'xframe-missing',
    'server-disclosure',
  ],
  old: ['csp-missing', 'hsts-missing', 'xframe-missing', 'server-disclosure'],
}

// Deterministic simulated check duration in milliseconds. The scan UI turns
// these into a timeline; they are presentation values, not measurements.
export const SCAN_DURATIONS = [
  620, 800, 940, 700, 860, 600, 740, 1020, 1180, 700, 840, 900,
]

export function statusesForFindings(findingKeys) {
  const map = Object.fromEntries(CHECKS.map((check) => [check.id, 'pass']))

  if (findingKeys.includes('hsts-missing')) map.hsts = 'warn'
  if (findingKeys.includes('csp-missing')) map.csp = 'warn'
  if (findingKeys.includes('xframe-missing')) map.headers = 'warn'
  if (findingKeys.includes('exposed-config')) map['config-files'] = 'review'
  if (findingKeys.includes('source-map')) map['source-map'] = 'review'
  if (findingKeys.includes('server-disclosure')) map['server-header'] = 'review'

  return CHECKS.map((check) => ({ id: check.id, status: map[check.id] }))
}

export function getCheck(checkId) {
  return CHECKS.find((check) => check.id === checkId)
}

export function getFinding(key) {
  return FINDINGS[key] ?? null
}
