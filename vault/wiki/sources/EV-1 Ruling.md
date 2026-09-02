---
title: EV-1 Ruling
type: source
summary: Product-owner ruling retiring PI_REMOTE_HOST_KEY, fixing the seven-state footer set, and seeding the spec-correction governance that governed the whole epic.
aliases: [EV-1 Open-Judgment Rulings]
tags: [council/ruling, enrollment, footer-states, spec-governance]
sources: ["[[EV-1 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Product-owner ruling on EV-1 (2026-08-31), the docs-only spec-sync card. Three rulings: **Q1** — `PI_REMOTE_HOST_KEY` is retired entirely (zero occurrences in the spec; `PI_REMOTE_SERVER_URL` is the sole env override); credentials never ride env vars, not even as a documented override. **Q2** — `resyncing` is the seventh footer state; the authoritative lifecycle-ordered set is off, not enrolled, authorizing, dialing, resyncing, live, error (see [[Seven Footer States]]). **Q3** — the §7.5 tenancy prose and RFC 8414 discovery dependency are in-mandate prose-sync; no ratification needed.

Q3 became the seed of [[Spec Correction Governance]]: spec corrections forced by authoritative upstream evidence and preserving the security model are prose-sync within the implementing card's mandate. Also notable: the seat's grounding framework originates from a different product and is explicitly disclaimed — see [[Council Seats]] for the provenance note. Meta-note: `ALREADY_LIVE_COPY` (EV-2 Item 3) and the EV-8 footer acceptance are treated as binding downstream text.

## Related
[[Spec Correction Governance]], [[Seven Footer States]], [[Copy Honesty Doctrine]], [[EV-1 Step-10 Judge-Object Ruling]], [[pi-remote]]

## Sources
`vault/raw/2026-08-31-po-ev1-ruling.md`
