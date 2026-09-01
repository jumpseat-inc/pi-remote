---
title: EV-3 Ruling
type: source
summary: Product-owner ruling that the transport retries forever and emits only honest metadata — no terminal kind:"error" — with the five-value reason taxonomy and footer error as downstream policy.
aliases: [EV-3 Open-Judgment Rulings]
tags: [council/ruling, transport, retry, states]
sources: ["[[EV-3 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Four sub-rulings on EV-3 (2026-08-31). **S1** — retry forever at capped exponential backoff + jitter; §8's "terminal" attaches to user rendering, not the act of retrying. **S3** — the typed event stream is `{kind: "dialing" | "live", reason?, severity, order}`; **no `kind:"error"` exists** — a terminal event from a non-terminal mechanism would be a lie in the stream. **S4** — footer `error` is EV-8's derived policy ("after N consecutive relay_unreachable events, land on error" was the ruling's own example). The closed five-value reason taxonomy (`first_connect`, `reconnecting`, `relay_unreachable`, `protocol_violation`, `url_expired`) lives on [[Reason Taxonomy]]; the full two-seam reconciliation with credential terminality on [[Retry Policy]].

## Related
[[Retry Policy]], [[Reason Taxonomy]], [[Footer Merge Policy]], [[Closed Vocabulary Discipline]], [[transport.ts]]

## Sources
`vault/raw/2026-08-31-po-ev3-ruling.md`
