---
title: Run Workspace Isolation
type: concept
summary: Two run-hygiene rules now written in AGENTS.md — an owner branch is cut from origin/main so card PRs stay product-only, and no seat mutates the shared main worktree's branch state.
aliases: [run hygiene, workspace isolation, main worktree immutability, card PR hygiene]
tags: [concept/process, council, git]
sources: ["[[EPIC-3 Run (FLLWUP-27..30)]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]", "[[EPIC-6 Run (FLLWUP-39..40)]]", "[[BUG-2 Run]]"]
created: 2026-09-23
updated: 2026-09-27
---
A council run writes durable state (board, cards, preflight) into the repository while an owner works a card in a separate worktree. Two conventions keep that from contaminating either the product diff or the shared checkout. Both were filed from real incidents in the [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]] and delivered into this repository's `AGENTS.md` by the [[EPIC-3 Run (FLLWUP-27..30)]].

**1. Card PRs are product-only (owner branch cut from `origin/main`).** A card's owner branch/worktree is cut from `origin/main`, never the run's local `main`, which carries unpushed run-state commits. A PR whose base was the run's local `main` carried the run's board/config/preflight commits alongside the product change; cutting from `origin/main` keeps the PR diff to the owner's product/plan files and routes the run's records through the step-12 push ([[Record-Push Discipline]]).

**2. The shared main worktree is immutable (no `checkout`/`switch`/`reset`).** Seat reconnaissance and verification happen inside the seat's own isolated worktree. A `git checkout` in the shared main worktree left its HEAD detached mid-run, and the facilitator's subsequent rebase moved the detached HEAD instead of replaying the run's commits. Rule: the main worktree stays on its branch; all branch-state change (moving a pointer, checking out a commit, switching branches, rewinding history) happens via `git worktree add`.

Both rules now live in the loader every seat reads first. The same immutability is mirrored in the packaged `owner`/`skeptic`/`council-runner` seat definitions ([[Council Seats]]). A [[Batched Card Delivery]] still uses exactly **one** owner worktree cut from `origin/main` — the batch changes nothing about the base or the product-only rule, it just means one worktree/PR carries both cards' product changes.

The [[BUG-2 Run]] is the predicted divergence, repaired rather than avoided: the owner branch was cut from `origin/main` (PR #52 is product-only), local `main` kept the run's record commits, and after the merge the facilitator union-merged `origin/main` (`ff0998e`). No `reset`, no force, no side discarded. Main-worktree immutability held: owner, skeptic, and judge used other worktrees.

## Related
[[Council Seats]], [[Record-Push Discipline]], [[Deterministic Merge Check]], [[Batched Card Delivery]], [[Fixture-Green Honesty]], [[EPIC-3 Decision Record]], [[EPIC-6 Decision Record]], [[BUG-2 Run]]

## Sources
[[EPIC-3 Run (FLLWUP-27..30)]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], [[EPIC-6 Run (FLLWUP-39..40)]], [[BUG-2 Run]]