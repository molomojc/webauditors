import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createFileStore } from '../api/_lib/store/file.js'
import { createMemoryStore } from '../api/_lib/store/memory.js'
import {
  createRun,
  enqueueJob,
  claimJob,
  completeRun,
  failRun,
  getOwnership,
  getRun,
  hashSessionId,
  listRuns,
  recordOwnership,
  summariseRun,
} from '../api/_lib/runs.js'

// The repository reads STORE at first use, so the in-memory store is selected
// before anything calls it.
process.env.STORE = 'memory'

let passed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.error(`  FAIL  ${name}`)
    throw error
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (error) {
    console.error(`  FAIL  ${name}`)
    throw error
  }
}

function makeRun(overrides = {}) {
  return {
    id: `run_${Math.random().toString(16).slice(2, 8)}`,
    sessionHash: 'hash-a',
    target: 'https://example.com/',
    agent: { id: 'web-auditor', version: 1, name: 'Web Auditor', model: 'test' },
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    summary: null,
    findings: [],
    usage: null,
    steps: null,
    error: null,
    events: [],
    ownership: { verified: false, method: null, verifiedAt: null },
    ...overrides,
  }
}

console.log('store: memory')

const memory = createMemoryStore()

await testAsync('creates and reads a run', async () => {
  const run = makeRun()
  await memory.createRun(run)
  const read = await memory.getRun(run.id)
  assert.equal(read.target, 'https://example.com/')
})

await testAsync('returns null for an unknown run', async () => {
  assert.equal(await memory.getRun('run_missing'), null)
})

await testAsync('scopes the run list to one session', async () => {
  await memory.createRun(makeRun({ sessionHash: 'hash-a' }))
  await memory.createRun(makeRun({ sessionHash: 'hash-b' }))
  const listed = await memory.listRuns({ sessionHash: 'hash-a' })
  assert.ok(listed.every((run) => run.sessionHash === 'hash-a'))
  assert.ok(listed.length >= 1)
})

await testAsync('appends events in order', async () => {
  const run = makeRun()
  await memory.createRun(run)
  await memory.appendEvent(run.id, { event: 'tool.call', name: 'fetch_page' })
  await memory.appendEvent(run.id, { event: 'tool.result', name: 'fetch_page' })
  const read = await memory.getRun(run.id)
  assert.equal(read.events.length, 2)
  assert.equal(read.events[0].event, 'tool.call')
  assert.equal(read.events[1].event, 'tool.result')
})

await testAsync('caps the stored event count', async () => {
  const run = makeRun()
  await memory.createRun(run)
  for (let index = 0; index < 450; index += 1) {
    await memory.appendEvent(run.id, { event: 'tool.call', index })
  }
  const read = await memory.getRun(run.id)
  assert.equal(read.events.length, 400)
  assert.equal(read.events.at(-1).index, 449)
})

await testAsync('updates a run and stamps updatedAt', async () => {
  const run = makeRun()
  await memory.createRun(run)
  const updated = await memory.updateRun(run.id, { status: 'completed' })
  assert.equal(updated.status, 'completed')
})

await testAsync('claims one queued job at a time', async () => {
  await memory.createJob({
    id: 'job_1',
    runId: 'run_1',
    type: 'agent.scan',
    status: 'queued',
    attempts: 0,
    createdAt: new Date().toISOString(),
    payload: {},
  })

  const claimed = await memory.claimJob()
  assert.equal(claimed.id, 'job_1')
  assert.equal(claimed.status, 'running')
  assert.equal(claimed.attempts, 1)
  assert.equal(await memory.claimJob(), null)
})

console.log('store: file')

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'webauditors-store-'))
const fileStore = createFileStore({ dir: directory })
await testAsync('persists a run across store instances', async () => {
  const run = makeRun({ id: 'run_persisted' })
  await fileStore.createRun(run)

  const reopened = createFileStore({ dir: directory })
  await reopened.init()
  const read = await reopened.getRun('run_persisted')
  assert.ok(read, 'the run should survive a new store instance')
  assert.equal(read.target, 'https://example.com/')
})

await testAsync('keeps a session scope after a restart', async () => {
  const reopened = createFileStore({ dir: directory })
  await reopened.init()
  const listed = await reopened.listRuns({ sessionHash: 'hash-a' })
  assert.ok(listed.some((run) => run.id === 'run_persisted'))
  const other = await reopened.listRuns({ sessionHash: 'hash-z' })
  assert.equal(other.length, 0)
})

await testAsync('writes a readable store file', async () => {
  const raw = await fs.readFile(path.join(directory, 'store.json'), 'utf8')
  const parsed = JSON.parse(raw)
  assert.ok(parsed.runs)
  assert.ok(parsed.jobs)
})

await testAsync('keeps a corrupt store file instead of wiping it', async () => {
  const broken = await fs.mkdtemp(path.join(os.tmpdir(), 'webauditors-broken-'))
  await fs.writeFile(path.join(broken, 'store.json'), '{ not json')

  const brokenStore = createFileStore({ dir: broken })
  await brokenStore.init()
  await brokenStore.createRun(makeRun({ id: 'run_after_corruption' }))

  const files = await fs.readdir(broken)
  assert.ok(
    files.some((name) => name.includes('.corrupt-')),
    'the damaged file should be kept as a backup',
  )
  assert.ok(files.includes('store.json'))

  const reopened = createFileStore({ dir: broken })
  await reopened.init()
  assert.ok(await reopened.getRun('run_after_corruption'))

  await fs.rm(broken, { recursive: true, force: true })
})

await testAsync('reclaims a job whose lease has expired', async () => {
  const leaseStore = createMemoryStore()
  const stale = {
    id: 'job_stale',
    runId: 'run_1',
    type: 'agent.scan',
    status: 'running',
    attempts: 1,
    createdAt: new Date().toISOString(),
    leaseUntil: new Date(Date.now() - 1000).toISOString(),
    payload: {},
  }

  await leaseStore.createJob(stale)
  const claimed = await leaseStore.claimJob()
  assert.ok(claimed, 'an expired lease should be reclaimable')
  assert.equal(claimed.id, 'job_stale')
  assert.equal(claimed.attempts, 2)
})

await testAsync('does not claim a job that is already leased', async () => {
  const leaseStore = createMemoryStore()
  await leaseStore.createJob({
    id: 'job_live',
    runId: 'run_1',
    type: 'agent.scan',
    status: 'queued',
    attempts: 0,
    createdAt: new Date().toISOString(),
    payload: {},
  })

  await leaseStore.claimJob()
  assert.equal(await leaseStore.claimJob(), null)
})

await testAsync('stores a setting and reads it back', async () => {
  const settingsStore = createMemoryStore()
  assert.equal(await settingsStore.getSetting('session_secret'), null)
  await settingsStore.setSetting('session_secret', 'abc')
  assert.equal(await settingsStore.getSetting('session_secret'), 'abc')
})

await fs.rm(directory, { recursive: true, force: true })

console.log('runs: repository')

await testAsync('creates a run owned by a session', async () => {
  const run = await createRun({
    target: 'https://example.com/',
    agent: { id: 'web-auditor', version: 1 },
    sessionId: 'session-one',
  })

  assert.ok(run.id.startsWith('run_'))
  assert.equal(run.status, 'running')
  assert.equal(run.sessionHash, hashSessionId('session-one'))
})

await testAsync('lists only the session that owns the runs', async () => {
  const mine = await listRuns({ sessionId: 'session-one' })
  assert.ok(mine.length >= 1)

  const theirs = await listRuns({ sessionId: 'session-two' })
  assert.equal(theirs.length, 0)
})

await testAsync('completes a run with findings', async () => {
  const run = await createRun({
    target: 'https://example.com/',
    agent: { id: 'web-auditor', version: 1 },
    sessionId: 'session-one',
  })

  await completeRun(run.id, {
    summary: 'Two issues.',
    findings: [
      { id: 'a', title: 'A', severity: 'high' },
      { id: 'b', title: 'B', severity: 'info' },
    ],
    usage: { inputTokens: 10, outputTokens: 5 },
    steps: 3,
  })

  const read = await getRun(run.id)
  assert.equal(read.status, 'completed')
  assert.equal(read.findings.length, 2)
  assert.ok(read.completedAt)
})

await testAsync('fails a run with a code and a message', async () => {
  const run = await createRun({
    target: 'https://example.com/',
    agent: { id: 'web-auditor', version: 1 },
    sessionId: 'session-one',
  })

  await failRun(run.id, { code: 'step_limit', message: 'No finish.' })
  const read = await getRun(run.id)
  assert.equal(read.status, 'failed')
  assert.equal(read.error.code, 'step_limit')
})

await testAsync('queues a job for a run', async () => {
  const run = await createRun({
    target: 'https://example.com/',
    agent: { id: 'web-auditor', version: 1 },
    sessionId: 'session-one',
  })

  const job = await enqueueJob({ runId: run.id, type: 'agent.scan' })
  assert.equal(job.status, 'queued')
  assert.equal(job.runId, run.id)

  const claimed = await claimJob()
  assert.ok(claimed)
  assert.equal(claimed.runId, run.id)
})

test('summarises a run for the list view', () => {
  const summary = summariseRun({
    id: 'run_1',
    target: 'https://example.com/',
    status: 'completed',
    createdAt: '2026-10-20T09:00:00.000Z',
    completedAt: '2026-10-20T09:00:12.000Z',
    findings: [
      { severity: 'high' },
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'info' },
    ],
  })

  assert.equal(summary.findingCount, 4)
  assert.equal(summary.severityCounts.high, 2)
  assert.equal(summary.severityCounts.medium, 1)
  assert.equal(summary.severityCounts.info, 1)
})

test('hashes a session id deterministically', () => {
  assert.equal(hashSessionId('abc'), hashSessionId('abc'))
  assert.notEqual(hashSessionId('abc'), hashSessionId('abd'))
  assert.equal(hashSessionId(null), null)
  assert.match(hashSessionId('abc'), /^[a-f0-9]{64}$/)
})

console.log('runs: ownership')

await testAsync('remembers a proof per domain, not per URL', async () => {
  await recordOwnership({
    sessionId: 'session-owner',
    target: 'https://example.com/',
    method: 'file',
  })

  const same = await getOwnership({
    sessionId: 'session-owner',
    target: 'https://example.com/',
  })
  assert.ok(same, 'the proof should be found')
  assert.equal(same.method, 'file')

  const otherScheme = await getOwnership({
    sessionId: 'session-owner',
    target: 'http://example.com/',
  })
  assert.ok(otherScheme, 'the same domain should be remembered')
})

await testAsync('does not let one session use another session proof', async () => {
  const theirs = await getOwnership({
    sessionId: 'session-stranger',
    target: 'https://example.com/',
  })
  assert.equal(theirs, null)
})

await testAsync('ignores an expired proof', async () => {
  await recordOwnership({
    sessionId: 'session-expiring',
    target: 'https://expired.example/',
    method: 'dns',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  })

  const record = await getOwnership({
    sessionId: 'session-expiring',
    target: 'https://expired.example/',
  })
  assert.equal(record, null)
})

console.log(`\n${passed} assertions passed`)
