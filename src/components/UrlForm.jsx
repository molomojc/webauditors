import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { parseTarget } from '../lib/url'

export default function UrlForm({
  onSubmit,
  initialValue = '',
  buttonLabel = 'Analyse website',
  autoFocus = false,
  id = 'website-url',
  onValueChange,
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState('')
  const errorId = `${id}-error`

  function report(next) {
    if (typeof onValueChange === 'function') onValueChange(next)
  }

  // The page needs to know the typed value, not just the submitted one, so it
  // can offer the ownership check before a scan starts.
  useEffect(() => {
    report(initialValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue])

  function handleSubmit(event) {
    event.preventDefault()
    const result = parseTarget(value)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setError('')
    onSubmit(result.url, result.hostname)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div
        className={`flex flex-col border bg-panel transition sm:flex-row sm:items-stretch ${
          error
            ? 'border-red-500/60'
            : 'border-rule focus-within:border-ink/70'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 sm:px-4">
          <span
            className="shrink-0 font-mono text-base text-ink-soft"
            aria-hidden="true"
          >
            &gt;
          </span>
          <label htmlFor={id} className="sr-only">
            Website URL
          </label>
          <input
            id={id}
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              if (error) setError('')
              report(event.target.value)
            }}
            placeholder="yourwebsite.com"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            className="min-w-0 flex-1 border-0 bg-transparent py-3.5 font-mono text-[13px] text-ink placeholder:text-ink-soft/70 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-2 border-t border-rule bg-ink px-5 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-canvas transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:border-l sm:border-t-0"
        >
          {buttonLabel}
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 font-mono text-[11px] leading-relaxed text-red-400"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}
