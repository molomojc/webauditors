// HTTPS & TLS evidence for the demo workspace. Every value is fixed sample
// data: no handshake, DNS lookup or network request produced it.

// The certificate is fictional. "Example Trust Services" is a placeholder
// authority, not a real certificate issuer.
export const tlsCertificate = {
  subject: 'CN=demo.example.com',
  subjectAltNames: ['demo.example.com', 'www.demo.example.com'],
  issuer: 'Example Trust Services R11',
  issuerNote:
    'Fictional certificate authority. No certificate was issued for this scenario.',
  validFrom: '2026-09-01',
  validTo: '2026-11-30',
  key: 'ECDSA P-256',
  signature: 'SHA-256',
  chain: ['leaf', 'R11', 'Example Root X1'],
  ocsp: 'Good (simulated)',
}

// The sample handshake accepts TLS 1.2 and 1.3. TLS 1.0 and 1.1 are refused,
// so their checks pass because the protocols are not offered.
export const tlsProtocols = [
  {
    id: 'tls13',
    protocol: 'TLS 1.3',
    status: 'Passed',
    tone: 'pass',
    note: 'Preferred',
    qualifier: null,
  },
  {
    id: 'tls12',
    protocol: 'TLS 1.2',
    status: 'Passed',
    tone: 'pass',
    note: 'Acceptable fallback',
    qualifier: null,
  },
  {
    id: 'tls11',
    protocol: 'TLS 1.1',
    status: 'Passed',
    tone: 'pass',
    note: 'Not offered',
    qualifier: 'disabled',
  },
  {
    id: 'tls10',
    protocol: 'TLS 1.0',
    status: 'Passed',
    tone: 'pass',
    note: 'Not offered',
    qualifier: 'disabled',
  },
  {
    id: 'forward-secrecy',
    protocol: 'Forward secrecy',
    status: 'Passed',
    tone: 'pass',
    note: 'ECDHE on all offered suites',
    qualifier: null,
  },
  {
    id: 'weak-ciphers',
    protocol: 'Weak ciphers',
    status: 'Passed',
    tone: 'pass',
    note: 'None offered',
    qualifier: null,
  },
]

export const tlsRedirects = [
  {
    id: 'http-apex',
    check: 'http://demo.example.com',
    response: '301 → https://demo.example.com',
    responseTone: 'text-ink',
    status: 'Passed',
    tone: 'pass',
    detail: 'Plain HTTP on the apex host redirects to HTTPS in the sample response.',
  },
  {
    id: 'https-www',
    check: 'https://www.demo.example.com',
    response: '301 → https://demo.example.com',
    responseTone: 'text-ink',
    status: 'Passed',
    tone: 'pass',
    detail: 'The www host redirects to the apex host in the sample response.',
  },
  {
    id: 'hsts-header',
    check: 'Strict-Transport-Security',
    response: 'Not set',
    responseTone: 'text-red-300',
    status: 'Warning',
    tone: 'warning',
    detail: 'No HSTS header in the sample HTTPS response.',
  },
  {
    id: 'hsts-preload',
    check: 'HSTS preload',
    response: 'Not applicable',
    responseTone: 'text-ink-soft',
    status: 'Needs review',
    tone: 'review',
    detail: 'No header to preload; preload only applies after HSTS is stable.',
  },
]

export const tlsHsts = {
  suggestedHeader:
    'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  note:
    'Without Strict-Transport-Security, the first request to demo.example.com can still travel over plain HTTP before the redirect is seen. The HSTS finding is documented in the sample report.',
  preloadNote:
    'Add preload only after the site has served HSTS with a stable max-age and every subdomain is ready.',
}

export const tlsNextActions = [
  {
    id: 'hsts',
    title: 'Add the HSTS header',
    detail:
      'Start with a short max-age if a long policy feels risky, confirm HTTPS works on every subdomain, then raise max-age toward one year.',
  },
  {
    id: 'renewal',
    title: 'Automate renewal and alert 30 days before expiry',
    detail:
      'Renewal should not depend on a calendar reminder. Send the alert to a monitored channel and check that a renewed certificate replaces the old one.',
  },
  {
    id: 'protocols',
    title: 'Keep TLS 1.0 and 1.1 disabled',
    detail:
      'Re-check cipher support and protocol versions after configuration changes so an older default does not reappear at the edge.',
  },
]
