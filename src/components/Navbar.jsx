import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/runs', label: 'Runs' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/reports/demo', label: 'Sample report' },
]

function navClass({ isActive }) {
  return `px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition ${
    isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
  }`
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.hash])

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-rule bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden border border-rule px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft sm:inline-flex">
              Demo / 0.1
            </span>
          </div>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navClass}>
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/sign-in" className={navClass}>
              Sign in
            </NavLink>
            <Link
              to="/scan"
              className="ml-2 inline-flex items-center border border-ink bg-ink px-3.5 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-canvas transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Run demo
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-9 w-9 place-items-center border border-rule text-ink-soft transition hover:border-ink/50 hover:text-ink md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Menu size={18} aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen ? (
          <div
            id="mobile-menu"
            className="border-t border-rule bg-panel px-4 pb-4 pt-2 md:hidden"
          >
            <nav className="flex flex-col" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="border-b border-rule px-1 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
                >
                  {link.label}
                </NavLink>
              ))}
              <NavLink
                to="/sign-in"
                className="border-b border-rule px-1 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
              >
                Sign in
              </NavLink>
              <Link
                to="/scan"
                className="mt-3 inline-flex items-center justify-center border border-ink bg-ink px-3.5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-canvas"
              >
                Run demo
              </Link>
            </nav>
          </div>
        ) : null}
      </header>
    </>
  )
}
