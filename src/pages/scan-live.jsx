import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Lock,
  RotateCcw,
} from 'lucide-react'
import { CHECKS } from '../data/demo'
import { formatDuration } from '../lib/scans'
import { hostnameOf, parseTarget } from '../lib/url'
import UrlForm from '../components/UrlForm'
import TerminalCard from '../components/TerminalCard'

const STATUS_TONE = {
  pass: {
    label: 'Pass',
    badge: 'border-emerald-400/30 text-emerald-300',
    text: 'text-emerald-300',
  },
  warn: {
    label: 'Warn',
    badge: 'border-amber-300/40 text-amber-300',
    text: 'text-amber-300',
  },
  review: {
    label: 'Review',
    badge: 'border-signal/40 text-signal',
    text: 'text-signal',
  },
}

const CHECK_NAMES = Object.fromEntries(CHECKS.map((check) => [check.id, check.name]))

const ERROR_HINTS = {
  blocked_host:
    'The collector refuses private, loopback and reserved addresses by design.',
  blocked_port: 'Only ports 80 and 443 are reachable by the collector.',
  dns_failed: 'Check the domain spelling, or try again in a moment.',
  timeout: 'The site did not answer in time. Try again or check it directly.',
  too_many_redirects: 'The redirect chain was longer than five hops.',
}

function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.review
  return (
    <span
      className={`inline-flex shrink-0 border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em] ${tone.badge}`}
    >
      {tone.label}
    </span>
  )
}

function SummaryCell({ label, value, hint, tone = 'text-ink' }) {
  return (
    <div className="min-w-0 bg-canvas px-4 py-3.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
        {label}
      </p>
      <p className={`mt-1.5 truncate font-mono text-[13px] ${tone}`} title={String(value)}>
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate font-mono text-[9px] text-ink-soft/70">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function EvidenceRow({ label, value }) {
  return (
    <div className="grid gap-1 border-b border-rule px-4 py-2.5 last:border-b-0 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <span className="break-all font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      <span className="min-w-0 break-all font-mono text-[11px] leading-5 text-ink">
        {value ?? '—'}
      </span>
    </div>
  )
}

function transcriptFor(evidence) {
  const lines = []
  lines.push({ tone: 'muted', text: `GET ${evidence.target}` })

  if (evidence.redirects?.length) {
    for (const hop of evidence.redirects) {
      lines.push({
        tone: 'out',
        text: `  ${hop.status} -> ${hop.to}`,
        wrap: true,
      })
    }
  }

  lines.push({
    tone: evidence.response.status < 400 ? 'ok' : 'warn',
    text: `status ${evidence.response.status} · ${evidence.response.contentType || 'unknown type'}`,
    wrap: true,
  })

  if (evidence.tls) {
    lines.push({
      tone: evidence.tls.authorized ? 'ok' : 'warn',
      text: `tls ${evidence.tls.protocol} · ${evidence.tls.cipher}`,
      wrap: true,
    })
    lines.push({
      tone: 'out',
      text: `cert ${evidence.tls.subject ?? 'unknown'} · ${evidence.tls.daysRemaining ?? '?'} days left`,
      wrap: true,
    })
  } else {
    lines.push({ tone: 'warn', text: 'no tls session' })
  }

  lines.push({
    tone: 'out',
    text: `server ${evidence.response.headers.server ?? 'not disclosed'}`,
  })

  for (const check of evidence.checks) {
    lines.push({
      tone:
        check.status === 'pass'
          ? 'ok'
          : check.status === 'warn'
            ? 'warn'
            : 'signal',
      text: `${check.id.padEnd(15, ' ')} ${check.status.toUpperCase()}`,
    })
  }

  return lines
}

export default function ScanLivePage() {
  const [searchParams] = useSearchParams()
  const initialUrl = searchParams.get('url') ?? ''

  const [status, setStatus] = useState('idle')
  const [evidence, setEvidence] = useState(null)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)

  const startedRef = useRef(0)
  const controllerRef = useRef(null)

  useEffect(() => {
    if (status !== 'running') return undefined
    const timer = window.setInterval(() => {
      setElapsed(Date.now() - startedRef.current)
    }, 100)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    [],
  )

  async function runScan(rawUrl) {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    const timeout = window.setTimeout(() => controller.abort(), 45_000)

    setStatus('running')
    setEvidence(null)
    setError(null)
    setElapsed(0)
    startedRef.current = Date.now()

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
        signal: controller.signal,
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok) {
        const failure = new Error(
          payload?.error ?? 'The live check could not be completed.',
        )
        failure.code = payload?.code ?? 'scan_failed'
        throw failure
      }

      setEvidence(payload)
      setElapsed(payload.durationMs ?? Date.now() - startedRef.current)
      setStatus('done')
    } catch (caught) {
      // A newer run (or StrictMode's double effect) has taken over.
      if (controllerRef.current !== controller) return

      if (caught?.name === 'AbortError') {
        setError({
          code: 'timeout',
          message: 'The check was cancelled before the site answered.',
        })
      } else {
        setError({
          code: caught?.code ?? 'scan_failed',
          message: caught?.message ?? 'The live check could not be completed.',
        })
      }
      setStatus('error')
    } finally {
      window.clearTimeout(timeout)
    }
  }

  function reset() {
    setStatus('idle')
    setEvidence(null)
    setError(null)
    setElapsed(0)
  }

  useEffect(() => {
    if (!initialUrl) return
    const parsed = parseTarget(initialUrl)
    if (parsed.ok) runScan(parsed.url)
    // Runs when the URL supplied in the query string changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl])

  const counts = useMemo(() => {
    const totals = { pass: 0, warn: 0, review: 0 }
    for (const check of evidence?.checks ?? []) {
      totals[check.status] = (totals[check.status] ?? 0) + 1
    }
    return totals
  }, [evidence])

  const targetHost = evidence
    ? hostnameOf(evidence.finalUrl ?? evidence.target)
    : initialUrl
      ? hostnameOf(initialUrl)
      : null

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
          <span className="text-ink/60">Live check</span>
        </nav>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.9rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
              {status === 'done' ? 'Live check complete' : 'Live check'}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-soft">
              {status === 'done' && targetHost
                ? 'Real evidence captured from '
                : 'The collector requests one page and records what came back from '}
              <span className="font-mono text-[12px] text-ink">
                {targetHost ?? 'the target'}
              </span>
              {status === 'done' ? '.' : ' — no agents, no invented findings.'}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 border border-signal/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-signal">
            <Activity size={11} aria-hidden="true" />
            Live · beta
          </span>
        </div>

        <div
          role="note"
          className="mt-5 flex gap-3 border border-amber-300/30 bg-amber-300/[0.04] px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/90"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300/90">
              Real requests
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Only check sites you own or have permission to test. The collector
              sends a real request to the URL you enter and records the response.
            </p>
          </div>
        </div>

        {status === 'idle' || status === 'error' ? (
          <div className="mt-6 border border-rule bg-panel p-5 sm:p-7">
            <label
              htmlFor="live-url"
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft"
            >
              Website URL
            </label>
            <p className="mt-2 text-xs leading-5 text-ink-soft/80">
              HTTP and HTTPS only. Ports 80 and 443. Private and reserved
              addresses are refused.
            </p>
            <div className="mt-4">
              <UrlForm
                id="live-url"
                onSubmit={runScan}
                initialValue={initialUrl}
                autoFocus
                buttonLabel="Run live check"
              />
            </div>

            {status === 'error' && error ? (
              <div
                role="alert"
                className="mt-5 border border-red-500/40 bg-red-500/[0.04] px-4 py-3"
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-red-300">
                  {error.code}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-ink">{error.message}</p>
                {ERROR_HINTS[error.code] ? (
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    {ERROR_HINTS[error.code]}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-7 grid gap-px border border-rule bg-rule sm:grid-cols-3">
              {[
                {
                  icon: Globe,
                  label: 'Request',
                  text: 'One document fetch, up to five redirects, no crawling.',
                },
                {
                  icon: Lock,
                  label: 'Transport',
                  text: 'TLS version, cipher, certificate issuer and expiry.',
                },
                {
                  icon: CheckCircle2,
                  label: 'Derive',
                  text: 'Twelve checks scored from the captured evidence only.',
                },
              ].map((item) => (
                <div key={item.label} className="bg-panel px-4 py-3.5">
                  <item.icon
                    size={15}
                    className="text-signal"
                    aria-hidden="true"
                  />
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {status === 'running' ? (
          <div className="mt-6 border border-rule bg-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center border border-signal/40">
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <span className="absolute inline-flex h-4 w-4 animate-ping bg-signal opacity-25" />
                    <Activity size={17} className="text-signal" aria-hidden="true" />
                  </span>
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">
                    Collecting evidence
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                    {targetHost ?? 'target'} · awaiting response
                  </p>
                </div>
              </div>
              <p className="font-mono text-xl font-medium tabular-nums text-ink">
                {formatDuration(elapsed)}
              </p>
            </div>
            <div className="border-t border-rule px-5 py-4">
              <div className="h-1 w-full overflow-hidden bg-rule">
                <div className="h-full w-1/3 animate-pulse bg-signal" />
              </div>
              <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                One request plus three well-known paths · max 45s
              </p>
            </div>
            <p className="sr-only" aria-live="polite">
              Live check running for {targetHost}.
            </p>
          </div>
        ) : null}

        {status === 'done' && evidence ? (
          <div className="fade-in">
            <div className="mt-6 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCell
                label="HTTP status"
                value={evidence.response.status}
                hint={evidence.response.contentType || 'unknown type'}
                tone={evidence.response.status < 400 ? 'text-emerald-300' : 'text-amber-300'}
              />
              <SummaryCell
                label="Final URL"
                value={targetHost}
                hint={
                  evidence.redirects.length
                    ? `${evidence.redirects.length} redirect(s)`
                    : 'no redirect'
                }
              />
              <SummaryCell
                label="TLS"
                value={evidence.tls ? evidence.tls.protocol : 'None'}
                hint={evidence.tls?.cipher ?? 'no tls session'}
                tone={evidence.tls?.authorized ? 'text-emerald-300' : 'text-amber-300'}
              />
              <SummaryCell
                label="Certificate"
                value={
                  evidence.tls?.daysRemaining === null ||
                  evidence.tls?.daysRemaining === undefined
                    ? 'Unknown'
                    : `${evidence.tls.daysRemaining} days`
                }
                hint={evidence.tls?.issuer ?? 'no certificate'}
                tone={
                  evidence.tls?.daysRemaining > 30
                    ? 'text-emerald-300'
                    : 'text-amber-300'
                }
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border border-rule bg-panel px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em]">
              <span className="text-emerald-300">{counts.pass} pass</span>
              <span className="text-amber-300">{counts.warn} warn</span>
              <span className="text-signal">{counts.review} review</span>
              <span className="ml-auto text-ink-soft">
                {formatDuration(evidence.durationMs)} ·{' '}
                {new Date(evidence.fetchedAt).toLocaleTimeString()}
              </span>
            </div>

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/40 pb-2">
                <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                  01 / Checks
                </h2>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">
                  Derived from captured evidence
                </span>
              </div>

              <ol className="mt-3 divide-y divide-rule border border-rule bg-panel">
                {evidence.checks.map((check, index) => {
                  const tone = STATUS_TONE[check.status] ?? STATUS_TONE.review
                  return (
                    <li key={check.id} className="flex gap-3 px-4 py-3 sm:px-5">
                      <span
                        className="w-6 shrink-0 pt-0.5 font-mono text-[9px] leading-5 tabular-nums text-ink/30"
                        aria-hidden="true"
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <p className="text-[13px] font-medium text-ink">
                            {CHECK_NAMES[check.id] ?? check.id}
                          </p>
                          <StatusBadge status={check.status} />
                        </div>
                        <p className={`mt-0.5 font-mono text-[11px] leading-5 ${tone.text}`}>
                          {check.observed}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/40 pb-2">
                <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                  02 / Collector transcript
                </h2>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">
                  Captured {new Date(evidence.fetchedAt).toLocaleString()}
                </span>
              </div>

              <TerminalCard
                className="mt-3"
                title="webauditors collect"
                tag="Live capture"
                command={`webauditors collect ${evidence.target}`}
                lines={transcriptFor(evidence)}
                footer={`${evidence.checks.length} checks · ${formatDuration(evidence.durationMs)} · ${evidence.response.bodyBytes} bytes read`}
              />
            </section>

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/40 pb-2">
                <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                  03 / Raw evidence
                </h2>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">
                  Not interpreted
                </span>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="border border-rule bg-panel">
                  <p className="border-b border-rule px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                    Response headers
                  </p>
                  {Object.entries(evidence.response.headers).length ? (
                    Object.entries(evidence.response.headers).map(([name, value]) => (
                      <EvidenceRow key={name} label={name} value={value} />
                    ))
                  ) : (
                    <p className="px-4 py-3 font-mono text-[11px] text-ink-soft">
                      No headers were captured.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="border border-rule bg-panel">
                    <p className="border-b border-rule px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                      Transport
                    </p>
                    <EvidenceRow label="TLS protocol" value={evidence.tls?.protocol} />
                    <EvidenceRow label="Cipher" value={evidence.tls?.cipher} />
                    <EvidenceRow label="Issuer" value={evidence.tls?.issuer} />
                    <EvidenceRow label="Subject" value={evidence.tls?.subject} />
                    <EvidenceRow
                      label="Valid to"
                      value={
                        evidence.tls?.validTo
                          ? new Date(evidence.tls.validTo).toLocaleDateString()
                          : null
                      }
                    />
                    <EvidenceRow
                      label="SAN entries"
                      value={evidence.tls?.sanCount ?? null}
                    />
                  </div>

                  <div className="border border-rule bg-panel">
                    <p className="border-b border-rule px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                      Redirects
                    </p>
                    {evidence.redirects.length ? (
                      evidence.redirects.map((hop, index) => (
                        <EvidenceRow
                          key={`${hop.from}-${index}`}
                          label={`${hop.status} hop ${index + 1}`}
                          value={hop.to}
                        />
                      ))
                    ) : (
                      <p className="px-4 py-3 font-mono text-[11px] text-ink-soft">
                        No redirect was followed.
                      </p>
                    )}
                  </div>

                  <div className="border border-rule bg-panel">
                    <p className="border-b border-rule px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                      Probes
                    </p>
                    {evidence.probes.length ? (
                      evidence.probes.map((probe) => (
                        <EvidenceRow
                          key={probe.path}
                          label={probe.path}
                          value={
                            probe.status === null
                              ? 'unreachable'
                              : `${probe.status} · ${probe.bytes} bytes`
                          }
                        />
                      ))
                    ) : (
                      <p className="px-4 py-3 font-mono text-[11px] text-ink-soft">
                        Probes were skipped because the response was not HTML.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
              >
                <RotateCcw size={13} aria-hidden="true" />
                Run another check
              </button>
              <Link
                to="/scan"
                className="inline-flex items-center justify-center border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-canvas"
              >
                Back to scan options
              </Link>
            </div>

            <p className="mt-4 border-t border-rule pt-4 text-xs leading-6 text-ink-soft/80">
              This is raw evidence, not a security verdict. A missing header is
              recorded as an observation. Findings, agent interpretation and
              stored report links arrive in a later step; live checks are not
              saved to scan history yet.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
