# Dashboard spec — shared contract

Read this before touching any page. It is the single source of truth for the
dashboard build.

## Product context

WebAuditors audits sites built quickly (including AI-assisted "vibe-coded"
sites) and reports what the site tells the internet about itself: DNS, TLS,
headers, and public files. The product is evidence-first — no vague score, no
pretend exploit claims.

The dashboard is the working surface for one monitored site:
`demo.example.com`. It is a prototype, so every value is simulated.

## Scope for this phase

| Route | Page | Owner |
| --- | --- | --- |
| `/dashboard` | Overview | Main agent |
| `/dashboard/dns` | DNS configuration | Agent 1 |
| `/dashboard/tls` | HTTPS & TLS configuration | Agent 2 |

Not in scope: authentication, real lookups, adding more routes, editing the
existing report/history/scan pages.

## Hard rules

1. **Simulated data only.** No `fetch`, no WebSocket, no live DNS/TLS calls.
   The UI must say so: the layout already renders a "Demo data — no live scan"
   notice at the top of every dashboard page.
2. **Use documentation-safe values.** IPs from `203.0.113.0/24` and
   `2001:db8::/32`; hosts under `example.com`; fictional CA names such as
   "Example Trust Services R11" (do not imply a real certificate was issued).
3. **No new dependencies.** React, React Router, Tailwind, and Lucide only.
4. **Own only your files.** The shared layout, routes, navbar, design tokens,
   and other agents' pages are off limits.
5. **Never describe simulated output as a measurement.** Prefer "observed in
   the sample response" / "configured in this scenario" over "we detected".

## Design system (current, do not fork it)

The app was restyled to a technical-dossier look. Match it exactly.

### Type

- Sans: `font-sans` (IBM Plex Sans) for prose and headings.
- Mono: `font-mono` (JetBrains Mono) for labels, record values, IDs, timestamps.
- Page title: `text-3xl font-medium tracking-[-0.03em] text-ink sm:text-4xl`.
- Eyebrow / section index:
  `font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft`.
- Section heading: `text-sm font-medium text-ink` or
  `text-lg font-medium tracking-[-0.02em] text-ink`.
- Body copy: `text-sm leading-6 text-ink-soft`.

### Colour tokens

| Token | Use |
| --- | --- |
| `bg-canvas` | Page background (`#08090b`) |
| `bg-panel` | Raised blocks (`#0d0f12`) |
| `text-ink` | Primary text |
| `text-ink-soft` | Secondary text |
| `border-rule` | Every hairline border |
| `text-signal` / `border-signal` / `bg-signal` | The one cool accent |
| `text-emerald-300` | Passed |
| `text-amber-300` | Warning |
| `text-red-300` | Fail / high |
| `text-blue-300` | Informational / review |
| `font-mono` | Labels and data values |

### Shape and depth

- Sharp corners. Use `rounded-none`; do not introduce `rounded-xl` cards.
- 1 px rules (`border border-rule`), no shadows, no gradients, no glass.
- Generous vertical rhythm; separate sections with `border-t border-rule pt-6`.
- No emoji, no decorative icons larger than 18 px, no animation loops.

### Status chips

Use one consistent chip:

```jsx
<span className="inline-flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300">
  Passed
</span>
```

Tone map: passed → emerald, warning → amber, needs review → blue,
not set / fail → red. Keep the chip square.

### Tables

- `<div className="overflow-x-auto">` wrapper.
- `<table className="w-full border-collapse text-left text-sm">`.
- `<caption className="sr-only">…</caption>`.
- Header cells: `border-b border-rule py-2 pr-4 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft`.
- Body cells: `border-b border-rule py-3 pr-4 align-top`.
- Mono for record values, TTLs, hashes, protocol names.
- No zebra striping; hover only if a row is clickable.

### Responsive

Build mobile-first. At 390 px: stack summary blocks, let tables scroll, never
truncate a value without keeping it reachable. At 1024 px+: multi-column
grids are fine. Do not hide required evidence on small screens.

### Accessibility

- One `<h1>` per page (the layout renders it).
- Use `<section>` + `<h2>` for sections.
- Table headers must use `scope="col"` / `scope="row"`.
- Status must be text, never colour alone.
- Interactive elements need visible focus (global focus style already exists).
- Do not use `aria-hidden` on meaningful content.

## Page component contract

Each page file default-exports a component and wraps its content in the shared
layout:

```jsx
import DashboardLayout from '../../components/DashboardLayout'

export default function DnsPage() {
  return (
    <DashboardLayout
      active="dns"
      title="DNS configuration"
      subtitle="How demo.example.com tells the internet where to send traffic and mail."
    >
      {/* sections */}
    </DashboardLayout>
  )
}
```

The layout owns the page header, the section tabs, the simulated-data notice,
and the container width. Do not duplicate those.

## Consistency with the existing report

The sample report (`/reports/demo`) contains five findings: CSP missing, HSTS
missing, source map exposed, X-Frame-Options missing, sensitive file exposed.
The dashboard should not contradict it:

- The overview reports **5 findings from 12 checks**.
- DNS and TLS pages are **configuration evidence views**, not extra finding
  lists. Show per-item statuses and inline notes; when an issue maps to an
  existing report finding (HSTS), link to `/reports/demo`.
- Do not invent a numerical security score.

## Definition of done for a page

- Imports resolve; no unused imports; no console errors.
- Route renders at 390 px and 1440 px.
- Values are plausible, consistent, and documentation-safe.
- Statuses use the vocabulary `Passed`, `Warning`, `Needs review`, `Not set`.
- Readme updated to `in-review` with files, decisions, verification, and any
  open questions.
