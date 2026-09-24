---
title: Record-Push Discipline
type: concept
summary: The step-12 direct-to-main record commit is a privileged write the authority map does not re-home; it needs a run-scoped Phase-1 authorization recorded before the first push, and an unauthorized push is a HALT.
aliases: [record push, step-12 push, admin bypass, record-push authorization]
tags: [concept/process, merge, security]
sources: ["[[EPIC-3 Run (FLLWUP-27..30)]]"]
created: 2026-09-23
updated: 2026-09-23
---
The autonomous run's durable state is the board and the card files. Step 12 commits the reconciliation and pushes it **directly to `main`** — the "push records as they happen" recipe that keeps a run recoverable ([[Run Workspace Isolation]]). The authority map re-homes exactly one merge-time power (the human merge gate → the [[Deterministic Merge Check]]) and says nothing about this push. Under a `main` ruleset that forbids direct updates, that push is a **second privileged write**.

**The rule.** A direct-to-`main` record push requires a recorded, run-scoped, human-granted **Phase-1** authorization, named on the run's Phase-1 record **before the run's first record push**. The authorization is never extended to a later run. An unauthorized push is a **HALT** surfaced to the human, never silently executed. The sequencing word is load-bearing: a retroactive grant is a disclosure, not compliance.

**The merge-side analogue.** `gh pr merge <PR> --squash --admin --match-head-commit <X>` is sanctioned under the same rule — only with a recorded, run-scoped authorization, and never extended. A run without one that a ruleset then blocks is a HALT (the protection doing its job), not an obstacle to defeat.

**Observed.** The [[EPIC-3 Run (FLLWUP-27..30)]] recorded **R-PUSH-1** (direct record push) and **R-ADMIN-1** (`--admin` contingency) at Phase 1 before the first push; `main` was unprotected, so `--admin` went unused and every merge was ordinary squash with `--match-head-commit`. When a github.com outage interrupted one card after its merge, the runner left the record commits committed locally and the orchestrator rebased them onto `origin/main` on recovery — no force, no reset, no history rewrite.

## Related
[[Deterministic Merge Check]], [[Run Workspace Isolation]], [[Council Seats]], [[EPIC-3 Decision Record]]

## Sources
[[EPIC-3 Run (FLLWUP-27..30)]]