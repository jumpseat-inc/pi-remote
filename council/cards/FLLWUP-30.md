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
  definitions or the council run book), not left implicit.
- No product behavior changes; the repo's gates stay green.