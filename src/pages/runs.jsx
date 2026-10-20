import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, Inbox } from 'lucide-react'
import { formatDate } from '../lib/scans'
import {
  SEVERITY_LABEL,
  SEVERITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  fetchRuns,
  runPath,
} from '../lib/runs'
import { hostnameOf } from '../lib/url'

function SeverityCounts({ counts }) {
  const entries = ['high', 'medium', 'info'].filter(
    (severity) => (counts?.[severity] ?? 0) > 0,
  )

  if (!entries.length) {
    return (
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">
        No findings
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map((severity) => (
        <span
          key={severity}
          className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
            SEVERITY_TONE[severity]
          }`}
        >
          {counts[severity]} {SEVERITY_LABEL[severity]}
        </span>
      ))}
    </div>
  )
}

function RunRow({ run }) {
  const severityCounts = run.severityCounts ?? {}
  const findingCount = run.findingCount ?? 0

  return (
    <li className="transition hover:bg-canvas">
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-all text-sm font-medium text-ink">
              {run.target ? hostnameOf(run.target) : run.id}
            </p>
            {run.target ? (
              <p className="mt-0.5 break-all font-mono text-[10px] leading-5 text-ink-soft">
                {run.target}
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
              STATUS_TONE[run.status] ?? STATUS_TONE.queued
            }`}
          >
            {STATUS_LABEL[run.status] ?? run.status}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          <span className="whitespace-nowrap">{formatDate(run.createdAt)}</span>
          <span className="tabular-nums">
            {findingCount} finding{findingCount === 1 ? '' : 's'}
          </span>
          <span className="break-all">{run.id}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <SeverityCounts counts={severityCounts} />
          <Link
            to={runPath(run.id)}
            className="font-mono text-[9px] uppercase tracking-[0.14em] text-signal transition hover:text-ink"
          >
            View report
          </Link>
        </div>
      </div>
    </li>
  )
}

export default function RunsPage() {
  const [runs, setRuns] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError(null)

    fetchRuns({ signal: controller.signal })
      .then((items) => {
        if (controller.signal.aborted) return
        setRuns(items)
        setStatus('ready')
      })
      .catch((caught) => {
        if (controller.signal.aborted) return
        setError({
          code: caught?.code ?? 'request_failed',
          message: caught?.message ?? 'The runs could not be loaded.',
        })
        setStatus('error')
      })

    return () => controller.abort()
  }, [])

  return (
    <div>
      <div className="page-grain" aria-hidden="true" />

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft"
        >
          <Link to="/scan" className="transition hover:text-ink">
            New scan
          </Link>
          <span className="mx-2 text-ink/25" aria-hidden="true">
            /
          </span>
          <span className="text-ink/60">Agent runs</span>
        </nav>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.9rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
              Stored agent runs
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-soft">
              Every agent run is stored on the server with its findings and
              transcript. Open a run to read the full report.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 border border-signal/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-signal">
            <Bot size={11} aria-hidden="true" />
            Agent · beta
          </span>
        </div>

        {status === 'loading' ? (
          <div className="mt-6 border border-rule bg-panel px-4 py-6">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
              Loading runs
            </p>
            <p className="mt-2 text-xs leading-6 text-ink-soft/70">
              Asking the server for stored runs…
            </p>
          </div>
        ) : null}

        {status === 'error' ? (
          <div
            role="alert"
            className="mt-6 border border-red-500/40 bg-red-500/[0.04] px-4 py-5"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-red-300">
              {error?.code ?? 'request_failed'}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-ink">
              {error?.code === 'agent_not_configured'
                ? 'The agent is not configured on the server, so no runs exist yet.'
                : error?.message}
            </p>
          </div>
        ) : null}

        {status === 'ready' && runs.length ? (
          <ul className="mt-6 divide-y divide-rule border border-rule bg-panel">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </ul>
        ) : null}

        {status === 'ready' && !runs.length ? (
          <div className="mt-6 border border-rule bg-panel px-4 py-10 text-center">
            <span className="mx-auto grid h-10 w-10 place-items-center border border-rule text-ink-soft">
              <Inbox size={17} aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium text-ink">No agent runs yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-ink-soft">
              Agent runs are stored on the server, not in this browser. Assign an
              agent to a site and the finished run appears here with a link to
              its report.
            </p>
            <Link
              to="/scan/agent"
              className="mt-5 inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
            >
              Assign an agent
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        ) : null}

        <div className="mt-8 border-t border-rule pt-4">
          <Link
            to="/scan/agent"
            className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
          >
            Assign another agent
            <ArrowRight
              size={12}
              className="transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </div>
  )
}
