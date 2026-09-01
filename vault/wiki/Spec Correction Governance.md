---
title: Spec Correction Governance
type: concept
summary: Spec corrections forced by authoritative evidence ride the implementing card's PR as facilitator-authored, evidence-cited prose-sync; security-model changes escalate to steward.
aliases: [spec amendment governance, prose-sync]
tags: [concept/spec, doctrine, process]
sources: ["[[EV-1 Ruling]]", "[[EV-4 Ruling]]", "[[EV-5 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[FLLWUP-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
The spec (docs/PI-SPEC.md) is the source of truth (repo AGENTS.md), and locked sections still turned out to contain protocol errors once tested against the real AG-UI schema and SDK. The governance that emerged, refined across five rulings:

- **Rides the implementing card's PR** — facilitator-authored, evidence-cited prose-sync; never a silent rewrite, never a separate spec card that delays the only consumer (EV-4 Q1, EV-5 B1/B2, EV-2's §3 O-1, FLLWUP-4).
- **Three-part test**: forced by authoritative upstream evidence, preserves the security model, belongs to the contract surface the implementing card owns (FLLWUP-5 ruling's general rule).
- **Escalation boundary**: amendments that change the security model — new server contract surface, loosened tenancy, expanded threat model — are portfolio changes and route to [[Council Seats|steward]] (FLLWUP-5 ruling). EV-5 B2 is the worked example: §2's lock was read as outbound-only by its literal text rather than amended.
- **A spec row documents the contract, not runtime reachability** — FLLWUP-5 J-ACCEPT amended the acceptance, not the §4 row.

Grounding: `AGENTS.md` ("keep it in sync with any change that affects the wire format") is dispositive in favor of amendment (EV-4 Q1).

## Related
[[Cheapest To Reverse]], [[Fixture-Green Honesty]], [[Closed Vocabulary Discipline]], [[Council Seats]], [[pi-remote]]

## Sources
[[EV-1 Ruling]], [[EV-4 Ruling]], [[EV-5 Ruling]], [[FLLWUP-4 Ruling]], [[FLLWUP-5 Ruling]]
