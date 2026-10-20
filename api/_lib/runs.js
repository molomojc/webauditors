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

// Ownership is recorded per session and per target, so a verification for one
// domain never authorises a scan of another.
export function ownershipKey(sessionId, target) {
  return `${hashSessionId(sessionId) ?? 'anonymous'}:${target}`
}

export async function recordOwnership({ sessionId, target, method }) {
  const store = await getStore()
  const record = {
    verified: true,
    method: method ?? null,
    target,
    verifiedAt: now(),
  }
  await store.setOwnership(ownershipKey(sessionId, target), record)
  return record
}

export async function getOwnership({ sessionId, target }) {
  const store = await getStore()
  return store.getOwnership(ownershipKey(sessionId, target))
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
