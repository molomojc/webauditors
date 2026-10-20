import { FlaskConical } from 'lucide-react'

export default function DemoNotice({ children, className = '' }) {
  return (
    <div
      role="note"
      className={`flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ${className}`}
    >
      <FlaskConical
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider">
          Demo data
        </p>
        <p className="mt-1 leading-relaxed text-amber-200/90">
          {children ??
            'No live security scan was performed. All results are simulated for product demonstration.'}
        </p>
      </div>
    </div>
  )
}
