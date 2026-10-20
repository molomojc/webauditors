import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  ShieldAlert,
} from 'lucide-react'
import {
  CHECKS,
  DEMO_TARGET,
  SAMPLE_FINDING_KEYS,
  SCAN_DURATIONS,
  statusesForFindings,
} from '../data/demo'
import { addScan, createScan, formatDuration, summarize } from '../lib/scans'
import { hostnameOf, parseTarget } from '../lib/url'
import DemoNotice from '../components/DemoNotice'
import {
  CheckStatusBadge,
  CheckStatusIcon,
} from '../components/CheckStatus'

const RESULT_STATUSES = Object.fromEntries(
  statusesForFindings(SAMPLE_FINDING_KEYS).map((check) => [
    check.id,
    check.status,
  ]),
)

function buildTimeline() {
  let cursor = 320
  return CHECKS.map((check, index) => {
    const start = cursor
    const end = start + SCAN_DURATIONS[index % SCAN_DURATIONS.length]
    cursor = end + 130
    return { start, end }
  })
}

export default function ScanDemoPage() {
  const [searchParams] = useSearchParams()
  const timeline = useMemo(buildTimeline, [])
  const totalMs = timeline[timeline.length - 1].end

  const target = useMemo(() => {
    const parsed = parseTarget(searchParams.get('url') ?? DEMO_TARGET)
    return parsed.ok ? parsed.url : DEMO_TARGET
  }, [searchParams])
  const hostname = hostnameOf(target)

  const [now, setNow] = useState(0)
  const [scan, setScan] = useState(null)
  const startedAtRef = useRef(Date.now())
  const savedRef = useRef(false)

  useEffect(() => {
    if (scan) return undefined

    startedAtRef.current = Date.now()
    const start = performance.now()
    const interval = window.setInterval(() => {
      setNow(Math.min(performance.now() - start, totalMs))
    }, 80)

    return () => window.clearInterval(interval)
  }, [scan, totalMs])

  useEffect(() => {
    if (now < totalMs || scan || savedRef.current) return

    savedRef.current = true
    const completed = createScan({
      target,
      findingKeys: SAMPLE_FINDING_KEYS,
      durationMs: totalMs,
      startedAt: startedAtRef.current,
    })
    addScan(completed)
    setScan(completed)
  }, [now, totalMs, scan, target])

  const statuses = CHECKS.map((check, index) => {
    if (scan) return scan.checks[index]?.status ?? 'pass'
    const step = timeline[index]
    if (now >= step.end) return RESULT_STATUSES[check.id]
    if (now >= step.start) return 'checking'
    return 'waiting'
  })

  const completedCount = statuses.filter(
    (status) => status !== 'waiting' && status !== 'checking',
  ).length
  const progress = scan ? 100 : Math.min(100, Math.round((now / totalMs) * 100))
  const summary = scan ? summarize(scan) : null

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-xs text-slate-400">
        <Link to="/scan" className="hover:text-white">
          New demonstration scan
        </Link>
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {scan ? 'Demo scan complete' : 'Demonstration scan'}
          </h1>
          <p className="mt-1 break-all text-sm text-slate-300">
            {scan ? 'Sample results are ready for ' : 'Running simulated checks for '}
            <span className="font-medium text-slate-100">{hostname}</span>
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
          <FlaskConical size={12} aria-hidden="true" />
          Demo mode
        </span>
      </div>

      <DemoNotice className="mt-5">
        No requests are sent to {hostname}. These checks use fixed demonstration
        data so the full experience can be reviewed without scanning a real
        website.
      </DemoNotice>

      <div className="mt-6 rounded-xl border border-white/10 bg-panel p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 place-items-center rounded-full ${
                scan
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-blue-500/10 text-blue-400'
              }`}
            >
              {scan ? (
                <CheckCircle2 size={20} aria-hidden="true" />
              ) : (
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-blue-400 opacity-20" />
                  <FlaskConical size={18} aria-hidden="true" />
                </span>
              )}
            </span>
            <div>
              <p className="text-sm font-medium text-white">
                {scan ? 'All simulated checks finished' : 'Running simulated checks'}
              </p>
              <p className="text-xs text-slate-400">
                {completedCount} of {CHECKS.length} checks complete
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="font-mono text-xl font-medium tabular-nums text-white">
              {formatDuration(scan ? scan.durationMs : now)}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">
              Elapsed
            </p>
          </div>
        </div>

        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Demonstration scan progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${
              scan ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
          <span>{progress}% complete</span>
          <span>Demonstration data · no network requests</span>
        </div>

        {!scan && now > 1200 ? (
          <button
            type="button"
            onClick={() => setNow(totalMs)}
            className="mt-3 text-xs font-medium text-slate-400 underline decoration-slate-600 underline-offset-4 transition hover:text-white"
          >
            Skip animation and show results
          </button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {scan ? 'Demo scan complete. Sample results are ready.' : ''}
      </p>

      <ol className="mt-6 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-sm">
        {CHECKS.map((check, index) => {
          const status = statuses[index]
          const resultText =
            status !== 'waiting' && status !== 'checking'
              ? check.results[status]
              : null

          return (
            <li
              key={check.id}
              className="flex gap-3 px-4 py-3.5 sm:px-5"
            >
              <div className="pt-0.5">
                <CheckStatusIcon status={status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p
                    className={`text-sm font-medium ${
                      status === 'waiting' ? 'text-slate-400' : 'text-white'
                    }`}
                  >
                    {check.name}
                  </p>
                  <CheckStatusBadge status={status} />
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  {check.description}
                </p>
                {resultText ? (
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      status === 'warn'
                        ? 'text-amber-300'
                        : status === 'review'
                          ? 'text-blue-300'
                          : 'text-slate-400'
                    }`}
                  >
                    {resultText}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {scan && summary ? (
        <section className="mt-6 rounded-xl border border-white/10 bg-panel p-5 shadow-sm fade-in">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/10 text-amber-300">
                <ShieldAlert size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Overall status
                </p>
                <p className="text-lg font-semibold text-amber-300">
                  {summary.status}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">
              Demo results
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {summary.checks} simulated checks completed with {summary.high}{' '}
            high, {summary.medium} medium and {summary.info} informational
            findings.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              {
                label: 'High',
                value: summary.high,
                className: 'bg-red-500/10 text-red-300',
              },
              {
                label: 'Medium',
                value: summary.medium,
                className: 'bg-amber-500/10 text-amber-300',
              },
              {
                label: 'Info',
                value: summary.info,
                className: 'bg-blue-500/10 text-blue-300',
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-lg px-3 py-2 ${item.className}`}
              >
                <p className="text-xl font-semibold tabular-nums">
                  {item.value}
                </p>
                <p className="text-[11px] font-medium">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              to={`/reports/${scan.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              View security report
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              to="/history"
              className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
            >
              Scan history
            </Link>
            <Link
              to="/scan"
              className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Run another scan
            </Link>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            This demonstration report has been saved to the scan history in
            this browser.
          </p>
        </section>
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        These results are deterministic demonstration data. No HTTP requests,
        TLS handshakes or file checks were performed. Do not use this output as
        evidence that a real website is secure or insecure.
      </p>
    </div>
  )
}
