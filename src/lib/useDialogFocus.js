import { useEffect, useRef } from 'react'

/**
 * Shared dialog behaviour: Escape to close, body scroll lock, initial focus,
 * focus restoration and a basic focus trap.
 */
export function useDialogFocus(open, onClose, panelRef) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const restoreRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    restoreRef.current = document.activeElement
    const panel = panelRef.current
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const focusables = Array.from(
      panel?.querySelectorAll(focusableSelector) ?? [],
    )
    focusables[0]?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll(focusableSelector))
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, panelRef])
}
