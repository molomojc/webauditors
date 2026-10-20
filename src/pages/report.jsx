import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  Download,
  FlaskConical,
  RefreshCw,
  SearchX,
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
import FindingsToolbar from '../components/FindingsToolbar'
import FindingsTable from '../components/FindingsTable'
import Drawer from '../components/Drawer'
import FindingDetail from '../components/FindingDetail'
import SeverityBadge from '../components/SeverityBadge'

function ReportNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <span className="mx-auto grid h-12 w-12 place-items-center border border-rule text-ink-soft">
        <SearchX size={20} aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-[1.7rem] font-medium leading-tight tracking-[-0.03em] text-ink">
        Report not found
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-soft">
        This demonstration report is not stored in this browser. It may have
        been removed when the demo data was reset.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          to="/history"
          className="inline-flex items-center border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
        >
          Back to scan history
        </Link>
        <Link
          to="/reports/demo"
          className="inline-flex items-center border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60"
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
  const attention = summary.tone === 'attention'

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

  const stats = [
    { label: 'High findings', value: summary.high, tone: 'text-red-300' },
    { label: 'Medium findings', value: summary.medium, tone: 'text-amber-300' },
    { label: 'Informational', value: summary.info, tone: 'text-signal' },
    { label: 'Checks completed', value: summary.checks, tone: 'text-ink' },
  ]

  return (
    <div>
      <div className="page-grain" aria-hidden="true" />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft"
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link to="/history" className="transition hover:text-ink">
                Scan history
              </Link>
            </li>
            <li className="text-ink/25" aria-hidden="true">
              /
            </li>
            <li className="text-ink/60">Demonstration report</li>
          </ol>
        </nav>

        <div className="mt-6 flex flex-col gap-5 border-b border-rule pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-all text-[clamp(1.9rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                {hostname}
              </h1>
              <span className="inline-flex items-center gap-1.5 border border-amber-300/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300/90">
                <FlaskConical size={10} aria-hidden="true" />
                Demo
              </span>
            </div>
            <p className="mt-2 text-[13px] text-ink-soft">
              Security report ·{' '}
              <time dateTime={scan.startedAt} className="font-mono text-[11px]">
                {formatDate(scan.startedAt)}
              </time>
            </p>

            <div className="mt-4 flex flex-col gap-1.5 border-t border-rule pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-6">
              <span className="break-all normal-case tracking-normal">
                {scan.target}
              </span>
              <span className="tabular-nums">
                {formatDuration(scan.durationMs)} (simulated)
              </span>
              <span className="tabular-nums">
                {scan.checks.length} checks completed
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
            >
              {exported ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Download size={13} aria-hidden="true" />
              )}
              {exported ? 'Downloaded' : 'Export report'}
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(`/scan/demo?url=${encodeURIComponent(scan.target)}`)
              }
              className="inline-flex items-center justify-center gap-2 border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-panel"
            >
              <RefreshCw size={13} aria-hidden="true" />
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

        <section className="mt-6 grid gap-px border border-rule bg-rule lg:grid-cols-12">
          <div className="bg-panel p-5 sm:p-6 lg:col-span-7">
            <div className="flex items-center gap-2.5">
              <span
                className={`h-1.5 w-1.5 ${attention ? 'bg-amber-300' : 'bg-emerald-400'}`}
                aria-hidden="true"
              />
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
                Overall status
              </p>
            </div>
            <p
              className={`mt-2 text-xl font-medium tracking-[-0.02em] ${
                attention ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {summary.status}
            </p>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-ink-soft">
              This status summarises {summary.total} simulated findings from{' '}
              {summary.checks} checks. It is not a security score and it does not
              guarantee that the website is secure or insecure.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <SeverityBadge severity="high" count={summary.high} />
              <SeverityBadge severity="medium" count={summary.medium} />
              <SeverityBadge severity="info" count={summary.info} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-rule lg:col-span-5">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-canvas px-5 py-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                  {stat.label}
                </p>
                <p
                  className={`mt-1.5 font-mono text-2xl font-medium tabular-nums tracking-[-0.02em] ${stat.tone}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
                01 / Findings
              </p>
              <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-ink">
                Evidence, impact and fix
              </h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-ink-soft">
                Every finding includes sample evidence, impact, a recommended fix
                and the limits of the check.
              </p>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
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

          <div className="mt-3 border border-rule bg-panel">
            {filtered.length > 0 ? (
              <FindingsTable
                findings={filtered}
                onSelect={setSelectedFinding}
              />
            ) : (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto grid h-10 w-10 place-items-center border border-rule text-ink-soft">
                  <SearchX size={17} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink">
                  No findings match these filters
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Try a different severity or clear the search.
                </p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-5 inline-flex items-center border border-rule px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition hover:border-ink/60 hover:bg-canvas"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 border border-rule bg-panel p-5 sm:p-6">
          <h2 className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
            02 / About this report
          </h2>
          <ul className="mt-4 grid border-t border-rule sm:grid-cols-2 sm:gap-x-8">
            <li className="flex gap-3 border-b border-rule py-3.5">
              <span
                className="shrink-0 font-mono text-[11px] leading-5 text-amber-300/70"
                aria-hidden="true"
              >
                —
              </span>
              <span className="text-[13px] leading-6 text-ink-soft">
                All findings are simulated. No request, scan or exploit was run
                against {hostname}.
              </span>
            </li>
            <li className="flex gap-3 border-b border-rule py-3.5">
              <span
                className="shrink-0 font-mono text-[11px] leading-5 text-ink/30"
                aria-hidden="true"
              >
                —
              </span>
              <span className="text-[13px] leading-6 text-ink-soft">
                Missing headers are reported as observations and potential risk —
                not as confirmed vulnerabilities.
              </span>
            </li>
            <li className="flex gap-3 border-b border-rule py-3.5">
              <span
                className="shrink-0 font-mono text-[11px] leading-5 text-ink/30"
                aria-hidden="true"
              >
                —
              </span>
              <span className="text-[13px] leading-6 text-ink-soft">
                The overall status summarises the findings. There is deliberately
                no numerical security score.
              </span>
            </li>
            <li className="flex gap-3 border-b border-rule py-3.5">
              <span
                className="shrink-0 font-mono text-[11px] leading-5 text-signal"
                aria-hidden="true"
              >
                →
              </span>
              <Link
                to="/how-it-works"
                className="font-mono text-[10px] uppercase leading-6 tracking-[0.14em] text-signal transition hover:text-ink"
              >
                Read the methodology and prototype limits
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
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
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
    </div>
  )
}
