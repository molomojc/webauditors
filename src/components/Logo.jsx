import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Logo({ className = '' }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="WebAuditors home"
    >
      <span className="grid h-8 w-8 place-items-center border border-ink bg-ink text-canvas">
        <ShieldCheck size={17} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink">
        WebAuditors
      </span>
    </Link>
  )
}
