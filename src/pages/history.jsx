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
    return <span className="text-xs text-slate-400">None</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {['high', 'medium', 'info'].map((severity) =>
        summary[severity] > 0 ? (
          <span
            key={severity}
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${SEVERITIES[severity].soft} ${SEVERITIES[severity].text}`}
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
      className="h-4 w-4 cursor-pointer rounded border-white/15 text-blue-400 accent-blue-600"
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
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-300">
            Demonstration workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Scan history
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Demonstration scans saved in this browser. Nothing here was fetched
            from a live website.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/scan"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            New demo scan
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            <RotateCcw size={15} aria-hidden="true" />
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
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      ) : null}

      {confirmReset ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 fade-in">
          <p className="text-sm font-semibold text-red-100">
            Reset demonstration data?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-red-200">
            This removes all scans saved in this browser and restores the three
            seeded example reports.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
            >
              Reset demo data
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="inline-flex items-center rounded-lg border border-red-500/30 bg-panel px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-panel p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Compare two scans</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Select two rows to see findings introduced, resolved or unchanged.
            Selecting a third replaces the earliest choice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCompare}
            disabled={selected.length !== 2}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
          >
            <GitCompare size={15} aria-hidden="true" />
            Compare selected ({selected.length}/2)
          </button>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSelected([])
                setComparison(null)
              }}
              className="inline-flex items-center rounded-lg border border-white/15 bg-panel px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5"
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

      <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-sm">
        <div className="hidden md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Demonstration scan history
            </caption>
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                <th scope="col" className="py-3 pl-4 pr-2">
                  <span className="sr-only">Compare</span>
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Target
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Date
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Scan status
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Findings
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Duration
                </th>
                <th scope="col" className="py-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {scans.map((scan) => {
                const checked = selected.includes(scan.id)
                return (
                  <tr
                    key={scan.id}
                    className={checked ? 'bg-blue-500/10' : undefined}
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
                      <p className="text-sm font-medium text-white">
                        {hostnameOf(scan.target)}
                      </p>
                      <p className="mt-0.5 break-all text-xs text-slate-400">
                        {scan.target}
                      </p>
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 align-top text-sm text-slate-300">
                      {formatDate(scan.startedAt)}
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        Completed
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {summarize(scan).status}
                      </p>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <FindingCounts scan={scan} />
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4 align-top text-sm text-slate-300">
                      {formatDuration(scan.durationMs)}
                    </td>
                    <td className="py-4 pr-4 align-top text-right">
                      <Link
                        to={`/reports/${scan.id}`}
                        className="text-sm font-medium text-blue-300 hover:text-blue-200 hover:underline"
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

        <ul className="divide-y divide-white/5 md:hidden">
          {scans.map((scan) => {
            const checked = selected.includes(scan.id)
            return (
              <li
                key={scan.id}
                className={checked ? 'bg-blue-500/10' : undefined}
              >
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {hostnameOf(scan.target)}
                      </p>
                      <p className="mt-0.5 break-all text-xs text-slate-400">
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

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>{formatDate(scan.startedAt)}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Completed
                    </span>
                    <span>{formatDuration(scan.durationMs)}</span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <FindingCounts scan={scan} />
                    <Link
                      to={`/reports/${scan.id}`}
                      className="text-sm font-medium text-blue-300 hover:text-blue-200"
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
          <div className="px-6 py-12 text-center">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/10 text-slate-400">
              <FlaskConical size={18} aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium text-white">
              No demonstration scans yet
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Run a demo scan to create the first report.
            </p>
            <Link
              to="/scan"
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Run demo scan
            </Link>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        Seeded examples and scans you create are stored in local storage. To
        remove all demo history, use “Reset demo data”. No real scan records are
        created by this prototype.
      </p>
    </div>
  )
}
