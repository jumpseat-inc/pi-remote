---
title: EPIC-3 Run (FLLWUP-27..30)
type: source
summary: The four-card run that delivered the device-flow polish run's residuals — the owner-branch base and main-worktree isolation conventions, and committed fixtures pinning slowdown cancellation and the attended no-detail boundary.
aliases: [EPIC-3 run, run integrity and device-flow coverage, FLLWUP-27..30 run]
tags: [council/run, run-hygiene, testing, login]
sources: ["[[EPIC-3 Run (FLLWUP-27..30)]]"]
created: 2026-09-23
updated: 2026-09-23
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the FLLWUP-16 precedent at run scale. Its authority is the council card faces (EPIC-3, FLLWUP-27..31), the run ledger, and PRs #33–#36.

An autonomous `/features-deliver EPIC-3` run (2026-09-23) delivered the four residuals the [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]] filed. Build order was ruled at Phase 1 (**R-ORDER-1**): FLLWUP-27 → FLLWUP-30 → FLLWUP-28 → FLLWUP-29. Every card ran the same recorded execution mode — **`Direct`**, chosen as the robust default ([[Execution-Mode Recording]]). Every merge was SHA-pinned and `gates` + `gates-windows` SUCCESS on the merged SHA ([[Deterministic Merge Check]]).

**What shipped.**
- **FLLWUP-27 (PR #33, merge `dac5c7e`)** — the owner-worktree base rule written into `AGENTS.md`: an owner branch is cut from `origin/main`, so a card PR carries only its own product/plan change; the run's board/config/preflight commits reach `main` through the step-12 record push ([[Run Workspace Isolation]]).
- **FLLWUP-30 (PR #34, merge `de4a942`)** — the shared main-worktree immutability rule written into `AGENTS.md`: no `git checkout`/`git switch`/`git reset` against the shared worktree; every branch-state change happens in a dedicated `git worktree`. Delivered, not retired: the rule already lived in the packaged seat definitions, so restating it in the loader makes the repository record it ([[Run Workspace Isolation]]).
- **FLLWUP-28 (PR #35, merge `3b60bb6`)** — a committed fixture pinning cancellation arriving during the five-second RFC 8628 §3.5 slowdown sleep: outcome `cancelled`, no failure copy, no further token poll. Red-at-base recorded in full (seven fields).
- **FLLWUP-29 (PR #36, merge `8a529d8`)** — a committed fixture pinning the attended (PKCE) path's no-`login.failure.detail` boundary: an attended token-exchange failure carrying an `error_description` emits no detail line. Red-at-base recorded in full.

**Doctrine this run exercised or added.**
- **[[Execution-Mode Recording]]** (new) — the recorded dispatch mode is read mechanically from the run substrate, but the runner re-derives its path from the gate-ledger fallback; the `Direct` default self-corrects upward.
- **[[Record-Push Discipline]]** (new) — the step-12 direct record push is a privileged write requiring a run-scoped Phase-1 authorization; this run recorded **R-PUSH-1** (record push) and **R-ADMIN-1** (`--admin` contingency, unused — `main` unprotected) before the first push.
- **[[Run Workspace Isolation]]** (new) — the two conventions above, unified.
- **[[Fixture-Green Honesty]]** — the probe-proven gaps from the prior run are now fixture-pinned; the corollary's loop is closed.
- **[[Deterministic Merge Check]]** — exercised in its **mode-keyed** form (Direct = criteria 1, 2, 5).

**Closure and residual.** `steward` ruled EPIC-3 **`Done`**, closing the epic with its one residual announced at the closure record: **FLLWUP-31** (`Backlog`) — correct `AGENTS.md`'s stale "218 pass" suite count (observed 237 at close). Filed during the run from FLLWUP-30's step-13 candidate, whose recorded follow-up decision (`Mode: File`) was confirmed by `product-owner` before the card was written.

**Environment resilience.** A ~15-minute github.com outage began immediately after FLLWUP-30's merge. The merge and merged-SHA CI were observed first; the runner committed all local record state and reported a resume recipe rather than forcing. On recovery the orchestrator rebased the local record commits onto `origin/main` (disjoint files, no conflict, no force, no markers) and pushed ([[Record-Push Discipline]]). SSH port 22 was blocked for part of the session; pushes used HTTPS with a `gh` credential helper.

## Related
[[EPIC-3 Decision Record]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], [[Execution-Mode Recording]], [[Record-Push Discipline]], [[Run Workspace Isolation]], [[Fixture-Green Honesty]], [[Deterministic Merge Check]], [[Council Seats]], [[login.ts]], [[pi-remote]]

## Sources
`council/cards/EPIC-3.md`, `council/cards/FLLWUP-27.md`…`FLLWUP-31.md`; run ledger `EPIC-3-ledger.md`; PRs #33–#36 (merges `dac5c7e`, `de4a942`, `3b60bb6`, `8a529d8`). No `vault/raw/` file — deviation stated above.