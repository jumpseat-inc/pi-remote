---
title: EPIC-6 Run (FLLWUP-39..40)
type: source
summary: The two-card single-runner run (2026-09-24) that declared the vendored thinking/tool-call signature fields and corrected the pairing-test comment — one owner, one Skeptic, one judge over one PR (#47).
aliases: [EPIC-6 run, FLLWUP-39 run, FLLWUP-40 run, single-runner run]
tags: [council/run, sdk, testing, doctrine]
sources: ["[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-24
updated: 2026-09-24
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the [[EPIC-3 Run (FLLWUP-27..30)]] and [[EPIC-4 Run (FLLWUP-11..12)]] precedent. Authority is the council card faces (EPIC-6, FLLWUP-39, FLLWUP-40 with their run records), the run ledger, and PR #47. It depends on the **EPIC-5** run's step-13 records (FLLWUP-39..40 were FLLWUP-38/37's residuals), which the wiki has not yet ingested — flagged in log.md.

An autonomous `/features-deliver EPIC-6` run (2026-09-24) delivered **two cards in one council runner** — the run's defining constraint. The human's intake directive and EPIC-6's approved `goal` both required it (**R-ONE-RUN-1**): one `owner` implementation (one branch and PR) covering both changes first, then one `skeptic` verification and one judge `PASS` covering both. The run honored it exactly: owner job-14.1 (`owner/epic6-sdk-residuals`, PR #47), skeptic job-14.2, judge job-14.3 — no generator seats, no duplicate dispatch. This is [[Batched Card Delivery]], the wiki's first worked two-card single-run example; the established default is one runner per card.

**What shipped (PR #47, merge `cb0ba13`).**
- **FLLWUP-39** — the vendored `PiThinkingContent` now declares `thinkingSignature?: string` (pi-ai `dist/types.d.ts:247–255`, field `:250`) and `PiToolCall` declares `thoughtSignature?: string` (`:261–269`, field `:266`), each with line-referenced provenance per the R-TYPE-1 vendoring pattern, mirroring FLLWUP-38's DECLARE path. `redacted?` (`:254`) and `namespace?` (`:268`) are **deliberately omitted with the reasons stated** in the provenance comments. The SDK is not a dependency (`package.json`/`bun.lock` diff vs `origin/main` empty). This is the sibling case FLLWUP-38's first-step verification opened ([[Real-Surface Verification]], [[pi-sdk-events.ts]]).
- **FLLWUP-40** — the FLLWUP-12 static pairing test's source comment in `test/translate.test.ts` was corrected (+8/−3, **assertions byte-identical**) to state what the test actually pins: derivation-text presence and role vocabulary in the 400-char signature windows, and **not** the value-level decode comparison — consistent with the merged `docs/ROLE-DECODER-DUPLICATION.md`. The skeptic re-demonstrated the documented false-green (mutate the decode comparison → suite still green → restore byte-exact). This is the comment-level variant of [[Record Accuracy]].

**Merge basis.** Both cards recorded execution mode **`Verify`** ([[Execution-Mode Recording]]), read mechanically via `council_route op:"authority"` keyed to the single ROOT `job-14` — one authority read and one squash SHA satisfied both cards. All five [[Deterministic Merge Check]] criteria held (owner gates `bunx tsc --noEmit` exit 0, `bun test` 279 pass / 1 Windows-gated skip / 0 fail; `gates` SUCCESS on the PR head and merged SHA; no blocking skeptic objection; judge `PASS`; no `Needs Human`). `--admin` was recorded (R-ADMIN-1) but unused — `main` unprotected.

**Doctrine this run exercised or added.** [[Batched Card Delivery]] (new) — one runner, one owner, one skeptic, one judge across two cards, with the epic `goal` encoding the mechanics so `steward`'s closure certifies both the product delta and the build order. [[Real-Surface Verification]] — extended to *declare-or-annotate-with-reason* for vendored fields (including deliberately omitted siblings). [[Record Accuracy]] / [[Fixture-Green Honesty]] — a source comment that overstates what a test pins is a lying record; fixed comment-only. [[Council Seats]] — promotion ratification exercised again (product-owner job-13), and the single container authored both cards. [[Record-Push Discipline]] — R-PUSH-1/R-ADMIN-1 re-recorded run-scoped before the first push; note that the EPIC-5 and EPIC-6 runs shared one run id, since the run substrate is keyed to the host session.

**Closure and residual.** `steward` job-15 ratified EPIC-6 **`Done` (met)** — both children `Done` from one run, one PR merged with green `gates`; **no residual accepted**, no follow-ups filed. The pair that the EPIC-5 run's closure had announced as ungrouped residuals is now delivered, closing EPIC-5's announced-debt trail.

**Environment note.** The record push used plain `origin` with a per-invocation `gh auth git-credential` helper; the explicit `ssh://git@github.com/…` form that worked in EPIC-4 intermittently failed/hung here.

## Related
[[EPIC-6 Decision Record]], [[Batched Card Delivery]], [[Real-Surface Verification]], [[Record Accuracy]], [[Execution-Mode Recording]], [[Deterministic Merge Check]], [[Council Seats]], [[Record-Push Discipline]], [[pi-sdk-events.ts]], [[translate.ts]], [[Fixture-Green Honesty]], [[EPIC-4 Run (FLLWUP-11..12)]]

## Sources
`council/cards/EPIC-6.md`, `council/cards/FLLWUP-39.md`, `council/cards/FLLWUP-40.md`; run ledger; PR #47 (merge `cb0ba13`). No `vault/raw/` file — deviation stated above.