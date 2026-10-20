import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const LABEL_CLASS =
  'block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft'

const INPUT_CLASS =
  'mt-2 block w-full border border-rule bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal'

const ERROR_CLASS = 'mt-1.5 text-xs text-red-300'

const SUBMIT_CLASS =
  'inline-flex w-full items-center justify-center border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-canvas transition hover:border-signal hover:bg-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

const LINK_CLASS =
  'font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [showStatus, setShowStatus] = useState(false)

  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  function updateField(field, value) {
    if (field === 'email') setEmail(value)
    else setPassword(value)

    setShowStatus(false)
    setErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = {}

    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (password.length === 0) {
      nextErrors.password = 'Enter your password.'
    }

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors)
      setShowStatus(false)

      if (nextErrors.email) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    setErrors({})
    setShowStatus(true)
  }

  const footer = (
    <div className="border-t border-rule pt-4">
      <Link to="/sign-up" className={LINK_CLASS}>
        Create an account
      </Link>
      <p className="mt-3 text-xs leading-5 text-ink-soft">
        Password reset is not part of the prototype.
      </p>
    </div>
  )

  return (
    <AuthLayout
      eyebrow="Account / Sign in"
      title="Sign in"
      subtitle="A prototype screen for the account flow. The demo workspace stays open without an account."
      footer={footer}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        aria-label="Sign in"
        className="space-y-5"
      >
        <div>
          <label htmlFor="sign-in-email" className={LABEL_CLASS}>
            Email address
          </label>
          <input
            ref={emailRef}
            id="sign-in-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => updateField('email', event.target.value)}
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={
              errors.email ? 'sign-in-email-error' : undefined
            }
            className={INPUT_CLASS}
          />
          {errors.email ? (
            <p id="sign-in-email-error" className={ERROR_CLASS}>
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="sign-in-password" className={LABEL_CLASS}>
            Password
          </label>
          <input
            ref={passwordRef}
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => updateField('password', event.target.value)}
            aria-invalid={errors.password ? 'true' : undefined}
            aria-describedby={
              errors.password ? 'sign-in-password-error' : undefined
            }
            className={INPUT_CLASS}
          />
          {errors.password ? (
            <p id="sign-in-password-error" className={ERROR_CLASS}>
              {errors.password}
            </p>
          ) : null}
        </div>

        {showStatus ? (
          <div
            role="status"
            aria-live="polite"
            className="border border-emerald-500/30 bg-emerald-500/5 px-4 py-4"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-300">
              Prototype only
            </p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              No credentials were sent, stored or checked. There is no account
              system behind this form.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link to="/dashboard" className={LINK_CLASS}>
                Open the demo dashboard
              </Link>
              <Link to="/" className={LINK_CLASS}>
                Back to home
              </Link>
            </div>
          </div>
        ) : null}

        <button type="submit" className={SUBMIT_CLASS}>
          Sign in
        </button>
      </form>
    </AuthLayout>
  )
}
