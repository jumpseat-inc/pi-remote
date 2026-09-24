---
title: EPIC-4 Decision Record
type: overview
summary: Synthesis of the two-card run that closed the installability gap — real-surface verification, emission-semantics fidelity, record accuracy, and runner stall recovery — and the seven follow-ups now grouped under EPIC-5.
aliases: [EPIC-4 overview, real-host installability decision record]
tags: [overview/epic4, synthesis, sdk]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]"]
created: 2026-09-24
updated: 2026-09-24
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the [[EPIC-3 Run (FLLWUP-27..30)]] precedent. Authority is the council card faces (EPIC-4, FLLWUP-11/12, FLLWUP-32..38), PRs #38/#39, and the run ledger.

**What was built.** EPIC-4 reconciled pi-remote with the *installed* pi SDK. [[pi-remote]] had only ever been fixture-tested against a local `ExtensionAPI` stand-in; that stand-in had drifted from the real SDK in two invisible ways. FLLWUP-11 removed/re-homed the 13 non-`on` base members (2 kept typed-to-real, 5 re-homed to `ExtensionContext`, 5 to [[pi-host.ts]], 1 dropped) and vendored the real signatures; FLLWUP-12 re-narrowed all eleven live `forward()` handlers on the real payload types and added [[pi-sdk-events.ts]]. Both merged with `gates` SUCCESS on head + merged SHAs (FLLWUP-11 `a91a30b`, FLLWUP-12 `524bc90`), mode `Verify`, all five [[Deterministic Merge Check]] criteria. The extension now loads through the installed production loader — `REAL LOAD OK`.

**Doctrine this run added:**
- [[Real-Surface Verification]] — verify at the real boundary; a non-vacuous gate is proven by defect injection; "correct-or-document" is a strict boundary.
- [[Emission-Semantics Fidelity]] — fixture the constructing layer's per-emission semantics (fresh copies), not the pass-through emitter.
- [[Record Accuracy]] — the run record's counts/claims are their own honesty axis.
- [[Runner Stall Recovery]] — size the stall window above the longest child dispatch; cancel + one re-dispatch with a resumption note.

**Doctrine this run refined:**
- [[Execution-Mode Recording]] — `council_route` is parent-only; the orchestrator supplies the recorded mode in the dispatch input; `Verify` suits implementation-after-ruling work.
- [[Fixture-Green Honesty]] — the FLLWUP-9 stand-in corollary is now a worked example, not a hypothesis; the latent runtime defect was real.
- [[Council Seats]] — the held-follow-up confirmation path exercised end-to-end (seven candidates).

**Residual at closure.** Seven follow-ups filed (FLLWUP-32..38), now grouped under **EPIC-5**; steward promoted FLLWUP-34 `Backlog → Ready` because its "once FLLWUP-12 lands" precondition is satisfied. The one stale artifact is `AGENTS.md`'s "Current state" claim, carried by FLLWUP-34 — the wiki's own [[pi-remote]] and [[pi-sdk-on.ts]] pages were corrected by this ingest.

**Process lesson.** The run's central result is negative-space evidence: a full-green local suite proved nothing about the real host. The fix was not more fixtures against the stand-in but verification at the real boundary, plus a gate proven capable of failing.

## Related
[[EPIC-4 Run (FLLWUP-11..12)]], [[Real-Surface Verification]], [[Emission-Semantics Fidelity]], [[Record Accuracy]], [[Runner Stall Recovery]], [[pi-remote]], [[pi-sdk-on.ts]], [[pi-host.ts]], [[pi-sdk-events.ts]], [[Fixture-Green Honesty]], [[Execution-Mode Recording]], [[Deterministic Merge Check]], [[EPIC-3 Decision Record]], [[EPIC-1 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]]