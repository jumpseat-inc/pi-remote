---
title: EV-8 Ruling
type: source
summary: Product-owner ruling adopting the kind-first footer merge (amending its own EV-2 preference), deferring the URL prompt to /rc:login, stopping on credential terminality, pinning N=10, and refusing while-live re-enroll.
aliases: [EV-8 product-owner ruling]
tags: [council/ruling, footer, merge, lifecycle]
sources: ["[[EV-8 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Five rulings on EV-8 (2026-08-31). **J1** — kind-first `mergeTransport` with `kind:"live"` clearing a sticky `error`; explicitly amends product-owner's own EV-2 Item 4 non-binding preference (recorded preferences are advisory) because the Skeptic verified `live` is emitted only after WS onopen + one-time-token validation — the guard's failure mode is structurally impossible. Operational shape and threshold on [[Footer Merge Policy]]. **J2** — the URL prompt fires only out-of-band after `/rc:login`, never from a bare `/rc`; a serverUrl-only credential contradicts the full-shape-or-absent boundary; the §8 amendment rides the PR. **J3** — enrollment-class 401/403 during rearm STOPS the retry loop with the rich reason preserved (the rearm-collapse must-satisfy) — credential terminality is a different seam from EV-3's transport terminality; see [[Retry Policy]]. **J4** — N = 10 consecutive error-severity dialing events, injectable, counter reset on any non-error event. **J5** — `/rc:login` while non-idle is refused with "close the tunnel first with /rc:off"; the driver enters only from `off` and `not enrolled`.

## Related
[[Footer Merge Policy]], [[Retry Policy]], [[Copy Honesty Doctrine]], [[Seven Footer States]], [[index.ts]]

## Sources
`vault/raw/2026-08-31-po-ev8-ruling.md`
