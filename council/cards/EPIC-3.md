---
id: EPIC-3
title: "Run integrity and device-flow coverage — the device-flow polish run's four follow-ups"
state: Ready
owner: null
epic: null
goal: Card runs are self-contained and their behavior is fixture-pinned — an owner PR contains only its product/plan change (branches base on `origin/main`), no seat leaves the shared main worktree's HEAD detached, and the login suite pins both cancellation during the 5-second device-flow slowdown and the attended PKCE path's no-`login.failure.detail` boundary.
---

## Intent

The three-card device-flow polish run (BUG-1, FLLWUP-24, FLLWUP-25) closed the
headless-login gaps but filed four follow-ups that belonged together and had no
common home. Two were **epic-less run-process cards** (FLLWUP-27: owner
worktrees base on `origin/main` so card PRs stay product-only; FLLWUP-30: no
seat `git checkout` in the shared main worktree) and two were **EPIC-2
residuals** (FLLWUP-28: pin cancellation during the 5-second slowdown;
FLLWUP-29: pin the attended PKCE path's no-`login.failure.detail` boundary).
EPIC-2 is already `Done`, so its residuals were carried as provenance rather
than under a live fence.

This epic gives those four a single home. Its theme is the lesson the run
taught: **a run's own hazards and its unproven-but-correct behaviors need
durable carriers** — 27/30 came from real incidents (a contaminated PR base, a
detached main-worktree HEAD), and 28/29 from [[Fixture-Green Honesty]]'s
corollary that a probe-proven green is not fixture-pinned. Grouping them means
the run-hygiene conventions and the coverage pins land together instead of
drifting as unowned Backlog.

Delivered by children FLLWUP-27 through FLLWUP-30; this card tracks the set and
is not actionable on its own. (Grouping reassigns FLLWUP-28/29 off EPIC-2 and
clears the `epic: null` on FLLWUP-27/30.)

## Acceptance

Observed as met when FLLWUP-27 through FLLWUP-30 are all Done: card PRs are
product-only, the main worktree's HEAD never leaves its branch across seat
dispatches, and both device-flow behaviors carry committed red-capable
fixtures. The two run-hygiene conventions are written where the seats/runner
read them, not left implicit; the repo's gates stay green throughout.

## Run rulings — /features-deliver EPIC-3 (2026-09-23)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-CONV-1 (FLLWUP-27, FLLWUP-30)** — The run-hygiene conventions are written
  in this repository's `AGENTS.md`, the sanctioned sink (“where the
  runner/owner seats actually read it”). FLLWUP-27 records the owner-worktree
  base rule: an owner branch is cut from `origin/main`, so the card PR carries
  only its own product/plan change. FLLWUP-30 records the shared main-worktree
  immutability rule: no `git checkout`/`git switch`/`git reset` against the
  shared main worktree — every branch-state change happens in a dedicated
  `git worktree`. FLLWUP-30 is delivered, not retired: its convention is
  already carried by the packaged seat definitions and is restated in
  `AGENTS.md` so the repository records it. Both cards’ third Acceptance
  bullets are amended to name `AGENTS.md` as the sink.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-27 → FLLWUP-30 → FLLWUP-28 →
  FLLWUP-29.
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