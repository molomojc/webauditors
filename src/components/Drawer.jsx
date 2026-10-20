import { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useDialogFocus } from '../lib/useDialogFocus'

export default function Drawer({ open, onClose, title, eyebrow, children }) {
  const panelRef = useRef(null)
  const titleId = useId()
  useDialogFocus(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="drawer-panel absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/10 bg-panel shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="mb-1.5">{eyebrow}</div>
            ) : null}
            <h2
              id={titleId}
              className="text-base font-semibold leading-snug tracking-tight text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close finding details"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
