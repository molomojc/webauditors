import { SEVERITIES } from '../data/demo'

export default function SeverityBadge({ severity, count, className = '' }) {
  const meta = SEVERITIES[severity]
  if (!meta) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.badge} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
        aria-hidden="true"
      />
      {count === undefined ? meta.label : `${count} ${meta.label}`}
    </span>
  )
}
