import { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useDialogFocus } from '../lib/useDialogFocus'

export default function Modal({ open, onClose, title, description, children }) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useDialogFocus(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
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
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full rounded-t-2xl bg-panel p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {description ? (
          <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-slate-300">
            {description}
          </p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
