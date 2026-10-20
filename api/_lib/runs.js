import { randomBytes } from 'node:crypto'
import { hashSession } from './auth.js'
import { getStore } from './store/index.js'

// The run record is the durable side of an agent assignment: it survives the
// response, it is what the report page reads, and it is what a queue job
// points at. A run is never mutated in place by a caller — the store owns the
// merge so concurrent writers cannot clobber each other's fields.

export function newRunId() {
  return `run_${randomBytes(6).toString('hex')}`
}

export function newJobId() {
  return `job_${randomBytes(6).toString('hex')}`
}

// The session id is a secret, so only its hash is stored. The hash comes from
// the session module so both halves agree on what a "session" means.
export function hashSessionId(sessionId) {
  if (!sessionId) return null
  return hashSession(sessionId)
}

function now() {
  return new Date().toISOString()
}

export async function createRun({
  target,
  agent,
  sessionId = null,
  ownership = null,
  status = 'running',
}) {
  const store = await getStore()
  const timestamp = now()

  const run = {
    id: newRunId(),
    sessionHash: hashSessionId(sessionId),
    target,
    agent: agent ?? null,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    summary: null,
    findings: [],
    usage: null,
    steps: null,
    error: null,
    events: [],
    ownership: ownership ?? { verified: false, method: null, verifiedAt: null },
  }

  await store.createRun(run)
  return run
}

export async function getRun(id) {
  const store = await getStore()
  return store.getRun(id)
}

export async function listRuns({ sessionId = null, limit = 50 } = {}) {
  const store = await getStore()
  return store.listRuns({ sessionHash: hashSessionId(sessionId), limit })
}

export async function appendEvent(id, event) {
  const store = await getStore()
  return store.appendEvent(id, event)
}

export async function updateRun(id, patch) {
  const store = await getStore()
  return store.updateRun(id, patch)
}

export async function completeRun(id, { summary, findings, usage, steps }) {
  const store = await getStore()
  return store.updateRun(id, {
    status: 'completed',
    summary: summary ?? null,
    findings: Array.isArray(findings) ? findings : [],
    usage: usage ?? null,
    steps: steps ?? null,
    completedAt: now(),
  })
}

export async function failRun(id, { code, message }) {
  const store = await getStore()
  return store.updateRun(id, {
    status: 'failed',
    error: { code: code ?? 'agent_failed', message: message ?? 'The agent run failed.' },
    completedAt: now(),
  })
}

// Ownership is recorded per session and per domain, so a verification for one
// domain never authorises a scan of another, and a proof is not thrown away
// because the site was reached over a different path.
export const OWNERSHIP_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function hostnameOf(target) {
  try {
    return new URL(target).hostname.toLowerCase()
  } catch {
    return String(target ?? '').toLowerCase()
  }
}

export function ownershipKey(sessionId, target) {
  return `${hashSessionId(sessionId) ?? 'anonymous'}:${hostnameOf(target)}`
}

export async function recordOwnership({
  sessionId,
  target,
  method,
  expiresAt,
}) {
  const store = await getStore()
  const record = {
    verified: true,
    method: method ?? null,
    target: hostnameOf(target),
    verifiedAt: now(),
    expiresAt:
      expiresAt ??
      new Date(Date.now() + OWNERSHIP_TTL_MS).toISOString(),
  }
  await store.setOwnership(ownershipKey(sessionId, target), record)
  return record
}

// A proof that has expired is not a proof. The record carries its own expiry
// so a stale entry can never authorise a scan.
export async function getOwnership({ sessionId, target }) {
  const store = await getStore()
  const record = await store.getOwnership(ownershipKey(sessionId, target))

  if (!record?.verified) return null
  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) return null

  return record
}

export async function enqueueJob({ runId, type = 'agent.scan', payload = {} }) {
  const store = await getStore()
  const job = {
    id: newJobId(),
    runId,
    type,
    status: 'queued',
    attempts: 0,
    createdAt: now(),
    payload,
  }
  await store.createJob(job)
  return job
}

export async function claimJob() {
  const store = await getStore()
  return store.claimJob()
}

export async function queuedJobCount() {
  const store = await getStore()
  const jobs = await store.listJobs({ status: 'queued', limit: 100 })
  return jobs.length
}

// A run whose worker died stays in `running` for ever otherwise. Anything that
// has not moved for a while is failed, so the report page stops waiting for it.
export async function reapStaleRuns({ olderThanMs = 15 * 60_000 } = {}) {
  const store = await getStore()
  const cutoff = new Date(Date.now() - olderThanMs).toISOString()
  const stale = await store.findRuns({ status: 'running', olderThan: cutoff })

  for (const run of stale) {
    await failRun(run.id, {
      code: 'timeout',
      message: 'The run stopped without finishing and was closed.',
    })
  }

  return stale.length
}

export async function getSetting(key) {
  const store = await getStore()
  return store.getSetting(key)
}

export async function setSetting(key, value) {
  const store = await getStore()
  return store.setSetting(key, value)
}

export async function finishJob(id, patch) {
  const store = await getStore()
  return store.finishJob(id, patch)
}

// The list view carries counts, not the findings themselves, so a client can
// render a table of runs without pulling every transcript.
export function summariseRun(run) {
  const severityCounts = { high: 0, medium: 0, info: 0 }

  for (const finding of run.findings ?? []) {
    if (severityCounts[finding.severity] === undefined) continue
    severityCounts[finding.severity] += 1
  }

  return {
    id: run.id,
    target: run.target,
    status: run.status,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    findingCount: (run.findings ?? []).length,
    severityCounts,
  }
}
