const TONES = {
  high: {
    value: 'text-red-300',
    iconWrap: 'bg-red-500/10 text-red-400',
  },
  medium: {
    value: 'text-amber-300',
    iconWrap: 'bg-amber-500/10 text-amber-400',
  },
  info: {
    value: 'text-blue-300',
    iconWrap: 'bg-blue-500/10 text-blue-400',
  },
  neutral: {
    value: 'text-white',
    iconWrap: 'bg-white/10 text-slate-300',
  },
}

export default function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}) {
  const styles = TONES[tone] ?? TONES.neutral

  return (
    <div className="rounded-xl border border-white/10 bg-panel p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        {Icon ? (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${styles.iconWrap}`}
          >
            <Icon size={16} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${styles.value}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}
