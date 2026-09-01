---
title: Reason Taxonomy
type: entity
summary: The transport's closed five-value reason set — first_connect, reconnecting, relay_unreachable, protocol_violation, url_expired — honest metadata, never terminal.
aliases: [reason values, dialing reasons]
tags: [entity/states, transport]
sources: ["[[EV-3 Ruling]]", "[[EV-5 Ruling]]", "[[EV-8 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
EV-3 S3 pinned the typed transport event stream as `{kind: "dialing" | "live", …, reason?, severity, order}` with `reason` drawn from exactly five values: `first_connect`, `reconnecting` (a payload sub-state of `dialing`, not an eighth footer state), `relay_unreachable`, `protocol_violation`, `url_expired`. There is no `kind:"error"` — the transport has no terminality to report (see [[Retry Policy]]).

Downstream: EV-8's merge derives the footer `error` from consecutive error-severity dialing events (N=10) with the rich reason preserved end-to-end (the rearm-collapse must-satisfy — EV-8 J3). `protocol_violation` is reused for inbound-shape rejections after EV-5 B2's `parseInbound` hardening. `severity` follows the EV-2 tag convention; `order` is a monotonic gap-free ordinal.

## Related
[[Retry Policy]], [[Footer Merge Policy]], [[Seven Footer States]], [[transport.ts]], [[Closed Vocabulary Discipline]]

## Sources
[[EV-3 Ruling]], [[EV-5 Ruling]], [[EV-8 Ruling]]
