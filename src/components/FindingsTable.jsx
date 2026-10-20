import { ChevronRight } from 'lucide-react'
import SeverityBadge from './SeverityBadge'

function RiskType({ type }) {
  const confirmed = type === 'Confirmed observation'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        confirmed
          ? 'bg-white/10 text-slate-200 ring-white/15'
          : 'bg-panel text-slate-300 ring-white/15'
      }`}
    >
      {type}
    </span>
  )
}

export default function FindingsTable({ findings, onSelect }) {
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Demonstration security findings
          </caption>
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="py-3 pl-4 pr-3 font-medium">
                Severity
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Finding
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Check
              </th>
              <th scope="col" className="py-3 pr-4 font-medium">
                Type
              </th>
              <th scope="col" className="py-3 pr-4">
                <span className="sr-only">Open details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {findings.map((finding) => (
              <tr
                key={finding.id}
                className="cursor-pointer transition hover:bg-white/5"
                onClick={() => onSelect(finding)}
              >
                <td className="py-4 pl-4 pr-3 align-top">
                  <SeverityBadge severity={finding.severity} />
                </td>
                <td className="py-4 pr-4 align-top">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(finding)
                    }}
                    className="text-left text-sm font-medium text-white transition hover:text-blue-300"
                  >
                    {finding.title}
                  </button>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                    {finding.description}
                  </p>
                </td>
                <td className="py-4 pr-4 align-top text-sm text-slate-300">
                  {finding.category}
                </td>
                <td className="py-4 pr-4 align-top">
                  <RiskType type={finding.riskType} />
                </td>
                <td className="py-4 pr-4 text-right align-top text-slate-500">
                  <ChevronRight
                    size={16}
                    className="ml-auto"
                    aria-hidden="true"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-white/5 md:hidden">
        {findings.map((finding) => (
          <li key={finding.id}>
            <button
              type="button"
              onClick={() => onSelect(finding)}
              className="block w-full px-4 py-4 text-left transition hover:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3">
                <SeverityBadge severity={finding.severity} />
                <span className="text-xs text-slate-400">
                  {finding.category}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-white">
                {finding.title}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                {finding.description}
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <RiskType type={finding.riskType} />
                <span className="text-xs font-medium text-blue-300">
                  View details →
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
