# Agent coordination

This folder is the shared handoff point between the main agent and the page
agents. Every agent owns exactly one readme here, and the main agent reads all
of them before integrating or verifying work.

## Files

| File | Owner | Purpose |
| --- | --- | --- |
| `README.md` | Main agent | Protocol, rules, status vocabulary |
| `DASHBOARD-SPEC.md` | Main agent | Dashboard design and data contract |
| `AUTH-SPEC.md` | Main agent | Sign-in / sign-up design, copy and behaviour contract |
| `Agent1readme.md` | Agent 1 | DNS configuration (done); sign-in page (current) |
| `Agent2Readme.md` | Agent 2 | HTTPS & TLS configuration (done); sign-up page (current) |
| `Agent3readme.md` | Agent 3 (when added) | Next assigned page |

## Status vocabulary

Use exactly one of these in the `Status:` line:

- `assigned` — task written, agent has not started
- `in-progress` — agent is working
- `blocked` — agent needs a decision; state the question in `Open questions`
- `in-review` — agent believes it is done; main agent has not verified
- `done` — main agent verified the work
- `changes-requested` — main agent found an issue; see `Review notes`

Only the main agent may set `done` or `changes-requested`. The page agent sets
`in-progress`, `blocked`, or `in-review`.

## Rules

1. **One writer per file.** An agent may only write the files listed under
   `Owned files` in its own readme. Shared files (routes, navbar, layout,
   design tokens) belong to the main agent.
2. **Update your readme as you go**, not only at the end. The main agent reads
   them to see progress and to avoid duplicating work.
3. **Never edit another agent's readme.** Add cross-agent notes under
   `Handoff notes` instead.
4. **No new dependencies.** No `npm install`, no new packages.
5. **No network requests.** Every value is demonstration data.
6. **Leave the app buildable.** If a page is incomplete, export a component
   that renders a short "in progress" state rather than breaking the import.
7. **Do not run the dev server, build, or smoke test.** Concurrent runs on the
   same `dist/` and `node_modules/.vite` cause false failures. The main agent
   runs verification.

## Main-agent review checklist

- Read the page agent's readme and compare its claims to the actual files.
- Check imports, unused code, and console errors.
- Check the design contract in `DASHBOARD-SPEC.md`.
- Run `npm run build` and `npm run test:smoke`.
- Capture desktop and mobile screenshots.
- Set the readme to `done` or `changes-requested` with specifics.

## Definition of done

- The route renders with no errors at 390 px and 1440 px.
- Data is clearly labelled simulated and contains no real target.
- The page follows the design contract (tokens, type, rules, tables).
- The readme lists files, decisions, verification, and open questions.
- The main agent has verified the work and marked the readme `done`.
