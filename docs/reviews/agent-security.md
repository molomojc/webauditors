# Agent layer security review

Scope: `api/_lib/agent/*`, `api/agent/scan.js`, reused `guard.js` and `collect.js`. Read-only review, no code changed.

**No Critical findings.** The private-IP/metadata guard holds on every fetch path I could construct; the High items are origin/port escape and cost/injection, not internal-network reach.

## High

**H1. `probe_path` escapes the target origin via `//host`.**
`api/_lib/agent/tools.js:342-348` only checks `path.startsWith('/')`; `api/_lib/collect.js:328` then does `new URL(requestPath, origin)`. A path of `//evil.com:22/x` (or `/\evil.com/x`, since WHATWG URL normalises backslash) becomes `https://evil.com:22/x`. Verified in Node: `new URL('//evil.com:22/x','https://target.example')` → origin `https://evil.com:22`. The agent can probe `//attacker.tld:6379/x` and the server fetches it, labelled `probe://attacker.tld:6379/x`. `resolvePublicHost` still blocks private space, so this is third-party fetch + port scanning, not internal SSRF — but it breaks the "target origin only" guarantee.
Fix: reject `startsWith('//')` and backslashes in `probePath`, then assert `new URL(path, origin).origin === origin`.

**H2. Redirect hops never re-check the port.**
`api/_lib/collect.js:184-206` validates scheme and resolves the host per hop but not the port, so the 80/443 rule from `guard.js:176-184` applies only to the entry URL. A target that 302s to `http://203.0.113.9:6379/` makes the collector speak HTTP to that port; with H1 the model can pick it directly. Byte counts and timings come back, so this is a usable probe primitive.
Fix: reject redirect ports other than 80/443 (or the origin port), as `normaliseTarget` does.

**H3. Unbounded site-controlled strings in tool output (prompt injection + token blowup).**
`api/_lib/collect.js:246-252` returns full URLs for `scriptSrcs`/`stylesheetHrefs`/`sourceMapUrl` with no length cap, and `tools.js:317-331` passes them (plus ~16KB header values and 5 redirect URLs) straight into the model. A 256KB body of `<script src="data:text/plain,IGNORE PREVIOUS INSTRUCTIONS…">` injects ~256KB of attacker text per `fetch_page`; 12 calls ≈ 3MB of prompt. `bundle.js:136` also returns `sourceMapUrl` untruncated.
Fix: cap every URL/header/redirect string to ~300 chars at the collector boundary, cap each serialized tool result to ~16KB, and wrap tool messages in an explicit untrusted-data envelope.

**H4. Unauthenticated, unthrottled, uncapped spend.**
`api/agent/scan.js:6` has no auth, CSRF check, per-IP limit or concurrency limit; each request drives up to 10 chat completions (`run.js:11`) with no `max_tokens` (`provider.js:50-56`). A loop of POSTs is an unbounded bill and pins concurrency. `readJsonBody` also accepts a `text/plain` JSON body, so a cross-site fetch can trigger runs.
Fix: require product auth, add per-IP + global rate limits and a concurrency semaphore, set `max_tokens`.

## Medium

**M1. Evidence ids issued for data that does not exist.** `tools.js:307-315` adds `tls`, `cookies`, `redirects` after every `fetch_page` even for plain HTTP (no `tls`), zero cookies, no redirects. `validateFindings` (`tools.js:170`) only checks set membership, so "certificate expires in 3 days", citing `tls`, validates on an HTTP-only site. Fix: issue ids conditionally and cite the field digest, not just an id.

**M2. Evidence crosses origins silently.** `probe_path` (`tools.js:348-350`) adds `probe:<path>` even when `redirectedTo` is another host, so a finding claims target content that came from a third party. `fetch_asset` (`tools.js:386-391`) performs the off-origin fetch before rejecting it. Fix: reject off-origin redirects in the collector when a `sameOrigin` flag is set; omit the evidence id on rejection.

**M3. Idle-only timeout, abort not propagated.** `collect.js:157` uses `request.setTimeout` (socket idle), so a 1-byte/7s drip holds a connection ~forever; `TOTAL_BUDGET_MS` is checked only after the fetch returns (`collect.js:295`). `run.js:90` never passes `signal` into `executeTool`, so client disconnect leaves the fetch and one more LLM call running. Fix: total deadline per call that destroys the socket, and thread `signal` through `requestOnce`.

**M4. Provider error bodies logged.** `provider.js:74` writes 500 chars of the provider response to logs; gateways commonly echo request messages there, i.e. site content and prompt text. Fix: log status + error `code` only.

**M5. Duplicate finding ids.** `tools.js:183` slugs the title, so identical titles collide in the stream and in storage. Fix: suffix the index.

## Low

- `scan.js:85` streams `error.message` for non-`AgentError` 5xx. Return a generic message, log the real one.
- `scan.js:58` ignores `response.write()` backpressure; events are small, but check the return and pause.
- `scan.js:22` never resolves the target, so `http://127.0.0.1` is accepted and burns an LLM turn before `fetch_page` rejects it. Call `resolvePublicHost` before streaming.
- `bundle.js:54-57` keeps 6 chars by design (`sk_liv…`); use keep=0 for high-severity kinds.
- Findings are model-written; the UI must escape, not `innerHTML`, them.

## Verified safe

- **Private/metadata reach:** every hop resolves through `resolvePublicHost` (`collect.js:169`) with RFC1918, loopback, link-local/169.254, CGNAT, multicast, ULA and `::ffff:0:0/96` blocked; decimal/octal/hex IPv4 normalise to dotted quads and are caught.
- **DNS rebinding:** the validated address is pinned via `pinnedLookup` (`collect.js:30-44`), so a second DNS answer cannot redirect the socket, and all returned addresses are checked, not just the first.
- **Scheme/credential abuse:** only `http:`/`https:` at entry (`guard.js:145-166`) and per redirect (`collect.js:197`); `file:`, `gopher:`, `data:` rejected; URL credentials stripped and rejected at entry.
- **Secret handling:** `bundle.js` returns kind/severity/count and a redacted prefix only; `EMBEDDED_SECRET` captures the key *name*; `DATABASE_URL` is fully masked; JWT issuer text is capped at 40 chars. Probe bodies (`collect.js:338`) reach only `classifyProbe`, which extracts env key *names* — never the body or values. No raw secret appeared in any NDJSON event I traced.
- **Evidence forgery:** `context.evidence` is a server-owned `Set`; the model cannot add ids, and `finish` rejects unknown refs. Ids are added only after the awaited call succeeds.
- **Loop bounds:** `MAX_STEPS` 10, `maxCalls` 12, probes 8, assets 5, findings 8, DNS records 20×300 chars.
- **Stream integrity:** every event is `JSON.stringify`+`\n`, so site text cannot inject NDJSON frames; `cache-control: no-store` is set.

## Acceptable for prototype, must fix before launch

H1/H2 (origin+port enforcement), H4 (auth, rate limit, `max_tokens`), M3 (total deadline + abort), M4 (logging), M1 (conditional evidence). DNS TXT records are an accepted injection surface only because they are capped and labelled — keep the cap.

## Remediation status

Fixed in the same change set:

- **H1** — `probePath` now rejects `//host` and backslashes, resolves against the target and asserts the origin matches before fetching.
- **H2** — every redirect hop rejects ports other than 80/443; `fetchWithRedirects` accepts an `allowedOrigin` and probes/assets pass it.
- **H3 (mitigated)** — script/style/source-map URLs and header values are capped at the collector boundary (300/400 chars); every tool result is capped to 300-char strings and 40-entry arrays and prefixed with an `UNTRUSTED TOOL OUTPUT` envelope.
- **H4 (partial)** — `max_tokens: 1500`, JSON-only `content-type` (forces a CORS preflight), and a two-run per-instance concurrency cap with `429 agent_busy`. Auth, a shared rate limiter and ownership verification remain launch blockers.
- **M1** — `tls`, `cookies` and `redirects` evidence ids are issued only when that data exists.
- **M2** — off-origin probe/asset redirects are rejected before the body is read and before an evidence id is issued.
- **M3** — a wall-clock 8s deadline per request destroys the socket; the abort signal is threaded from the handler through the collector into every request.
- **M4** — provider error logging keeps the status and provider code, never the body.
- **M5** — finding ids are suffixed with their index.
- **Low** — non-`AgentError` messages are no longer streamed; the target host is resolved before the stream starts.

Still open before public launch: authentication, a shared rate limiter, ownership verification, run persistence, and a report page that renders model-written findings as text (never HTML).
