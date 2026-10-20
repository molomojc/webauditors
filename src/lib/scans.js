import {
  DEMO_TARGET,
  FINDINGS,
  SAMPLE_FINDING_KEYS,
  SEED_FINDING_SETS,
  SEVERITIES,
  statusesForFindings,
} from '../data/demo'

const STORAGE_KEY = 'webauditors.demo.v1'
const DAY = 24 * 60 * 60 * 1000

let memoryScans = null

function buildScan({ id, target, startedAt, durationMs, findingKeys }) {
  return {
    id,
    target,
    startedAt: new Date(startedAt).toISOString(),
    durationMs,
    findings: [...findingKeys],
    checks: statusesForFindings(findingKeys),
    simulated: true,
    engine: 'demo',
  }
}

export function seedScans() {
  const now = Date.now()
  return [
    buildScan({
      id: 'demo-scan-latest',
      target: DEMO_TARGET,
      startedAt: now - 2 * DAY - 3 * 60 * 60 * 1000,
      durationMs: 11840,
      findingKeys: SEED_FINDING_SETS.latest,
    }),
    buildScan({
      id: 'demo-scan-mid',
      target: DEMO_TARGET,
      startedAt: now - 9 * DAY - 5 * 60 * 60 * 1000,
      durationMs: 10920,
      findingKeys: SEED_FINDING_SETS.mid,
    }),
    buildScan({
      id: 'demo-scan-old',
      target: DEMO_TARGET,
      startedAt: now - 21 * DAY - 2 * 60 * 60 * 1000,
      durationMs: 12460,
      findingKeys: SEED_FINDING_SETS.old,
    }),
  ]
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryScans))
  } catch {
    // Local storage can be unavailable (private mode, quota). The in-memory
    // store still keeps the prototype usable for the current session.
  }
}

function read() {
  if (memoryScans) return memoryScans

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryScans = parsed
        return memoryScans
      }
    }
  } catch {
    // Corrupt or unavailable storage falls through to fresh seed data.
  }

  memoryScans = seedScans()
  persist()
  return memoryScans
}

export function getScans() {
  return [...read()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
}

export function getScanById(id) {
  if (id === 'demo') {
    return getScans().find((scan) => scan.id === 'demo-scan-latest') ?? getScans()[0]
  }
  return getScans().find((scan) => scan.id === id) ?? null
}

export function createScan({ target, findingKeys, durationMs, startedAt }) {
  const at = startedAt ?? Date.now()
  return buildScan({
    id: `demo-${at}-${Math.random().toString(36).slice(2, 7)}`,
    target: target || DEMO_TARGET,
    startedAt: at,
    durationMs,
    findingKeys: findingKeys ?? SAMPLE_FINDING_KEYS,
  })
}

export function addScan(scan) {
  memoryScans = [scan, ...read().filter((item) => item.id !== scan.id)]
  persist()
  return scan
}

export function resetDemoData() {
  memoryScans = seedScans()
  persist()
  return getScans()
}

export function findingsFor(scan) {
  if (!scan) return []
  return scan.findings
    .map((key) => FINDINGS[key])
    .filter(Boolean)
    .sort((a, b) => SEVERITIES[a.severity].rank - SEVERITIES[b.severity].rank)
}

export function summarize(scan) {
  const findings = findingsFor(scan)
  const counts = { high: 0, medium: 0, info: 0 }
  findings.forEach((finding) => {
    counts[finding.severity] += 1
  })

  const checks = scan?.checks?.length ?? 0
  const needsAttention = counts.high > 0 || counts.medium > 0

  return {
    ...counts,
    total: findings.length,
    checks,
    status: needsAttention ? 'Needs attention' : 'No priority findings',
    tone: needsAttention ? 'attention' : 'ok',
  }
}

export function compareScans(scanA, scanB) {
  const [older, newer] = [scanA, scanB].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  )

  const olderKeys = new Set(older.findings)
  const newerKeys = new Set(newer.findings)

  const toFinding = (key) => FINDINGS[key]
  const bySeverity = (a, b) => SEVERITIES[a.severity].rank - SEVERITIES[b.severity].rank

  return {
    older,
    newer,
    introduced: newer.findings
      .filter((key) => !olderKeys.has(key))
      .map(toFinding)
      .filter(Boolean)
      .sort(bySeverity),
    resolved: older.findings
      .filter((key) => !newerKeys.has(key))
      .map(toFinding)
      .filter(Boolean)
      .sort(bySeverity),
    unchanged: newer.findings
      .filter((key) => olderKeys.has(key))
      .map(toFinding)
      .filter(Boolean)
      .sort(bySeverity),
  }
}

export function formatDate(isoDate) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}

export function formatShortDate(isoDate) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoDate))
  } catch {
    return isoDate
  }
}

export function formatDuration(ms) {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}
