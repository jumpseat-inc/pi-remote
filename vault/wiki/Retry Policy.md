---
title: Retry Policy
type: concept
summary: Two seams — the transport dial retries transient failures forever at capped backoff, while enrollment-class credential terminality stops the loop with the rich reason preserved.
aliases: [retry-forever, credential terminality, transport terminality]
tags: [concept/transport, doctrine]
sources: ["[[EV-3 Ruling]]", "[[EV-8 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
EV-3 ruled the **transport seam**: the WS dial retries transient failures forever at capped exponential backoff + jitter — §6 sets no give-up boundary, §8's "terminal" attaches to user rendering, and the transport "cannot honestly know what hopeless means." It emits only honest metadata ([[Reason Taxonomy]]); never a terminal `kind:"error"`.

EV-8 J3 ruled the **credential seam**: when a rearm hits an enrollment-terminal `TunnelError` (401/403 on `createTunnel`, which is 401-terminal by design), the retry loop **stops**, the footer lands on `error` carrying the rich enrollment reason (`enrollment_expired` / `enrollment_rejected`), and the remedy is `/rc:login`. Re-dialing the same dead credential is futile in a way re-dialing the same relay after a blip is not — collapsing the two seams would hide the one case only `/rc:login` can unstick.

The binding glue: the rearm-collapse must preserve the rich `TunnelError.reason` end-to-end (transport.ts's collapse to `relay_unreachable` must not erase it), and teardown never clears the credential.

## Related
[[Reason Taxonomy]], [[Footer Merge Policy]], [[transport.ts]], [[tunnel.ts]], [[Closed Vocabulary Discipline]]

## Sources
[[EV-3 Ruling]], [[EV-8 Ruling]]
