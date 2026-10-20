import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Search,
} from 'lucide-react'

export const CHECK_STATUS = {
  waiting: {
    label: 'Waiting',
    icon: Circle,
    iconClass: 'text-slate-500',
    badgeClass: 'bg-white/10 text-slate-400',
  },
  checking: {
    label: 'Checking',
    icon: Loader2,
    iconClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-300',
    spin: true,
  },
  pass: {
    label: 'Passed',
    icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-400',
  },
  warn: {
    label: 'Warning',
    icon: AlertTriangle,
    iconClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-300',
  },
  review: {
    label: 'Needs review',
    icon: Search,
    iconClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-300',
  },
}

export function CheckStatusIcon({ status, className = '' }) {
  const meta = CHECK_STATUS[status] ?? CHECK_STATUS.waiting
  const Icon = meta.icon

  return (
    <Icon
      size={18}
      className={`${meta.iconClass} ${meta.spin ? 'animate-spin' : ''} ${className}`}
      aria-hidden="true"
    />
  )
}

export function CheckStatusBadge({ status }) {
  const meta = CHECK_STATUS[status] ?? CHECK_STATUS.waiting

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  )
}
