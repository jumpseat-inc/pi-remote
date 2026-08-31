---
id: EV-2
title: "Control-plane tunnel REST client"
state: In Review
owner: null
epic: EPIC-1
goal: tunnel.ts creates a tunnel via POST /tunnels using the enrollment credential, consumes the returned signed one-time wss URL, and deletes the tunnel via DELETE /tunnels/:id on teardown.
---

## Intent

Implements §7.2's client half of the contract in `src/tunnel.ts` — the only
code besides `transport.ts` that touches the network. It presents the
enrollment credential (from `/rc:login` provisioning, EV-7) as opaque, sends
session id, session name, cwd, and host metadata, and hands the signed
one-time `wss://` URL plus TTL to the transport (EV-3). User-visible surface —
none directly; this is host-side plumbing, but its failure copy (bad or expired
enrollment credential, control plane unreachable) surfaces in the `/rc`
command output and footer status, and those messages should name the fix (run
`/rc:login`).

## Acceptance

- With a valid enrollment credential, a tunnel create request returns a
  parseable `{ tunnelId, url, tokenTtl }` and the extension dials within the
  TTL.
- A second create while already connected is not issued — `/rc` stays
  idempotent (EV-8 relies on this).
- On teardown the extension issues DELETE for its tunnel id and discards all
  token state; the token is never persisted.
- An expired or rejected enrollment credential produces an error that names
  `/rc:login` as the remedy, not a raw HTTP trace.

---

## Step 1 — gate (facilitator)

State `Ready`. **Full council** (cross-seam: `src/tunnel.ts` is one of the two
network modules; it consumes the EV-7-provisioned enrollment credential and
hands the signed `wss://` URL + TTL to EV-3 transport; its failure copy
surfaces in EV-8's `/rc`/footer output; where the one-silent-refresh of spec §8
lives is un-pinned and genuinely ambiguous; 401 vs 403 vs expired vs
unreachable handling, idempotency mechanism, and token-discard timing are
design judgments). **Surface-touching** (failure and status copy name the fix
`run /rc:login`) — designer seated alongside owner and principal in steps 2–3.

---

## Step 2 — independent first pass (jobs 12.1 owner, 12.2 principal, 12.3 designer; dispatched in parallel, each with only the card + binding contract)

All three seats settled independently in ~5.2m each. Positions recorded verbatim below (abridged where noted).

### owner (job-12.1, verbatim)

> **Approach** — `tunnel.ts` is a pure REST client with injectable `fetch`/`now`, exposing `createTunnel(input)→{tunnelId,url,tokenTtl,refreshed}` and `deleteTunnel(tunnelId)`, plus a single `TunnelError` discriminated by `kind`. It owns the active-tunnel flag so a second create while connected is a return-existing no-op (this is the idempotency mechanism EV-8 relies on). It runs the one-silent-refresh *mechanism* against the discovered `token_endpoint` before `POST /tunnels` when the access token is expired, and it routes every auth-class failure through one formatter that names `/rc:login` — while never persisting any token and dropping the in-memory tunnel-token reference the instant the url is handed to EV-3's transport.
>
> **Tradeoffs accepted** — (a) Refresh: split mechanism (in tunnel.ts, per §3 "token exchange" scope) from policy + footer-state mapping (in EV-8), surfaced via the `refreshed` flag; widens the client contract slightly to keep the `/rc:login` seam and "exactly one refresh per /rc" guard testable in one place. (b) Idempotency as return-existing rather than a hard throw. (c) DELETE is best-effort on the wire (never blocks `session_shutdown`), accepting a possibly leaked dead tunnel bounded by §7.4 TTL/revocation. (d) "the token is never persisted" = the **tunnel token**, not the enrollment credential — discarding the enrollment credential on teardown would force re-`/rc:login` every session and contradict §7.2 settings persistence; flagged this reading explicitly.
>
> **Testable claims** (injected mock `fetch`, no real control plane): Create success (parsed fields, Bearer header, body fields); Idempotency (second create fires zero POST and returns same tunnelId); 401 → `kind==="unauthenticated"` msg contains `/rc:login`, no raw leak; Expired+refresh (past tokenExpiry + valid refresh → exactly one grant call then one POST, `refreshed===true`); Refresh fails (400 → `kind==="expired"` naming `/rc:login`, no POST); Unreachable (fetch TypeError → `kind==="unreachable"`, names URL/network, does NOT contain `/rc:login`); Delete+discard (one DELETE, then active===null and a persist spy never called); Discovery cached (two creates on same serverUrl fetch discovery once).
>
> **Open questions for other seats:** whether EV-8 wants return-existing or an explicit "already connected" signal; whether best-effort DELETE (drops state under network failure) is acceptable vs retry/queue; confirmation that `POST /tunnels` stays a fixed path (discovery carries no tunnels endpoint today) rather than later becoming discovered.

### principal (job-12.2, verbatim)

> **Seam reading** — No `src/tunnel.ts` yet; contract lives in PI-SPEC + EV-1 rulings. §3 (PI-SPEC:74) "transport.ts is the only module that touches the network" contradicts the same §3 listing `tunnel.ts` as "control-plane REST client." The card Step-1 gate overrides §3; EV-1 pinned direction (`grep fetch( src/transport.ts` empty). **Settle: tunnel.ts = HTTP/fetch only; transport.ts = WebSocket only.** Clean boundary = three non-overlapping surfaces: tunnel.ts owns bytes-over-HTTPS + runtime validation of the three response fields; EV-8 owns when-to-call, one-refresh cap, no-op-when-connected; EV-3 owns the socket given a validated URL + absolute deadline. tunnel.ts never dials, never subscribes to pi events, keeps no module-level mutable state.
>
> **Blind spots** (each side can't see its neighbors): (a) §7.2 makes URL **single-use** (PI-SPEC:259–260) vs §6 transport "reconnects … rather than spawning a new tunnel" — reconnect loop reaches for a dead URL; re-arm on reconnect is a *third* thing (EV-8-level re-`createTunnel`), not owned by EV-2 or EV-3 alone. (b) §8 teardown "discards token state" reads "clear the settings," but EV-7's acceptance requires the provisioned credential to survive `/rc:off` and restart. Discard boundary: **tunnel grant (tunnelId + signed URL) is discarded; the enrollment credential (access/refresh/tokenExpiry) survives.** (c) Silent refresh during `/rc` is a **write path** — RFC refresh rotation can return a new refresh token and §7.2 says "the extension stores it"; EV-7 owns the keys but the write happens at `/rc` time. Seam = a persistence callback: tunnel.ts returns rotated tokens; EV-8 persists; EV-7 owns the key set.
>
> **Reframe** — (1) "Consumes" in the goal must mean "validates and hands off," not "dials." (2) "Token never persisted" = one-time tunnel token, not the enrollment credential; state the discard boundary so EV-8 doesn't clear settings on `/rc:off`. (3) Split silent refresh into mechanism vs policy: the HTTP call (`grant_type=refresh_token` at token_endpoint) is tunnel.ts's; the "at most once per /rc" cap is EV-8's. **Do not put auto-refresh-on-401 inside createTunnel** (would hide a second network call and make the one-refresh cap unobservable). tunnel.ts exposes `createTunnel`, `refreshAccessToken`, `deleteTunnel` as stateless request functions; EV-8 sequences: `ensureFresh` (≤1 refresh) → `createTunnel` → on 401, ≤1 refresh + ≤1 retry → hand `{url, expiresAt, tunnelId}` to EV-3.
>
> **Open questions for EV-3/EV-8:** (a) single-use-URL vs reconnect re-arm — who re-arms, does re-arm count as "spawning a new tunnel"; (b) whether 403 (valid credential lacking scope) names `/rc:login` as re-consent vs a different "contact the control-plane admin" remedy — acceptance says "rejected credential" names `/rc:login`; 403 is a *valid* credential lacking scope, should not be collapsed.
>
> **Testable claims** (in-repo fake CP via `Bun.serve`, no real server): (1) runtime validation (url not wss/http → typed error before dial; tokenTtl 0/neg/non-number → error); base URL is a function parameter — tunnel.ts reads no `process.env`/pi settings. (2) TTL absolute deadline at receipt: `expiresAt = now + tokenTtl*1000`; TTL 0 → dial refusal. (3) One silent refresh observed: expired-token `/rc` → exactly 1 refresh POST + 1 /tunnels POST; refresh failure → 0 /tunnels + error naming /rc:login; 401 on create with fresh token → ≤1 refresh + ≤1 retry, second 401 → /rc:login, no dial. (4) Error taxonomy: 401 unauthorized (names /rc:login), 403 forbidden (distinct copy, open Q), unreachable (contains serverUrl, not /rc:login), discovery-failed (contains serverUrl); no error string contains raw body or one-time URL. (5) Teardown idempotency+discard: one DELETE; second /rc:off no second DELETE; 404/410 treated success; network-failed DELETE swallowed, tunnelId cleared. (6) Capability hygiene: signed URL (`?token=…`) never in logs/errors/persisted settings. (7) Seam gates: `fetch(` empty in transport.ts; `WebSocket|wss://` empty in tunnel.ts; `PI_REMOTE_HOST_KEY` zero repo-wide; `process.env` empty in tunnel.ts. (8) EV-4 22-test suite stays green; tsc + bun test exit 0.

### designer (job-12.3, verbatim — abridged; full record retained)

> **Design position** — tunnel.ts's host-facing surface is a *vocabulary* consumed by index.ts (EV-8) and rendered through `ctx.ui.setStatus` footer + `/rc`/`/rc:off` command output. Job: define a closed set of **error reasons** and **lifecycle events**, pin for each a single fix-naming user string + a single footer transition. Seven states bind (off→not enrolled→authorizing→dialing→resyncing→live→error). tunnel.ts owns `dialing` (entered immediately after successful `POST /tunnels` parse, before transport takes over) and `error` (with reason, only for HTTP control-plane failures that block create/teardown — NOT transport failures, NOT not_enrolled/authorizing/resyncing/live/off). Emits reason phrase that follows `error`.
>
> **Gulf closed** — Gulf of Evaluation + Execution for the host user: a `/rc` returning to `error` with a reason reading "enrollment expired — run /rc:login" closes "what happened?" and "what do I do?" in one line; no raw HTTP trace.
>
> **Error type as vocabulary** — a closed set of reason codes, each → exactly one user string + one next command; mapping lives in tunnel.ts, rendering in index.ts. Proposed seven reason codes: `not_enrolled` (footer `not enrolled`), `enrollment_expired` (401 + no refresh / refresh failed → `error`), `enrollment_rejected` (403 valid-but-unauthorized → `error`), `control_plane_unreachable` (network/DNS/TCP/TLS → `error`), `server_error` (5xx → `error`), `teardown_failed` (non-2xx DELETE → no footer change; off proceeds), `already_live` (create while open → no state change). Designer proposed **Bahasa Indonesia copy** for each (flagged itself: "I am not a native speaker"; flags for native cold-read at skeptic/product-owner). English gloss in the right column for code review.
>
> **Principle and evidence** (six instruments): error type as vocabulary, footer FSM (exactly two transitions this card drives), idempotency as a **stated refusal** (return existing + emit `notified`/`already_live` line, not silent success), raw HTTP trace is a *log* decision not a copy decision (debug-level structured log allowed; no status/URL/body/stack in user strings), teardown is a courtesy not a precondition for `off` (DELETE failure must not block local teardown), remote observer can correlate state with behavior (same phrase across footer+/rc output+journal).
>
> **Falsifiable predictions** (10): 401→enrollment_expired + `setStatus("pi-remote","error","enrollment_expired")`; 403→enrollment_rejected with an *additional* remedy line (must NOT be identical to 401); TCP refused→control_plane_unreachable (no stack in line); 503→server_error distinct from unreachable; second create→zero HTTP + same tunnelId + notified/already_live + no footer transition; DELETE 500→teardown_failed but local tunnelId discarded and footer `off` (not `error`); a test must not require a real CP (binds 127.0.0.1, no env); pure seam (no `WebSocket(` in tunnel.ts, no `console.log` of body); Bahasa strings not English in disguise; the seven reason codes are the only reasons emitted (no `unknown`/`http_401` leaks).
>
> **Open design questions** — To owner: where does the reason→string rendering table live — tunnel.ts (owns vocabulary incl. language, keeps unit-testable without index.ts) vs index.ts (cleaner i18n)? Argues tunnel.ts. To principal: what's the footer-merge rule — "highest severity wins" (error>live, error>resyncing) vs "most recent wins"? Affects failure-then-recover testability. To product-owner: is the `already_live` line the product, or a single-char ack? (scope, not taste). To skeptic: mock server must be a real HTTP server not a mock of `fetch`; Bahasa needs native cold-read smoke.
>
> **Ranked-last preferences** (ungrounded taste): fixed-width muted style; error footer visually distinct from live; single consistent Bahasa politeness register. None of these is decisive.

---

## Step 3 — round 1 → convergence note

Convergences already recorded (all three, independently):
- **"Token never persisted" = the one-time tunnel token (tunnelId + signed URL); the enrollment credential survives teardown** and is persisted by EV-7 — do NOT clear settings on `/rc:off` (owner, principal, designer all state this).
- **Retain §3/Step-1 resolution: tunnel.ts = HTTP/fetch only; transport.ts = WebSocket only** (principal; owner/designer's designs imply it).
- **Copy/reason vocabulary lives in tunnel.ts** (strings co-located so they're unit-testable without index.ts) — owner's one-formatter + designer's reason-code map converge; EV-8 renders.
- **DELETE is best-effort; teardown never blocks on it** (owner open Q answered by designer+principal).
- **Discovery per serverUrl, endpoints not hardcoded; refresh = grant_type=refresh_token at token_endpoint, no separate /refresh.**

Divergences to resolve in round 2:
1. **Refresh shape** — owner: tunnel.ts runs the refresh mechanism *inside* createTunnel when tokenExpiry passed, `refreshed` flag. principal: expose `refreshAccessToken` as a separate stateless function; EV-8 sequences ensureFresh→create→(on 401) ≤1 refresh+retry; **rejects auto-refresh-on-401 inside createTunnel**. Both accept "one silent refresh at /rc time."
2. **Who calls setStatus** — designer: tunnel.ts calls setStatus directly for `dialing`/`error`. owner/principal: tunnel.ts returns typed data/errors; EV-8 owns rendering (tunnel.ts keeps no UI/session wiring). (Reconcilable: vocabulary in tunnel.ts, render call in EV-8.)
3. **403 copy** — principal+designer: 403 (valid credential, lacks scope) is distinct from 401 and should not be collapsed; designer adds an extra "contact admin" remedy but card acceptance still requires /rc:login to be named. Whether 403 names /rc:login only, or adds an admin line.
4. **Copy language** — designer proposed ungrounded Bahasa Indonesia strings (self-flagged non-native); no Bahasa requirement exists in PI-SPEC or the card; spec/code/README are English. English is the natural default but this is a user-visible copy judgment → likely open-judgment for product-owner.
5. **Single-use URL vs reconnect re-arm** (principal) — who re-arms the dead URL on EV-3 reconnect; likely a seam for EV-3/EV-8 or a follow-up, not EV-2 scope.
6. **`already_live` line vs single-char ack** copy (designer→product-owner, scope).


## Step 3 — round 2 (jobs 12.4 owner, 12.5 principal, 12.6 designer)

All three settled in ~3.5m. Positions converged on architecture; remaining splits are open-judgment. Recorded verbatim above (full text in this file); the decisive outcomes:

**Converged (all three, round 2):**
- **tunnel.ts = pure, STATELESS REST client.** Exposes three stateless request functions `createTunnel`, `refreshAccessToken`, `deleteTunnel`, plus a `TunnelError` discriminated by `kind` and a pure reason→`{footerState, userLine, severity}` copy map (`describeTunnelError`/`tunnelReason`). NO module-level mutable state; no `ctx`; no `setStatus`; no `process.env`; no `WebSocket`. (owner conceded module-level flag; designer conceded setStatus call; principal held statelessness.)
- **Fetch only in tunnel.ts; WebSocket only in transport.ts** (§3 contradiction settled). tunnel.ts "consumes" = validates + hands off `{url, expiresAt, tunnelId}`; never dials.
- **setStatus CALL lives in EV-8**; the reason→copy vocabulary map lives in tunnel.ts (pure data, unit-testable without index.ts).
- **Idempotency guard lives in EV-8** as `activeTunnel: {tunnelId,url,expiresAt}|null`, checked BEFORE createTunnel; a second `/rc` while connected emits `already_live` line, zero POSTs. Guard is keyed on **"live", not "ever created"** — so EV-3 reconnect re-arm (a deliberate re-create) is not blocked.
- **Refresh**: separate stateless `refreshAccessToken` → `{accessToken, refreshToken?, expiresAt}` (grant_type=refresh_token at token_endpoint). The ≤1-per-/rc cap is EV-8 policy. NO auto-refresh inside createTunnel; principal withdrew the 401-on-create retry (spec §8 authorizes one PRE-EMPTIVE refresh on tokenExpiry only; a 401 from create is a terminal rejection). Rotated refresh tokens returned for EV-8 to persist via EV-7-owned keys.
- **Token discard boundary**: tunnel grant (tunnelId + signed URL) is discarded; the enrollment credential survives teardown and is EV-7's to persist. Do NOT clear settings on `/rc:off`.
- **DELETE best-effort**; teardown never blocks; 404/410 treated as success.
- **Copy language = English** (all three; PI-SPEC/card/README English; no Bahasa requirement; designer withdrew its ungrounded Bahasa).
- **Single-use-URL reconnect re-arm** = EV-3/EV-8 scope or a follow-up, NOT an EV-2 blocker; EV-2's obligation is just that `createTunnel` is stateless/re-callable.

**Split (1v2) — 403 copy / card-acceptance reading "rejected credential":**
- principal: 403 = distinct `forbidden` kind, names `/rc:login` ONLY, no "admin" line (control plane out of repo scope §10; only re-consent is client-reachable).
- owner + designer: 403 = distinct kind (not collapsed with 401 string), names `/rc:login` AND adds a distinct "ask control-plane admin to grant scope / contact admin" line. Designer frames it as a **card-acceptance reading** ("does 'rejected credential' literally include 403?") routed to product-owner; Reading B = 403 gets its own line because a 403 a driver cannot fix by re-consent alone should not be silently patched to "run /rc:login."
- **Open for product-owner.**

**Genuinely open (routed, not settled by any test):**
1. **403 remedy line**: /rc:login only (principal) vs + admin/scope line (owner+designer); and the card-acceptance reading of "rejected credential" (does it include 403?). Design judgment + acceptance reading.
2. **i18n seam**: literal English strings now vs key-based reason→message table for future en→id (owner: English default, localization separate card later; designer: offers key seam, says English strings not the blocker). Copy-language shape, user-visible.
3. **`already_live` ack density**: sentence line vs single-char ack (designer→product-owner; brand/feedback, not design).
4. **Footer-merge policy** (highest-severity vs most-recent wins) — EV-8's policy; tunnel.ts only tags `severity`. EV-8 concern, noted.

No testable dispute remains unsettled at the architecture level; the remaining items are judgment/acceptance-readings.

## Step 4 — Skeptic attacks and runs tests (job-12.7)

Verdict: **no open objections block the design.** All protocol facts verified via MCP (context7) confirm the design: refresh at token_endpoint (RFC 6749 §6 / OAuth 2.1 §4.3, no separate /refresh); device_authorization_endpoint OPTIONAL in RFC 8414 but the spec may require it as its own contract (valid, ambiguous phrasing); RFC 8628 device-flow polling semantics correct; OAuth 2.1 §4.3.2 refresh rotation required for public clients (design accounts for it); POST /tunnels → {tunnelId,url,tokenTtl} Bearer + DELETE /tunnels/:id contract present and self-consistent.

Objections:
- **O1 closed-red (non-blocking residual):** docs/PI-SPEC.md §3 line 74 "`transport.ts` is the only module that touches the network" coexists with line 66 listing tunnel.ts as REST client — a genuine §3 self-contradiction, residual spec-sync from the EV-1 docs rewrite. One-line fix; does NOT block design. **To be carried as a §3 amendment on the EV-2 PR** (facilitator-authored, evidence-cited per EV-4 Q1 precedent).
- **O4 closed-green:** token-discard boundary (enrollment credential survives teardown; tunnel token discarded) — spec §7.2.259 + §8.322 fully consistent with the convergence reading.
- **O5 closed-green:** pre-emptive refresh before create, terminal 401 (no auto-refresh inside create) matches spec §8 step order.
- **O2/O3/O6/O7 open-untested (post-change gates):** (O2) `tokenExpiry` must be an absolute timestamp (now + expires_in*1000), not raw relative expires_in — storage line must show conversion; (O3) 403 copy is a product-owner/acceptance-reading judgment (RFC 6750 §3: 401 invalid/revoked token vs 403 valid-but-insufficient-scope) — settle at implementation per the ruling; (O6) refresh-rotation persistence seam (return-then-persist vs callback) unresolved at impl level; (O7) discovery cache must not be module-level state in tunnel.ts.

**Confirmations:** PI_REMOTE_HOST_KEY zero matches in docs confirmed; seven footer states confirmed at §8.326–327; no separate /refresh confirmed at §7.2.233.

Follow-up candidate surfaced: none new beyond the §3 line fix (folds into EV-2's PR as an amendment, not a separate card).

## Step 5 — Synthesis (consolidator, job-12.8, verbatim)

**SETTLED** — stateless REST client (createTunnel/refreshAccessToken/deleteTunnel + TunnelError kind + pure reason→{footerState,userLine,severity} map); fetch-only in tunnel.ts / WebSocket-only in transport.ts; setStatus call in EV-8, vocabulary map in tunnel.ts; idempotency guard in EV-8 keyed on "live" (not "ever created"); one-silent-refresh split mechanism(tunnel.ts)/policy-cap(EV-8), no auto-refresh inside create, terminal 401; token-discard boundary (enrollment credential survives); best-effort DELETE; English copy; single-use re-arm = EV-3/EV-8 follow-up not EV-2 blocker; discovery per serverUrl. Settled disputes: O4 closed-green (token-discard), O5 closed-green (pre-emptive refresh), protocol facts via MCP; **O1 closed-red classified as in-scope prose-sync for EV-2** — §3 line 74 fix rides the EV-2 PR per EV-4 Q1 precedent (EV-2 implements tunnel.ts and depends on a correct §3 module rule), no ruling needed.

**OPEN JUDGMENT (for product-owner, escalating to steward; no test settles):**
1. **403 remedy line + "rejected credential" reading** (BLOCKER — gates O3): does "rejected credential" literally include 403 (valid-but-insufficient-scope)? All three seats agree 403 = distinct `forbidden` kind, not collapsed with 401. Reading A (principal): 403 names /rc:login ONLY. Reading B (owner+designer): /rc:login AND a distinct "ask control-plane admin to grant scope" line. RFC 6750 §3: 401 invalid/revoked vs 403 valid-but-insufficient-scope.
2. **i18n seam**: literal English strings now (owner) vs key-based reason→message table for future en→id (designer). User-visible copy-language shape.
3. **already_live ack density**: sentence line vs single-char ack (brand/feedback, not mechanism).
4. **Footer-merge policy**: highest-severity vs most-recent wins — EV-8's policy; tunnel.ts only tags severity.

**OPEN OBJECTIONS (post-change gates, step 9):** O2 tokenExpiry absolute timestamp (`now + expires_in*1000`, not raw relative); O3 403 copy per the ruling (BLOCKED by open judgment #1); O6 refresh-rotation persistence seam (return-then-persist vs callback); O7 discovery cache not module-level state in tunnel.ts.

**Recommendation:** route all four open-judgment items to product-owner; #1 is the blocker for full closure (gates O3); the §3 amendment is settled in-scope prose-sync, no ruling needed.

## Step 6 — routing (facilitator)

No Phase 1 rulings exist (human delegated all open-judgment calls). Per the escalation contract, `product-owner`/`steward` are ruling seats dispatched by the orchestrator, not this container. Open-judgment items 1–4 above carry forward to the orchestrator via ESCALATION with facts only. Card remains `Deliberating` awaiting the ruling before steps 7–14 can proceed.

## Step 6 — resume (instance 2): product-owner rulings applied (binding, verbatim)

The orchestrator dispatched `product-owner` (judgment row); it ruled on all four items, item 4 deferred to EV-8's deliberation with a recorded preference. Rulings appended verbatim (also archived by the orchestrator at `vault/raw/2026-08-31-po-ev2-ruling.md`):

**Item 1 — 403 remedy line + "rejected credential" reading. — Reading B.** The 403 row names /rc:login AND adds a distinct, non-identical clause naming the control-plane admin / pi-remote:host scope remedy. Concretely: 401 (enrollment_expired) is "enrollment expired or revoked — run /rc:login"; 403 (enrollment_rejected) is "this host lacks the pi-remote:host scope — run /rc:login to re-consent; if the scope is missing after that, ask your control-plane admin to grant it". The card acceptance's "rejected credential" is read to include 403 on three grounds: RFC 6750 §3 calls 401 and 403 distinct rejection classes (both are rejections); collapsing 403 to the 401 copy silently hides the case where /rc:login cannot help (the host has a credential, it just lacks scope), which is exactly the Gulf-of-Evaluation failure mode the designer's reason-vocabulary principle exists to prevent; and the acceptance text constrains the form ("names a remedy, not a trace"), not the number of distinct rows. §10 keeps the control-plane implementation out of repo scope; the "ask your control-plane admin" clause is a user instruction pointing at a person, not a control-plane contract, and is in EV-2's scope by acceptance.

**Item 2 — i18n / copy-language seam. — Key-based reason→message table now, with English values populated.** The export shape (reason → {footerState, userLine, severity}) stands; userLine is a stable message key ("tunnel.error.unauthenticated", "tunnel.error.forbidden", etc.), and tunnel.ts ships an English default lookup that resolves each key to its user-line. The English default lives in tunnel.ts (not index.ts) so the table is unit-testable without rendering. Future localization is a separate card that adds a second lookup plus a resolver — not part of EV-2.

**Item 3 — already_live ack density. — Sentence line, not single-character ack.** The exact form is the designer's round-1 wording as a stated refusal: "already connected to `<serverUrl>`; ignoring this `/rc`". Rendered once by the /rc command output; the footer stays at live (no transition, no severity tag, no journal entry — a successful no-op, not an error). `<serverUrl>` is the configured control-plane server URL (the same URL the user's /rc:login was aimed at), not the tunnel URL — the tunnel URL is a one-time secret that must never appear in copy (PI-SPEC §7.2).

**Item 4 — Footer-merge policy. — Deferred to EV-8's deliberation, with a recorded non-binding preference.** tunnel.ts emits each result tagged with a severity field; the merge rule itself is EV-8's policy because EV-8 owns the setStatus call and the multi-writer merge. EV-2's obligation is just to ship the severity tag. Recorded preference (EV-8 may overturn): most-recent-wins for the live → resyncing → live cycle (resyncing is a healthy phase); highest-severity-wins for the live / error / dialing transitions (an error must not be silently overwritten by a follow-on live from a reconnect that has not yet succeeded). If EV-8 wants a single uniform rule, highest-severity-wins (error > live > resyncing) is the principled uniform pick.

**Post-change gates (step 9) — restated:** O2 tokenExpiry absolute timestamp: now + expires_in*1000 at the conversion site, not raw relative. O3 403 copy runnable against the tunnel.error.forbidden row per Item 1. O6 refresh-rotation persistence seam: tunnel.ts returns rotated tokens (refreshAccessToken returns {accessToken, refreshToken?, expiresAt}), EV-8 persists via EV-7-owned keys. O7 discovery cache must not be module-level state in tunnel.ts (cache per serverUrl within the request functions or a closure-bound memo, not a top-level mutable). O1 (closed-red §3 line-74 prose-sync amendment — "transport.ts is the only module that touches the network" vs tunnel.ts as REST client) rides the EV-2 PR per the EV-4 Q1 governance precedent: facilitator-authored, evidence-cited, in-scope prose-sync. No ruling needed.

