---
id: EV-3
title: "Outbound wss transport with seq-ack envelope"
state: Ready
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
