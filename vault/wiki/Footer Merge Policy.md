---
title: Footer Merge Policy
type: concept
summary: Kind-first mergeTransport — live clears a sticky error on a verified WS open; most-recent-wins across the live family; error at 10 consecutive error-severity dialing events; resyncing is replay overlay.
aliases: [mergeTransport, footer merge rule]
tags: [concept/footer, states]
sources: ["[[EV-8 Ruling]]", "[[EV-2 Ruling]]", "[[EV-8 Design Position r1]]"]
created: 2026-09-02
updated: 2026-09-02
---
EV-8 J1's ruling, amending product-owner's own EV-2 Item 4 preference. The policy, in order:

- **Order-guard**: events with `order <= lastOrder` are ignored.
- **`live` clears a sticky `error`** (`live → {live, consec:0}`) — sound because the Skeptic verified `live` is emitted only after a successful WS onopen and one-time-token validation; the failure mode the EV-2 preference guarded against (an unverified reconnect overwriting an honest error) is structurally impossible.
- **Most-recent-wins across the live family** (live → resyncing → live: resyncing is a healthy phase).
- **`error` is reached only by threshold**: N = 10 consecutive error-severity dialing events (`ERROR_DIAL_THRESHOLD`, injectable, N ≥ 2); the counter resets on any non-error event and lives in EV-8's FSM, independent of the transport's backoff counter.
- **`resyncing` is replay overlay only**, never produced by the merge; mid-replay dialing aborts replay and moves the footer to dialing.
- Rich reasons are preserved end-to-end (the rearm-collapse must-satisfy), so the error footer carries the enrollment remedy, not a collapsed `relay_unreachable`.

Note the meta-lesson: the recorded EV-2 Item 4 preference was **advisory** — product-owner amended it on the Skeptic's verified invariant without ceremony.

## Related
[[Seven Footer States]], [[Reason Taxonomy]], [[Retry Policy]], [[index.ts]], [[transport.ts]]

## Sources
[[EV-8 Ruling]], [[EV-2 Ruling]], [[EV-8 Design Position r1]]
