import { useEffect, useRef, useState } from 'react'

// Terminal-look transcript used by the landing page and the report. Every
// string it renders is demonstration copy: nothing here is captured from a
// process, and the card is labelled as simulated by its caller.
const TONES = {
  out: 'text-ink-soft',
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  muted: 'text-ink-soft/60',
  signal: 'text-signal',
}

const CHAR_MS = 18
const LINE_MS = 110

export default function TerminalCard({
  title,
  tag = 'Simulated',
  command = '',
  lines = [],
  footer,
  className = '',
}) {
  const [visible, setVisible] = useState(false)
  const [typed, setTyped] = useState(0)
  const [shown, setShown] = useState(0)
  const [done, setDone] = useState(false)
  const frameRef = useRef(null)

  // Replay from the start whenever the script itself changes, which is how the
  // report re-narrates a different finding.
  const signature = JSON.stringify({ command, lines })

  useEffect(() => {
    const node = frameRef.current
    if (!node) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return undefined

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      setTyped(command.length)
      setShown(lines.length)
      setDone(true)
      return undefined
    }

    let cancelled = false
    const timers = []
    const wait = (ms) =>
      new Promise((resolve) => {
        timers.push(window.setTimeout(resolve, ms))
      })

    setTyped(0)
    setShown(0)
    setDone(false)

    ;(async () => {
      await wait(320)
      for (let index = 0; index <= command.length; index += 1) {
        if (cancelled) return
        setTyped(index)
        await wait(CHAR_MS)
      }
      await wait(280)
      for (let index = 0; index < lines.length; index += 1) {
        if (cancelled) return
        setShown(index + 1)
        await wait(lines[index].pause ?? LINE_MS)
      }
      if (!cancelled) setDone(true)
    })()

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
    // `signature` already captures command and lines; depending on the array
    // itself would restart the animation on every render.
  }, [visible, signature])

  const typing = visible && typed < command.length
  const transcript = [command, ...lines.map((line) => line.text)].join('\n')

  return (
    <figure ref={frameRef} className={`border border-rule bg-panel ${className}`}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-soft">
          {title}
        </span>
        {tag ? (
          <span className="border border-amber-300/30 px-2 py-px font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300/80">
            {tag}
          </span>
        ) : null}
      </figcaption>

      {/* Log lines keep their alignment and scroll sideways on narrow screens
          rather than wrapping into ragged columns; prose lines opt into wrap. */}
      <div className="overflow-x-auto bg-canvas px-4 py-4 font-mono text-[11px] leading-6">
        <p className="flex gap-2 whitespace-nowrap">
          <span className="shrink-0 text-signal" aria-hidden="true">
            &gt;
          </span>
          <span className="min-w-0 text-ink">
            {command.slice(0, typed)}
            {typing ? (
              <span
                className="ml-px inline-block h-3 w-[6px] translate-y-px animate-pulse bg-ink"
                aria-hidden="true"
              />
            ) : null}
          </span>
        </p>

        <div aria-hidden="true">
          {lines.slice(0, shown).map((line, index) => (
            <p
              key={`${index}-${line.text}`}
              className={`${line.wrap ? 'break-words' : 'whitespace-nowrap'} ${
                TONES[line.tone] ?? TONES.out
              }`}
            >
              {line.text || '\u00a0'}
            </p>
          ))}

          {visible && !done && shown > 0 ? (
            <p className="text-ink-soft/40">
              <span className="inline-block h-3 w-[6px] translate-y-px animate-pulse bg-ink-soft" />
            </p>
          ) : null}
        </div>

        <pre className="sr-only">{transcript}</pre>
      </div>

      {footer ? (
        <div className="border-t border-rule px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
          {footer}
        </div>
      ) : null}
    </figure>
  )
}
