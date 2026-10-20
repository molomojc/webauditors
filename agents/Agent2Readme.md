# Agent 2 — page delivery log

**Status:** done
**Owner:** Agent 2
**Current task:** Sign-up page (`/sign-up`)
**Owned files (current task):**
- `src/pages/auth/sign-up.jsx`
- `agents/Agent2Readme.md`

**Completed:** HTTPS & TLS configuration (`/dashboard/tls`) and sign-up page
(`/sign-up`) — done, verified 2026-10-20.

**Do not edit (current task):** `App.jsx`, `Navbar.jsx`, `AuthLayout.jsx`,
`index.css`, `src/data/demo.js`, any dashboard page, `package.json`.

**Last update:** 2026-10-20 (verified and marked done by main agent)

## Current assignment — Sign-up page

Build the prototype sign-up screen. Read `agents/AUTH-SPEC.md` first; it is the
copy, validation and design contract for both auth pages.

### Deliverable

`src/pages/auth/sign-up.jsx`, default-exporting `SignUpPage` and wrapping the
form in the shared `AuthLayout` (do not duplicate its header or aside).

### Required behaviour

- Full name, email address, password and confirm-password fields, visible
  labels, autocomplete attributes.
- Validate on submit with the exact errors in the spec; focus the first invalid
  field; clear an error when its field is edited.
- Valid submit shows the `role="status"` **Prototype only** panel with the spec
  copy and links to `/dashboard` and `/`.
- Link to `/sign-in` ("Sign in").
- No network request, storage, session, spinner or navigation on submit.
- No social sign-in, terms checkbox, trust badges or pretend security claims.

### Acceptance

- [x] `src/pages/auth/sign-up.jsx` default-exports `SignUpPage`.
- [x] Uses `AuthLayout`; exact copy and errors from `AUTH-SPEC.md`.
- [x] Keyboard operable at 390 px and 1440 px; errors announced.
- [x] No `fetch`, no storage, no new dependencies.
- [x] Readme updated to `in-review` with files, decisions and verification.

### Current progress log

- 2026-10-20 — Assigned by main agent.
- 2026-10-20 — Read `AUTH-SPEC.md`, `AuthLayout.jsx` and the coordination rules.
- 2026-10-20 — Created `src/pages/auth/sign-up.jsx`: four labelled fields,
  submit-time validation, first-invalid focus, per-field error clearing,
  edit-clears status, and the `role="status"` Prototype only panel.
- 2026-10-20 — Matched all 19 required copy strings against the spec by
  normalised text search; checked ARIA wiring, focus order and absence of
  network/storage/navigation calls.
- 2026-10-20 — Status set to `in-review`.

## Current decisions

- **One field component.** `Field` owns the label, input, error and
  `aria-invalid` / `aria-describedby` wiring so all four fields behave the same.
  Each input receives its ref through an `inputRef` prop rather than forwarding
  refs.
- **Validate on submit, not on change.** Errors are produced only by
  `handleSubmit`; editing a field deletes that field's error and hides the
  status panel. This matches the spec and avoids shouting at a half-typed email.
- **Focus order is explicit.** `FIELD_ORDER` is the visual order
  (`fullName`, `email`, `password`, `confirm`); the first key with an error
  gets focus after `preventDefault`.
- **Confirm-password rule.** Confirm is compared to password directly, so two
  empty fields produce only `Use at least 8 characters.` rather than a
  misleading mismatch error. A filled password with an empty confirm produces
  `Passwords do not match.`
- **Status is state, not navigation.** `showStatus` only renders the panel;
  there is no router navigation, timer, request or storage write. The panel sits
  above the submit button and disappears on any edit.
- **No password visibility toggle.** It is optional in the spec; omitting it
  keeps tab order to four inputs, two status links, submit and the switch link.
- **Footer prompt.** The footer contains a plain `Already have an account?`
  lead-in plus the required `Sign in` link. The prompt is connective copy, not
  marketing; the link text and target are exact.
- **No sign-up footnote.** The spec defines the password-reset footnote for
  sign-in only, so none was invented here.
- **Shared link class.** Status links and the switch link use the spec's mono
  uppercase `text-signal` treatment; no second link style was introduced.

## Current verification

- **Copy:** a normalised-whitespace search found all required strings: eyebrow,
  title, subtitle, four labels, submit label, four errors, status heading/body,
  both status link labels, `Sign in`, and the three routes `/sign-in`,
  `/dashboard`, `/`.
- **Imports:** `AuthLayout` exists at `../../components/AuthLayout` and
  default-exports the shell; `useRef`/`useState` and `Link` are all used. No
  unused imports or constants.
- **Behaviour wiring:** `noValidate`, `onSubmit`, `event.preventDefault()`,
  `inputRefs[firstInvalid].current?.focus()`, `aria-invalid`,
  `aria-describedby`, `role="status"` and `aria-live="polite"` are present.
- **Honesty constraints:** a case-insensitive scan found no `fetch`,
  `localStorage`, `sessionStorage`, `setTimeout`, `useNavigate` or `navigate(`,
  plus no checkbox, social provider, remember-me, strength meter, spinner or
  forgot-password UI.
- **Structure:** tag counts balance (all elements closed; inputs self-close).
  One layout `h1`; the form has `aria-label="Create account"`.
- **Responsive:** static check only — the form is `w-full` inside the layout's
  `max-w-md` column, fields are single-column, status links and footer copy
  wrap. The main agent should confirm at 390 px and 1440 px in the browser.
- **Scope:** only `src/pages/auth/sign-up.jsx` and this readme were written. No
  route, navbar, layout, CSS, package or dashboard file changed; dev server,
  build and smoke test were not run.

## Current open questions

- **Footer lead-in.** `Already have an account?` is not in the required copy
  block. It reads naturally, but if the main agent wants strictly spec-only
  copy it can be removed without touching behaviour.
- **Keyboard/responsive proof.** Verified by markup inspection, not a browser
  run (per the coordination rules). The main agent's 390 px screenshot and
  smoke run are the real check.
- **Sign-in parity.** Agent 1 may choose a different footer prompt; the two
  pages should be compared for tone once both exist.

## Current handoff notes

- **Files changed:** `src/pages/auth/sign-up.jsx` (new) and
  `agents/Agent2Readme.md` (this file). Nothing else was touched.
- Wire the route in `App.jsx`, e.g.
  `import SignUpPage from './pages/auth/sign-up'` and
  `<Route path="/sign-up" element={<SignUpPage />} />`. Any navbar link to
  `/sign-up` is also main-agent owned.
- Smoke-test hooks: form accessible name `Create account`, switch link `Sign in`,
  status panel role `status` with heading `Prototype only`.
- The page holds no module state and shares no data with other pages.

### Review notes (main agent) — sign-up

- **Status:** `done`, verified 2026-10-20.
- **Routes:** `/sign-up` is registered in `App.jsx` and is reachable from the
  sign-in page's "Create an account" link; the navbar's "Sign in" control leads
  into the same flow.
- **Browser verification:** `npm run build` passes. `npm run test:smoke` passes,
  covering the full journey: filled fields, the confirm-password mismatch error,
  the corrected submit, and the "Prototype only" panel.
- **Visual check:** `13-signup.png` — four fields, status panel, aside and footer
  align with the sign-in page and the dossier system at 1440 px.
- **Review edit:** added `required` to the shared `Field` input so sign-up
  matches sign-in's assistive-technology semantics; `noValidate` still leaves
  validation to the page. Behaviour is unchanged and the smoke test was rerun
  after the edit.
- **Open questions resolved:** the "Already have an account?" lead-in is
  accepted; its link text and target match the sign-in page's footer pattern.
  Sign-up shares the shell whose 390 px layout is verified by the sign-in smoke
  screenshot.

## Previous assignment — HTTPS & TLS configuration (done)

Build the HTTPS & TLS configuration page for `demo.example.com`. It is an
**evidence view**: certificate facts, protocol support, redirect behaviour and
HSTS, with a clear note on what to review. Read `agents/DASHBOARD-SPEC.md`
first and follow its design contract exactly.

### Required sections (in this order)

1. **Summary strip** — four compact stat blocks:
   - Certificate: `Valid`
   - Expires: computed days remaining (see below)
   - Protocols: `TLS 1.2 · 1.3`
   - HSTS: `Not set`

2. **Certificate** — a two-column definition list (stack on mobile):
   - Subject: `CN=demo.example.com`
   - SANs: `demo.example.com`, `www.demo.example.com`
   - Issuer: `Example Trust Services R11` (fictional; do not imply a real CA)
   - Valid from: `01 Sep 2026`
   - Valid to: `30 Nov 2026`
   - Key: `ECDSA P-256`
   - Signature: `SHA-256`
   - Chain: `leaf → R11 → Example Root X1`
   - OCSP: `Good (simulated)`
   Compute days remaining from the fixed `validTo` at render time
   (`Math.ceil((new Date(validTo) - Date.now()) / 86400000)`), and show the
   count in the summary. Do not hardcode a number that will go stale.

3. **Protocol support** — table with columns Protocol / Status / Note:
   - TLS 1.3 — Passed — preferred
   - TLS 1.2 — Passed — acceptable fallback
   - TLS 1.1 — Passed (disabled) — not offered
   - TLS 1.0 — Passed (disabled) — not offered
   - Forward secrecy — Passed — ECDHE on all offered suites
   - Weak ciphers — Passed — none offered
   Status text must make "disabled" unambiguous (e.g. `Passed` chip + note
   "Not offered").

4. **Redirect behaviour** — a small evidence table or list:
   - `http://demo.example.com` → `https://demo.example.com` — `301` — Passed
   - `https://www.demo.example.com` → `https://demo.example.com` — `301` — Passed
   - HSTS header — `Not set` — Warning
   - HSTS preload — `Not applicable` — Needs review (no header to preload)
   For the HSTS note, state that without `Strict-Transport-Security` the first
   request can still travel over HTTP, and link to the sample report
   (`/reports/demo`) where the HSTS finding is documented. Suggested header:
   `Strict-Transport-Security: max-age=31536000; includeSubDomains` (mention
   `preload` only after the site is ready).

5. **Review next** — three ordered actions:
   - Add the HSTS header, starting with a short max-age if needed.
   - Automate renewal and alert 30 days before expiry.
   - Keep TLS 1.0/1.1 disabled and re-check cipher support after configuration
     changes.

6. **Footer note** — link to `/reports/demo` and `/how-it-works` using mono
   `text-signal` link styling.

### Data file

`src/data/tls.js` must export the certificate object, the protocol rows, the
redirect rows, and the next-actions array. Keep the fixed `validTo` ISO date in
the data file and derive the day count in the page. No network calls.

### Copy rules

- Write "in the sample handshake", "this scenario", or "the sample response".
- Never claim a live handshake or a real certificate.
- No marketing language, emoji, or exclamation marks.

## Acceptance checklist

- [x] `src/pages/dashboard/tls.jsx` default-exports `TlsPage`.
- [x] Wraps content in `<DashboardLayout active="tls" title="HTTPS & TLS" subtitle="…">`.
- [x] All six sections present; certificate dates and day count are correct.
- [x] Sharp corners, `border-rule` hairlines, mono labels, no shadows/gradients.
- [x] Works at 390 px and 1440 px; tables scroll horizontally on mobile.
- [x] Tables have `<caption className="sr-only">` and `scope="col"` headers.
- [x] No new dependencies; no edits outside owned files.
- [x] Readme updated to `in-review` with files, decisions, verification.

## Progress log

- 2026-10-20 — Assigned by main agent.
- 2026-10-20 — Read spec, layout, tokens, landing page and demo data.
- 2026-10-20 — Created `src/data/tls.js` with certificate, protocol, redirect,
  HSTS and next-action records.
- 2026-10-20 — Created `src/pages/dashboard/tls.jsx`: summary strip, certificate
  definition list, protocol table, redirect/HSTS table and note, ordered next
  actions, footer links.
- 2026-10-20 — Fixed section labelling (single visible `h2` per section, no
  duplicate sr-only heading) and the expired-certificate fallback.
- 2026-10-20 — Verified imports/exports, day count, date formatting, table
  semantics and responsive classes. Status set to `in-review`.

## Decisions

- **Day count derived at render.** `daysRemaining` uses
  `Math.ceil((new Date(validTo).getTime() - Date.now()) / 86400000)`, as
  specified. The page shows 41 days on 2026-10-20 and will fall as the clock
  advances; the number is not stored.
- **One source for dates.** The data file keeps ISO `validFrom` / `validTo`;
  the page formats them with a fixed month table using UTC getters. `Intl`
  with `en-GB` was tested and returns `01 Sept 2026`, which breaks the required
  `01 Sep 2026` label, so it was not used.
- **Disabled protocols are explicit in two places.** TLS 1.0/1.1 show the
  `Passed` chip, a mono `disabled` qualifier and the note `Not offered`. The
  section intro also explains that the check passes because the protocol is
  disabled.
- **Static copy where status is mixed.** HSTS is a table row (`Not set` /
  `Warning`) plus a bordered evidence panel with the suggested header, preload
  caveat and a link to `/reports/demo`, because the header advice needs more
  room than a table cell.
- **Footer is a `<footer>`, not a sixth numbered section.** The five numbered
  sections are Summary, Certificate, Protocol support, Redirect behaviour,
  Review next; the evidence note and both links sit in the footer so the
  dossier numbering stays honest.
- **Local chip component.** `StatusChip` implements the spec chip inline
  (square, 9px mono, four tones). The older `CheckStatus` component is
  rounded-full and off-contract, so it is not imported.
- **No route edit.** The route stays with the main agent; this page only
  default-exports `TlsPage`.

## Verification

- **Imports/exports:** `src/components/DashboardLayout.jsx` and
  `src/data/tls.js` exist; the page imports exactly `tlsCertificate`, `tlsHsts`,
  `tlsNextActions`, `tlsProtocols`, `tlsRedirects`, all exported by name.
  `node --check src/data/tls.js` passes.
- **Day count:** computed with the specified formula; 41 on 2026-10-20 for
  `validTo: '2026-11-30'`. Expired dates fall back to `Expired` with no unit.
- **Dates:** formatter returns `01 Sep 2026` and `30 Nov 2026`; `Intl` was
  checked and rejected as above.
- **Section count/order:** Summary, Certificate (9 rows), Protocol support
  (6 rows), Redirect behaviour (4 rows + HSTS panel), Review next (3 actions),
  footer note with `/reports/demo` and `/how-it-works` mono signal links.
- **Table semantics:** both tables have `caption.sr-only`, `th scope="col"` on
  every column and `th scope="row"` on the first cell of each body row.
- **Responsive:** summary `grid-cols-2` → `lg:grid-cols-4`; certificate list
  stacks below `sm`; tables use `overflow-x-auto` with `min-w-[34rem]` /
  `min-w-[40rem]`; review list is a two-column number/text grid; footer stacks
  below `sm`.
- **Design contract:** `rounded-none` is implicit (no `rounded-*` added),
  every border is `border-rule` or a status-tone border, no shadow/gradient/
  emoji, mono on labels and all record values.
- **Scope:** only the three owned files were written. No dependency, config,
  route, layout or `demo.js` change. Dev server/build/smoke test were not run.

## Open questions

- **Stale day count in `src/data/demo.js` — resolved.** The main agent replaced
  "valid for 78 more days" with "valid and not close to expiry", so the report
  and the computed 41 days no longer contradict each other.
- **HSTS status tone — confirmed.** The row keeps the amber `Warning` status
  (the finding is medium) while the `Not set` value is red. That reads correctly
  as "a warning about a missing control".
- **Disabled protocol status label — confirmed.** `Passed` plus the `disabled`
  qualifier and `Not offered` note is accurate: the check passes *because* the
  protocol is refused. No change needed.

## Handoff notes

- **Files changed:** `src/data/tls.js` (new), `src/pages/dashboard/tls.jsx`
  (new), `agents/Agent2Readme.md` (this file). Nothing else was touched.
- Wire the route in `App.jsx`, e.g.
  `import TlsPage from './pages/dashboard/tls'` and
  `<Route path="/dashboard/tls" element={<TlsPage />} />`. The layout already
  has the `tls` tab pointing at `/dashboard/tls`.
- No data or state is shared outside `src/data/tls.js`; the page is pure and
  makes no requests.

## Review notes (main agent)

- 2026-10-20 — Read `tls.jsx` and `tls.js` against the assignment. The 41-day
  count, UTC date formatting, section order, table semantics, responsive
  classes and copy all match the brief.
- Route wired in `src/App.jsx` (`/dashboard/tls`); the layout tab already
  pointed at it.
- Integration edits:
  - the **Certificate** summary now flips to `Expired` with a red tone once
    `validTo` passes; previously only the Expires block handled expiry, so the
    two blocks could disagree;
  - replaced the stale "78 more days" copy in `src/data/demo.js` with "valid and
    not close to expiry" so the report and dashboard agree.
- `npm run build` passed. `npm run test:smoke` passed, including the
  overview → DNS → TLS journey and the 390 px dashboard check.
- Screenshots: `.smoke/10-dashboard-tls.png`. No browser console errors.
- Status set to `done`.

