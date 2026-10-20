import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import DashboardLayout from '../../components/DashboardLayout'
import {
  CATEGORIES,
  DASHBOARD_SITE,
  PRIORITY_FIXES,
} from '../../data/dashboard'
import { SEVERITIES } from '../../data/demo'
import {
  formatDuration,
  formatShortDate,
  getScans,
  summarize,
} from '../../lib/scans'

const TONES = {
  review: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  fail: 'border-red-500/30 bg-red-500/5 text-red-300',
  ok: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
}

const SEVERITY_TONE = {
  high: 'fail',
  medium: 'warning',
  info: 'review',
}

function StatusChip({ tone = 'review', children }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
        TONES[tone] ?? TONES.review
      }`}
    >
      {children}
    </span>
  )
}

function SectionHead({ id, index, title, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
          {index}
        </p>
        <h2
          id={id}
          className="mt-2 text-lg font-medium tracking-[-0.02em] text-ink"
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

export default function DashboardOverviewPage() {
  const [scans] = useState(() => getScans())
  const latest = scans[0]
  const summary = summarize(latest)
  const attention = summary.tone === 'attention'

  return (
    <DashboardLayout
      active="overview"
      title="Security dashboard"
      subtitle={`What ${DASHBOARD_SITE.host} currently tells the internet, and what to review first.`}
    >
      <section aria-label="Posture summary">
        <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-canvas p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              Overall status
            </p>
            <p
              className={`mt-2 text-xl font-medium tracking-[-0.02em] ${
                attention ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {summary.status}
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Summary of the sample findings, not a security score.
            </p>
          </div>

          <div className="bg-canvas p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              Findings
            </p>
            <p className="mt-2 text-xl font-medium tabular-nums tracking-[-0.02em] text-ink">
              {summary.total}
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-ink-soft">
              {summary.high} high · {summary.medium} medium · {summary.info} info
            </p>
          </div>

          <div className="bg-canvas p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              Last scan
            </p>
            <p className="mt-2 text-xl font-medium tracking-[-0.02em] text-ink">
              {latest ? formatShortDate(latest.startedAt) : '—'}
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-ink-soft">
              {latest
                ? `Simulated run · ${formatDuration(latest.durationMs)}`
                : 'No scans yet'}
            </p>
          </div>

          <div className="bg-canvas p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">
              Coverage
            </p>
            <p className="mt-2 text-xl font-medium tabular-nums tracking-[-0.02em] text-ink">
              {summary.checks} / 12
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Checks completed in the most recent run.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="surface-heading">
        <SectionHead
          id="surface-heading"
          index="01 / Surface"
          title="Four areas, one site"
          action={
            <Link
              to="/reports/demo"
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-signal transition hover:text-ink"
            >
              Open sample report
              <ArrowUpRight size={11} aria-hidden="true" />
            </Link>
          }
        />
        <ul className="border-b border-rule">
          {CATEGORIES.map((category) => (
            <li key={category.key} className="border-t border-rule">
              <Link
                to={category.to}
                className="group grid gap-3 px-1 py-5 transition hover:bg-panel sm:grid-cols-12 sm:items-center sm:gap-6"
              >
                <span className="font-mono text-[10px] tracking-[0.08em] text-ink-soft sm:col-span-1">
                  {category.index}
                </span>
                <div className="sm:col-span-6">
                  <p className="text-sm font-medium text-ink transition group-hover:text-signal">
                    {category.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">
                    {category.summary}
                  </p>
                </div>
                <div className="sm:col-span-3">
                  <StatusChip tone={category.tone}>
                    {category.status}
                  </StatusChip>
                </div>
                <div className="sm:col-span-2 sm:justify-self-end">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft transition group-hover:text-ink">
                    Review
                    <ArrowRight size={11} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <SectionHead index="02 / Priority" title="Fix first" />
          <ol className="border-b border-rule">
            {PRIORITY_FIXES.map((fix, index) => (
              <li key={fix.title} className="border-t border-rule py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-[10px] tabular-nums text-ink-soft">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip tone={SEVERITY_TONE[fix.severity]}>
                        {SEVERITIES[fix.severity].label}
                      </StatusChip>
                      <p className="text-sm font-medium text-ink">
                        {fix.title}
                      </p>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                      {fix.detail}
                    </p>
                    <Link
                      to={fix.to}
                      className="mt-2 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-signal transition hover:text-ink"
                    >
                      Open in report
                      <ArrowUpRight size={11} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <SectionHead
            index="03 / Activity"
            title="Recent scans"
            action={
              <Link
                to="/history"
                className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-signal transition hover:text-ink"
              >
                All scans
                <ArrowUpRight size={11} aria-hidden="true" />
              </Link>
            }
          />

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Recent demonstration scans for {DASHBOARD_SITE.host}
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Findings
                  </th>
                  <th
                    scope="col"
                    className="border-b border-rule py-2 text-right font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Report
                  </th>
                </tr>
              </thead>
              <tbody>
                {scans.slice(0, 3).map((scan) => {
                  const scanSummary = summarize(scan)
                  return (
                    <tr key={scan.id}>
                      <td className="border-b border-rule py-3 pr-4 font-mono text-[11px] text-ink">
                        {formatShortDate(scan.startedAt)}
                      </td>
                      <td className="border-b border-rule py-3 pr-4">
                        <StatusChip
                          tone={
                            scanSummary.tone === 'attention' ? 'warning' : 'ok'
                          }
                        >
                          {scanSummary.status}
                        </StatusChip>
                      </td>
                      <td className="border-b border-rule py-3 pr-4 font-mono text-[11px] tabular-nums text-ink-soft">
                        {scanSummary.total}
                      </td>
                      <td className="border-b border-rule py-3 text-right">
                        <Link
                          to={`/reports/${scan.id}`}
                          className="font-mono text-[9px] uppercase tracking-[0.14em] text-signal transition hover:text-ink"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
            Demonstration history stored in this browser
          </p>
        </div>
      </section>
    </DashboardLayout>
  )
}
