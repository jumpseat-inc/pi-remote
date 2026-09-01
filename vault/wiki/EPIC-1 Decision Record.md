---
title: EPIC-1 Decision Record
type: overview
summary: Synthesis of the two autonomous delivery runs on EPIC-1 — 18 PRs, the doctrine the rulings converged on, and where the record deliberately left doors open.
aliases: [EPIC-1 overview, decision record]
tags: [overview/epic1, synthesis]
sources: ["[[EV-1 Ruling]]", "[[EV-3 Ruling]]", "[[EV-8 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[FLLWUP-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
EPIC-1 delivered pi-remote (see [[pi-remote]]) across two autonomous runs: 18 merged PRs, every one through a five-criterion deterministic merge check with SHA-pinned merges. This page is the synthesis; the per-card trail lives in the source pages.

**What was built.** OAuth2 enrollment (`/rc:login`, no env-var credentials), the tunnel client and transport with the seq/ack envelope, the pure translation mapper with the corrected §4 rows, JSONL replay with deterministic ids, injection with a live approval loop, the seven-state footer, and 207 tests across `gates` + `gates-windows`.

**The doctrine the run converged on** (each a page): [[Copy Honesty Doctrine]], [[Closed Vocabulary Discipline]], [[Stable Keys]], [[Spec Correction Governance]], [[Fixture-Green Honesty]], [[Cheapest To Reverse]], [[Gulf of Evaluation]], [[Judge Object Rule]], [[Verify Cycle Cap]], [[Footer Merge Policy]], [[Retry Policy]].

**How the record evolved.** Early rulings seeded principles that later rulings refined rather than contradicted: EV-1 Q3's prose-sync became full [[Spec Correction Governance]]; EV-2 Item 4's footer preference was amended by EV-8 J1 on a Skeptic-verified invariant (preferences are advisory); EV-3's retry-forever and EV-8 J3's credential-stop were ruled a two-seam boundary, not a conflict. Two Skeptic corrections changed the record's own facts (the false "no producer" claim in FLLWUP-3; the dead raise path in FLLWUP-5 probe 8) — both were flagged, never silently overwritten.

**Doors deliberately left open** (Backlog at close): FLLWUP-11 (stand-in members vs real SDK — potential load-time TypeError; highest severity), FLLWUP-12 (payload-shape honesty), FLLWUP-13 (registerPrompt slimming), FLLWUP-14 (raise-UI fidelity documentation), FLLWUP-15 (local-answer race), FLLWUP-16 (Windows test timeout), FLLWUP-17 (`tunnel.alreadyLive` keying). All carry binding riders; none may relitigate stable keys.

**Process lessons.** The [[Judge Object Rule]] was the single unblock for the whole run; [[Fixture-Green Honesty]] came from nearly shipping an acceptance the scope couldn't deliver; the Skeptic's machine-gate probes found defects neither deliberation nor implementation would (the BOM, the SID abbreviation, the kind-collision misroute).

## Related
[[pi-remote]], [[Council Seats]], [[Copy Honesty Doctrine]], [[Spec Correction Governance]], [[Footer Merge Policy]]

## Sources
[[EV-1 Ruling]], [[EV-1 Step-10 Judge-Object Ruling]], [[EV-2 Ruling]], [[EV-3 Ruling]], [[EV-4 Ruling]], [[EV-5 Ruling]], [[EV-7 Ruling]], [[EV-8 Ruling]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]], and the six design-position pages.
