---
title: EPIC-4 Run (FLLWUP-11..12)
type: source
summary: The two-card autonomous run (2026-09-24) that reconciled pi-remote's ExtensionAPI stand-in and handler payload shapes with the installed pi SDK — real production-loader verification, an emission-semantics fix cycle, and seven filed follow-ups now grouped under EPIC-5.
aliases: [EPIC-4 run, real-host installability run, FLLWUP-11 run, FLLWUP-12 run]
tags: [council/run, sdk, testing, doctrine]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]"]
created: 2026-09-24
updated: 2026-09-24
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the [[EPIC-3 Run (FLLWUP-27..30)]] precedent at run scale. Its authority is the council card faces (EPIC-4, FLLWUP-11/12 with their run records and the FLLWUP-33 post-run correction), the seven follow-up cards FLLWUP-32..38, PRs #38/#39, and the run ledger.

An autonomous `/features-deliver EPIC-4` run (2026-09-24) closed the installability gap left by [[EPIC-1 Decision Record]]: everything shipped to that point was fixture-tested against a local `ExtensionAPI` stand-in, and that stand-in had silently drifted from the installed pi SDK in two ways — missing/foreign members and event-payload shapes. Both defects are invisible to a green local suite, which is the whole point of the run. Build order was ruled at Phase 1 (**R-ORDER-1**): FLLWUP-11 → FLLWUP-12. Both cards ran recorded execution mode **`Verify`** ([[Execution-Mode Recording]]), and both merges were SHA-pinned with `gates` SUCCESS on the head and merged SHAs ([[Deterministic Merge Check]]).

**What shipped.**
- **FLLWUP-11 (PR #38, merge `a91a30b`)** — the stand-in's non-`on` members reconciled. The audit found **13 non-`on` base members**: 2 kept typed-to-real (`registerCommand`, `sendUserMessage` — both genuinely present), 5 re-homed to the real `ExtensionContext` surface (`ctx.ui.setStatus`, `ctx.ui.input`, `ctx.isIdle()`, `ctx.sessionManager`, `ctx.cwd`), 5 to a new documented local-capability module ([[pi-host.ts]]), and 1 dropped (`version`). Real SDK signatures **vendored** into [[pi-sdk-on.ts]] and [[pi-host.ts]] with provenance and re-diff notes; the SDK was **not** added as a dependency (R-TYPE-1). The decisive evidence was a real load through the installed production loader (`loadExtensionFromFactory`) → `REAL LOAD OK`, with the gate proven non-vacuous by defect injection (`pi.getSetting is not a function` reproduced) ([[Real-Surface Verification]]).
- **FLLWUP-12 (PR #39, merge `524bc90`)** — every one of the eleven live `forward()` handlers re-narrowed on the real SDK payload types, vendored in [[pi-sdk-events.ts]]. Verify cycle 1 **BLOCKED**: pass-through fixtures assumed shared object identity, but the engine emits fresh spread-copies per event, so an identity-derived `messageId` minted a fresh key per emission (two `TEXT_MESSAGE_START`, zero `END`). The fix derives the id from payload-intrinsic `(role, timestamp)`; verify cycle 2 **PASSED** with zero open objections. The single documentation-only divergence (`tool_result`: `messageId := toolCallId`) is justified on the card under R-PAYLOAD-1 ([[Emission-Semantics Fidelity]]).

**Doctrine this run exercised or added.**
- **[[Real-Surface Verification]]** (new) — verify at the real boundary, not the stand-in; prove the gate non-vacuous by defect injection; "correct-or-document" is a strict boundary.
- **[[Emission-Semantics Fidelity]]** (new) — fixture the constructing layer's per-emission semantics, not the pass-through emitter.
- **[[Record Accuracy]]** (new) — the run record's own counts/claims must match the audit they cite (the "twelve vs 13" defect).
- **[[Runner Stall Recovery]]** (new) — a runner's stall window must exceed its longest child dispatch; recovery is cancel + one re-dispatch with an explicit resumption note.
- **[[Execution-Mode Recording]]** — refined: `council_route` is parent-only, so the orchestrator supplies the recorded mode in the runner's dispatch input; `Verify` is the right mode when Phase-1 rulings settle the design (no deliberation, but skeptic + judge still required).
- **[[Deterministic Merge Check]]** — exercised in its `Verify` form (all five criteria, criterion 3 scoped to the single Verify skeptic dispatch).
- **[[Record-Push Discipline]]** — **R-PUSH-1** and **R-ADMIN-1** re-recorded run-scoped before the first push; `main` unprotected, so `--admin` went unused and every merge was ordinary squash.
- **[[Fixture-Green Honesty]]** — its FLLWUP-9 stand-in corollary is now a worked example: the latent runtime defect was real and is closed.

**Held follow-ups, exercised end-to-end.** Each card's step-13 candidates were held confirmation-pending (recorded `Mode: File`); the orchestrator routed each draft to `product-owner`, which ratified all seven, and a resumed runner wrote them as their own cards. This is the full version of the path [[Council Seats]] records from EPIC-3.

**Closure and residual.** `steward` ruled EPIC-4 **`Done` (met)**: both children `Done`, `tsc` exit 0, `bun test` green (248 pass / 1 Windows-gated skip / 0 fail at FLLWUP-11; 270/1/0 at FLLWUP-12), real load smoke green, no missing-member error. Seven follow-ups were filed — **FLLWUP-32** (load-smoke test header overstates its compile-time claim), **FLLWUP-33** (the FLLWUP-11 record's member-count discrepancy), **FLLWUP-34** (`AGENTS.md` "Current state" stale once FLLWUP-12 lands), and **FLLWUP-35..38** (FLLWUP-12's candidates). Steward also promoted FLLWUP-34 `Backlog → Ready` because its precondition is now satisfied. The seven now group under the new **EPIC-5**, since Done EPIC-4 had no live home (**EPIC-5** grouping).

**Environment resilience.** A concurrency race on an 8-way simultaneous seat probe tripped a stale-ctx MCP error after each seat emitted its output; a lone probe was clean, so it was a fan-out race, not a seat-resolution failure. One `product-owner` dispatch failed transiently on a `@modelcontextprotocol/sdk` extension-load error; the dependency resolves and the single permitted re-dispatch succeeded. The first runner stalled blocked on a long owner dispatch and was recovered per [[Runner Stall Recovery]].

## Related
[[EPIC-4 Decision Record]], [[Real-Surface Verification]], [[Emission-Semantics Fidelity]], [[Record Accuracy]], [[Runner Stall Recovery]], [[pi-host.ts]], [[pi-sdk-events.ts]], [[pi-sdk-on.ts]], [[Fixture-Green Honesty]], [[Execution-Mode Recording]], [[Deterministic Merge Check]], [[Council Seats]], [[pi-remote]]

## Sources
`council/cards/EPIC-4.md`, `council/cards/FLLWUP-11.md`, `council/cards/FLLWUP-12.md`, `council/cards/FLLWUP-32.md`…`FLLWUP-38.md`; run ledger (orchestrator report); PRs #38/#39 (merges `a91a30b`, `524bc90`). No `vault/raw/` file — deviation stated above.