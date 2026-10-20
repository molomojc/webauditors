import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  FlaskConical,
  Globe2,
  Info,
  ListChecks,
  RefreshCw,
  SearchX,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { FINDINGS } from '../data/demo'
import {
  findingsFor,
  formatDate,
  formatDuration,
  getScanById,
  summarize,
} from '../lib/scans'
import { downloadReport } from '../lib/export'
import { hostnameOf } from '../lib/url'
import DemoNotice from '../components/DemoNotice'
import SummaryCard from '../components/SummaryCard'
import FindingsToolbar from '../components/FindingsToolbar'
import FindingsTable from '../components/FindingsTable'
import Drawer from '../components/Drawer'
import FindingDetail from '../components/FindingDetail'
import SeverityBadge from '../components/SeverityBadge'

function ReportNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/10 text-slate-400">
        <SearchX size={22} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
        Report not found
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-300">
        This demonstration report is not stored in this browser. It may have
        been removed when the demo data was reset.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to="/history"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Back to scan history
        </Link>
        <Link
          to="/reports/demo"
          className="inline-flex items-center rounded-lg border border-white/15 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
        >
          Open sample report
        </Link>
      </div>
    </div>
  )
}

export default function ReportPage() {
  const { scanId } = useParams()
  const navigate = useNavigate()
  const [scan, setScan] = useState(() => getScanById(scanId ?? 'demo'))
  const [severity, setSeverity] = useState('all')
  const [query, setQuery] = useState('')
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [exported, setExported] = useState(false)

  useEffect(() => {
    setScan(getScanById(scanId ?? 'demo'))
    setSeverity('all')
    setQuery('')
    setSelectedFinding(null)
    setExported(false)
  }, [scanId])

  if (!scan) return <ReportNotFound />

  const findings = findingsFor(scan)
  const summary = summarize(scan)
  const hostname = hostnameOf(scan.target)

  const counts = {
    total: findings.length,
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
  }

  const searchTerm = query.trim().toLowerCase()
  const filtered = findings.filter((finding) => {
    const matchesSeverity =
      severity === 'all' || finding.severity === severity
    const matchesQuery =
      !searchTerm ||
      [finding.title, finding.description, finding.category, finding.evidence, finding.recommendation]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm)
    return matchesSeverity && matchesQuery
  })

  function handleExport() {
    downloadReport(scan)
    setExported(true)
    window.setTimeout(() => setExported(false), 3000)
  }

  function handleClearFilters() {
    setSeverity('all')
    setQuery('')
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-xs text-slate-400">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/history" className="hover:text-white">
              Scan history
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-slate-200">Demonstration report</li>
        </ol>
      </nav>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-all text-3xl font-semibold tracking-tight text-white">
              {hostname}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
              <FlaskConical size={11} aria-hidden="true" />
              Demo
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            Security report ·{' '}
            <time dateTime={scan.startedAt}>{formatDate(scan.startedAt)}</time>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Globe2 size={13} className="shrink-0" aria-hidden="true" />
              <span className="break-all">{scan.target}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} aria-hidden="true" />
              {formatDuration(scan.durationMs)} (simulated)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={13} aria-hidden="true" />
              {scan.checks.length} checks completed
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-200"
          >
            {exported ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Download size={15} aria-hidden="true" />
            )}
            {exported ? 'Downloaded' : 'Export report'}
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/scan/demo?url=${encodeURIComponent(scan.target)}`)
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Rescan demo
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {exported ? 'Demonstration report downloaded.' : ''}
      </p>

      <DemoNotice className="mt-5">
        No live security scan was performed on {hostname}. Every finding,
        timestamp and comparison in this report is simulated demonstration data.
      </DemoNotice>

      <section className="mt-6 grid items-start gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div
          className={`rounded-xl border bg-panel p-5 shadow-sm ${
            summary.tone === 'attention'
              ? 'border-amber-500/30'
              : 'border-emerald-500/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                summary.tone === 'attention'
                  ? 'bg-amber-500/10 text-amber-300'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {summary.tone === 'attention' ? (
                <AlertTriangle size={20} aria-hidden="true" />
              ) : (
                <ShieldCheck size={20} aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Overall status
              </p>
              <p
                className={`text-xl font-semibold ${
                  summary.tone === 'attention'
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {summary.status}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            This status summarises {summary.total} simulated findings from{' '}
            {summary.checks} checks. It is not a security score and it does not
            guarantee that the website is secure or insecure.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <SeverityBadge severity="high" count={summary.high} />
            <SeverityBadge severity="medium" count={summary.medium} />
            <SeverityBadge severity="info" count={summary.info} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            label="High findings"
            value={summary.high}
            tone="high"
            icon={ShieldAlert}
          />
          <SummaryCard
            label="Medium findings"
            value={summary.medium}
            tone="medium"
            icon={AlertTriangle}
          />
          <SummaryCard
            label="Informational"
            value={summary.info}
            tone="info"
            icon={Info}
          />
          <SummaryCard
            label="Checks completed"
            value={summary.checks}
            tone="neutral"
            icon={ListChecks}
            hint="Deterministic demo checks"
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Findings
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Every finding includes sample evidence, impact, a recommended fix
              and the limits of the check.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            {counts.total} findings · all simulated
          </p>
        </div>

        <div className="mt-4">
          <FindingsToolbar
            severity={severity}
            onSeverityChange={setSeverity}
            query={query}
            onQueryChange={setQuery}
            counts={counts}
            total={counts.total}
            visible={filtered.length}
          />
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-sm">
          {filtered.length > 0 ? (
            <FindingsTable
              findings={filtered}
              onSelect={setSelectedFinding}
            />
          ) : (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/10 text-slate-400">
                <SearchX size={18} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-medium text-white">
                No findings match these filters
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try a different severity or clear the search.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 inline-flex items-center rounded-lg border border-white/15 bg-panel px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-white/10 bg-panel p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-white">About this report</h2>
        <ul className="mt-3 grid gap-3 text-xs leading-relaxed text-slate-300 sm:grid-cols-2">
          <li className="flex items-start gap-2">
            <FlaskConical
              size={14}
              className="mt-0.5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            All findings are simulated. No request, scan or exploit was run
            against {hostname}.
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck
              size={14}
              className="mt-0.5 shrink-0 text-emerald-400"
              aria-hidden="true"
            />
            Missing headers are reported as observations and potential risk — not
            as confirmed vulnerabilities.
          </li>
          <li className="flex items-start gap-2">
            <Info
              size={14}
              className="mt-0.5 shrink-0 text-blue-400"
              aria-hidden="true"
            />
            The overall status summarises the findings. There is deliberately no
            numerical security score.
          </li>
          <li className="flex items-start gap-2">
            <Link
              to="/how-it-works"
              className="font-medium text-blue-300 hover:text-blue-200"
            >
              Read the methodology and prototype limits →
            </Link>
          </li>
        </ul>
      </section>

      <Drawer
        open={Boolean(selectedFinding)}
        onClose={() => setSelectedFinding(null)}
        title={selectedFinding?.title}
        eyebrow={
          selectedFinding ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <SeverityBadge severity={selectedFinding.severity} />
              <span className="text-xs text-slate-400">
                {selectedFinding.category}
              </span>
            </div>
          ) : null
        }
      >
        {selectedFinding ? (
          <FindingDetail finding={FINDINGS[selectedFinding.id]} />
        ) : null}
      </Drawer>
    </div>
  )
}
