import { Search, X } from 'lucide-react'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'info', label: 'Info' },
]

export default function FindingsToolbar({
  severity,
  onSeverityChange,
  query,
  onQueryChange,
  counts,
  total,
  visible,
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter findings by severity"
        >
          {FILTERS.map((filter) => {
            const active = severity === filter.key
            const count = filter.key === 'all' ? counts.total : counts[filter.key]
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={active}
                onClick={() => onSeverityChange(filter.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'border-white bg-white text-slate-900'
                    : 'border-white/10 bg-panel text-slate-300 hover:border-white/25 hover:bg-white/5'
                }`}
              >
                {filter.label}
                <span
                  className={`rounded px-1 text-[11px] tabular-nums ${
                    active ? 'bg-slate-900/10 text-slate-700' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <label htmlFor="finding-search" className="sr-only">
            Search findings
          </label>
          <input
            id="finding-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search findings"
            className="w-full rounded-lg border border-white/15 bg-panel py-2 pl-9 pr-9 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-500 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <p
        className="mt-2 text-xs text-slate-400"
        aria-live="polite"
        aria-atomic="true"
      >
        Showing {visible} of {total} findings
      </p>
    </div>
  )
}
