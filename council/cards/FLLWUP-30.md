---
id: FLLWUP-30
title: "Keep the shared main worktree's HEAD untouched during a run (no seat checkouts in the main checkout)"
state: Ready
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