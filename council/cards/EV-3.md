---
id: EV-3
title: "Outbound wss transport with seq-ack envelope"
state: In Review
owner: null
epic: EPIC-1
goal: transport.ts dials the relay over wss, wraps every AG-UI event in a {v, seq, ack, frame} envelope with a monotonic extension-owned seq, echoes the highest processed inbound seq, heartbeats, and reconnects with exponential backoff and jitter under a stable session-scoped connection id.
---

## Intent

Implements §6 in `src/transport.ts`, the single network module. The envelope
and monotonic `seq` are what make the 1:N fan-out decision (§9) workable, so
this card owns the total order: one producer, no gaps the extension created.
Reconnect re-binds to the same session id (`ctx.sessionManager.getSessionId()`)
rather than spawning a new tunnel. User-visible surface — the footer status
entry (`ctx.ui.setStatus("pi-remote", …)`) flips between `dialing` and `live`
as this module connects, so the host user can always see reachability.

## Acceptance

- A captured frame stream shows strictly increasing `seq` from the extension
  and `ack` values tracking the highest processed inbound seq.
- Killing the relay mid-session produces reconnect attempts with visibly
  increasing backoff and jitter, and the session resumes under the same
  connection id without user action.
- No other module performs network I/O (code review + a test asserting
  translate/history/inject call no socket APIs).
- Heartbeat keeps the connection alive through an idle period longer than a
  typical proxy timeout.

---

## Step 1 — gate (facilitator)

State `Ready`. **Full council** (cross-seam: `src/transport.ts` is one of the
two network modules; it consumes tunnel.ts's validated one-time `wss://` URL,
is keyed to a stable session-scoped logical connection id via
`ctx.sessionManager.getSessionId()`, drives the footer `dialing`/`live` states,
and is the single producer owning the monotonic `seq` that makes §9 fan-out
workable; the envelope shape, ack semantics, heartbeat cadence, backoff/jitter
parameters, and the single-use-URL reconnect re-arm are genuine design
judgments — the latter is an open question EV-2's principals already routed to
this card). **Surface-touching** (footer status flips between `dialing` and
`live`, visible to the host user) — `designer` seated alongside `owner` and
`principal` in steps 2–3.

Binding contract carried for all seats: spec §6 (envelope `{v, seq, ack,
frame}`, monotonic extension-owned seq, ack echoes highest processed inbound
seq, heartbeat, exponential backoff + jitter, session id as logical connection
id, durability split, idempotency) is **unchanged by any merged card**;
`ctx.sessionManager.getSessionId()` (stable) and `ctx.ui.setStatus("pi-remote",
…)` are the only extension surfaces this card may touch; tunnel.ts (EV-2,
merged) validates and hands `{tunnelId, url, expiresAt}`; no other module
performs network I/O; tests must not require a real relay — stub/fake the WS
server in-repo (Bun native `WebSocket` for this harness); the 40-test suite
stays green and this card adds its own.

---

## Step 2 — independent first pass (jobs 15.1 owner, 15.2 principal, 15.3 designer; dispatched in parallel, each with only the card + binding contract)

All three seats settled independently in ~6.9m each. Positions recorded verbatim below (condensed where noted; full text retained in the runner's exchange).

### owner (job-15.1)

> **Approach** — `createTransport(deps)` factory returning a lifecycle handle (`connect/disconnect/send/onInbound/onStatus/getId`), every knob injected: `sessionId` (= `ctx.sessionManager.getSessionId()`, stable logical connection id), `rearm` (a `() => Promise<CreateTunnelResult>` wiring to EV-2's `createTunnel`, supplied by EV-8 so credential/refresh policy stays in EV-8), the WebSocket impl (Bun native/injectable), a clock/sleep/rng, and backoff/heartbeat params. Envelope construction is a **pure function** `envelope({v,seq,ack,frame})` with `v=1`; transport owns the monotonic outbound `seq` and stamps `frame.id = uuid()` for each live frame (the seam translate can't cover — verified translate.ts has no `crypto`/`uuid`, so it cannot be entropic). Reconnect is an exponential-with-full-jitter loop owned *by transport*, re-arming the consumed single-use URL by calling the injected `rearm()` per dial attempt.
>
> **Tradeoffs accepted** — Re-arm = physical re-create (fresh tunnelId) at the control plane, logical same-session via the stable session id and a footer that never leaves `dialing`→`live`; this is correct because a same-`tunnelId` re-arm would need the server to re-bind a spent signed URL (§7.2 doesn't offer it); it does NOT trip EV-8's idempotency guard (EV-2 converged it's keyed on "live", not "ever-created" — a deliberate re-arm while not-live is unblocked). Heartbeat as transport-level WS control-frame ping below the framing layer (server accepts "AG-UI frames and nothing else" — a proxy-surviving heartbeat must be a control-frame ping; pong flow is WS-layer, orthogonal to AG-UI). No fake timers (VERIFIED: bun 1.4.0 `mock.timer` is not a function) — backoff/ack math are pure functions tested with a fixed rng/clock; live reconnect/heartbeat loops tested with short real intervals (5–20 ms injected params). Transport reports status via `onStatus` (`dialing`→`live`), EV-8 renders `setStatus` (EV-2 settled convention); transport emits NOT `not enrolled`/`authorizing`/`resyncing`/`error` (those belong to EV-7/EV-2/EV-5).
>
> **Seams pinned** — To tunnel.ts: only the `CreateTunnelResult` shape `{tunnelId,url,expiresAt}` via `rearm`; never imports serverUrl/accessToken/settings/env, never calls `fetch`, re-checks `url` is `wss:`, refuses to dial past `expiresAt`. To EV-8: `getId()` session-scoped connection id; `onStatus("dialing"|"live")`; `onInbound(frame)` → EV-6 injection; EV-5 replay pushes through `send`; `disconnect()` idempotent teardown. Durability: in-flight window only (sent-but-unacked), no durable buffer; JSONL is source of truth.
>
> **Testable claims** — (1) `envelope(...)` returns exactly `{v:1,seq,ack,frame}`; N outbound frames yield strictly increasing consecutive seq; inbound `seq=k` updates next outbound `ack` to `max(k,…)`. (2) `nextBackoff(attempt,{base,max},rng)` with fixed `rng=1` (full jitter) returns `min(max, base*2^attempt)`, strictly increasing until `max`; with uniform rng lands in `[0, computedDelay]`. (3) On relay kill: transport calls `rearm()` for a fresh URL and re-dials; `getId()` unchanged across reconnect; non-decreasing measured `Date.now` deltas. (4) During reconnect `onStatus` sees `dialing` then `live`, never `not enrolled`/`authorizing`. (5) Every outbound frame carries a UUID `frame.id` (regex), distinct; static check: translate.ts has no `crypto`/`uuid`. (6) Heartbeat: fake WS answers pong → after idle `>5*I` socket still open + pings recorded; pong suppressed past `pongTimeout` → connection dead, reconnect fires. (7) Static network-I/O guard: translate/history/inject contain no `new WebSocket(`/no `wss?://` dial; transport.ts contains no `fetch(`.
>
> **Timer note** — `mock.timer` does not exist on bun 1.4.0; timer tests rest on injected params + short real intervals.

### principal (job-15.2)

> **Seam reading** — `createTunnel` returns `{tunnelId, url, expiresAt}` (absolute epoch-ms, O2) and never dials. §7.2 makes the URL **single-use — consumed on successful WS upgrade**, so a transport reconnect loop holding one URL and re-dialing it is dead on arrival: every reconnect after a real socket drop needs a **fresh** `createTunnel` call. That is the re-arm EV-2 deferred. A re-arm **mints a new `tunnelId`** each time — at the control plane that IS a new tunnel; at the session layer it is not (logical connection id = session id stays constant as long as whoever calls `createTunnel` keeps passing the same `sessionId`). Transport cannot verify this (the signed URL is opaque); "same connection id" is a property of the URL *provider*, not the socket.
>
> translate→transport: translate.ts's `eventOrdinal` is translation-internal bookkeeping (an owner who reaches for `eventOrdinal` as "the seq" reaches for the wrong number). transport→EV-8: the `setStatus` **call** lives in EV-8; transport's output is a **typed state event**, not a footer write — §8 lists seven footer states and transport may claim only `dialing` and `live`.
>
> **Blind spots** — transport-owner view can't see seq ownership collides with EV-5 (whoever assigns seqs to replayed frames must be the same counter as live frames, else `resync_done.uptoSeq` is meaningless); can't see the single-use-URL churn; can't see `setStatus` is EV-8's FSM and there is no `reconnecting` state in §8 so every reconnect renders as `dialing`; can't see "processed ≠ injected". EV-8 view can't see "reconnect re-binds" requires a per-attempt `createTunnel` with the same `sessionId`; can't see local-close vs network-close (a `session_shutdown` must NOT auto-reconnect, a relay death must); can't see the disconnect-window decision; inherits a leak-accounting question (who DELETEs the spent tunnels).
>
> **Reframe** — Three distinct numbers must never be conflated: **`outboundSeq`** (extension-owned monotonic counter, incremented once per envelope sent, never reset within the transport instance including across reconnects); **`inboundSeq`** (the inbound watermark: highest inbound envelope seq transport has *dispatched* to its inbound consumer — "processed" = dispatched, not applied, since transport cannot know whether `inject` succeeded); **`lastAckedSeq[deviceId]`** (per-device record of the highest *outbound* seq that device acked from its inbound `ack` — §7.3's "tracks lastAckedSeq per device"; read-only data transport hands to EV-5 for replay scoping). Envelope `ack` is symmetric: on outbound frames `ack = inboundSeq`; on inbound frames `ack` is that device's ack of our stream.
>
> **Reframe 2** — Transport is a protocol state machine with injected seams: `connect(url,{expiresAt})`, `close(reason)`, `send(frame) → number` (returns assigned seq), deps `{WebSocket, now, setTimeout, clearTimeout, jitter, urlProvider, onInbound, onStateChange}`; `urlProvider` (re-arm) called **per reconnect attempt** (not once at disconnect), `expiresAt` checked against `now`; never imports `tunnel.ts` or `ctx`. `send` while not live is a **drop with a signal** (no queue) — "no durable buffer beyond the in-flight window" forces this; EV-5 replay is the recovery path. Seq counter is in-memory, survives reconnect but not process restart (restart = new epoch, recoverable via event-id dedupe, never by seq). Replay and live frames both go through `transport.send()` — transport is the sole seq assigner; `uptoSeq` for `resync_done` is whatever `send` returned.
>
> **Heartbeat** — Bun client WebSocket exposes **no `.ping()`** (server-side API in Bun), so heartbeats must be **application-level envelopes** (`{v,seq,ack,frame:null}`) and must consume a seq (every envelope has a unique seq = simplest invariant).
>
> **Open questions it raised** — To EV-5 (replay through transport.send; uptoSeq transport-reported). To EV-8 (does re-arm per attempt mean createTunnel runs inside the backoff loop; DELETE/leak policy for churned tunnelId; is inbound seq space global — recommends global since outbound broadcast ack is a single number). To skeptic (history/inject no-socket gate can't run today — files don't exist; must be a stub).
>
> **10 testable claims** — strictly increasing seq + ack tracking; send returns seq, seq never resets across reconnect; sole seq owner (live+replay both via send); inbound dedupe + per-device ack; malformed inbound rejected; heartbeat envelope `frame:null` consumes seq; backoff non-decreasing capped jitter, reset on open; local close ≠ network close; re-arm seam (opened-then-closed → urlProvider called again; upgrade-fail-before-open retries SAME url without provider call); static guards.

### designer (job-15.3)

> **Design position** — transport.ts is a **transducer, not a renderer**: it turns the reality of an outbound WebSocket into a strictly-ordered, severity-tagged stream of `TransportStatus` events that EV-8 alone renders via `ctx.ui.setStatus`. It owns four status values — `dialing`, `live`, `reconnecting`, `error` — emitted with a defined `severity` (`error` > `dialing` ≡ `reconnecting` > `live`) and an `order` (monotonic gap-free event ordinal so EV-8 can implement either merge rule). Hard rule: **never flip footer to `dialing` on a reconnect**; emit a separate `reconnecting` state with a `since` timestamp; footer shows `live → reconnecting → live`; `dialing` is first-connect only; no `dialing→live→dialing→live` flicker by construction. `error` belongs to this card: emitted once per failed cycle, closed-set reason (`relay_unreachable` after N failed dials, `protocol_violation` malformed envelope, `url_expired` TTL past), does not auto-clear. Heartbeat is invisible by design (the user must never see pinging; only a `reconnecting` flip if a heartbeat-miss tears down).
>
> **Gulf closed** — Gulf of *Evaluation* for the host user: the single question the footer must answer is "is my session remotely reachable, right now?". A `reconnecting` state signifies "I lost the connection and I'm trying to come back without spawning a new tunnel" — so a user who watched the footer say `reconnecting` for 6s and return to `live` has a word for what happened and a reason to trust the session is the *same* session. Gulf of *Execution* for EV-8: a clean closed, ordered event surface; EV-8's `setStatus` is a renderer; the merge rule (EV-2 ruling) is implementable from transport's output without coupling.
>
> **Falsifiable predictions (8)** — flicker test (live→reconnecting→live, no `dialing` between); error terminality (one `error` per failed cycle, not five); `dialing` first-connect only (20 close-then-upgrade cycles → `dialing` count == 1, `reconnecting` count == 20); heartbeat invisibility (10-min idle → footer stream stays `[live]`); heartbeat-miss is `reconnecting`, not silent death, not sudden `error`; session-id stability on reconnect (same connectionId in both `live` events); severity order not temporal order governs arbitration; error footer copy is a closed reason set, never a stack trace or tunnel URL.
>
> **Open questions raised** — order vs timestamp as EV-8 merge primitive (argues order, gap-free); url_expired race (URL expires before upgrade — a distinct error from relay_unreachable; fold into follow-up?); **is `reconnecting` a NEW 8th §8 state (argues YES — amend §8 to eight) or a sub-state of `dialing`**; which merge-policy group `reconnecting` joins (argues most-recent-wins with `live`; product-owner judgment); typed status event ownership (narrow union in transport.ts vs shared status.ts).

---

## Step 3 — round 1 → round 2 (jobs 15.4 owner, 15.5 principal, 15.6 designer; each re-dispatched with the others' full positions)

Positions stabilised on the core architecture; recorded verbatim below (condensed; full text retained).

**Converged (all three, round 2):**

1. **Typed state-event seam.** transport emits typed events `{kind, severity, order, connectionId, reason?, since?}`; EV-8 alone renders `setStatus`. The seam makes EV-8's merge policy (EV-2 Item 4) implementable from transport's output without coupling. `kind` union is small (`dialing | live`, ± `error` — see residual).
2. **`reconnecting` is NOT an 8th §8 state; it is a sub-state of `dialing` via a `reason`/`phase` payload field** (`reason: "first-connect" | "reconnecting"`, or `phase: "initial" | "reconnect"`, plus an `attempt` ordinal and `since` wall-time). designer withdrew its round-1 demand for a new §8 state (the Q1 governance precedent does not extend — a reconnecting state is not forced by an authoritative upstream and not security-model; a payload field is the cheaper-to-reverse path). FLLWUP-2 owns §8/six-seven-state reconciliation. §8 amendment is out of scope for EV-3; EV-8 renders `dialing` either way.
3. **Heartbeat = native WS control-frame ping.** owner AND principal independently ran the settling test on Bun 1.4.0: the Bun client `WebSocket` **has a callable `.ping()`** (resolves to `Bun.WebSocket` because tsconfig `lib` is `ESNext` + `types:["bun"]`, no DOM) and the ping arrives at the server's `websocket.ping` handler, **not** the `message`/AG-UI data path — so it does not violate "server accepts AG-UI frames and nothing else". principal withdrew the app-level `{frame:null}`-consumes-seq heartbeat. Refinement (principal, verified): the Bun client has **no `pong` event** (`WebSocketEventMap` is close|error|message|open only), so dead-peer detection rides `close`/`error` + the next failed `send`, **not** a pong-timeout; the heartbeat's testable job is keep-alive (fake relay `idleTimeout` smaller than heartbeat interval, assert `readyState === OPEN` well past idle with pings recorded server-side).
4. **Re-arm seam.** Converge on owner's `rearm(): Promise<CreateTunnelResult>` injected by EV-8; transport invokes it **once per dial attempt ≥ 2, inside the backoff loop** (after the backoff sleep; first connect does not call it — EV-8 hands the initial `{url, expiresAt}` from its own `/rc` create). **Transport owns WHEN, EV-8 owns WHAT**: the `rearm` closure is `deleteTunnel(currentTunnelId)` (best-effort) → optional silent refresh → `createTunnel(...)` → update `currentTunnelId`. Transport never imports tunnel.ts, never sees a credential, never calls `fetch`. `getId()` returns the session id, full stop; transport never assumes `tunnelId` is stable across attempts.
5. **Three-numbers seq/ack contract.** `outboundSeq` (monotonic, never reset across reconnect, in-memory, dies with the session epoch), `inboundSeq` (highest inbound seq *dispatched* — not applied — to the inbound consumer), `lastAckedSeq[deviceId]` (per-device highest *outbound* seq acked, §7.3, read-only data for EV-5). Envelope `ack` = **socket-level watermark** (max dispatched inbound seq on the relay→extension socket) — the envelope has no `deviceId` field, so it can only be the socket watermark, never per-device (with 1:N a per-device ack would ack the wrong device and break §5.3 resume). Because the outbound broadcast `ack` is a single number, the **inbound seq space must be global across all devices**. Process restart = new epoch; dedupe by event id, never by seq.
6. **Seq assigned at write time.** Assign seq inside `send` immediately before the socket write, so a `send`-while-not-live **drop emits a signal and never consumes a seq** — a dropped frame is never emitted, deleting the gap ambiguity by construction. Invariant to state: "consecutive over emitted frames".
7. **UUID stamping via injected `newId`** (not module-level `crypto.randomUUID()`, for testability) on live frames only; `send` must **leave a pre-existing `frame.id` untouched** (replay frames carry EV-5's deterministic ids — stamping over them would break replay dedupe).
8. **Re-arm does NOT trip EV-8's idempotency guard.** EV-2 convergence: guard keyed on "live", not "ever-created", precisely so a deliberate re-arm while not-live is unblocked. The tunnelId churn / superseded-`DELETE` accounting is **EV-8's post-change gate**, not an EV-3 obligation; the leak is bounded by §7.2 (single-use token + TTL).
9. **history/inject no-socket gate deferred.** `src/` verified to contain only `translate.ts` and `tunnel.ts`; `history.ts`/`inject.ts` don't exist until EV-5/EV-6. The no-socket guard is enforceable today only on `translate.ts` (EV-2 already covers tunnel.ts); the history/inject assertions are a documented invariant EV-5/EV-6 inherit, not placeholder asserts against nonexistent files.
10. **Error is a footer state owned by EV-8, not a transport emission into the footer.** Transport emits typed events with severity/reason metadata; EV-8's merge policy decides when the footer lands on `error`. designer retreated from "error belongs to this card" as a footer emission, but keeps `error` in the reasoning around an unrecoverable relay death (see residual).

**Residuals (not closed by round 2):**

1. **Terminal failure: give-up-after-N vs retry-forever.** designer: transport emits a `kind:"error"` event with a closed reason set (`relay_unreachable` after N failed dials / `protocol_violation` / `url_expired`) once per failed cycle, and a subsequent successful reconnect emits `live` directly. principal: dial failures are transient — §6 sets no give-up, backoff continues — so `relay_unreachable`/`protocol_violation`/`url_expired` are `reason` metadata on the `dialing` event (or a transport-internal failure signal), never a footer state; whether anything lands on the footer as `error` is EV-8's policy. Whether transport ever stops retrying and signals terminal failure (vs retry forever at capped backoff) is unresolved; the give-up-vs-forever product call and the emitted-kind set are open at the seam.
2. **Typed event field set.** owner reads `onStatus("dialing"|"live")` minimal; designer/principal read `{kind, severity, order, connectionId, reason?, since?}`. designer frames it as testable: a fixture running EV-8's merge policy against a field-starved shape would fail to apply the EV-2 Item-4 recorded preference. Field set to be settled at the owner's step-8 implementation / step-9 skeptic against the real merge policy need.
3. **§8 one-line note** — whether `docs/PI-SPEC.md` §8 should carry a one-line note that the host-visible copy may distinguish first-connect from reconnecting via a payload field on the `dialing` transition. Reading (a): leave §8 unchanged (EV-8 renders either way). Reading (b): add the one-line note (prose-sync within a card's mandate per EV-1 Q3 precedent). Touches §8 prose; open-judgment, and FLLWUP-2 already reconciles EV-8 text with the seven-state set — deferred rather than decided here.

---

## Step 4 — Skeptic attacks and runs tests (job-15.7)

Skeptic settled in 4.0m. **Verdict: `blocks`** on three open design questions, but the protocol facts all settled green. Full report recorded; key results:

- **O4 closed-green (heartbeat, SETTLED BY RUNNING):** ran against real `Bun.serve` on this repo's bun 1.4.0 — `WebSocket.prototype.ping` IS a function; `ws.ping()` fires the server's `websocket.ping` handler and NOT the `message`/AG-UI data path; there is NO client `pong` event (dead-peer detection rides `close`/`error` + next failed `send`, not pong-timeout). Verdict: no change; native control-frame ping stands.
- **O6 closed-green:** seq strictly increasing across reconnect (monotonic counter, drops happen before assignment); event gaps are intentional, handled by EV-5 replay.
- **O7 closed-green:** ack = highest-processed-inbound watermark, correct for §5.3 resume semantics.
- **O8 closed-green:** design injects clock/sleep/rng; no fake timers needed (bun `mock.timer` absent; verified `Bun.fakeTimers`/`jest`/`vi` all false).
- **O9 closed-green:** gate-integrity failure-injections mapped (seq reset→fails; 0 backoff→fails; 0 jitter→fails; omitted heartbeat→connection drops; buffering-during-disconnect→fails; rearm-on-first→fails).
- **O1 OPEN (blocks):** terminal failure — give-up-after-N vs retry-forever. Spec §8 defines `error` as terminal; §6 sets no give-up. Design cannot decide whether transport ever stops retrying or what it emits; EV-8 cannot know if a failed transport is dead or retrying.
- **O2 OPEN (blocks step 9, not step 6):** typed event field set underspecified (minimal `onStatus("dialing"|"live")` vs `{state, connectionId, reason?, severity?}`). EV-2 tunnel.ts already models `Severity = "error"|"live"|"resyncing"` + `ReasonCopy{footerState, severity}`; merge policy (EV-2 Item 4) needs the richer shape. Closure-by-test at step 9.
- **O3 PARTIAL (open, non-blocking):** no-other-module gate satisfiable only against `translate.ts` now; history/inject assertions deferred to when those files land (EV-5/EV-6).

## Step 5 — Synthesis (consolidator, job-15.8, verbatim — condensed)

**SETTLED** (each closed by a Skeptic step-4 test): the ten-point converged architecture (typed state-event seam; `reconnecting` = payload sub-state of `dialing`, not an 8th §8 state; native WS control-frame-ping heartbeat — O4 green; re-arm seam transport-when/EV-8-what; three-numbers seq/ack contract; write-time seq assignment; injected-`newId` UUID stamping never overwriting replay ids; idempotency-guard keyed on live; gate scoped to what exists; error footer state owned by EV-8 merge policy).

**OPEN JUDGMENT (for product-owner, escalating to steward; no test settles):**
1. **O1 (BLOCKING) — terminal failure: give-up-after-N vs retry-forever.** designer: transport emits `kind:"error"` (closed reasons `relay_unreachable`/`protocol_violation`/`url_expired`) once per failed cycle, can stop retrying; recovery emits `live` directly. principal: dial failures transient, §6 sets no give-up, backoff continues, reasons are metadata on `dialing`, never a footer state. A ruling decides: (i) give-up-after-N vs retry-forever at capped backoff; (ii) N and the closed reason set if give-up; (iii) whether transport emits a terminal `kind:"error"` event or only `reason` metadata; (iv) the boundary between a transport-internal failure signal and an EV-8 footer-`error` landing.
2. **R3 (NON-BLOCKING) — §8 one-line note**: Reading (a) leave §8 unchanged; Reading (b) add a one-line note that host-visible copy may distinguish first-connect from reconnecting via a payload field on the `dialing` transition. EV-1 Q3 precedent bounds the mechanism (prose-sync would ride the PR) but not the content (a UX-preference state/note is NOT the forced-by-upstream class). FLLWUP-2 already reconciles EV-8 text with the seven-state set.

**OPEN OBJECTIONS:**
- **O2 (BLOCKS step 9, not step 6) — typed event field set.** Closure-by-test, NOT a ruling: a step-9 Skeptic fixture runs EV-8's merge policy (per EV-2 Item 4 recorded preference) against the implemented shape. Precedent-set floor (apply, don't re-ask): EV-2 Item 4 ships `severity` + a recorded most-recent-wins/highest-severity-wins preference, so `severity` and an order-or-timestamp primitive are settled by precedent; the residual is the remaining fields (`order` vs timestamp, `since?`, `attempt?`, `connectionId`, `reason?`).
- **O3 (NON-BLOCKING) — gate scope.** translate.ts assertion testable at step 9 now; history/inject deferred-by-design to EV-5/EV-6.

**Precedent applied:** EV-2 Item 4 (footer-merge deferred to EV-8; `severity` floor for O2); EV-1 Q3 + EV-4 Q1 (spec corrections corruption mechanism; UX-preference not auto-amending — bounds R3); EV-1 Q2 (seven footer states binding — `reconnecting` is a payload sub-state); EV-1 step-10 judge-object (judge evaluates PR branch at Skeptic-verified SHA — applied at step 10).

**Not ready to hand off: O1 blocks routing to implementation.** O2/O3/R3 do not block step 6. Once O1 is ruled, EV-3 routes to step 8 carrying the settled architecture, the closed-green Skeptic tests, and the O2/O3 test plan.

## Step 6 — routing (facilitator)

Phase 1 rulings: NONE (human delegated all open-judgment calls). `product-owner`/`steward` are ruling seats this container does not dispatch. Per the `<escalation_contract>`, the open-judgment item the consolidator sorted as requiring a product-owner ruling — **O1 (terminal give-up vs retry-forever)**, with R3 (the §8 one-line note) as a non-blocking companion — carries forward to the orchestrator via ESCALATION with facts only, no recommendation. O2 and O3 are closure-by-test / deferred and do not need a ruling. Card remains `Deliberating` awaiting the ruling before steps 7–14 can proceed.




---

## Step 6 continuation — product-owner ruling (binding, appended verbatim)

The orchestrator dispatched `product-owner` for the O1 open-judgment item (with R3 as a non-blocking companion); it ruled. The ruling is binding and applied without re-asking. Full ruling document: `vault/raw/2026-08-31-po-ev3-ruling.md`. Binding text as delivered:

> **Sub-question 1 — Retry forever at capped exponential backoff + jitter. The transport never gives up.** §6 names "reconnect with exponential backoff + jitter" with no give-up boundary; §8's "terminal" attaches to the rendering of failure to the user, not to the act of retrying by the transport. The transport is a transducer; it cannot honestly know what "hopeless" means.
>
> **Sub-question 2 — Moot.** Sub-question 1 rules out give-up; the closed reason set is, however, decided for transport-internal use under sub-question 3.
>
> **Sub-question 3 — Only `reason` metadata on `dialing`, never a terminal `kind:"error"` event.** The typed event stream emits only `kind: "dialing" | "live"`. The closed `reason` taxonomy is five values: `first_connect`, `reconnecting` (payload sub-state of `dialing`, per the converged architecture), `relay_unreachable`, `protocol_violation`, `url_expired`. No `kind:"error"` event exists; the transport has no terminality to report.
>
> **Sub-question 4 — `error` is EV-8's policy decision, derived from transport reason metadata + tunnel.ts reason rows via EV-8's merge function.** Transport has no path to a footer write by construction. The transport's retry-forever mechanism and EV-8's "after N consecutive `relay_unreachable` reason events, land on `error`" threshold are two different numbers — that seam is the ruling.
>
> **Companion R3 — Defer to FLLWUP-2.** FLLWUP-2 already reconciles EV-8's card text with the seven-state footer set; the §8 prose note belongs there, not on the EV-3 PR. Non-binding preference for FLLWUP-2's runner: Reading (a) — leave §8 prose unchanged, because the architecture already pins `reconnecting` as a payload sub-state of `dialing`.
>
> **General rule for EV-5 / EV-6 / EV-7 / EV-8:** The transport's typed event stream is `{kind: "dialing" | "live", …, reason?, severity, order, …}`. There is no `kind:"error"`. The `reason` field is one of the five closed values. `severity` follows the EV-2 tag convention; `order` is a monotonic gap-free ordinal. The transport failure signal is honest metadata, never terminal. Any `error` on the footer is EV-8's call, derived from metadata EV-8 receives; downstream cards that need to surface failure route through EV-8's merge function, not via a transport side-channel.

## Step 6 → Step 7 handoff (facilitator)

O1 is no longer open; it is closed by the ruling. R3 is deferred to FLLWUP-2 (no EV-3 step-9 gate, no §8 prose edit on this PR). O2 remains closure-by-test at step 9 (merge-policy fixture); O3 non-blocking (translate.ts static gate now, history/inject inherited by EV-5/EV-6). EV-3 proceeds to step 7 carrying the four sub-question rulings, the companion deferral, and the ten-point converged architecture as the binding contract.

---

## Step 7 — design spec + handoff

Design spec committed: `docs/superpowers/specs/2026-08-31-EV-3-design.md` (settled design, no §8 edit — R3 deferred to FLLWUP-2). Card → `In Progress`.

## Step 8 — owner implementation (job-17.1, 8.8m)

Branch `ev-3-transport`, **PR #4 open**, head `57d5632ea4cd4e728218bd83a201331b40f7208e`. Own gates: `bunx tsc --noEmit` clean; `bun test` 49 pass / 0 fail (40 existing + 9 new). Deviation documented: defensive URL regex accepts `ws:` too (test-only, in-repo Bun.serve fake has no TLS; production wss enforced by EV-2) — referred to Skeptic. Card → `In Review` (observed: PR #4 open, `gates` workflow SUCCESS on head).

## Step 9 — Skeptic verification (job-17.2, 5.7m) — verify cycle 1/3

Verdict **pass; NO open objections — all closed-green**. Own re-runs: tsc clean; `bun test --timeout 30000` 49 pass / 0 fail; gate-failure injection confirmed the gate can fail (8 fail on injected `fetch(`).
- **O1(a) closed-green** — `dialLoop` gated only by stopped/disconnecting/dialToken; no give-up counter or boundary (retry-forever).
- **O1(b) closed-green** — `TransportKind = "dialing"|"live"`; no `kind:"error"` in type or any emission.
- **O1(c) closed-green** — `TransportReason` exactly the closed 5-value set.
- **O1(d) closed-green** — no `setStatus` call, no `fetch(` in transport.ts.
- **O2 closed-green** — §3.1-9 merge-policy fixture implements EV-2 Item 4 preference against the implemented shape; severity+order primitives workable; residual fields populated; no field-starved shape.
- **O3 closed-green** — static no-socket gate on translate.ts.
- **R3 closed-green** — `git diff main -- docs/PI-SPEC.md` empty (no §8 edit).
- **ws:/wss: deviation closed-green** — necessary for in-repo Bun.serve fake (no TLS); confined to URL-validation regex; production wss enforced by EV-2; consistent with binding contract.

## Step 10 — Judge (job-17.3, 1.0m)

Verdict **PASS** at head `57d5632e` (PR #4), evaluated per the standing step-10 rule at the Skeptic-verified SHA, not main. Basis: every goal clause met (dials relay over wss; {v,seq,ack,frame} envelope via send→envelope(); monotonic extension-owned seq, not reset on reconnect; ack echoes highest processed inbound seq; heartbeat via native WS control-frame ping; reconnect with capped exponential + jitter, retry-forever; stable session-scoped connection id, getId() unchanged). Self-verified tsc clean, 49/0 tests, no fetch( in transport.ts, no §8 edit.
