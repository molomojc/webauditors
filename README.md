# WebAuditors — interactive prototype

A working prototype of WebAuditors: a security analysis tool for solo
developers, indie hackers and people building with AI coding tools.

The goal of this build is to validate the **experience** — enter a URL, start an
analysis, understand an evidence-based security report — not to prove that
detection works yet.

## What this prototype does and does not do

**It does**

- Validates the URL in the browser (HTTP/HTTPS only, rejects malformed input).
- Runs a complete simulated scan with per-check progress and states.
- Shows a report with severity, evidence, impact, remediation, confidence and
  limitations.
- Supports severity filters, search, finding details, report export, scan
  history and comparison.
- Stores demonstration history in `localStorage` and can reset it.
- Shows prototype sign-in and sign-up screens that validate input locally but
  never create an account, send credentials or start a session.

**It deliberately does not**

- Make any HTTP request to the URL you enter.
- Exploit, fuzz, enumerate or submit anything.
- Verify domain ownership (deferred by design).
- Create accounts, authenticate anyone or store credentials. The sign-in and
  sign-up screens are UI prototypes only.
- Produce a numerical security score.
- Claim a simulated result is a real finding.

Every scan, timestamp and comparison in the UI is labelled as simulated.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173).

```bash
npm run build      # production build
npm run preview    # serve the production build
```

## Run in GitHub Codespaces

Codespaces runs the project in a cloud container and exposes it through a
browser URL. The devcontainer also installs the OpenCode CLI, so the agent web
UI can run in the same Codespace.

This folder is a git repository with an initial commit. Create an empty
repository on GitHub, then connect and push it:

```bash
git remote add origin https://github.com/<you>/webauditors.git
git push -u origin main
```

1. On GitHub, choose **Code → Codespaces → Create codespace on main**.
2. In the Codespace terminal, start the prototype:

   ```bash
   npm run dev -- --host 0.0.0.0
   ```

3. Open the forwarded **5173** port from the **Ports** panel.
4. To use the browser agent UI, run this in a second terminal:

   ```bash
   opencode pair
   ```

   Open the forwarded URL it prints and sign in with the generated username and
   password. Connect a model provider on first use; the credential stays in the
   Codespace, not in this repository.

Keep the OpenCode port **private**: it controls an agent with access to the
workspace. Agent sessions are local to an OpenCode instance, so live sessions
from a local build do not move into the Codespace. The workflow docs in
`agents/` do travel with the repository. Never commit provider keys.

For the smoke suite in a Linux Codespace, install Playwright's browser once:

```bash
npx playwright install chromium
npm run test:smoke
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Homepage with URL entry and product overview |
| `/scan` | URL submission with demo-mode explanation |
| `/scan/demo?url=...` | Simulated scanning progress and completion summary |
| `/reports/demo` | Seeded sample report (`demo.example.com`) |
| `/reports/:scanId` | Report for any scan in the local demo history |
| `/dashboard` | Dashboard overview: posture, surface areas, priority fixes, recent scans |
| `/dashboard/dns` | DNS configuration evidence (records, email auth, DNSSEC, CAA) |
| `/dashboard/tls` | HTTPS and TLS configuration evidence (certificate, protocols, HSTS) |
| `/sign-in` | Prototype sign-in screen; no credentials are sent or stored |
| `/sign-up` | Prototype sign-up screen; no account is created |
| `/history` | Demonstration scan history and comparison |
| `/how-it-works` | Method, checks, limits and what real scanning needs |

## Demo behaviour

- Three seeded reports (21, 9 and 2 days old) are created on first load.
- Running a demo scan writes a new report to the history in this browser only.
- "Reset demo data" removes local scans and restores the seeded examples.
- The sample report always shows 12 checks with 1 high, 2 medium and 2
  informational findings.
- Comparison marks findings as introduced, resolved or unchanged.

Storage key: `webauditors.demo.v1`.

## Dashboard and page agents

The `/dashboard` area is an evidence view for the demo site, split so several
agents can work without touching the same files:

- `agents/README.md` — status vocabulary, file ownership and review gates
- `agents/DASHBOARD-SPEC.md` — dashboard design and data contract
- `agents/AUTH-SPEC.md` — sign-in / sign-up design, copy and validation contract
- `agents/Agent1readme.md` — DNS configuration (done); sign-in page
- `agents/Agent2Readme.md` — HTTPS and TLS configuration (done); sign-up page

Each agent updates only its own readme. The main agent reads them, wires the
routes, verifies the pages against the spec, and marks a readme `done` only
after `npm run build` and `npm run test:smoke` pass.

## Verification

```bash
npm run build        # type-free build check
npm run test:smoke   # end-to-end journey check (see note)
```

The smoke test drives a real browser through the full journey: URL validation,
demo scan, report filtering and search, finding detail, export download,
history comparison, reset and mobile navigation. It writes screenshots to
`.smoke/`.

It uses an installed browser channel. Override if needed:

```bash
# PowerShell
$env:PW_CHANNEL = "chrome"; npm run test:smoke
```

Requires a running dev server on `http://localhost:5173` (override with
`BASE_URL`).

## Design system

- React 19 + Vite, JavaScript (JSX), client-side routing via React Router.
- Tailwind CSS v4 with custom tokens in `src/index.css`.
- "Technical dossier" theme: near-black canvas (`--color-canvas`), warm ink
  (`--color-ink`), hairline rules (`--color-rule`), one cool signal colour, and
  red / amber / blue severity colours tuned for dark backgrounds.
- IBM Plex Sans for reading copy, JetBrains Mono for labels, navigation, data
  and controls. Sections use numbered editorial rules instead of card grids.
- An inverted (black on white) call-to-action band and `color-scheme: dark` so
  native controls match.
- Icons from Lucide, used sparingly.
- The hero carries a wireframe WebGL globe with surface arcs, orbit rings and a
  slow sonar pulse (plain three.js, no React reconciler in the render loop). It
  is code-split via `React.lazy`, only mounted at `min-width: 768px`, pauses
  when scrolled out of view, and renders a single static frame under
  `prefers-reduced-motion`.
- Motion is limited to functional state changes (drawer, focus, progress) plus
  the slow hero rotation, so the product reads as a tool rather than a demo.

## Safety boundaries for the next stage

Real scanning is intentionally out of scope and must not be bolted on without:

- Ownership verification (DNS TXT or equivalent) before any live scan.
- Safe target handling: block private, loopback, link-local and cloud metadata
  addresses, and re-check after redirects.
- Rate limits, concurrency caps and audit logs to prevent abuse.
- Detection rules verified against controlled sites with known configurations,
  with false-positive measurement before shipping.

The codebase is split into `src/data` (demo content), `src/lib` (validation,
storage, comparison, export) and `src/components` (reusable UI), so a real
scanner and an ownership-verification step can be added without a rewrite.

## Project extras

The `.opencode/skills` folder contains design-intelligence skills installed for
OpenCode. They are tooling for the build process and are not part of the app.
