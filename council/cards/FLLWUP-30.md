---
id: FLLWUP-30
title: "Keep the shared main worktree's HEAD untouched during a run (no seat checkouts in the main checkout)"
state: Done
owner: null
epic: EPIC-3
goal: A run seat never runs `git checkout` in the shared main worktree (seats operate only inside their own isolated worktree), so the main worktree's HEAD and branch are never left detached or moved during a run.
---

## Intent

Filed from the FLLWUP-24 run's step 12. The main worktree's reflog showed HEAD
being moved by `git checkout` to the PR head and back (`HEAD@{1}`–`HEAD@{4}`:
`moving from main to b56b1dc`, `moving from b56b1dc to b784540`, …), leaving the
main worktree **detached at `b784540`**. The facilitator's subsequent
`git rebase origin/main` then rebased the detached HEAD (nothing ahead) and
moved it to the merge commit instead of replaying the local council commits;
recovery required reattaching `main` (`9c4bf07`) and rebasing again.

A run's main worktree is the facilitator's write surface (board/cards) and must
stay on its branch across seat dispatches. Seat reconnaissance and verification
must happen inside the seat's own isolated worktree.

## Acceptance

- No seat performs `git checkout` / `git switch` in the shared main worktree
  during a run; the main worktree stays on its branch and its HEAD is never
  left detached.
- The convention is written where seats/runner read it (the owner/skeptic seat
  definitions or the council run book), not left implicit. Per R-CONV-1 the
  sanctioned sink is this repository's `AGENTS.md`.
- No product behavior changes; the repo's gates stay green.

## Run rulings — /features-deliver EPIC-3 (2026-09-23)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

## Run record — /features-deliver EPIC-3 (2026-09-23)

### Step 1 — recorded mode Direct (authoritative)
EV-70 owner-only lane. Mechanical, not surface-touching (agent-facing docs, no user-visible product surface). Concurs with the recorded routing; no fallback judgment needed. Direct path: no deliberation, no spec file, no skeptic, no judge — criteria 1, 2, 5 only.

### Step 7 — handoff (record commit `be75601`)
Card set `In Progress` (card + board), validate.py clean.

### Step 8 — owner implements (job-2.1, settled 2.6m, ~202K tokens)
Worktree `/home/tista/codes/pi-remote-fllwup-30` cut from `origin/main` `29f1488` (main-worktree HEAD untouched; owner confirmed `symbolic-ref HEAD` resolves to `refs/heads/main`). Branch `owner/fllwup-30-main-worktree-immutability`, PR #34 open at head `624681c8eabcd6b24eeba3f0902ee3e8025d2b31`, diff = `AGENTS.md` only (+7, immutability rule leading the "Council card worktrees" section, R-CONV-1 cited). Gates in the worktree: `bun install` exit 0; `bunx tsc --noEmit` exit 0; `bun test` 234 pass / 1 skip / 0 fail, exit 0. Card set `In Review` from the observed open PR (facilitator-verified: `gh pr view` OPEN, `gh pr diff --name-only` = `AGENTS.md`).

### Step 11 — merge gate (unattended, R-MERGE-1)
Deterministic merge check, mode Direct, against head `624681c8eabcd6b24eeba3f0902ee3e8025d2b31`: (1) owner gates green in full — facilitator re-ran them in the owner worktree: `bunx tsc --noEmit` exit 0, `bun test` 234 pass / 1 skip / 0 fail exit 0; (2) `gh pr checks 34 --json name,state,workflow` keyed on `workflow == "gates"` → `SUCCESS` (gates + gates-windows); (5) no `Needs Human` state, reviewDecision empty, no outstanding ruling — all five Phase-1 rulings applied and cited. `gh pr merge 34 --squash --match-head-commit 624681c…` (ordinary merge per R-ADMIN-1; `main` unprotected, MERGEABLE). PR MERGED 2026-09-23T20:29:22Z, squash commit **`de4a942efa8b1b9ab3bf9cf23801836258aaee4f`**. CI on the merged SHA: `gates` success, `gates-windows` success (check-runs API, observed).

### Step 12 — sync and reconcile
Blocked mid-step by a transient environment failure: all transports to github.com (git over SSH and HTTPS, api.github.com) began timing out immediately after the merge landed. The merge and its CI-green verification were already observed and complete; only the record push to `main` under R-PUSH-1 remains. Local `main` at the Done record commit, HEAD attached, tree clean. No checkout/switch/reset used (this card's own rule); repair is a plain `git fetch`/`git pull --no-rebase` + push once the network returns. Held for the resuming runner.

### Step 13 — follow-ups (held, not filed)
One candidate drafted (owner's incidental observation, out of scope for this card, dedup pass clean — no existing card or sibling covers it):

- Draft title: "Update AGENTS.md's stale unit-suite count in Current state (218 pass → observed 234)"
- Recorded decision (council_followup_review, active gate, status ok): **Mode: File — composite 0.16 < merge threshold 1.00 — Update AGENTS.md's stale unit-suite count in Current state (218 pass → observed 234) (active)**
- Held, not filed: confirmation-pending per the active gate — no card written to `council/cards/` in this container; resumable by the next runner against this draft title once the confirming ruling arrives.

- **R-CONV-1 (FLLWUP-27, FLLWUP-30)** — The run-hygiene conventions are written
  in this repository's `AGENTS.md`, the sanctioned sink. This card records the
  shared main-worktree immutability rule: no `git checkout`/`git switch`/
  `git reset` against the shared main worktree — every branch-state change
  happens in a dedicated `git worktree`. FLLWUP-27 records the owner-worktree
  base rule. This card is delivered, not retired: the convention is already
  carried by the packaged seat definitions and is restated in `AGENTS.md` so
  the repository records it. Both cards’ third Acceptance bullets are amended
  to name `AGENTS.md`.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-27 → FLLWUP-30 → FLLWUP-28 →
  FLLWUP-29. This card runs second.
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