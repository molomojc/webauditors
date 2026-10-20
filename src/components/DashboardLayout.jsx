import { Link, NavLink } from 'react-router-dom'
import { ArrowRight, FlaskConical } from 'lucide-react'

const TABS = [
  { key: 'overview', to: '/dashboard', label: 'Overview', end: true },
  { key: 'dns', to: '/dashboard/dns', label: 'DNS' },
  { key: 'tls', to: '/dashboard/tls', label: 'HTTPS / TLS' },
]

function tabClass({ isActive }) {
  return `-mb-px border-b-2 px-0.5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
    isActive
      ? 'border-ink text-ink'
      : 'border-transparent text-ink-soft hover:text-ink'
  }`
}

export default function DashboardLayout({
  active = 'overview',
  title,
  subtitle,
  children,
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-6 border-b border-rule pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
            Demo workspace / demo.example.com
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300">
            <FlaskConical size={10} aria-hidden="true" />
            Simulated data
          </span>
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 border border-ink bg-ink px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-canvas transition hover:border-signal hover:bg-signal hover:text-canvas"
          >
            Run demo scan
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <nav
        aria-label="Dashboard sections"
        className="mt-4 flex flex-wrap gap-x-6 border-b border-rule"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.end}
            className={tabClass}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div
        role="note"
        className="mt-5 flex gap-3 border border-amber-500/25 bg-amber-500/5 px-4 py-3"
      >
        <FlaskConical
          size={14}
          className="mt-0.5 shrink-0 text-amber-300"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-amber-300">
            Demo data — no live scan
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
            Every value on this page is fixed sample data for demo.example.com.
            No DNS lookup, TLS connection or network request was made.
          </p>
        </div>
      </div>

      <div className="mt-8">{children}</div>
    </div>
  )
}
