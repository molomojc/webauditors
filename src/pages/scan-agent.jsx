import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  RotateCcw,
  Wrench,
} from 'lucide-react'
import { formatDuration } from '../lib/scans'
import { hostnameOf, parseTarget } from '../lib/url'
import UrlForm from '../components/UrlForm'
import OwnershipBadge from '../components/OwnershipBadge'
import { pollRun } from '../lib/runs'

const SEVERITY_TONE = {
  high: 'border-red-400/40 text-red-300',
  medium: 'border-amber-300/40 text-amber-300',
  info: 'border-signal/40 text-signal',
}

const SEVERITY_LABEL = {
  high: 'High',
  medium: 'Medium',
  info: 'Info',
}

const TOOLS = [
  {
    name: 'fetch_page',
    text: 'One request: status, redirects, headers, TLS and certificate.',
  },
  {
    name: 'probe_path',
    text: 'Up to eight well-known paths, chosen by the agent.',
  },
  {
    name: 'fetch_asset',
    text: 'Reads same-origin bundles and reports secrets redacted.',
  },
  {
    name: 'dns_lookup',
    text: 'TXT, CAA, MX and NS records for the target hostname.',
  },
]

const ERROR_HINTS = {
  agent_not_configured:
    'Add LLM_API_KEY and LLM_MODEL to the environment, then restart the server.',
  llm_failed: 'The model provider rejected the request. Check the model name and key.',
  llm_timeout: 'The model did not answer in time. Try again with a smaller model.',
  llm_unreachable: 'The model endpoint could not be reached from this server.',
  step_limit: 'The agent hit its step limit. Run it again to continue.',
  ownership_required:
    'Publish the verification file or DNS record, then verify again.',
  blocked_host: 'The agent refuses private, loopback and reserved addresses.',
  blocked_port: 'Only ports 80 and 443 are reachable.',
  dns_failed: 'The domain could not be resolved.',
}

function eventLine(event) {
  switch (event.event) {
    case 'agent.assigned':
      return {
        tone: 'text-signal',
        text: `agent assigned · ${event.agent?.name} v${event.agent?.version} · ${event.agent?.model ?? 'model'}`,
      }
    case 'tool.call':
      return {
        tone: 'text-ink',
        text: `> ${event.name}${event.argument ? ` ${event.argument}` : ''}`,
      }
    case 'tool.result':
      return {
        tone: event.ok ? 'text-ink-soft' : 'text-amber-300',
        text: `→ ${event.summary}`,
      }
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
      return {
        tone: 'text-emerald-300',
        text: `done · ${event.steps} steps · ${
          (event.usage?.inputTokens ?? 0) + (event.usage?.outputTokens ?? 0)
        } tokens`,
      }
    case 'agent.failed':
      return { tone: 'text-red-300', text: `! ${event.code}: ${event.error}` }
    default:
      return null
  }
}

function severityTone(severity) {
  return SEVERITY_TONE[severity] ?? SEVERITY_TONE.info
}

function FindingCard({ finding }) {
  return (
    <article className="border border-rule bg-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
            {finding.category}
          </p>
          <h3 className="mt-1 text-sm font-medium leading-5 text-ink">
            {finding.title}
          </h3>
        </div>
        <span
          className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${severityTone(
            finding.severity,
          )}`}
        >
          {SEVERITY_LABEL[finding.severity] ?? finding.severity}
        </span>
      </header>

      <dl className="divide-y divide-rule">
        {[
          ['Observed', finding.observation],
          ['Impact', finding.impact],
          ['Fix', finding.fix],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              {label}
            </dt>
            <dd className="mt-1 text-xs leading-6 text-ink-soft">{value}</dd>
          </div>
        ))}
      </dl>

      <footer className="flex flex-wrap items-center gap-1.5 border-t border-rule px-4 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
          Evidence
        </span>
        {finding.evidence.map((ref) => (
          <code
            key={ref}
            className="break-all border border-rule px-1.5 py-0.5 font-mono text-[9.5px] text-ink-soft"
          >
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

export default function ScanAgentPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialUrl = searchParams.get('url') ?? ''

  const [status, setStatus] = useState('idle')
  const [targetUrl, setTargetUrl] = useState(initialUrl)
  const [draftUrl, setDraftUrl] = useState(initialUrl)
  const [runId, setRunId] = useState(null)
  const [ownership, setOwnership] = useState({
    status: 'unknown',
    method: null,
    detail: '',
    token: null,
    path: null,
    dnsName: null,
    instructions: '',
  })
  const [events, setEvents] = useState([])
  const [findings, setFindings] = useState([])
  const [agent, setAgent] = useState(null)
  const [summary, setSummary] = useState('')
  const [usage, setUsage] = useState(null)
  const [steps, setSteps] = useState(0)
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

  function handleEvent(event) {
    setEvents((current) => [...current, event])

    if (event.event === 'agent.assigned') setAgent(event.agent)
    if (event.event === 'run.created') setRunId(event.runId)
    if (event.event === 'finding') {
      setFindings((current) => [...current, event.finding])
    }
    if (event.event === 'agent.completed') {
      setSummary(event.summary ?? '')
      setUsage(event.usage ?? null)
      setSteps(event.steps ?? 0)
      setStatus('done')
    }
    if (event.event === 'agent.failed') {
      setError({ code: event.code, message: event.error })
      setStatus('error')
    }
  }

  async function checkOwnership() {
    const parsed = parseTarget(draftUrl)

    if (!parsed.ok) {
      setOwnership((current) => ({
        ...current,
        status: 'failed',
        detail: 'Enter the site URL first.',
      }))
      return
    }

    setOwnership((current) => ({ ...current, status: 'verifying', detail: '' }))

    try {
      if (!ownership.token) {
        const response = await fetch('/api/agent/ownership', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'create', url: parsed.url }),
        })
        const payload = await response.json()

        if (!payload.ok) {
          throw new Error(payload.error ?? 'The ownership check failed.')
        }

        setOwnership({
          status: 'unverified',
          method: null,
          detail: '',
          token: payload.token,
          path: payload.path,
          dnsName: payload.dnsName,
          instructions: payload.instructions,
        })
        return
      }

      const response = await fetch('/api/agent/ownership', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          url: parsed.url,
          token: ownership.token,
        }),
      })
      const payload = await response.json()

      if (!payload.ok) {
        throw new Error(payload.error ?? 'The ownership check failed.')
      }

      setOwnership((current) => ({
        ...current,
        status: payload.verified ? 'verified' : 'failed',
        method: payload.method ?? null,
        detail: payload.detail ?? '',
      }))
    } catch (error) {
      setOwnership((current) => ({
        ...current,
        status: 'failed',
        detail: error?.message ?? 'The ownership check failed.',
      }))
    }
  }

  // The queue path: the run is stored first, then a worker picks it up. The
  // browser does not have to hold the stream open, and the finished run has a
  // report page of its own.
  async function runInBackground(rawUrl) {
    const parsed = parseTarget(rawUrl)

    if (!parsed.ok) {
      setError({ code: 'invalid_url', message: parsed.error })
      setStatus('error')
      return
    }

    setStatus('queued')
    setError(null)
    setEvents([])
    setFindings([])
    setRunId(null)

    try {
      const response = await fetch('/api/agent/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: parsed.url,
          async: true,
          ownershipToken: ownership.token ?? undefined,
        }),
      })
      const payload = await response.json()

      if (!payload.ok) {
        const failure = new Error(payload.error ?? 'The run could not be queued.')
        failure.code = payload.code ?? 'queue_failed'
        throw failure
      }

      setRunId(payload.runId)

      // Nothing claims a queued run on its own: a cron or a deploy hook calls
      // the worker. In the prototype the browser nudges it once.
      await fetch('/api/agent/worker', { method: 'POST' }).catch(() => null)

      await pollRun(payload.runId, {
        onUpdate: (run) => setRunId(run.id),
      })

      navigate(`/reports/agent/${payload.runId}`)
    } catch (caught) {
      setError({
        code: caught?.code ?? 'queue_failed',
        message: caught?.message ?? 'The queued run did not finish.',
      })
      setStatus('error')
    }
  }

  async function runScan(rawUrl) {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setStatus('running')
    setTargetUrl(rawUrl)
    setRunId(null)
    setEvents([])
    setFindings([])
    setAgent(null)
    setSummary('')
    setUsage(null)
    setSteps(0)
    setError(null)
    setElapsed(0)
    startedRef.current = Date.now()

    try {
      const response = await fetch('/api/agent/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: rawUrl,
          ownershipToken: ownership.token ?? undefined,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null)
        const failure = new Error(
          payload?.error ?? 'The agent could not be started.',
        )
        failure.code = payload?.code ?? 'agent_failed'
        throw failure
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let newline = buffer.indexOf('\n')

        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          newline = buffer.indexOf('\n')
          if (!line) continue
          try {
            handleEvent(JSON.parse(line))
          } catch {
            // A malformed event should not kill the transcript.
          }
        }
      }
    } catch (caught) {
      if (controllerRef.current !== controller) return

      if (caught?.name === 'AbortError') {
        setError({
          code: 'aborted',
          message: 'The run was cancelled before the agent finished.',
        })
      } else {
        setError({
          code: caught?.code ?? 'agent_failed',
          message: caught?.message ?? 'The agent run failed.',
        })
      }
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setTargetUrl('')
    setRunId(null)
    setEvents([])
    setFindings([])
    setAgent(null)
    setSummary('')
    setUsage(null)
    setSteps(0)
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

  const targetHost = targetUrl ? hostnameOf(targetUrl) : null
  const transcript = events
    .map(eventLine)
    .filter(Boolean)

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
          <span className="text-ink/60">Agent scan</span>
        </nav>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.9rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
              {status === 'done' ? 'Agent finished' : 'Assign an agent'}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-soft">
              {status === 'done'
                ? `Findings from ${agent?.name ?? 'the agent'} for `
                : 'One agent investigates a single site with read-only tools. It reports what it observed for '}
              <span className="font-mono text-[12px] text-ink">
                {targetHost ?? 'the target'}
              </span>
              .
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 border border-signal/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-signal">
            <Bot size={11} aria-hidden="true" />
            Agent · beta
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
              Only scan sites you own or have permission to test. The agent reads
              from your site and cannot run commands or reach other hosts.
            </p>
          </div>
        </div>

        {status === 'idle' || status === 'error' ? (
          <div className="mt-6 border border-rule bg-panel p-5 sm:p-7">
            <label
              htmlFor="agent-url"
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft"
            >
              Website URL
            </label>
            <p className="mt-2 text-xs leading-5 text-ink-soft/80">
              HTTP and HTTPS only. Ports 80 and 443. Private and reserved
              addresses are refused.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 border border-rule bg-panel px-4 py-3">
              <OwnershipBadge
                status={ownership.status}
                method={ownership.method}
                detail={ownership.detail}
                onVerify={checkOwnership}
              />
              <p className="min-w-0 flex-1 text-xs leading-5 text-ink-soft">
                Prove you control the domain before it is scanned. The check
                reads one file or one DNS record; the agent never asks for it.
              </p>
            </div>

            {ownership.token && ownership.status !== 'verified' ? (
              <div className="mt-3 border border-signal/30 bg-signal/[0.04] px-4 py-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-signal">
                  Publish this token
                </p>
                <p className="mt-1.5 text-xs leading-5 text-ink-soft">
                  {ownership.instructions}
                </p>
                <pre className="mt-2 overflow-x-auto border border-rule bg-canvas px-3 py-2 font-mono text-[10px] leading-5 text-ink-soft">
                  {ownership.token}
                </pre>
                <p className="mt-2 text-xs leading-5 text-ink-soft">
                  Press Verify again once it is published.
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <UrlForm
                id="agent-url"
                onSubmit={runScan}
                initialValue={initialUrl}
                onValueChange={setDraftUrl}
                autoFocus
                buttonLabel="Assign agent"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => runInBackground(draftUrl)}
                className="inline-flex items-center justify-center border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-canvas"
              >
                Queue this scan
              </button>
              <p className="min-w-0 flex-1 text-xs leading-5 text-ink-soft/80">
                The run is stored first and picked up by a worker, so the
                finished report outlives this tab.
              </p>
            </div>

            {status === 'error' && error ? (
              <div
                role="alert"
                className="mt-5 border border-red-500/40 bg-red-500/[0.04] px-4 py-3"
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-red-300">
                  {error.code}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-ink">
                  {error.message}
                </p>
                {ERROR_HINTS[error.code] ? (
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    {ERROR_HINTS[error.code]}
                  </p>
                ) : null}

                {error.code === 'agent_not_configured' ? (
                  <pre className="mt-3 overflow-x-auto border border-rule bg-canvas px-3 py-2.5 font-mono text-[10px] leading-5 text-ink-soft">
{`LLM_API_KEY=sk-...
LLM_MODEL=your-model
LLM_BASE_URL=https://api.openai.com/v1  # optional`}
                  </pre>
                ) : null}
              </div>
            ) : null}

            <div className="mt-7 grid gap-px border border-rule bg-rule sm:grid-cols-2">
              {TOOLS.map((tool) => (
                <div key={tool.name} className="bg-panel px-4 py-3.5">
                  <p className="font-mono text-[10px] text-ink">{tool.name}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-soft">
                    {tool.text}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-ink-soft/80">
              <Wrench size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Tool output is treated as untrusted data. Findings that cite no
              captured evidence are rejected before they reach this page.
            </p>
          </div>
        ) : null}

        {status === 'queued' ? (
          <div className="mt-6 border border-rule bg-panel px-5 py-6">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              Queued
            </p>
            <p className="mt-2 text-[13px] leading-6 text-ink">
              The run is stored and waiting for a worker
              {runId ? (
                <>
                  {' '}
                  <span className="font-mono text-[12px] text-ink-soft">
                    {runId}
                  </span>
                </>
              ) : null}
              . The report opens when it finishes.
            </p>
          </div>
        ) : null}

        {status === 'running' || status === 'done' ? (
          <div className="fade-in">
            <div className="mt-6 border border-rule bg-panel">
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center border ${
                      status === 'done'
                        ? 'border-emerald-400/30 text-emerald-300'
                        : 'border-signal/40 text-signal'
                    }`}
                  >
                    {status === 'done' ? (
                      <Bot size={18} aria-hidden="true" />
                    ) : (
                      <span className="relative flex h-4 w-4 items-center justify-center">
                        <span className="absolute inline-flex h-4 w-4 animate-ping bg-signal opacity-25" />
                        <Activity size={17} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {status === 'done'
                        ? `${agent?.name ?? 'Agent'} finished`
                        : `${agent?.name ?? 'Agent'} investigating`}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                      {agent
                        ? `${agent.id} v${agent.version} · ${agent.model ?? 'model'}`
                        : 'assigning agent'}
                    </p>
                    {runId ? (
                      <p className="mt-1 font-mono text-[9.5px] tracking-[0.12em] text-ink-soft/70">
                        {runId}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono text-xl font-medium tabular-nums text-ink">
                    {formatDuration(elapsed)}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                    {status === 'done' ? `${steps} steps` : 'Elapsed'}
                  </p>
                </div>
              </div>

              <div className="border-t border-rule bg-canvas px-4 py-3.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                  Transcript
                </p>
                {transcript.length ? (
                  <ol className="mt-2 space-y-1 overflow-x-auto font-mono text-[11px] leading-5">
                    {transcript.map((line, index) => (
                      <li
                        key={index}
                        className={`break-all ${line.tone}`}
                      >
                        {line.text}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 font-mono text-[11px] leading-5 text-ink-soft/60">
                    Waiting for the first event…
                  </p>
                )}
                {status === 'running' ? (
                  <p className="mt-2 font-mono text-[11px] text-ink-soft/50">
                    <span className="inline-block h-3 w-[6px] translate-y-px animate-pulse bg-ink-soft" />
                  </p>
                ) : null}
              </div>
            </div>

            {status === 'done' ? (
              <>
                {summary ? (
                  <section className="mt-4 border border-rule bg-panel px-5 py-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                      Agent summary
                    </p>
                    <p className="mt-2 text-[13px] leading-6 text-ink">
                      {summary}
                    </p>
                    {usage ? (
                      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">
                        {(usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)}{' '}
                        tokens · {findings.length} findings
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <section className="mt-6">
                  <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/40 pb-2">
                    <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                      Findings
                    </h2>
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft/70">
                      Every item cites captured evidence
                    </span>
                  </div>

                  {findings.length ? (
                    <div className="mt-3 space-y-3">
                      {findings.map((finding, index) => (
                        <FindingCard
                          key={`${finding.id}-${index}`}
                          finding={finding}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 border border-rule bg-panel px-4 py-4 text-xs leading-6 text-ink-soft">
                      The agent finished without a supported finding. That is a
                      valid result: it will not report what it could not observe.
                    </p>
                  )}
                </section>

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {runId ? (
                    <Link
                      to={`/reports/agent/${runId}`}
                      className="inline-flex items-center justify-center border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-canvas"
                    >
                      Open the stored report
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    Assign another agent
                  </button>
                  <Link
                    to="/scan"
                    className="inline-flex items-center justify-center border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-canvas"
                  >
                    Back to scan options
                  </Link>
                </div>

                <p className="mt-4 border-t border-rule pt-4 text-xs leading-6 text-ink-soft/80">
                  {runId
                    ? `This run is stored as ${runId}. The report page keeps the transcript and the findings after this tab closes.`
                    : 'This transcript is the run record. A stored report link appears here once the run has an id.'}
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {status === 'running'
            ? 'The agent is investigating.'
            : status === 'done'
              ? 'The agent finished.'
              : ''}
        </p>

        <div className="mt-8 border-t border-rule pt-4">
          <Link
            to="/scan/live"
            className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
          >
            Just capture evidence, without an agent
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
