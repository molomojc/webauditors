// Demonstration data for the dashboard overview. Nothing here is measured;
// the dashboard is a working surface for the simulated demo site.

export const DASHBOARD_SITE = {
  host: 'demo.example.com',
  label: 'Demo workspace',
}

export const CATEGORIES = [
  {
    key: 'dns',
    index: '01',
    title: 'DNS configuration',
    status: 'Needs review',
    tone: 'review',
    summary:
      'SPF soft-fails and DMARC only monitors. DNSSEC and CAA are not set.',
    to: '/dashboard/dns',
  },
  {
    key: 'tls',
    index: '02',
    title: 'HTTPS & TLS',
    status: 'Warning',
    tone: 'warning',
    summary:
      'Certificate chain and protocol support are sound. HSTS is not enabled.',
    to: '/dashboard/tls',
  },
  {
    key: 'headers',
    index: '03',
    title: 'Security headers',
    status: 'Warning',
    tone: 'warning',
    summary:
      'Content-Security-Policy and HSTS are absent from the sample response.',
    to: '/reports/demo',
  },
  {
    key: 'files',
    index: '04',
    title: 'Public files & source maps',
    status: 'Action needed',
    tone: 'fail',
    summary:
      'A configuration file and a JavaScript source map are publicly readable.',
    to: '/reports/demo',
  },
]

export const PRIORITY_FIXES = [
  {
    severity: 'high',
    title: 'Remove the publicly readable configuration file',
    detail:
      'A sample configuration file exposes a placeholder credential at a predictable path.',
    to: '/reports/demo',
  },
  {
    severity: 'medium',
    title: 'Enable a Content-Security-Policy',
    detail:
      'The sample response has no CSP, so injected scripts would not be constrained by the browser.',
    to: '/reports/demo',
  },
  {
    severity: 'medium',
    title: 'Send HSTS on HTTPS responses',
    detail:
      'Without Strict-Transport-Security the first request can still travel over plain HTTP.',
    to: '/reports/demo',
  },
]
