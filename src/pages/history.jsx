import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  GitCompare,
  RotateCcw,
} from 'lucide-react'
import { SEVERITIES } from '../data/demo'
import {
  compareScans,
  formatDate,
  formatDuration,
  getScans,
  resetDemoData,
  summarize,
} from '../lib/scans'
import { hostnameOf } from '../lib/url'
import DemoNotice from '../components/DemoNotice'
import ComparePanel from '../components/ComparePanel'

function FindingCounts({ scan }) {
  const summary = summarize(scan)

  if (summary.total === 0) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
        None
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {['high', 'medium', 'info'].map((severity) =>
        summary[severity] > 0 ? (
          <span
            key={severity}
            className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${SEVERITIES[severity].soft} ${SEVERITIES[severity].text}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${SEVERITIES[severity].dot}`}
              aria-hidden="true"
            />
            {summary[severity]} {SEVERITIES[severity].shortLabel}
          </span>
        ) : null,
      )}
    </div>
  )
}

function CompareCheckbox({ scan, checked, onChange, disabledHint }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      title={disabledHint ? 'Selecting this will replace an earlier choice' : undefined}
      className="h-4 w-4 cursor-pointer accent-signal"
      aria-label={`Select scan of ${scan.target} from ${formatDate(scan.startedAt)}`}
    />
  )
}

export default function HistoryPage() {
  const [scans, setScans] = useState(() => getScans())
  const [selected, setSelected] = useState([])
  const [comparison, setComparison] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')

  function toggleSelection(id) {
    setComparison(null)
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id)
      }
      if (current.length >= 2) {
        return [current[1], id]
      }
      return [...current, id]
    })
  }

  function handleCompare() {
    if (selected.length !== 2) return
    const first = scans.find((scan) => scan.id === selected[0])
    const second = scans.find((scan) => scan.id === selected[1])
    if (!first || !second) return
    setComparison(compareScans(first, second))
  }

  function handleReset() {
    const next = resetDemoData()
    setScans(next)
    setSelected([])
    setComparison(null)
    setConfirmReset(false)
    setNotice('Demo data reset. The seeded demonstration scans have been restored.')
  }

  return (
    <div>
      <div className="page-grain" aria-hidden="true" />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col gap-5 border-b border-rule pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-soft">
                Demonstration workspace
              </span>
            </div>
            <h1 className="mt-5 text-[clamp(1.9rem,4vw,2.6rem)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
              Scan history
            </h1>
            <p className="mt-3 max-w-2xl text-[13px] leading-6 text-ink-soft">
              Demonstration scans saved in this browser. Nothing here was
              fetched from a live website.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/scan"
              className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:bg-white"
            >
              New demo scan
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center justify-center gap-2 border border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink transition hover:border-ink/60 hover:bg-panel"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Reset demo data
            </button>
          </div>
        </div>

        <DemoNotice className="mt-5">
          Every scan in this history is simulated. The list is stored only in
          this browser's local storage and can be reset at any time.
        </DemoNotice>

        <p className="sr-only" aria-live="polite">
          {notice}
        </p>
        {notice ? (
          <div className="mt-4 border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
            {notice}
          </div>
        ) : null}

        {confirmReset ? (
          <div className="mt-4 border border-red-500/30 bg-red-500/5 p-4 fade-in">
            <p className="text-sm font-medium text-red-200">
              Reset demonstration data?
            </p>
            <p className="mt-1.5 text-xs leading-6 text-red-200/80">
              This removes all scans saved in this browser and restores the three
              seeded example reports.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center border border-red-400/50 bg-red-500/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-red-200 transition hover:bg-red-500/25"
              >
                Reset demo data
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="inline-flex items-center border border-rule px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition hover:border-ink/40 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-4 border border-rule bg-panel p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-sm font-medium text-ink">Compare two scans</h2>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              Select two rows to see findings introduced, resolved or unchanged.
              Selecting a third replaces the earliest choice.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCompare}
              disabled={selected.length !== 2}
              className="inline-flex items-center justify-center gap-2 border border-ink bg-ink px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas transition hover:bg-white disabled:cursor-not-allowed disabled:border-rule disabled:bg-transparent disabled:text-ink-soft"
            >
              <GitCompare size={13} aria-hidden="true" />
              Compare selected ({selected.length}/2)
            </button>
            {selected.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelected([])
                  setComparison(null)
                }}
                className="inline-flex items-center border border-rule px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition hover:border-ink/40 hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {comparison ? (
          <ComparePanel
            comparison={comparison}
            onClose={() => setComparison(null)}
          />
        ) : null}

        <div className="mt-5 border border-rule bg-panel">
          <div className="hidden md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Demonstration scan history
              </caption>
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className="py-3 pl-4 pr-2">
                    <span className="sr-only">Compare</span>
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-4 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Target
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-4 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-4 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Scan status
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-4 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Findings
                  </th>
                  <th
                    scope="col"
                    className="py-3 pr-4 font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-ink-soft"
                  >
                    Duration
                  </th>
                  <th scope="col" className="py-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {scans.map((scan) => {
                  const checked = selected.includes(scan.id)
                  return (
                    <tr
                      key={scan.id}
                      className={checked ? 'bg-signal/10' : 'transition hover:bg-canvas'}
                    >
                      <td className="py-4 pl-4 pr-2 align-top">
                        <CompareCheckbox
                          scan={scan}
                          checked={checked}
                          onChange={() => toggleSelection(scan.id)}
                          disabledHint={selected.length >= 2}
                        />
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <p className="text-sm font-medium text-ink">
                          {hostnameOf(scan.target)}
                        </p>
                        <p className="mt-0.5 break-all font-mono text-[10px] leading-5 text-ink-soft">
                          {scan.target}
                        </p>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4 align-top font-mono text-[11px] text-ink">
                        {formatDate(scan.startedAt)}
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          Completed
                        </span>
                        <p className="mt-1.5 text-[11px] text-ink-soft">
                          {summarize(scan).status}
                        </p>
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <FindingCounts scan={scan} />
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4 align-top font-mono text-[11px] tabular-nums text-ink-soft">
                        {formatDuration(scan.durationMs)}
                      </td>
                      <td className="py-4 pr-4 text-right align-top">
                        <Link
                          to={`/reports/${scan.id}`}
                          className="font-mono text-[9px] uppercase tracking-[0.14em] text-signal transition hover:text-ink"
                        >
                          View report
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-rule md:hidden">
            {scans.map((scan) => {
              const checked = selected.includes(scan.id)
              return (
                <li key={scan.id} className={checked ? 'bg-signal/10' : undefined}>
                  <div className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {hostnameOf(scan.target)}
                        </p>
                        <p className="mt-0.5 break-all font-mono text-[10px] leading-5 text-ink-soft">
                          {scan.target}
                        </p>
                      </div>
                      <CompareCheckbox
                        scan={scan}
                        checked={checked}
                        onChange={() => toggleSelection(scan.id)}
                        disabledHint={selected.length >= 2}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      <span>{formatDate(scan.startedAt)}</span>
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 size={11} aria-hidden="true" />
                        Completed
                      </span>
                      <span className="tabular-nums">
                        {formatDuration(scan.durationMs)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <FindingCounts scan={scan} />
                      <Link
                        to={`/reports/${scan.id}`}
                        className="font-mono text-[9px] uppercase tracking-[0.14em] text-signal transition hover:text-ink"
                      >
                        View report
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {scans.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center border border-rule text-ink-soft">
                <FlaskConical size={17} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-medium text-ink">
                No demonstration scans yet
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Run a demo scan to create the first report.
              </p>
              <Link
                to="/scan"
                className="mt-5 inline-flex items-center border border-ink bg-ink px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas transition hover:bg-white"
              >
                Run demo scan
              </Link>
            </div>
          ) : null}
        </div>

        <p className="mt-4 border-t border-rule pt-4 text-xs leading-6 text-ink-soft/80">
          Seeded examples and scans you create are stored in local storage. To
          remove all demo history, use “Reset demo data”. No real scan records are
          created by this prototype.
        </p>
      </div>
    </div>
  )
}
