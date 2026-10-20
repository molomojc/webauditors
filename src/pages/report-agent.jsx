import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bot, ChevronDown, ListChecks } from 'lucide-react'
import { formatDate } from '../lib/scans'
import {
  SEVERITY_LABEL,
  SEVERITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  fetchRun,
  pollRun,
  runPath,
} from '../lib/runs'
import { hostnameOf } from '../lib/url'

const LABEL = 'font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft'
const GHOST_LINK =
  'inline-flex items-center justify-center border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-panel'

function MetaItem({ label, value }) {
  return (
    <div className="px-4 py-3">
      <p className={LABEL}>{label}</p>
      <p className="mt-1 break-words font-mono text-[11px] leading-5 text-ink">{value}</p>
    </div>
  )
}

function SeverityPill({ severity }) {
  const tone = SEVERITY_TONE[severity] ?? SEVERITY_TONE.info
  return (
    <span className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${tone}`}>
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  )
}

// Every string in a run is written by a language model, so it is rendered as
// plain React text and never as markup.
function FindingCard({ finding }) {
  const evidence = Array.isArray(finding.evidence) ? finding.evidence : []
  const rows = [
    ['Observed', finding.observation],
    ['Impact', finding.impact],
    ['Fix', finding.fix],
  ]
  if (finding.limitations) rows.push(['Limitations', finding.limitations])

  return (
    <article className="border border-rule bg-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <p className={LABEL}>{finding.category}</p>
          <h3 className="mt-1 text-sm font-medium leading-5 text-ink">{finding.title}</h3>
        </div>
        <SeverityPill severity={finding.severity} />
      </header>

      <dl className="divide-y divide-rule">
        {rows.map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <dt className={LABEL}>{label}</dt>
            <dd className="mt-1 text-xs leading-6 text-ink-soft">{value}</dd>
          </div>
        ))}
      </dl>

      <footer className="flex flex-wrap items-center gap-1.5 border-t border-rule px-4 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">Evidence</span>
        {evidence.map((ref) => (
          <code key={ref} className="break-all border border-rule px-1.5 py-0.5 font-mono text-[9.5px] text-ink-soft">
            {ref}
          </code>
        ))}
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">
          {finding.confidence} confidence
        </span>
      </footer>
    </article>
  )
}

function eventLine(event) {
  const tokens = (event.usage?.inputTokens ?? 0) + (event.usage?.outputTokens ?? 0)

  switch (event?.event) {
    case 'agent.assigned':
      return {
        tone: 'text-signal',
        text: `agent assigned · ${event.agent?.name} v${event.agent?.version} · ${event.agent?.model ?? 'model'}`,
      }
    case 'tool.call':
      return { tone: 'text-ink', text: `> ${event.name}${event.argument ? ` ${event.argument}` : ''}` }
    case 'tool.result':
      return { tone: event.ok ? 'text-ink-soft' : 'text-amber-300', text: `→ ${event.summary}` }
    case 'finding':
      return {
        tone:
          event.finding?.severity === 'high'
            ? 'text-red-300'
            : event.finding?.severity === 'medium'
              ? 'text-amber-300'
              : 'text-signal',
        text: `+ ${event.finding?.title} [${event.finding?.severity}]`,
      }
    case 'agent.completed':
      return { tone: 'text-emerald-300', text: `done · ${event.steps} steps · ${tokens} tokens` }
    case 'agent.failed':
      return { tone: 'text-red-300', text: `! ${event.code}: ${event.error}` }
    default:
      return { tone: 'text-ink-soft', text: event?.event ?? 'event' }
  }
}

function Transcript({ events }) {
  const lines = events.map(eventLine)

  return (
    <details open className="group mt-6 border border-rule bg-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">Transcript</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">{events.length} events</span>
          <ChevronDown size={13} className="text-ink-soft transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-rule bg-canvas px-4 py-3.5">
        {lines.length ? (
          <ol className="space-y-1 overflow-x-auto font-mono text-[11px] leading-5">
            {lines.map((line, index) => (
              <li key={index} className={`break-all ${line.tone}`}>{line.text}</li>
            ))}
          </ol>
        ) : (
          <p className="font-mono text-[11px] leading-5 text-ink-soft/60">No events were recorded.</p>
        )}
      </div>
    </details>
  )
}

export default function ReportAgentPage() {
  const { runId } = useParams()
  const [run, setRun] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const loadRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    loadRef.current?.abort()
    loadRef.current = controller

    setStatus('loading')
    setRun(null)
    setError(null)

    fetchRun(runId, { signal: controller.signal })
      .then((loaded) => {
        if (controller.signal.aborted) return
        setRun(loaded)
        setStatus('ready')
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setError({
          code: caught?.code ?? 'request_failed',
          message: caught?.message ?? 'The run could not be loaded.',
        })
        setStatus('error')
      })

    return () => controller.abort()
  }, [runId])

  // A stored run may still be in flight, so the page follows it until it
  // settles. The poll is cancelled when the page moves on.
  const runStatus = run?.status
  useEffect(() => {
    if (status !== 'ready') return undefined
    if (runStatus !== 'queued' && runStatus !== 'running') return undefined

    const controller = new AbortController()
    pollRun(runId, {
      signal: controller.signal,
      onUpdate: (updated) => setRun(updated),
    }).catch(() => {
      // A cancelled or timed out poll leaves the stored snapshot in place.
    })

    return () => controller.abort()
  }, [status, runStatus, runId])

  const targetHost = run?.target ? hostnameOf(run.target) : null
  const findings = Array.isArray(run?.findings) ? run.findings : []
  const events = Array.isArray(run?.events) ? run.events : []
  const tokenTotal = run?.usage
    ? (run.usage.inputTokens ?? 0) + (run.usage.outputTokens ?? 0)
    : null

  return (
    <div>
      <div className="page-grain" aria-hidden="true" />
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <nav aria-label="Breadcrumb" className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
          <Link to="/runs" className="transition hover:text-ink">Runs</Link>
          <span className="mx-2 text-ink/25" aria-hidden="true">/</span>
          <span className="break-all text-ink/60">{runId}</span>
        </nav>

        {status === 'loading' ? (
          <div aria-live="polite" className="mt-6 border border-rule bg-panel px-4 py-6">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">Loading run</p>
            <p className="mt-2 text-xs leading-6 text-ink-soft/70">Fetching the stored record…</p>
          </div>
        ) : null}

        {status === 'error' ? (
          <div role="alert" className="mt-6 border border-red-500/40 bg-red-500/[0.04] px-4 py-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-red-300">
              {error?.code === 'not_found' ? 'Not found' : 'Run unavailable'}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-ink">
              {error?.code === 'not_found'
                ? "That run does not exist or is not in this browser's session."
                : error?.message}
            </p>
            {error?.code === 'agent_not_configured' ? (
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                Add LLM_API_KEY and LLM_MODEL to the environment, then restart the server.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/runs" className={GHOST_LINK}>All runs</Link>
              <Link to="/scan/agent" className={GHOST_LINK}>Assign an agent</Link>
            </div>
          </div>
        ) : null}

        {status === 'ready' && run ? (
          <div className="fade-in">
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="break-all text-[clamp(1.9rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                  {targetHost ?? 'Agent run'}
                </h1>
                <p className="mt-2 text-[13px] leading-6 text-ink-soft">
                  {run.agent?.name ?? 'Agent'}
                  {run.agent?.version ? ` v${run.agent.version}` : ''} report for{' '}
                  <span className="font-mono text-[12px] text-ink">{run.target}</span>
                </p>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-1.5 border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
                  STATUS_TONE[run.status] ?? STATUS_TONE.queued
                }`}
              >
                <Bot size={11} aria-hidden="true" />
                {STATUS_LABEL[run.status] ?? run.status}
              </span>
            </div>

            {run.status === 'failed' && run.error ? (
              <div role="alert" className="mt-5 border border-red-500/40 bg-red-500/[0.04] px-4 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-red-300">{run.error.code}</p>
                <p className="mt-1 text-[13px] leading-6 text-ink">{run.error.message}</p>
              </div>
            ) : null}

            {run.status === 'queued' || run.status === 'running' ? (
              <div role="note" className="mt-5 flex gap-3 border border-signal/30 bg-signal/[0.04] px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal/90" aria-hidden="true" />
                <p className="text-xs leading-5 text-ink-soft">
                  This run is still {run.status}. The page refreshes itself when the agent finishes.
                </p>
              </div>
            ) : null}

            <div className="mt-5 grid gap-px border border-rule bg-rule sm:grid-cols-2">
              <MetaItem label="Run id" value={run.id} />
              <MetaItem
                label="Agent"
                value={`${run.agent?.id ?? 'agent'} v${run.agent?.version ?? 1} · ${run.agent?.model ?? 'model'}`}
              />
              <MetaItem label="Created" value={formatDate(run.createdAt)} />
              <MetaItem label="Completed" value={run.completedAt ? formatDate(run.completedAt) : '—'} />
              <MetaItem label="Steps" value={run.steps ?? '—'} />
              <MetaItem label="Tokens" value={tokenTotal ?? '—'} />
            </div>

            {run.summary ? (
              <section className="mt-4 border border-rule bg-panel px-5 py-4">
                <p className={LABEL}>Agent summary</p>
                <p className="mt-2 text-[13px] leading-6 text-ink">{run.summary}</p>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">{findings.length} findings</p>
              </section>
            ) : null}

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/40 pb-2">
                <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">Findings</h2>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">Every item cites captured evidence</span>
              </div>
              {findings.length ? (
                <div className="mt-3 space-y-3">
                  {findings.map((finding, index) => (
                    <FindingCard key={`${finding.id}-${index}`} finding={finding} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 border border-rule bg-panel px-4 py-4 text-xs leading-6 text-ink-soft">
                  This run recorded no findings. That is a valid result: the agent will not report
                  what it could not observe.
                </p>
              )}
            </section>

            <Transcript events={events} />

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Link
                to="/runs"
                className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
              >
                <ListChecks size={13} aria-hidden="true" />
                All runs
              </Link>
              <Link to="/scan/agent" className={GHOST_LINK}>Assign another agent</Link>
            </div>

            <p className="mt-4 border-t border-rule pt-4 text-xs leading-6 text-ink-soft/80">
              This report is a stored record of one agent run. Its address is{' '}
              <span className="font-mono text-[11px] text-ink">{runPath(run.id)}</span>.
            </p>
          </div>
        ) : null}

        <div className="mt-8 border-t border-rule pt-4">
          <Link
            to="/runs"
            className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
          >
            Stored agent runs
            <ArrowRight size={12} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
