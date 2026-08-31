---
id: EV-3
title: "Outbound wss transport with seq-ack envelope"
state: Deliberating
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

