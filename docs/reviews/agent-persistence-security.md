# Agent persistence, session, queue and ownership review

Scope: the store, the session/ownership libs, the four `api/agent/*` endpoints, the run pages and `src/lib/runs.js`. Read-only.

**No Critical findings.** I could not forge, fixate or replay a session, read another session's run, or satisfy the ownership gate without control of the target. The High items are cost, store integrity and queue liveness.

## High

**H1. The queued path is an unbounded, unauthenticated spend lever.** `api/agent/scan.js:163-181` returns 202 *before* the `MAX_CONCURRENT` check at `:183`, so queued runs are uncapped. `api/agent/worker.js:20-52` is unauthenticated, accepts GET, and each call runs a full agent scan. *Fix:* semaphore on the queue, per-session quota, authenticate the worker, prune jobs.

**H2. Every event rewrites the whole store; nothing is pruned.** `api/_lib/store/file.js:108-120` persists on each event and `persist()` (`:42-60`) rewrites the whole file. N runs make every write O(N) and the total O(N^2). `state.runs`/`state.jobs` (`:17`) are never trimmed. *Fix:* per-run event log, batched writes, retention.

**H3. A corrupt store wipes every run.** `api/_lib/store/file.js:21-37` sets `loaded = true` *before* `JSON.parse`; a parse error is rethrown, but the store now counts as loaded with the empty default, so the next write persists an empty store. The temp name is fixed (`:46`), so two processes interleave. *Fix:* set `loaded` only after a good parse, back up a corrupt file, unique temp name.

**H4. The gate and the session secret are both opt-in.** `api/agent/scan.js:37` enforces ownership only when `REQUIRE_OWNERSHIP=1`; `api/_lib/auth.js:13,19-22` falls back to a per-process secret. A deployment missing either allows anonymous scanning of any third-party domain; on serverless the rotating secret mints a session per request, so challenges never verify and `/runs` is empty. *Fix:* require both in production, fail fast at boot.

**H5. A killed worker strands the run forever.** `api/_lib/store/file.js:141-158` sets `status:'running'` with no lease and nothing reaps it. `vercel.json:11` caps the worker at 60s while a run can take longer, so the function is killed mid-run: job and run stay `running` forever and the report page polls until it times out. The file store's claim is not atomic across processes, so two workers can run one job. *Fix:* claim lease + requeue, `for update skip locked` (`api/_lib/store/postgres.js:157-186`) or a lock file, longer `maxDuration`.

## Medium

- **M1. Ownership is keyed on the URL, not the domain.** `api/_lib/runs.js:104-106` keys on the href, but `api/agent/ownership.js:65,83` uses the origin, and verify records nothing. A proven domain must be re-proved per path, so "remembered per domain" is false - fail-closed, but the gate looks broken. *Fix:* key on the hostname, record on verify.
- **M2. The token binds the hostname only.** `api/_lib/ownership.js:66,195` - a token issued for `https://example.com` also authorises `http://example.com`, and the file check then fetches over plain HTTP (`:207-212`), so an on-path attacker can satisfy it. *Fix:* bind the origin.
- **M3. A recorded ownership never expires.** `api/_lib/runs.js:108-118` stores `verifiedAt`; `api/agent/scan.js:31-35` never checks it, so one proof authorises that URL for a 180-day cookie (`api/_lib/auth.js:8`). *Fix:* carry the token expiry into the record.
- **M4. Plain-object maps turn an odd id into a 500.** `api/_lib/store/file.js:92-96` - `state.runs['constructor']` is the inherited `Object`, `structuredClone` throws, and `api/agent/runs.js:73-84` answers `runs_unavailable`; `?id=__proto__` leaks the prototype. *Fix:* `Object.create(null)`/`Map`, `Object.hasOwn`.
- **M5. `activeRuns` leaks.** `api/agent/scan.js:197` increments before `createRun`; the `finally` (`:273`) only wraps the agent call, so two store failures make the endpoint return 429 forever. *Fix:* increment inside the try.
- **M6. Write failures are swallowed.** `api/_lib/store/file.js:55-57` catches and logs, so the API reports success for a run that was never persisted. *Fix:* rethrow, or flag the run unpersisted.

## Low

- `api/_lib/auth.js:24-31,96-109`: the signed cookie carries no expiry and is never rotated, so a captured cookie replays forever. Add an expiry to the payload and the `__Host-` prefix.
- `api/agent/runs.js:26`: the read endpoint never sets the cookie, so a session that has not scanned has none and `/runs` is empty.
- `api/agent/scan.js:216-220`: once the client disconnects, `closed` stops the store append too, truncating the transcript.
- `api/agent/ownership.js:12-92`: an unauthenticated fetch oracle - the server GETs any public host's well-known path and returns the response class (`api/_lib/ownership.js:123-147`). Rate limit, answer uniformly.

## Verified safe

- **Forgery/fixation:** HMAC-SHA256, timing-safe compare, shape check (`api/_lib/auth.js:17,33-56`); a planted cookie is discarded and a fresh id minted (`:83-94`). `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- **Cross-session reads:** `api/agent/runs.js:34` compares the stored hash and answers 404, so an id cannot be probed; the hash is stripped (`:47`).
- **Ownership token:** `nonce|expiry|sessionHash|hostname` is signed (`api/_lib/ownership.js:194-196`); tampered, expired and other-session tokens are rejected before any request leaves the server (`:199-205`).
- **The model cannot grant ownership:** the check is a server-side file/DNS fetch; the tools never read the verification file.
- **The gate covers the queued path** (`api/agent/scan.js:143-160` precedes the async branch); only server env toggles it.
- **No prototype pollution or traversal:** `__proto__` from `JSON.parse` stays an own property, spread copies rather than assigns, ownership keys carry the session hash, ids are server-generated hex.
- **Bounded per run:** events capped at 400 (`api/_lib/store/file.js:114`); findings capped upstream.
- **XSS:** model-written strings are React text; no `dangerouslySetInnerHTML`/`innerHTML` in `src/`.

## Must fix before launch

1. Enforce ownership and a fixed `SESSION_SECRET`; fail fast at boot (H4).
2. Authenticate the worker; quota the queue; cap concurrent runs (H1).
3. Bound the store: event log, retention, corruption recovery, visible write errors (H2, H3, M6).
4. Lease and reap claims; give the worker enough duration (H5).
5. Key ownership on the hostname, record on verify, expire it (M1-M3).

## Remediation status

Fixed in the same change set:

- **H1** — the queued path is bounded: at most five runs may wait, and the sixth is refused with `429 queue_full`. The worker requires `WORKER_SECRET` through the `x-worker-secret` header when that variable is set, and the store prunes finished jobs.
- **H2** — the file store coalesces writes (a burst of events becomes one write), keeps the last 200 runs and 50 jobs, and caps a run's events at 400.
- **H3** — a store file that cannot be parsed is kept as `store.json.corrupt-<timestamp>` instead of being replaced by an empty store, and the temporary file name is unique per process.
- **H4** — the signing secret is generated once and kept in the store when `SESSION_SECRET` is unset, so instances share it; the ownership gate is on by default in production and `REQUIRE_OWNERSHIP=0` turns it off explicitly.
- **H5** — a job carries a two-minute lease, an expired lease is reclaimed, and runs that have not moved for fifteen minutes are closed as `timeout`.
- **M1/M2** — ownership is keyed on the hostname, so one proof covers the domain; the token is bound to the origin, so a proof for `https://example.com` cannot authorise `http://example.com`.
- **M3** — a recorded proof expires after seven days, and an expired proof authorises nothing.
- **M4** — the store keeps null-prototype maps and checks `Object.hasOwn`, so `?id=constructor` is a missing run (`404`) rather than a crash.
- **M5** — the concurrency counter is released when the run cannot be stored, so a store failure no longer leaves the endpoint answering `429` for ever.
- **M6** — a failed write is reported to the caller instead of being swallowed.
- **Low** — the cookie carries its own expiry and is issued with the `__Host-` prefix in production; the runs endpoint sets the session cookie, so a session that has not scanned yet still has one.

Still open before public launch: real accounts, a shared rate limiter, a shared store, and a per-client quota.
