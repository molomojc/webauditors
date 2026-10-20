import { Link } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="border-t border-rule bg-panel">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
              Evidence-based website security reports for solo developers,
              small teams and anyone shipping on the open web.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 border border-amber-400/30 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300">
              <FlaskConical size={12} aria-hidden="true" />
              Interactive prototype — all results simulated
            </p>
          </div>

          <div>
            <h2 className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-ink-soft">
              Product
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/scan" className="text-ink-soft hover:text-ink">
                  Analyse a website
                </Link>
              </li>
              <li>
                <Link
                  to="/reports/demo"
                  className="text-ink-soft hover:text-ink"
                >
                  Sample report
                </Link>
              </li>
              <li>
                <Link
                  to="/history"
                  className="text-ink-soft hover:text-ink"
                >
                  Scan history
                </Link>
              </li>
              <li>
                <Link
                  to="/how-it-works"
                  className="text-ink-soft hover:text-ink"
                >
                  How it works
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-ink-soft">
              Prototype scope
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>No live network requests</li>
              <li>No vulnerability exploitation</li>
              <li>No real accounts or tracking</li>
              <li>Demo data stored in this browser</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-rule pt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} WebAuditors. Prototype for product
            validation.
          </p>
          <p>No live scanning. No personal data collected.</p>
        </div>
      </div>
    </footer>
  )
}
