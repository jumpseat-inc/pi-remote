---
id: FLLWUP-27
title: "Base owner worktrees on origin/main so card PRs stay product-only"
state: Done
owner: null
epic: EPIC-3
goal: A council card's owner branch is cut from origin/main rather than the run's local main, so the card's PR diff contains only its own product/plan change and not the run's local board, config, or preflight commits.
---

## Intent

Filed from the BUG-1 run (step 13). BUG-1's owner branched from the run's
local `main`, which had moved four commits ahead of `origin/main` with the
run's own board/config/preflight commits. Its PR #30 therefore carried plan
doc + `index.ts` + `test/index.test.ts` **plus** those four run commits, even
though the owner touched only the three product files. The facilitator had to
disambiguate the branch base for the Skeptic so scope objections targeted the
right delta, and the merge landed the run's council state through the PR
rather than through the step-12 record push.

The intended flow is that an owner PR carries product changes only and a run's
board/record commits land via the step-12 direct record push. Cutting owner
worktrees from `origin/main` (or rebasing the branch onto it before opening
the PR) restores that separation and keeps card PRs reviewable without
run-state noise.

## Acceptance

- A card run's owner branch is based on `origin/main`, so `gh pr diff` for the
  card shows only the owner's product and plan files.
- The run's board/config/preflight commits do not appear in the card PR; they
  reach `main` through the step-12 record push.
- The convention is written where the runner/owner seats actually read it (the
  council run book or the owner seat definition), not left implicit. Per
  R-CONV-1 the sanctioned sink is this repository's `AGENTS.md`.
- No product behavior changes; the repo's existing gates stay green.

## Run rulings — /features-deliver EPIC-3 (2026-09-23)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-CONV-1 (FLLWUP-27, FLLWUP-30)** — The run-hygiene conventions are written
  in this repository's `AGENTS.md`, the sanctioned sink. This card records the
  owner-worktree base rule: an owner branch is cut from `origin/main`, so the
  card PR carries only its own product/plan change. FLLWUP-30 records the
  shared main-worktree immutability rule. Both cards’ third Acceptance bullets
  are amended to name `AGENTS.md`.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-27 → FLLWUP-30 → FLLWUP-28 →
  FLLWUP-29. This card runs first.
- **R-PUSH-1 (run-wide)** — Run-scoped authorization: the step-12 record
  commit may be committed and pushed directly to `main` for this run only.
  Never extended to any later run.
- **R-ADMIN-1 (run-wide)** — Run-scoped authorization:
  `gh pr merge <PR> --squash --admin --match-head-commit <X>` may be used if a
  `main` ruleset blocks an ordinary merge. Unused while `main` is unprotected.
  Never extended to any later run.
- **R-MERGE-1 (run-wide)** — This run is unattended. The orchestrator executes
  the deterministic merge check and the merge without pausing for human
  confirmation, including the first merge of the run.
## Run record — /features-deliver EPIC-3 (2026-09-23)

### Step 1 — recorded mode Direct (authoritative)
EV-70 owner-only lane. Mechanical, not surface-touching (agent-facing docs, no user-visible product surface). Concurs with the recorded routing; no fallback judgment needed. Direct path: no deliberation, no spec file, no skeptic, no judge — criteria 1, 2, 5 only.

### Step 7 — handoff
Card set `In Progress` (card + board), validate.py clean, record commit `126de16`.

### Step 8 — owner implements (job-1.1, settled 3.3m, ~281K tokens)
Worktree `/home/tista/codes/pi-remote-fllwup-27` cut from `origin/main` `cb02823` per the card's own rule (main-worktree HEAD untouched). Branch `owner/fllwup-27-agents-worktree-base`, PR #33 at head `b63ba54279cbd69c9d97c051becdf90def802ca7`, one commit, diff = `AGENTS.md` only. Gates in the worktree: `bunx tsc --noEmit` exit 0; `bun test` 234 pass / 1 skip (Windows-gated) / 0 fail exit 0 — card's "218 pass" note verified stale at base cb02823 (234/1/0 there too; delta predates the change). Card set `In Review` from the observed open PR.

### Step 11 — merge gate (unattended, R-MERGE-1)
Deterministic merge check, mode Direct, against head `b63ba54`: (1) owner gates green in full; (2) `gh pr checks 33 --json name,state,workflow` keyed on `workflow == "gates"` → `SUCCESS` (gates + gates-windows); (5) no `Needs Human` state, reviewDecision empty, zero reviews, no outstanding ruling — R-MERGE-1 authorizes the merge. `gh pr merge 33 --squash --match-head-commit b63ba54…` (ordinary merge per R-ADMIN-1; `main` unprotected, MERGEABLE). PR MERGED 2026-09-23T20:18:24Z, squash commit **`dac5c7e5ab2d6e0f284264a007dd6cfa0652be2c`**. CI on the merged SHA: `gates` success, `gates-windows` success (check-runs API + run list, conclusion success).

### Step 12 — sync and reconcile
Record commit rebased onto `origin/main` `dac5c7e` (rebase of the In Progress/In Review record commits — no local commit discarded, no force, no conflict markers; squash-merge touched `AGENTS.md` only, disjoint from council records). validate.py clean. Record commit pushed directly to `main` under **R-PUSH-1** (run-scoped authorization, this run only). Card set `Done` from the observed merged artifact.

### Step 13 — follow-ups
None drafted: the run surfaced no deferred idea, no out-of-scope objection, and no "we should also" item. No `council_followup_review` call needed (no candidates); no cards written.

### Step 14 — persist
No durable wiki artifact surfaced; `vault/` untouched (repo has no wiki pages for run hygiene; AGENTS.md is the sanctioned sink per R-CONV-1).
