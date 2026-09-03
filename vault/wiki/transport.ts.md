---
title: transport.ts
type: entity
summary: The outbound wss module — {v, seq, ack, frame} envelope, retry-forever backoff, typed honest-metadata event stream, and the hardened parseInbound union.
aliases: [the transport]
tags: [entity/module, transport]
sources: ["[[EV-3 Ruling]]", "[[EV-5 Ruling]]", "[[EV-8 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
The single WS module (§6). Envelope `{v, seq, ack, frame}` with monotonic extension-owned seq (write-time assignment), socket-watermark `ack`, native WS control-frame-ping heartbeat, reconnect-forever at capped backoff + jitter under the session-scoped connection id (see [[Retry Policy]]). Typed event stream `{kind: "dialing" | "live", reason?, severity, order}` per [[Reason Taxonomy]] — no `kind:"error"`. Inbound: `parseInbound` validates a discriminated union on the frame slot (`AgUiFrame | {type:"resume",deviceId,lastAckedSeq} | {type:"resync",fromSeq} | null`); resume updates the watermark without surfacing; resync triggers the injected `onResync(fromSeq)` callback wired by EV-8; `protocol_violation` covers rejected shapes (EV-5 B2). Injected frames get `newId` UUID stamps that never overwrite replay ids. The rearm closure must preserve rich `TunnelError.reason` (EV-8 J3 must-satisfy); `ws:` is accepted only for the in-repo fake, production enforces `wss:`.

## Related
[[Retry Policy]], [[Reason Taxonomy]], [[Footer Merge Policy]], [[tunnel.ts]], [[index.ts]], [[AG-UI]]

## Sources
[[EV-3 Ruling]], [[EV-5 Ruling]], [[EV-8 Ruling]]
