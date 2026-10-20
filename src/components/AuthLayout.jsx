import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, FlaskConical } from 'lucide-react'

// Shared shell for the prototype auth screens. The form itself belongs to the
// page agent; the header, aside and demo boundary copy stay in one place so the
// sign-in and sign-up pages cannot drift apart.
export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
        >
          <ArrowLeft size={11} aria-hidden="true" />
          Back to site
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink"
        >
          Demo dashboard
          <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-16">
        <div className="max-w-md">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 text-sm leading-6 text-ink-soft">{subtitle}</p>
          ) : null}

          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>

        <aside className="border-t border-rule pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
            Prototype boundaries
          </p>
          <ul className="mt-4 space-y-4 text-sm leading-6 text-ink-soft">
            <li className="border-b border-rule pb-4">
              No credentials are sent, stored or checked.
            </li>
            <li className="border-b border-rule pb-4">
              No account is created. The demo dashboard is open without one.
            </li>
            <li>Every dashboard value is simulated for demo.example.com.</li>
          </ul>

          <div
            role="note"
            className="mt-6 flex gap-3 border border-amber-500/25 bg-amber-500/5 px-4 py-3"
          >
            <FlaskConical
              size={14}
              className="mt-0.5 shrink-0 text-amber-300"
              aria-hidden="true"
            />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">
                Demo only
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-200/80">
                This is a UI prototype, not a live account system.
              </p>
            </div>
          </div>

          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
            AUTH / PROTOTYPE 0.1
          </p>
        </aside>
      </div>
    </div>
  )
}
