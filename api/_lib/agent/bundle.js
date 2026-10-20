// Scans fetched JavaScript for shipped secrets and markers. Values are never
// returned to the model or the client: only a kind, a count and a redacted
// prefix. A report that leaks the key it found is worse than the finding.

const PATTERNS = [
  {
    kind: 'stripe-secret-key',
    severity: 'high',
    pattern: /\bsk_live_[0-9a-zA-Z]{16,}\b/g,
  },
  {
    kind: 'anthropic-key',
    severity: 'high',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    kind: 'openai-key',
    severity: 'high',
    pattern: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    kind: 'github-token',
    severity: 'high',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  },
  {
    kind: 'google-api-key',
    severity: 'medium',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    kind: 'stripe-publishable-key',
    severity: 'info',
    pattern: /\bpk_live_[0-9a-zA-Z]{16,}\b/g,
  },
  {
    kind: 'supabase-url',
    severity: 'info',
    pattern: /https:\/\/[a-z0-9]{20}\.supabase\.co/g,
  },
  {
    kind: 'localhost-url',
    severity: 'medium',
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{2,5})?/g,
  },
]

const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const EMBEDDED_SECRET =
  /["']([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)[A-Z0-9_]*)["']\s*[:=]\s*["'][^"']{8,}["']/g
const DATABASE_URL = /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/g
const SOURCE_MAP = /\/\/[#@]\s*sourceMappingURL=([^\s*'"]+)/g

function redact(value, keep = 6) {
  const text = String(value ?? '')
  if (text.length <= keep + 3) return '[redacted]'
  return `${text.slice(0, keep)}…[redacted]`
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

function classifyJwt(token) {
  const claims = decodeJwt(token)
  if (!claims) {
    return { kind: 'jwt', severity: 'medium', note: 'unreadable JWT payload' }
  }

  const role = claims.role ?? claims.user_role ?? null
  if (role === 'service_role') {
    return {
      kind: 'supabase-service-role-key',
      severity: 'high',
      note: 'JWT role=service_role — bypasses row level security',
    }
  }
  if (role === 'anon') {
    return {
      kind: 'supabase-anon-key',
      severity: 'info',
      note: 'JWT role=anon — publishable by design',
    }
  }
  if (claims.iss) {
    return {
      kind: 'jwt',
      severity: 'medium',
      note: `JWT issuer ${String(claims.iss).slice(0, 40)}`,
    }
  }
  return { kind: 'jwt', severity: 'medium', note: 'JWT without a role claim' }
}

export function scanText(text) {
  const source = String(text ?? '')
  const groups = new Map()
  let sourceMapUrl = null

  const add = (kind, severity, sample, note) => {
    const existing = groups.get(kind)
    if (existing) {
      existing.count += 1
      return
    }
    groups.set(kind, { kind, severity, count: 1, sample, note: note ?? null })
  }

  for (const { kind, severity, pattern } of PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      add(kind, severity, redact(match[0], severity === 'high' ? 0 : 6))
    }
  }

  for (const match of source.matchAll(JWT)) {
    const verdict = classifyJwt(match[0])
    add(
      verdict.kind,
      verdict.severity,
      redact(match[0], verdict.severity === 'high' ? 0 : 8),
      verdict.note,
    )
  }

  for (const match of source.matchAll(EMBEDDED_SECRET)) {
    add('embedded-secret', 'high', match[1], 'Secret-like key assigned a literal value')
  }

  for (const match of source.matchAll(DATABASE_URL)) {
    add('database-url', 'high', 'postgres://…[redacted]', 'Database URL with inline credentials')
  }

  for (const match of source.matchAll(SOURCE_MAP)) {
    sourceMapUrl = sourceMapUrl ?? match[1]
    add('source-map-reference', 'info', match[1].slice(0, 80), 'Source map reference')
  }

  return {
    patterns: [...groups.values()].slice(0, 12),
    sourceMapUrl: sourceMapUrl && sourceMapUrl.length <= 300 ? sourceMapUrl : null,
  }
}
