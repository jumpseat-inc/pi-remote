---
title: EPIC-2 Decision Record
type: overview
summary: Synthesis of the autonomous run that produced docs/SERVER-SIDE-SPEC.md — a self-contained server-side implementation spec — with the new doctrine the run added to the corpus.
aliases: [EPIC-2 overview, server-side spec decision record]
tags: [overview/epic2, synthesis]
sources: ["[[EPIC-2 Decision Record]]"]
created: 2026-09-02
updated: 2026-09-02
---
**Provenance deviation, stated:** unlike the EPIC-1 corpus, this run archived no `vault/raw/` files — its rulings live in the council card records (EV-9..EV-14, the EPIC-2 face with Phase 1 rulings R1-R6) and in PRs #20-25. This page and its sibling pages cite those as authority; the deviation is the FLLWUP-16 precedent applied at run scale.

**What was built.** `docs/SERVER-SIDE-SPEC.md` (see [[Server-Side Spec]]) — a self-contained, implementation-plan-grade specification of the relay and control plane, written for a reader with no access to PI-SPEC or the client source. Six SHA-pinned PRs (#20-25): framing (invariants INV-1..6, RFC 2119 keyword convention, the sole external link), enrollment/identity, tunnel lifecycle, data-plane relay, registry/grants/trust, assembly with two audits. Epic closed `Done` by steward with residuals announced at the closure record.

**New doctrine this run added:**
- [[Self-Containment Audit]] — the R5 blocklist, zero soft references, exactly one external link, and R1's incremental workflow (the audit runs on the real artifact, never a concatenation).
- [[Normativity Test]] — a MUST/SHOULD must name its observation point; one-sided bounds are never normative. It decided the frame-size ruling (the host's unbounded snapshot makes a SHOULD cap unenforceable) and caught a shipped defect (FLLWUP-23's inverted MUST).
- [[Spec Correction Governance]] refined — the routing reconciliation between ride-the-PR and file-a-card (EV-12 OJ-2), via the governance's own ownership leg.
- [[Fixture-Green Honesty]] extended to closure — steward: "an audit that can only pass by finding nothing is an audit incentivized to find nothing"; surfaced-and-carded beats suppressed, and the closure record announces residuals at the surface.
- [[Closed Vocabulary Discipline]] extended — vocabulary shrink is also a ruling act: EV-13 Q1 dropped `pi-remote:device` from the scope union (a grant nothing can bear is dead vocabulary the day it ships).

**Open contradictions at close** (recorded as Backlog cards, stated here as open — the wiki does not resolve them): SERVER-SIDE-SPEC §2.3 device-flow poll shape vs the shipped headless driver (FLLWUP-22 — the live one, steward's residual queue #1, may touch client code); §5.10 inverted MUST (FLLWUP-23); PI-SPEC §7.2 no-lookup-state prose (FLLWUP-19); PI-SPEC §7.3 per-device-ack claim (FLLWUP-20); §1.2 scoping drift (FLLWUP-21); FLLWUP-18 (refresh encoding conformance). Steward's residual order: 22 → 23 → 21 → 18 → 19 → 20, ahead of any new epic.

**Process lessons.** The self-containment mandate was enforced mechanically (EV-14's grep audit plus soft-phrase read-through), and the conformance audit ran council-side, recorded on the card — the two-audit split kept the page clean while keeping the verification honest. Provider idle timeouts killed two EV-13 instances at the same long-generation step; the chunked-write mitigation (compose large documents in bounded tool calls) resolved it without a model change.

## Related
[[Server-Side Spec]], [[Self-Containment Audit]], [[Normativity Test]], [[Spec Correction Governance]], [[Fixture-Green Honesty]], [[Closed Vocabulary Discipline]], [[EPIC-1 Decision Record]], [[pi-remote]]

## Sources
Provenance: council cards EV-9..EV-14 and EPIC-2 (Phase 1 rulings R1-R6), PRs #20-25 (SHA-pinned merges: fd4df38a, 7170212, 6376e6e, 2dc4e06, 1951cd2, a8690c4). No vault/raw/ file — deviation stated above.
