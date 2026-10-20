import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FlaskConical } from 'lucide-react'
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
    <div>
      <div className="page-grain" aria-hidden="true" />

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft"
        >
          <Link to="/scan" className="transition hover:text-ink">
            New demonstration scan
          </Link>
          <span className="mx-2 text-ink/25" aria-hidden="true">
            /
          </span>
          <span className="text-ink/60">
            {scan ? 'Results' : 'Run in progress'}
          </span>
        </nav>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.9rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
              {scan ? 'Demo scan complete' : 'Demonstration scan'}
            </h1>
            <p className="mt-2 break-all text-[13px] leading-6 text-ink-soft">
              {scan ? 'Sample results are ready for ' : 'Running simulated checks for '}
              <span className="font-mono text-[12px] text-ink">{hostname}</span>
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 border border-amber-300/30 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300/90">
            <FlaskConical size={11} aria-hidden="true" />
            Demo mode
          </span>
        </div>

        <DemoNotice className="mt-5">
          No requests are sent to {hostname}. These checks use fixed demonstration
          data so the full experience can be reviewed without scanning a real
          website.
        </DemoNotice>

        <div className="mt-6 border border-rule bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center border ${
                  scan
                    ? 'border-emerald-400/30 text-emerald-300'
                    : 'border-signal/40 text-signal'
                }`}
              >
                {scan ? (
                  <CheckCircle2 size={18} aria-hidden="true" />
                ) : (
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <span className="absolute inline-flex h-4 w-4 animate-ping bg-signal opacity-25" />
                    <FlaskConical size={17} aria-hidden="true" />
                  </span>
                )}
              </span>
              <div>
                <p className="text-sm font-medium text-ink">
                  {scan ? 'All simulated checks finished' : 'Running simulated checks'}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  {completedCount} of {CHECKS.length} checks complete
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-mono text-xl font-medium tabular-nums text-ink">
                {formatDuration(scan ? scan.durationMs : now)}
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                Elapsed
              </p>
            </div>
          </div>

          <div className="border-t border-rule px-5 py-4">
            <div
              className="h-1 w-full overflow-hidden bg-rule"
              role="progressbar"
              aria-label="Demonstration scan progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className={`h-full transition-[width] duration-150 ${
                  scan ? 'bg-emerald-400' : 'bg-signal'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
              <span>{progress}% complete</span>
              <span>Demonstration data · no network requests</span>
            </div>

            {!scan && now > 1200 ? (
              <button
                type="button"
                onClick={() => setNow(totalMs)}
                className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft underline decoration-rule underline-offset-4 transition hover:text-ink"
              >
                Skip animation and show results
              </button>
            ) : null}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {scan ? 'Demo scan complete. Sample results are ready.' : ''}
        </p>

        <ol className="mt-6 divide-y divide-rule border border-rule bg-panel">
          {CHECKS.map((check, index) => {
            const status = statuses[index]
            const resultText =
              status !== 'waiting' && status !== 'checking'
                ? check.results[status]
                : null

            return (
              <li key={check.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span
                  className="w-6 shrink-0 pt-0.5 font-mono text-[9px] leading-5 tabular-nums text-ink/30"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="pt-0.5">
                  <CheckStatusIcon status={status} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p
                      className={`text-[13px] font-medium ${
                        status === 'waiting' ? 'text-ink-soft' : 'text-ink'
                      }`}
                    >
                      {check.name}
                    </p>
                    <CheckStatusBadge status={status} />
                  </div>
                  <p className="mt-0.5 text-xs leading-6 text-ink-soft">
                    {check.description}
                  </p>
                  {resultText ? (
                    <p
                      className={`mt-1 font-mono text-[11px] leading-5 ${
                        status === 'warn'
                          ? 'text-amber-300'
                          : status === 'review'
                            ? 'text-signal'
                            : 'text-ink-soft'
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
          <section className="mt-6 border border-rule bg-panel fade-in">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                  Overall status
                </p>
                <p className="mt-1.5 text-lg font-medium tracking-[-0.02em] text-amber-300">
                  {summary.status}
                </p>
              </div>
              <span className="border border-rule px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                Demo results
              </span>
            </div>

            <div className="grid gap-px bg-rule sm:grid-cols-3">
              {[
                { label: 'High', value: summary.high, tone: 'text-red-300' },
                { label: 'Medium', value: summary.medium, tone: 'text-amber-300' },
                { label: 'Info', value: summary.info, tone: 'text-signal' },
              ].map((item) => (
                <div key={item.label} className="bg-canvas px-5 py-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                    {item.label}
                  </p>
                  <p
                    className={`mt-1.5 font-mono text-xl font-medium tabular-nums ${item.tone}`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-rule px-5 py-4">
              <p className="text-[13px] leading-6 text-ink-soft">
                {summary.checks} simulated checks completed with {summary.high}{' '}
                high, {summary.medium} medium and {summary.info} informational
                findings.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  to={`/reports/${scan.id}`}
                  className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
                >
                  View security report
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
                <Link
                  to="/history"
                  className="inline-flex items-center justify-center border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-canvas"
                >
                  Scan history
                </Link>
                <Link
                  to="/scan"
                  className="inline-flex items-center justify-center px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
                >
                  Run another scan
                </Link>
              </div>

              <p className="mt-3 text-xs leading-5 text-ink-soft/80">
                This demonstration report has been saved to the scan history in
                this browser.
              </p>
            </div>
          </section>
        ) : null}

        <p className="mt-6 border-t border-rule pt-4 text-xs leading-6 text-ink-soft/80">
          These results are deterministic demonstration data. No HTTP requests,
          TLS handshakes or file checks were performed. Do not use this output as
          evidence that a real website is secure or insecure.
        </p>
      </div>
    </div>
  )
}
