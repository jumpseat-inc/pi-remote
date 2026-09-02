---
title: Spec Correction Governance
type: concept
summary: Spec corrections forced by authoritative evidence ride the implementing card's PR as facilitator-authored, evidence-cited prose-sync; security-model changes escalate to steward.
aliases: [spec amendment governance, prose-sync]
tags: [concept/spec, doctrine, process]
sources: ["[[EV-1 Ruling]]", "[[EV-4 Ruling]]", "[[EV-5 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[FLLWUP-5 Ruling]]", "[[EPIC-2 Decision Record]]"]
created: 2026-09-02
updated: 2026-09-02
---
The spec (docs/PI-SPEC.md) is the source of truth (repo AGENTS.md), and locked sections still turned out to contain protocol errors once tested against the real AG-UI schema and SDK. The governance that emerged, refined across five rulings:

- **Rides the implementing card's PR** — facilitator-authored, evidence-cited prose-sync; never a silent rewrite, never a separate spec card that delays the only consumer (EV-4 Q1, EV-5 B1/B2, EV-2's §3 O-1, FLLWUP-4).
- **Three-part test**: forced by authoritative upstream evidence, preserves the security model, belongs to the contract surface the implementing card owns (FLLWUP-5 ruling's general rule).
- **Escalation boundary**: amendments that change the security model — new server contract surface, loosened tenancy, expanded threat model — are portfolio changes and route to [[Council Seats|steward]] (FLLWUP-5 ruling). EV-5 B2 is the worked example: §2's lock was read as outbound-only by its literal text rather than amended.
- **A spec row documents the contract, not runtime reachability** — FLLWUP-5 J-ACCEPT amended the acceptance, not the §4 row.

Grounding: `AGENTS.md` ("keep it in sync with any change that affects the wire format") is dispositive in favor of amendment (EV-4 Q1).

**Routing reconciliation (EV-12 OJ-2, refined).** Two authorities appeared to conflict — corrections ride the implementing PR (this page) versus file-a-card for drift (the FLLWUP-19 precedent). The reconciliation comes from this page's own three-part test: the deciding leg is *ownership of the surface*. A correction to the contract surface the implementing card writes **rides that card's PR**; pre-existing prose drift in a surface the card does not own (e.g. PI-SPEC §7.2's no-lookup-state sentence, §7.3's per-device-ack claim, both found mid-run) **files as its own FLLWUP card**, landing in Backlog beside its precedent. EV-14's conformance pass should expect to file several — routing them is bookkeeping, not judgment.

## Related
[[Cheapest To Reverse]], [[Fixture-Green Honesty]], [[Closed Vocabulary Discipline]], [[Council Seats]], [[pi-remote]]

## Sources
[[EV-1 Ruling]], [[EV-4 Ruling]], [[EV-5 Ruling]], [[FLLWUP-4 Ruling]], [[FLLWUP-5 Ruling]]
