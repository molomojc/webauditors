import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/AuthLayout'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_ORDER = ['fullName', 'email', 'password', 'confirm']

const LABEL_CLASS =
  'block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft'
const INPUT_CLASS =
  'mt-2 block w-full border border-rule bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal'
const ERROR_CLASS = 'mt-1.5 text-xs text-red-300'
const SUBMIT_CLASS =
  'inline-flex w-full items-center justify-center border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-canvas transition hover:border-signal hover:bg-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
const SWITCH_LINK_CLASS =
  'font-mono text-[10px] uppercase tracking-[0.16em] text-signal transition hover:text-ink'

function Field({
  id,
  name,
  label,
  type = 'text',
  autoComplete,
  autoCapitalize,
  spellCheck,
  value,
  error,
  onChange,
  inputRef,
}) {
  const errorId = `${id}-error`

  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        required
        value={value}
        onChange={onChange}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={INPUT_CLASS}
      />
      {error ? (
        <p id={errorId} className={ERROR_CLASS}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function validate(values) {
  const errors = {}

  if (!values.fullName.trim()) {
    errors.fullName = 'Enter your name.'
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (values.password.length < 8) {
    errors.password = 'Use at least 8 characters.'
  }
  if (values.confirm !== values.password) {
    errors.confirm = 'Passwords do not match.'
  }

  return errors
}

export default function SignUpPage() {
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState({})
  const [showStatus, setShowStatus] = useState(false)

  const nameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)

  const inputRefs = {
    fullName: nameRef,
    email: emailRef,
    password: passwordRef,
    confirm: confirmRef,
  }

  function handleChange(event) {
    const { name, value } = event.target

    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
    setShowStatus(false)
  }

  function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = validate(values)
    setErrors(nextErrors)

    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field])
    if (firstInvalid) {
      setShowStatus(false)
      inputRefs[firstInvalid].current?.focus()
      return
    }

    setShowStatus(true)
  }

  return (
    <AuthLayout
      eyebrow="Account / Sign up"
      title="Create your account"
      subtitle="A prototype screen for the account flow. No account is created and nothing is stored."
      footer={
        <p className="border-t border-rule pt-4 text-xs leading-5 text-ink-soft">
          Already have an account?{' '}
          <Link to="/sign-in" className={SWITCH_LINK_CLASS}>
            Sign in
          </Link>
        </p>
      }
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        aria-label="Create account"
        className="space-y-5"
      >
        <Field
          id="sign-up-name"
          name="fullName"
          label="Full name"
          autoComplete="name"
          value={values.fullName}
          error={errors.fullName}
          onChange={handleChange}
          inputRef={nameRef}
        />

        <Field
          id="sign-up-email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={values.email}
          error={errors.email}
          onChange={handleChange}
          inputRef={emailRef}
        />

        <Field
          id="sign-up-password"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          onChange={handleChange}
          inputRef={passwordRef}
        />

        <Field
          id="sign-up-confirm"
          name="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          error={errors.confirm}
          onChange={handleChange}
          inputRef={confirmRef}
        />

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
              No account was created and nothing was stored. There is no
              account system behind this form.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link to="/dashboard" className={SWITCH_LINK_CLASS}>
                Open the demo dashboard
              </Link>
              <Link to="/" className={SWITCH_LINK_CLASS}>
                Back to home
              </Link>
            </div>
          </div>
        ) : null}

        <button type="submit" className={SUBMIT_CLASS}>
          Create account
        </button>
      </form>
    </AuthLayout>
  )
}
