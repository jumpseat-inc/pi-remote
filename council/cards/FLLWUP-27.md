---
id: FLLWUP-27
title: "Base owner worktrees on origin/main so card PRs stay product-only"
state: Backlog
owner: null
epic: null
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
  council run book or the owner seat definition), not left implicit.
- No product behavior changes; the repo's existing gates stay green.