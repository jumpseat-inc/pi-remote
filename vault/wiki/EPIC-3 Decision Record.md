---
title: EPIC-3 Decision Record
type: overview
summary: Synthesis of the four-card run that closed the device-flow polish run's residuals — run-hygiene conventions and the two fixture-pinning gaps — and the doctrine it added.
aliases: [EPIC-3 overview, run integrity decision record]
tags: [overview/epic3, synthesis]
sources: ["[[EPIC-3 Run (FLLWUP-27..30)]]"]
created: 2026-09-23
updated: 2026-09-23
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the FLLWUP-16 precedent at run scale. Authority is the council card faces (EPIC-3, FLLWUP-27..31), the run ledger, and PRs #33–#36.

**What was built.** Four residuals from the [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], delivered in the order **R-ORDER-1** ruled at Phase 1: FLLWUP-27 → FLLWUP-30 → FLLWUP-28 → FLLWUP-29. The first two codified run hygiene into `AGENTS.md`; the last two turned probe-proven behaviors into committed red-capable fixtures. Every card ran mode `Direct`; every merge was SHA-pinned with `gates` + `gates-windows` SUCCESS on the merged SHA (merges `dac5c7e`, `de4a942`, `3b60bb6`, `8a529d8`). Epic closed `Done` by `steward`.

**Doctrine this run added:**
- [[Execution-Mode Recording]] — the recorded dispatch mode vs the runner's re-derived path; `Direct` as the self-correcting default.
- [[Record-Push Discipline]] — the step-12 direct record push as a privileged write needing a run-scoped Phase-1 authorization.
- [[Run Workspace Isolation]] — the owner-branch-base and main-worktree-immutability conventions, unified.

**Doctrine this run closed:**
- [[Fixture-Green Honesty]] — its "probe-proven ≠ fixture-pinned" corollary named FLLWUP-28/29 as the worked examples; both are now committed fixtures, so the loop is closed rather than queued.
- [[Deterministic Merge Check]] — exercised in its mode-keyed form (its page previously stated the five criteria unconditionally; now Direct = 1/2/5).

**Residual at closure.** **FLLWUP-31** (`Backlog`) — correct `AGENTS.md`'s stale "218 pass" suite line (observed 237 at close); announced at the closure record, queued not permanently accepted. No card retired, no child reopened.

**Process lessons.** The run validates the Phase-1 rulings preflight: a recorded convention ruling removed the per-card "where does this live" escalation, and the run-scoped authorizations were recorded before the first push. A transient github.com outage tested the recovery discipline — observe the merge first, commit local state, rebase on recovery, never force ([[Record-Push Discipline]]).

## Related
[[EPIC-3 Run (FLLWUP-27..30)]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], [[Fixture-Green Honesty]], [[Deterministic Merge Check]], [[Council Seats]], [[Execution-Mode Recording]], [[Record-Push Discipline]], [[Run Workspace Isolation]], [[EPIC-1 Decision Record]], [[EPIC-2 Decision Record]]

## Sources
[[EPIC-3 Run (FLLWUP-27..30)]]; council cards EPIC-3 and FLLWUP-27..31; PRs #33–#36.