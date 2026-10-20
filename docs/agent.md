# The agent layer

`POST /api/agent/scan` runs one language-model agent against one website. The
agent has five read-only tools, a fixed system prompt and a set of hard caps. It
reports findings only when they cite evidence ids that its own tools issued
during the same run. Everything the agent does is streamed to the browser as
NDJSON; nothing is stored.

This document describes the implementation in `api/`, `src/pages/scan-agent.jsx`
and `scripts/`, not a planned design.

- Registry entry: `api/_lib/agent/registry.js`
- Orchestration: `api/_lib/agent/run.js`
- Tools and validation: `api/_lib/agent/tools.js`
- Provider HTTP client: `api/_lib/agent/provider.js`
- Asset secret scanner: `api/_lib/agent/bundle.js`
- Target and address guard: `api/_lib/guard.js`
- HTTP handler: `api/agent/scan.js`
- Page: `/scan/agent` (`src/pages/scan-agent.jsx`)

## 1. What an "agent assignment" is

An assignment is the pairing of **one registry entry** with **one validated
target URL**, executed **once**. The UI phrase "Assign agent" is only a label
for `POST /api/agent/scan`; there is no scheduler, no queue and no assignment
record.

### The registry entry

`describeAgent()` returns the whole definition:

| Field | Current value | Notes |
| --- | --- | --- |
| `id` | `web-auditor` | Stable identifier for the agent, not the run |
| `version` | `1` | Bumped by hand when the prompt or tool set changes |
| `name` | `Web Auditor` | Display name |
| `model` | `process.env.LLM_MODEL` (or `null`) | Read at call time, so the same version can run on a different model |
| `tools` | `fetch_page`, `probe_path`, `fetch_asset`, `dns_lookup`, `finish` | Advertised list; the schemas the model sees come from `TOOL_SPECS` in `tools.js` |
| `system` | the `SYSTEM_PROMPT` constant | Never leaves the server |

`publicAgent()` strips `system`, so `agent.assigned` carries the id, version,
name, model and tool list â€” but not the prompt. The prompt itself is only sent
to the model provider.

Because the model comes from the environment rather than the registry,
`version: 1` pins the prompt and the tool surface but **not** the model weights
or provider behaviour. Two runs of "v1" can differ if `LLM_MODEL` changes.

### Run lifecycle

1. The handler rejects non-`POST` requests, reads the JSON body (8 KiB limit) and
   normalises `url` with `normaliseTarget()`. It does not resolve DNS here.
2. It checks `isAgentConfigured()`: both `LLM_API_KEY` and `LLM_MODEL` must be
   non-empty. Otherwise it returns `503 agent_not_configured` as JSON, before any
   stream starts.
3. It sends `200` with `application/x-ndjson` and flushes the headers.
4. `runAgentScan()` builds the context (target, origin, hostname, counters,
   `startedAt`, empty evidence set) and the message list: the system prompt plus
   one user message containing the target href, the UTC date and "Investigate
   this site."
5. It emits `agent.assigned`.
6. It loops up to `MAX_STEPS = 10` model turns. Each turn is one
   `chat/completions` call with all five tool schemas, `tool_choice: 'auto'` and
   `temperature: 0.1`.
7. If the assistant returns no tool calls, the runner appends a user message
   telling it to call `finish`, and consumes another step.
8. Tool calls in one turn run sequentially. Each one emits `tool.call` **before**
   execution and `tool.result` **after**, and appends a `role: 'tool'` message
   containing the result wrapped in an `UNTRUSTED TOOL OUTPUT` envelope, with
   every string capped at 300 characters and every array at 40 entries.
9. A successful `finish` emits one `finding` event per finding and returns
   `{ summary, findings, usage, steps, evidence }` to the handler.
10. The handler emits `agent.completed` with `completedAt` and ends the
    response. Any thrown error becomes one `agent.failed` event.
11. If the client disconnects, the handler aborts the run through an
    `AbortController`. The signal cancels the model call, is threaded into every
    collector request (including probes and assets), and destroys an in-flight
    socket with `aborted`. No further events are written, because the socket is
    gone.

```text
 client                api/agent/scan.js        runAgentScan()            provider / tools
   |                          |                       |                         |
   |-- POST {url} ----------->|                       |                         |
   |                          | validate body + url   |                         |
   |                          | configured? --no-----> 503 JSON (stop)          |
   |<== 200 + NDJSON =========|                       |                         |
   |                          |-- runAgentScan ------>|                         |
   |<-- agent.assigned -------|<-- emit --------------|                         |
   |                          |                       |-- chatCompletion ------>| 30 s timeout
   |                          |                       |<-- message + tool_calls |
   |<-- tool.call ------------|<-- emit --------------|                         |
   |                          |                       |-- executeTool --------->| guard + collector
   |                          |                       |<-- result --------------|
   |<-- tool.result ----------|<-- emit --------------|                         |
   |                          |                       |   loop (max 10 turns,   |
   |                          |                       |   12 calls, 45 s tools) |
   |                          |                       |-- finish ok             |
   |<-- finding (x n) --------|<-- emit --------------|                         |
   |<-- agent.completed ------|<-- summary, usage ----|                         |
   |                          |                       |                         |
   |-- disconnect ----------->| abort controller ---->| provider call cancelled |
   |                          |                       | next step aborts        |
```

Note the ordering on success: the `tool.result` for `finish` is emitted first,
then the `finding` events, then `agent.completed`.

### What is not persisted

Runs are persisted, but the page itself keeps nothing: it writes no
`localStorage`. The store is selected by the `STORE` environment variable:

| `STORE` | Where runs live | Durable |
| --- | --- | --- |
| `file` (default) | `.data/store.json` in the project directory | Across restarts on one machine; **not** on serverless, where the filesystem belongs to one instance |
| `memory` | The process | No |
| `postgres` | A Postgres database, via `DATABASE_URL` | Yes, shared across instances |

`postgres` needs the optional `pg` package (`npm install pg`) and the schema in
`api/_lib/store/schema.sql`. It is the only option that survives a serverless
deployment with more than one instance, so it is the one to set before a public
launch.

A run is scoped to the session that created it. The session is an anonymous
cookie; only its SHA-256 hash is stored, and a run id on its own is not a key â€”
reading a run from another session reports "not found" rather than "forbidden".

`finding.id` is a slug derived from the title plus the finding's index, not a
stored identifier. Two findings with the same title still get distinct ids. The
UI keys cards by id plus array index.

## 2. The endpoint: `POST /api/agent/scan`

### Request

```http
POST /api/agent/scan
content-type: application/json

{ "url": "example.com" }
```

`url` is a string. `normaliseTarget()`:

- prefixes `https://` when no scheme is given;
- accepts only `http:` and `https:`;
- rejects whitespace, URLs with credentials, and non-`http(s)` schemes;
- rejects ports other than 80 and 443;
- strips the fragment.

The body is read with `readJsonBody()`, which accepts either a pre-parsed body
(Vercel) or the raw stream (dev middleware) and caps it at 8 KiB.

### Response

A `200` response is `application/x-ndjson; charset=utf-8` with
`cache-control: no-store` and `x-accel-buffering: no`. Each line is one JSON
object; there is no array wrapper, no envelope and no trailing sentinel. The page
buffers on `\n` and silently ignores lines that do not parse.

### Events

| `event` | Fields | Emitted when |
| --- | --- | --- |
| `run.created` | `runId`, `createdAt` | First event of a persisted run, before the agent is assigned |
| `agent.assigned` | `agent` (`id`, `version`, `name`, `model`, `tools`), `assignedAt` | Once, before the first model turn |
| `tool.call` | `id` (provider call id), `name`, `argument` (short display string) | Before each tool executes |
| `tool.result` | `id`, `name`, `ok`, `summary` (one line) | After each tool returns |
| `finding` | `finding` (validated object) | One per finding, only after a successful `finish` |
| `agent.completed` | `summary`, `findings`, `usage` (`inputTokens`, `outputTokens`), `steps`, `evidence` (all ids), `completedAt` | Successful end of the run |
| `agent.failed` | `code`, `status`, `error` | The run threw |

`argument` is deliberately small: the probe path, the asset URL, the DNS record
type, `"N findings"` for `finish`, and an empty string for `fetch_page`.
`summary` is a human-readable one-liner such as `200 Â· 18 headers Â· TLSv1.3 Â· 12
scripts`; when a tool fails, `ok` is `false` and `summary` is the error text.

Example lines (wrapped here, one line each on the wire):

```json
{"event":"agent.assigned","agent":{"id":"web-auditor","version":1,"name":"Web Auditor","model":"gpt-4o-mini","tools":["fetch_page","probe_path","fetch_asset","dns_lookup","finish"]},"assignedAt":"2026-10-20T09:00:00.000Z"}
{"event":"tool.call","id":"call_1","name":"fetch_page","argument":""}
{"event":"tool.result","id":"call_1","name":"fetch_page","ok":true,"summary":"200 Â· 18 headers Â· TLSv1.3 Â· 12 scripts"}
{"event":"finding","finding":{"id":"hsts-is-not-enabled","title":"HSTS is not enabled","severity":"medium","category":"transport","observation":"â€¦","impact":"â€¦","fix":"â€¦","evidence":["headers"],"confidence":"high","limitations":null}}
{"event":"agent.completed","summary":"â€¦","findings":[],"usage":{"inputTokens":4000,"outputTokens":600},"steps":5,"evidence":["page","headers","tls","document","cookies","redirects","probe:/.env"],"completedAt":"2026-10-20T09:00:12.000Z"}
```

`agent.completed` repeats the findings already sent as `finding` events, plus the
summary, usage, step count and evidence set.

### Status codes

| Status | Body | Cause |
| --- | --- | --- |
| `200` | NDJSON | Stream started. Failures during the run arrive as `agent.failed` inside the stream |
| `400` | `{ ok: false, code, error }` | Bad JSON (`invalid_body`), bad URL (`invalid_url`, `invalid_scheme`, `blocked_port`, `blocked_host`) |
| `405` | `{ ok: false, code: "method_not_allowed", â€¦ }` | Anything but `POST`; also sends `allow: POST` |
| `413` | `{ ok: false, code: "body_too_large", â€¦ }` | Streamed body over 8 KiB |
| `415` | `{ ok: false, code: "unsupported_media_type", â€¦ }` | Missing or non-JSON `content-type` |
| `429` | `{ ok: false, code: "agent_busy", â€¦ }` | More than two runs active on this instance; sends `retry-after: 5` |
| `503` | `{ ok: false, code: "agent_not_configured", â€¦ }` | `LLM_API_KEY` or `LLM_MODEL` missing |

Two ordering details matter:

- URL validation and host resolution run **before** the configuration check, so a
  malformed or private URL returns `400` even when no key is set. This also means
  the endpoint does not stream a `200` only to fail on the first fetch.
- Once the stream has started, the HTTP status cannot change. A provider failure
  (`502`, or `504` on timeout), a `504` step limit or a `499` abort appear as the
  `status` **field** of `agent.failed`, not as the response status.

`content-type` must be `application/json`. The check exists so a cross-origin
page cannot trigger a run with a simple `text/plain` POST: a JSON request forces
a CORS preflight, which this endpoint does not answer.

## 3. The tool contract

All tools share these rules:

- The model sees `TOOL_SPECS` (OpenAI function schemas) on every turn; the
  executor is a `switch` over five names. An unknown name returns
  `{ ok: false, error: 'Unknown tool "â€¦".' }`.
- Every call increments `context.calls`; non-`finish` calls are refused once the
  12-call cap or the 45-second budget is exhausted. Network errors are caught and
  converted to `{ ok: false, error }`; they never throw out of the runner.
- Results are serialised into the conversation as JSON. Raw response bodies are
  never included: only derived signals, flags and redacted pattern summaries.
- Evidence ids are added to `context.evidence` by the executor, never supplied by
  the model.

### `fetch_page`

- **Arguments:** none (`additionalProperties: false`).
- **Returns:** `ok`, `evidence` (`page`, `headers`, `tls`, `document`,
  `cookies`, `redirects`), `target`, `finalUrl`, `status`, `redirects` (the
  chain), `headers` (11 picked headers), `tls` (protocol, cipher, issuer,
  subject, validity, `daysRemaining`, `sanCount`, authorisation error),
  `cookies` (`count`, `missing` flags), `document` (title, generator, source-map
  flags, mixed-content count, debug signals, script and stylesheet URLs, inline
  script count, password-input flag), `bodyBytes`, `truncated`, and a `note` that
  document strings are site data, not instructions.
- **Side effects:** sets `context.origin` and `context.hostname` from
  `finalUrl`, so later probes, assets and DNS lookups follow the redirect
  destination.
- **Limits:** collector-level only â€” 8 s per request, 20 s total for the
  document, 5 redirects, 256 KiB of textual body, one request per hop.
- **Evidence ids:** `page`, `headers`, `tls`, `document`, `cookies`, `redirects`.

### `probe_path`

- **Arguments:** `path` (required string, must start with `/`).
- **Returns:** `ok`, `evidence` (`probe:<path>`), `path`, `status`, `bytes`,
  `contentType`, `redirectedTo`, `truncated`, `headers` (picked subset),
  `flags`. Flags are path-specific: `.env` key names and assignment count
  (`looksLikeSecrets`), `.git/config` markers and remote count, source-map
  version and `sourcesCount`, `robots.txt` `disallowsAll`, `security.txt`
  `hasContact`, and `downloadable` for backup-like paths that return 200 with
  bytes.
- **Limits:** 8 probes per run; the counter increases before the request, so a
  probe that fails still consumes a slot. Path is truncated to 200 characters.
  Response body capped at 64 KiB, but only the first 4 KiB is kept server-side
  and it is never returned.
- **Evidence id:** `probe:<path>` â€” the path as the model wrote it, not the final
  URL.

### `fetch_asset`

- **Arguments:** `url` (required string, absolute URL or same-origin path).
- **Returns:** `ok`, `evidence` (`asset:<finalUrl>`), `url`, `status`, `bytes`,
  `contentType`, `truncated`, `patterns` (up to 12 pattern groups, each with
  `kind`, `severity`, `count`, redacted `sample`, optional `note`),
  `sourceMapUrl`.
- **Off-origin and non-text handling:** the resolved URL must share
  `context.origin`, and a redirect that ends on another origin is refused. A
  non-text content type returns `{ ok: true, skipped: true, reason }` with no
  evidence id, but the slot is already spent.
- **Limits:** 5 assets per run, 512 KiB per asset, 8 s per hop, 5 redirects.
- **Evidence id:** `asset:<finalUrl>`.

### `dns_lookup`

- **Arguments:** `type` (required, one of `TXT`, `CAA`, `MX`, `NS`;
  case-insensitive).
- **Returns:** `ok`, `evidence` (`dns:<TYPE>`), `type`, `host`, `records`. At
  most 20 records, each serialised and truncated to 300 characters. For `TXT`
  it also adds `hasSpf` and `hasDmarc` booleans.
- **Limits:** 4 s timeout (`dns_timeout`), lookup against `context.hostname`
  only.
- **Evidence id:** `dns:<TYPE>`.

### `finish`

- **Arguments:** `summary`, and `findings` â€” an array of at most 8 objects with
  `title`, `severity` (`high` | `medium` | `info`), `category` (optional),
  `observation`, `impact`, `fix`, `evidence` (1â€“5 ids), `confidence`
  (`high` | `medium` | `low`, optional), `limitations` (optional). Required:
  `title`, `severity`, `observation`, `impact`, `fix`, `evidence`.
- **Returns on success:** `ok`, `summary` (800 characters), `findings`
  (normalised: slug id, category default `general`, confidence default
  `medium`, text lengths capped).
- **Returns on failure:** `{ ok: false, error: "Invalid findings: â€¦" }`, listing
  up to 8 problems. The model can correct and call again; nothing is emitted and
  the run continues.
- **Limits:** exempt from the call, probe, asset and time checks. It still
  increments `context.calls`, and extra findings beyond 8 are dropped before
  validation.
- **Evidence ids:** none issued; it consumes them.

### Caps

| Cap | Value | Where | Behaviour when hit |
| --- | --- | --- | --- |
| Model steps | 10 | `MAX_STEPS` in `run.js` | `agent.failed` with `step_limit`, status 504 |
| Tool calls | 12 | `maxCalls` in `createAgentContext` | Further non-`finish` calls return `ok: false` with the limit message |
| Probes | 8 | `maxProbes` | `probe_path` returns an error without fetching |
| Assets | 5 | `maxAssets` | `fetch_asset` returns an error without fetching |
| Tool time budget | 45 s | `maxDurationMs`, measured from context creation | Non-`finish` calls return "Time limit reached"; a call already running is not interrupted |
| Model call | 30 s | `AbortSignal.timeout(30_000)` in `provider.js` | `llm_timeout`, status 504 |
| Output tokens | 1500 | `max_tokens` in `provider.js` | Provider truncates the turn; a turn without a tool call consumes a step |
| Concurrent runs | 2 per instance | `MAX_CONCURRENT` in `api/agent/scan.js` | 429 `agent_busy` with `retry-after: 5` |
| DNS call | 4 s | `withTimeout` in `tools.js` | `dns_timeout` |
| HTTP request | 8 s wall clock | `REQUEST_TIMEOUT_MS` in `collect.js` | `timeout`; the socket is destroyed, so a drip cannot hold it open |
| Request body | 8 KiB | `readJsonBody` | 413 `body_too_large` |

The 45-second budget is elapsed wall time since the run started, not time spent
inside tools, so slow model turns eat into it. `finish` is exempt from the call
and time checks, so the model can still submit after either limit is reached â€”
provided a step remains.

A run that exhausts the step limit without finishing has no partial result: no
`finding` events are emitted, and the browser shows `agent.failed` /
`step_limit` with the hint "The agent hit its step limit. Run it again to
continue."

## 4. Configuration

`agentConfig()` in `api/_lib/agent/provider.js` reads three variables:

| Variable | Required | Default | Use |
| --- | --- | --- | --- |
| `LLM_BASE_URL` | No | `https://api.openai.com/v1` | Base URL; trailing slashes are stripped, then `/chat/completions` is appended |
| `LLM_API_KEY` | Yes | â€” | Sent as `Authorization: Bearer â€¦` |
| `LLM_MODEL` | Yes | â€” | Sent as `model` in the request body and shown in `agent.assigned` |

`isAgentConfigured()` returns true only when both the key and the model are
non-empty. The base URL may be any OpenAI-compatible chat-completions endpoint
that supports function/tool calling â€” the client uses nothing else from the
provider API.

### Local development

Create `.env.local` in the repository root (already covered by `.env.*` in
`.gitignore`):

```dotenv
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
# LLM_BASE_URL=https://api.openai.com/v1
```

`npm run dev` runs Vite, so the variables must actually reach the Node process
that loads `api/agent/scan.js`. Vite loads `.env` files for its own
`import.meta.env` and does not populate `process.env` from them, so pass the file
to Node explicitly (Node 20.6 or newer, which the project already requires):

```bash
# bash / zsh
node --env-file=.env.local node_modules/vite/bin/vite.js
```

```powershell
# PowerShell
node --env-file=.env.local node_modules/vite/bin/vite.js
```

Or set them in the shell before starting the dev server:

```powershell
$env:LLM_API_KEY = "sk-..."
$env:LLM_MODEL   = "gpt-4o-mini"
npm run dev
```

```bash
export LLM_API_KEY=sk-...
export LLM_MODEL=gpt-4o-mini
npm run dev
```

`vite.config.js` mounts `/api/scan` and `/api/agent/scan` as dev middleware via
`server.ssrLoadModule`, so the handler runs inside the Vite process and reads
that process's environment. If a dev handler throws before sending headers, the
middleware returns `500` with `code: "dev_api_error"`.

### Vercel

Set the variables per environment (Production, Preview, Development) in
**Project â†’ Settings â†’ Environment Variables**, or with the CLI:

```bash
vercel env add LLM_API_KEY production
vercel env add LLM_MODEL production
vercel env add LLM_BASE_URL production   # only for a non-OpenAI endpoint
```

Changes apply to the next deployment, so redeploy after editing them. Do not
commit keys: `.gitignore` excludes `.env` and `.env.*` while allowing a committed
`.env.example` (no such file exists yet).

### Without a key

`POST /api/agent/scan` validates the URL, then returns:

```json
{
  "ok": false,
  "code": "agent_not_configured",
  "error": "The agent is not configured. Set LLM_API_KEY and LLM_MODEL in the environment."
}
```

with status `503` and no stream. The page reads `code` and `error` from that JSON,
shows the message with the hint "Add LLM_API_KEY and LLM_MODEL to the
environment, then restart the server", and prints:

```text
LLM_API_KEY=sk-...
LLM_MODEL=your-model
LLM_BASE_URL=https://api.openai.com/v1  # optional
```

The rest of the page (URL form, tool list, safety note) remains usable; only the
run fails. No request is made to the model provider in this state, and no target
is contacted.

## 5. Evidence and validation

Evidence ids are opaque strings stored in a `Set` on the run context. Only tools
add to it, and only ids added during this run are valid.

| Source | Ids |
| --- | --- |
| `fetch_page` | `page`, `headers`, `tls`, `document`, `cookies`, `redirects` |
| `probe_path` | `probe:<path>` |
| `fetch_asset` | `asset:<finalUrl>` |
| `dns_lookup` | `dns:<TYPE>` |
| `finish` | none |

`finish` calls `validateFindings(findings, context.evidence)`, which checks each
finding and collects errors rather than throwing. The submission is
all-or-nothing:

- `findings` must be a non-empty array; entries beyond 8 are ignored;
- each finding needs `title`, a valid `severity`, `observation`, `impact` and
  `fix`;
- `evidence` must contain at least one string id; the first 5 are kept, but every
  supplied ref is checked;
- **every** cited id must exist in the set. An unknown id produces
  `findings[i] cites unknown evidence "â€¦"` and the whole submission is rejected,
  so no `finding` event is emitted and the model must retry.

The error message is returned to the model as a tool result, not to the browser;
the browser only sees `tool.result` with `ok: false` and the generic summary
`Invalid findings: â€¦` (truncated to the first 8 errors).

The completed event also returns `evidence`, the full array of ids issued during
the run, so a client can audit which facts existed even when a finding cites only
some of them.

### Redaction

`scanText()` in `bundle.js` scans text assets for secret-shaped strings and
returns pattern groups, never matches:

- provider keys (`sk_live_â€¦`, `sk-ant-â€¦`, `sk-â€¦`, `ghp_â€¦`, `AIzaâ€¦`,
  publisher keys, Supabase project URLs), sampled as the first 6 characters plus
  `â€¦[redacted]`, or fully redacted when the kind is high severity;
- JWTs, sampled as the first 8 characters (fully redacted when high severity),
  classified by decoding the payload: `role: service_role` is `high`,
  `role: anon` is `info`, anything else is `medium`;
- secret-like assignments, reported by variable name only
  (`embedded-secret`, sample is the name, not the value);
- database URLs with inline credentials, always
  `postgres://â€¦[redacted]`;
- source-map references, reported as a URL truncated to 80 characters and also
  returned separately as `sourceMapUrl`.

The same rule holds elsewhere: `probe_path` returns flags and picked headers but
not the body; `fetch_page` returns `documentSignals` rather than HTML. Header
values, titles, generator strings and script URLs still come from the site and
are therefore untrusted text, but no raw file body is placed in the model
context or the client stream.

## 6. Security posture

**Target validation.** `normaliseTarget()` accepts only HTTP(S), strips
fragments, rejects embedded credentials, and allows only ports 80 and 443. A bare
domain becomes `https://`.

**Address guard.** Every outbound request goes through `resolvePublicHost()` in
`api/_lib/guard.js`, which resolves all A/AAAA answers and rejects the hostname
if any is in a blocked range: RFC1918, loopback, link-local (including the
`169.254.169.254` metadata endpoint), CGNAT, benchmarking, documentation,
multicast and reserved IPv4 space; IPv6 loopback, unique-local, link-local,
multicast, documentation, NAT64 and IPv4-mapped ranges. `localhost`,
`.localhost`, `.local`, `.internal` and `.home.arpa` are refused by name. The
connection is then pinned to the first vetted address (`pinnedLookup`), so a
second DNS answer cannot redirect the socket after validation. Every redirect hop
re-checks the scheme, rejects ports other than 80 and 443, and resolves the host
again (maximum 5 hops).

**No command execution.** The tool surface is a closed `switch` over five names.
There is no shell, no `child_process`, no file access and no write method: the
collector issues plain `GET` requests with a fixed user agent. Anything the model
asks for outside the five tools returns an unknown-tool error.

**Caps.** Probe, asset, call, step, time and body-size caps (section 3) bound the
work any single run can cause, regardless of what the model requests.

**Prompt injection.** Tool output is data. The system prompt says so, `fetch_page`
returns a `note` saying so, and each tool message is prefixed with an explicit
`UNTRUSTED TOOL OUTPUT` envelope. Every string is capped at 300 characters and
every array at 40 entries before it enters the prompt, so a page cannot inject
hundreds of kilobytes of instructions through a `<script src>` value. This
reduces, but does not eliminate, injection: headers, page titles and script URLs
are still site-controlled text in the context, and the model can be influenced by
them. Validation limits what a finding can cite, not what it can say â€” a model can
cite `headers` and still describe it wrongly â€” so treat findings as model-written
prose anchored to captured evidence, not as verified facts.

**Origin confinement, precisely.** `fetch_asset` checks the origin before the
request and rejects an off-origin redirect before reading it. `probe_path`
rejects `//host` and backslash forms, resolves the path against the target, and
asserts the resulting origin equals the target before the request; its redirects
are held to the same origin. Both run under the address guard, so private and
reserved space stays blocked even if the origin check were bypassed.

## 7. Testing

```bash
npm run test:api      # unit assertions, offline, no server
npm run test:collect  # collector helpers + guard rejection, offline
npm run test:agent    # mock model + dev server + Playwright, no API key
npm run test:live     # real collector against example.com, needs a dev server
```

**`npm run test:api`** runs `scripts/test-api.mjs` with `node:assert/strict`. It
has no network dependency and no server: it checks IP classification and target
normalisation, hostname resolution refusals, the 12 derived checks, every
`scanText` redaction and classification case, and `validateFindings` acceptance
and rejection (including an unknown evidence id). It prints one line per
assertion and exits non-zero on failure. It never calls the model.

**`npm run test:collect`** runs `scripts/test-collect.mjs`, offline. It covers
`documentSignals` (title, generator, script/style resolution and deduplication,
source maps, mixed content, debug signals, password inputs), cookie and header
summarisation, `probePath` argument validation, and the guard's refusal of a
loopback origin for both `fetchWithRedirects` and `probePath`. A local HTTP server
asserts it received zero connections.

**`npm run test:agent`** runs `scripts/test-agent.mjs`, which is self-contained:

1. starts `scripts/mock-llm.mjs` on `127.0.0.1:5199` (`MOCK_LLM_PORT`);
2. starts `vite --port 5180 --strictPort` (`AGENT_TEST_PORT`) with
   `LLM_BASE_URL=http://127.0.0.1:5199/v1`, `LLM_API_KEY=test-key`,
   `LLM_MODEL=mock-1`;
3. launches Playwright (channel from `PW_CHANNEL`, default `msedge` on Windows),
   opens `/scan/agent`, submits `example.com`, and waits for `/Agent finished/`;
4. asserts the transcript contains the assigned agent, `fetch_page`,
   `probe_path /.env`, `probe_path /.git/config`, `fetch_asset`, `dns_lookup TXT`,
   the expected finding titles, the summary and the evidence note, and that at
   least three finding cards rendered;
5. repeats the run through `/scan/agent?url=â€¦` at 390Ã—844 and asserts no
   horizontal overflow;
6. writes `.smoke/20-agent.png` and `.smoke/21-agent-mobile.png` (`SMOKE_OUT`);
7. kills both child processes (`taskkill /T /F` on Windows, `SIGTERM`
   elsewhere).

No model key is needed because the mock endpoint is scripted. The collector is
real, so the test still needs network access to `example.com`. The mock is
turn-based: turn 0 calls `fetch_page`, turn 1 probes `/.env` and `/.git/config`,
turn 2 fetches the origin as an asset, turn 3 resolves `TXT`, and every later
turn calls `finish` with findings derived from the actual tool results (missing
HSTS, missing CSP, a `Server` header, missing DMARC). It reports fixed usage
(800 prompt / 120 completion tokens per turn). It exists only for tests; it is
not used by the app.

**`npm run test:live`** runs `scripts/test-live.mjs` against `/scan/live`, the
collector without an agent. It needs network access and an already-running dev
server (`BASE_URL`, default `http://localhost:5173`); the script does not start
one. It asserts the 12 derived checks, TLS and Cloudflare evidence, the mobile
layout, and that a loopback target is refused. It does not exercise the agent
endpoint or the model.

## 8. Known limits and next steps

Limits that exist today:

- **No persistence by default on serverless.** Runs are stored, but the default
  file store lives on the instance's filesystem, so a run is not shared between
  instances and does not survive a cold start. Set `DATABASE_URL` (and
  `npm install pg`) to use the Postgres store before a public launch.
- **No accounts, no global rate limiting.** The session is an anonymous cookie,
  not an identity, and there is no ownership check unless
  `REQUIRE_OWNERSHIP=1`. `content-type: application/json` forces a CORS
  preflight and a per-instance concurrency cap of two stops one instance being
  pinned, but there is no shared limiter, per-client quota or abuse control.
  Those are launch blockers.
- **One agent, one version.** The registry is a single hard-coded entry; nothing
  routes between agents or pins a version per request.
- **No headless rendering.** The collector performs plain HTTP `GET`s and does
  not execute JavaScript, so client-rendered content, browser-only headers and
  runtime-injected bundles are invisible.
- **One vantage point.** Every request originates from the server running the
  function (locally or one Vercel region), so CDN, WAF and geo behaviour seen
  from that address may differ from a user's.
- **Shallow surface.** One document, up to 8 paths and 5 assets; no crawling,
  fuzzing, authentication attempts or exploitation.
- **60-second ceiling.** `vercel.json` sets `maxDuration: 60` for
  `api/agent/scan.js` (and 30 for `api/scan.js`). The 45-second tool budget fits,
  but ten model turns at a 30-second timeout do not: a slow provider can be cut
  off by the platform mid-stream, before `agent.failed` is written. Long runs
  cannot be resumed.
- **Model is environmental.** `LLM_MODEL` is read at run time, so a registry
  version does not pin provider behaviour or sampling.
- **DNS is hostname-only.** `dns_lookup` queries the current hostname; DMARC is
  therefore only detected if `v=DMARC1` is published on that name, not at
  `_dmarc.<host>`. Records are truncated to 20 entries and 300 characters each.
- **Probe origin is enforced, but no fuzzing.** `probe_path` refuses `//host`,
  backslashes and any resolved origin other than the target, and its redirects
  are origin- and port-checked. The remaining limit is budgetary: eight chosen
  paths, no wordlist.
- **Evidence ids are conditional, not field-level.** `fetch_page` issues `tls`,
  `cookies` and `redirects` only when that data exists, so a finding cannot cite
  a certificate that was not returned. An id still proves a tool ran, not that the
  model read the field correctly.
- **Token counts are provider-reported** and are not validated; a provider that
  omits `usage` yields zeroes.
- **Rejected tool calls still cost.** A refused probe, a skipped non-text asset
  and an invalid `finish` all consume a call, a quota slot or a step.

Natural next steps: persist runs and findings behind a run id (the finished
report already promises "persistence, re-runs against newer agent versions and
report links" next), add a queue and per-client rate limits, put auth and
ownership verification in front of the endpoint, support multiple registry
entries with explicit version selection, add a headless renderer behind the same
guard, and collect from more than one region.

## 9. Adding a new tool

A tool touches four places. Everything else (event stream, call cap, time
budget, evidence validation, UI transcript) follows automatically.

**1. Schema â€” `api/_lib/agent/tools.js`, `TOOL_SPECS`.** Add an OpenAI function
schema with `additionalProperties: false`. This is what the model sees; prose in
the description is the only guidance it gets.

```js
{
  type: 'function',
  function: {
    name: 'robots_summary',
    description:
      'Summarise /robots.txt: whether it disallows everything, and how many rules it lists. Maximum one call.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
}
```

**2. Executor â€” the `switch` in `executeTool`.** Add a `case`, do the work,
issue a stable evidence id, and return a small derived result. Respect
`context.origin` / `context.hostname`, and add your own counter to
`createAgentContext` if the tool needs a per-tool quota. The global 12-call cap
and 45-second budget already apply.

```js
case 'robots_summary': {
  const probe = await probePath(context.origin, '/robots.txt')
  const evidenceId = 'robots'
  context.evidence.add(evidenceId)

  return {
    ok: true,
    evidence: [evidenceId],
    status: probe.status,
    disallowsAll: /disallow:\s*\/\s*$/im.test(probe.body),
    ruleCount: (probe.body.match(/^(allow|disallow):/gim) ?? []).length,
  }
}
```

Follow the existing id convention: bare names for page-level facts (`page`,
`headers`), and a prefix that names the source for anything scoped
(`probe:<path>`, `asset:<url>`, `dns:<TYPE>`, `robots`). Never reuse an id for
different content within one run, and never return the raw body.

**3. Summary helpers â€” same file.** `summarizeToolCall` produces the `argument`
shown after `> tool_name`; `summarizeToolResult` produces the one-line
`tool.result` summary and is also used for failures.

```js
export function summarizeToolCall(name, args) {
  switch (name) {
    case 'robots_summary':
      return ''
    // â€¦
  }
}

export function summarizeToolResult(name, result) {
  if (result.ok === false) return result.error ?? 'failed'

  switch (name) {
    case 'robots_summary':
      return `${result.status} Â· ${result.ruleCount} rule(s)`
    // â€¦
  }
}
```

**4. Registry â€” `api/_lib/agent/registry.js`.** Add the name to the `tools` array
in `describeAgent()` so `agent.assigned` advertises it, and add the new evidence
id to the example list in `SYSTEM_PROMPT` so the model knows it exists. Bump
`version` when the prompt or tool surface changes.

Finally, add a unit assertion for the new evidence id or classifier to
`scripts/test-api.mjs`, and extend the scripted turns in `scripts/mock-llm.mjs`
if `npm run test:agent` should cover the new tool. Both are optional for the
feature to work, but they are the cheapest place to catch a regression.

## 10. Runs, the queue and ownership

### The run record

```js
{
  id: 'run_1a2b3c4d5e6f',
  sessionHash: 'sha256 of the session id',
  target: 'https://example.com/',
  agent: { id: 'web-auditor', version: 1, name: 'Web Auditor', model: 'â€¦' },
  status: 'queued' | 'running' | 'completed' | 'failed',
  createdAt, updatedAt, completedAt,
  summary: 'string' | null,
  findings: [ â€¦ ],
  usage: { inputTokens, outputTokens } | null,
  steps: 5 | null,
  error: { code, message } | null,
  events: [ â€¦ ],
  ownership: { verified: false, method: null, verifiedAt: null },
}
```

A run is created when a scan starts, not when it finishes, so an interrupted
run still has a record. Every streamed event is written to the run as it
happens, and the transcript in the report page is the same list the browser
saw.

### Reading runs

| Request | Response |
| --- | --- |
| `GET /api/agent/runs` | `{ ok: true, runs: [ { id, target, status, createdAt, completedAt, findingCount, severityCounts } ] }` for the current session |
| `GET /api/agent/runs?id=<runId>` | `{ ok: true, run: { â€¦ } }` with the findings and the transcript |

A run id on its own is not a key. The endpoint compares the session hash of the
caller with the one stored on the run, and a mismatch is reported as
`404 not_found` rather than `403`, so an id cannot be probed for existence.

### The queue

`POST /api/agent/scan` with `{ "url": "â€¦", "async": true }` creates a queued run
and returns `202 { ok: true, runId, status: 'queued' }` without streaming
anything. `POST /api/agent/worker` (or `GET`, so a platform cron can call it)
claims one queued job, runs the agent with the same tools and the same limits,
and writes the result back to the run. The worker is a pull model on purpose: a
push queue can replace it without changing the run API.

The default path stays synchronous and streaming. The queue exists so a long
scan does not have to hold a browser connection open for its whole life.

### Sessions

There is no account. The server issues an anonymous `wa_sid` cookie, signed with
`SESSION_SECRET` when that variable is set. Without it the secret is random per
process, which is fine locally but means a challenge issued by one instance
cannot be checked by another. **Set `SESSION_SECRET` in production.** Only the
SHA-256 hash of the session id is stored, and it is what scopes a run to the
browser that created it.

### Ownership

`REQUIRE_OWNERSHIP=1` makes the server refuse to scan a domain the session has
not proved it controls. The proof is stateless: the server issues a token that
carries its own signature, and the site owner publishes it either as a file at
`/.well-known/webauditors-verification` or as a TXT record at
`_webauditors.<hostname>`. The server then checks the site for that token.

The check is deliberately outside the agent: the agent's tools never read the
verification file, and a run cannot be authorised by anything the model says.
A verified domain is remembered per session and per target, so proving one
domain never authorises another.

Ownership is optional in the prototype and enforced in production. The page
always offers the check, so the flow can be demonstrated, but the server only
demands it when `REQUIRE_OWNERSHIP=1`.

### The pages

- `/scan/agent` runs a scan and streams the transcript. The finished page links
  to the stored report.
- `/reports/agent/<runId>` is the durable report: the summary, the findings with
  their evidence chips, and the transcript as a collapsible list.
- `/runs` lists the runs of the current session.

Every string on those pages came from a language model, so they are rendered as
React text. There is no `dangerouslySetInnerHTML` anywhere in the run views.

### Testing this layer

```bash
npm run test:store      # the store, the repository and the queue, offline
npm run test:auth       # signed cookies and challenge tokens, offline
npm run test:ownership  # the gate end to end, with its own server
```
