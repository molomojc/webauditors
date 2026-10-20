# Auth pages spec — sign-in and sign-up

Read this together with `agents/README.md`. It is the contract for the two
prototype auth screens and exists so the pages match each other and the rest of
the product.

## Scope and honesty

WebAuditors has no backend and no account system. These pages are **UI
prototypes** for a future account flow. They must:

- validate input in the browser only;
- make no network request, create no session and write nothing to storage;
- say plainly that no credentials were sent or checked and no account was
  created;
- keep the demo dashboard open without an account.

They must not include social sign-in, trust badges, "remember me", password
strength meters, fake loading states, or a "forgot password" link that goes
nowhere. A small note that password reset is out of scope is fine.

## Routes and ownership

| Route | Page | Owner | File |
| --- | --- | --- | --- |
| `/sign-in` | Sign in | Agent 1 | `src/pages/auth/sign-in.jsx` |
| `/sign-up` | Create account | Agent 2 | `src/pages/auth/sign-up.jsx` |

Shared shell: `src/components/AuthLayout.jsx` (main agent). It provides the
back/dashboard links, page title block, form column, the "Prototype
boundaries" aside and the demo note. Pages must not duplicate those.

Routes, navbar and smoke tests belong to the main agent.

## Required copy

Use these strings exactly so the smoke test and both pages stay consistent.

### Sign in

- Eyebrow: `Account / Sign in`
- Title: `Sign in`
- Subtitle: `A prototype screen for the account flow. The demo workspace stays open without an account.`
- Labels: `Email address`, `Password`
- Submit: `Sign in`
- Switch link: `Create an account` → `/sign-up`
- Errors: `Enter a valid email address.`, `Enter your password.`
- Status heading: `Prototype only`
- Status body: `No credentials were sent, stored or checked. There is no account system behind this form.`
- Status links: `Open the demo dashboard` → `/dashboard`, `Back to home` → `/`
- Footnote: `Password reset is not part of the prototype.`

### Sign up

- Eyebrow: `Account / Sign up`
- Title: `Create your account`
- Subtitle: `A prototype screen for the account flow. No account is created and nothing is stored.`
- Labels: `Full name`, `Email address`, `Password`, `Confirm password`
- Submit: `Create account`
- Switch link: `Sign in` → `/sign-in`
- Errors: `Enter your name.`, `Enter a valid email address.`, `Use at least 8 characters.`, `Passwords do not match.`
- Status heading: `Prototype only`
- Status body: `No account was created and nothing was stored. There is no account system behind this form.`
- Status links: same as sign-in.

## Form behaviour

- Use `<form noValidate onSubmit={...}>`; do not rely on native bubbles.
- Visible `<label htmlFor>` for every field. No placeholder-only labels.
- Sign in: email shape (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) and non-empty password.
- Sign up: non-empty name, email shape, password at least 8 characters, confirm
  must match.
- On invalid submit, set field errors, mark the field `aria-invalid="true"`,
  link the error with `aria-describedby`, and focus the first invalid field.
- Clear a field's error when the user edits that field.
- On valid submit, `preventDefault()`, then render a `role="status"`
  `aria-live="polite"` panel above the submit button with the status copy and
  links. Do not navigate, delay, or pretend to authenticate.
- Hide the status panel again as soon as the user edits a field.
- Autocomplete: `email`, `current-password` on sign-in; `name`, `email`,
  `new-password` on sign-up.
- Password visibility toggle is optional. If included it must be a real
  `<button type="button">` with an accessible name and `aria-pressed`, and must
  not submit the form.
- The submit button stays enabled. No spinners, no "Signing in…" state.

## Design

Match the current technical-dossier system. Sharp corners, hairline rules, mono
labels, no shadows, gradients, rounded cards or emoji.

- Field wrapper: `space-y-5` between fields.
- Label: `block font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft`.
- Input:
  `mt-2 block w-full border border-rule bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal`.
- Inline error: `mt-1.5 text-xs text-red-300`.
- Submit:
  `inline-flex w-full items-center justify-center border border-ink bg-ink px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-canvas transition hover:border-signal hover:bg-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`.
- Switch link: `font-mono text-[10px] uppercase tracking-[0.16em] text-signal hover:text-ink`.
- Status panel:
  `border border-emerald-500/30 bg-emerald-500/5 px-4 py-4` with a mono
  `Prototype only` label in `text-emerald-300`, body in
  `text-sm leading-6 text-ink-soft`, and links in `text-signal`.
- Footnote: `text-xs leading-5 text-ink-soft`.
- Mobile: single column; the aside stacks below the form. Nothing may overflow
  at 390 px.

## Accessibility

- One `<h1>` per page (the layout renders it); the form fields are in a
  `<form>` with a meaningful `aria-label` or a visible section heading.
- Do not use `aria-hidden` on meaningful text.
- Errors are text, not colour alone.
- Keyboard: logical tab order, Enter submits, visible focus on inputs and
  buttons.
- The status panel is announced (`role="status"`, `aria-live="polite"`).

## Page component contract

```jsx
import AuthLayout from '../../components/AuthLayout'

export default function SignInPage() {
  return (
    <AuthLayout
      eyebrow="Account / Sign in"
      title="Sign in"
      subtitle="A prototype screen for the account flow. The demo workspace stays open without an account."
    >
      {/* form */}
    </AuthLayout>
  )
}
```

`footer` is an optional prop on `AuthLayout` for the switch link and footnote.
Do not add a second page header, demo banner or container.

## Definition of done

- The route renders at 390 px and 1440 px with no console errors.
- Exact labels, errors and status copy above.
- No `fetch`, no storage, no session, no navigation on submit.
- Imports resolve; no unused imports; no new dependencies.
- Readme set to `in-review` with files, decisions, verification and open
  questions. The main agent runs build and smoke.
