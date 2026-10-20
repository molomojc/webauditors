// Presentational only. The badge renders a state that the page owns; it
// never fetches, never stores and never assumes where the state came from.
const TONE = {
  unverified: {
    label: 'Not verified',
    border: 'border-rule',
    text: 'text-ink-soft',
  },
  verifying: {
    label: 'Verifying…',
    border: 'border-signal/40',
    text: 'text-signal',
  },
  verified: {
    label: 'Ownership verified',
    border: 'border-emerald-400/30',
    text: 'text-emerald-300',
  },
  failed: {
    label: 'Verification failed',
    border: 'border-red-400/40',
    text: 'text-red-300',
  },
  unknown: {
    label: 'Ownership unknown',
    border: 'border-rule',
    text: 'text-ink-soft',
  },
}

const METHOD = {
  file: 'via file',
  dns: 'via DNS TXT',
}

export default function OwnershipBadge({
  status = 'unknown',
  method,
  onVerify,
  verifying = false,
  detail,
  className = '',
}) {
  const busy = verifying || status === 'verifying'
  const effective = busy ? 'verifying' : TONE[status] ? status : 'unknown'
  const tone = TONE[effective]
  const methodLabel = METHOD[method]
  const canAct = typeof onVerify === 'function'

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 border bg-panel px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${tone.border} ${tone.text} ${className}`}
    >
      <span className={busy ? 'animate-pulse' : undefined}>{tone.label}</span>

      {effective === 'verified' && methodLabel ? (
        <span className="text-ink-soft/70">{methodLabel}</span>
      ) : null}

      {effective === 'failed' && detail ? (
        <span className="text-[10px] normal-case tracking-normal text-ink-soft/80">
          {detail}
        </span>
      ) : null}

      {(effective === 'unverified' || effective === 'failed') && canAct ? (
        <button
          type="button"
          onClick={onVerify}
          className="border border-ink/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em] text-ink transition hover:border-ink/70 hover:bg-canvas"
        >
          {effective === 'failed' ? 'Retry' : 'Verify'}
        </button>
      ) : null}
    </span>
  )
}
