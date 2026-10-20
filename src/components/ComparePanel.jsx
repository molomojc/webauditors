import { ArrowRight, X } from 'lucide-react'
import SeverityBadge from './SeverityBadge'
import { SEVERITIES } from '../data/demo'
import { formatDate, summarize } from '../lib/scans'

function ScanCard({ label, scan }) {
  const summary = summarize(scan)

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-white">
        {formatDate(scan.startedAt)}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <SeverityBadge severity="high" count={summary.high} />
        <SeverityBadge severity="medium" count={summary.medium} />
        <SeverityBadge severity="info" count={summary.info} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {scan.checks.length} checks · {summary.status}
      </p>
    </div>
  )
}

function Group({ title, description, findings, emptyText, tone }) {
  const toneClasses = {
    introduced: 'text-red-300',
    resolved: 'text-emerald-400',
    unchanged: 'text-slate-200',
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4
          className={`text-sm font-semibold ${toneClasses[tone] ?? 'text-slate-200'}`}
        >
          {title}
        </h4>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-slate-300">
          {findings.length}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      {findings.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {findings.map((finding) => (
            <li key={finding.id} className="flex items-start gap-2">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITIES[finding.severity].dot}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm leading-snug text-white">
                  {finding.title}
                </p>
                <p className="text-[11px] text-slate-400">
                  {SEVERITIES[finding.severity].label}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ComparePanel({ comparison, onClose }) {
  const { older, newer, introduced, resolved, unchanged } = comparison

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-sm fade-in">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">
              Comparison
            </h2>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/30">
              Simulated
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            What changed between two demonstration reports.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close comparison"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="p-5">
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <ScanCard label="From" scan={older} />
          <div className="hidden justify-center text-slate-500 sm:flex">
            <ArrowRight size={18} aria-hidden="true" />
          </div>
          <ScanCard label="To" scan={newer} />
        </div>

        <div className="mt-4 grid items-start gap-3 md:grid-cols-3">
          <Group
            title="Introduced"
            description="Present in the newer report only."
            findings={introduced}
            emptyText="No new findings."
            tone="introduced"
          />
          <Group
            title="Resolved"
            description="Present in the older report only."
            findings={resolved}
            emptyText="No findings resolved."
            tone="resolved"
          />
          <Group
            title="Unchanged"
            description="Present in both reports."
            findings={unchanged}
            emptyText="No shared findings."
            tone="unchanged"
          />
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          Comparison matches simulated findings by identifier. It is not a diff
          of live scan data and cannot confirm that a real website changed.
        </p>
      </div>
    </section>
  )
}
