---
title: Deterministic Merge Check
type: concept
summary: The mechanical gate that replaced the human merge, keyed by the card's recorded execution mode (Direct = criteria 1/2/5; Verify and Deliberate = all five), pinned to the head SHA with --match-head-commit.
aliases: [merge check, five criteria]
tags: [concept/process, merge]
sources: ["[[Judge Object Rule]]", "[[FLLWUP-5 Ruling]]", "[[Execution-Mode Recording]]", "[[EPIC-3 Run (FLLWUP-27..30)]]"]
created: 2026-09-02
updated: 2026-09-23
---
The autonomous run's merge gate, executed with no discretion — no seat may substitute judgment for any criterion, and none may be skipped for small changes:

1. Every owner gate green, in full — regardless of change size.
2. GitHub Actions green on the PR head SHA: read via `gh pr checks <PR> --json name,state,workflow`, keyed on the `workflow` field; the `gates` workflow must APPEAR with `state: SUCCESS` — an absent check is not a passing check.
3. No blocking Skeptic objection.
4. Judge verdict PASS (object per the [[Judge Object Rule]] — the PR branch at the Skeptic-verified SHA).
5. No `Needs Human` state or outstanding ruling on the card.

**Mode-keyed.** These criteria are keyed by the card's recorded execution mode ([[Execution-Mode Recording]]), read mechanically from the run substrate, never from a seat's report: **Direct** applies criteria 1, 2, and 5 only — no skeptic and no judge are dispatched, the test suite is that mode's only gate; **Verify** applies all five, with criterion 3 scoped to the single Verify skeptic dispatch; **Deliberate** applies all five verbatim. A card with no recorded execution mode HALTs rather than merging. This page's earlier unconditional five-criteria framing is superseded by the mode-keyed ruleset; the numbered criteria above remain the Deliberate set.

**SHA pinning:** the merge is `gh pr merge <PR> --match-head-commit <X>` where X is the exact SHA criterion 2 was read against; if the flag is unavailable, re-read `headRefOid` immediately before merging and abort on mismatch. A mismatch is a HALT, not a retry. Across EPIC-1's 18 merges this pinned every merge; the one gates-windows flake (a bun 5s cold-start timeout, FLLWUP-16) was resolved by rerun + clean re-read, not by lowering the bar.

## Related
[[Judge Object Rule]], [[Verify Cycle Cap]], [[Council Seats]], [[Execution-Mode Recording]], [[Record-Push Discipline]], [[EPIC-3 Decision Record]], [[EPIC-1 Decision Record]]

## Sources
[[Judge Object Rule]], [[FLLWUP-5 Ruling]], [[Execution-Mode Recording]], [[EPIC-3 Run (FLLWUP-27..30)]]
