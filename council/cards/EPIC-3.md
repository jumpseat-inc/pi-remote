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