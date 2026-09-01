---
title: Deterministic Merge Check
type: concept
summary: The five-criteria mechanical gate that replaced the human merge — all five hold at one head SHA, and the merge is pinned to that SHA with --match-head-commit.
aliases: [merge check, five criteria]
tags: [concept/process, merge]
sources: ["[[Judge Object Rule]]", "[[FLLWUP-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
The autonomous run's merge gate, executed with no discretion — no seat may substitute judgment for any criterion, and none may be skipped for small changes:

1. Every owner gate green, in full — regardless of change size.
2. GitHub Actions green on the PR head SHA: read via `gh pr checks <PR> --json name,state,workflow`, keyed on the `workflow` field; the `gates` workflow must APPEAR with `state: SUCCESS` — an absent check is not a passing check.
3. No blocking Skeptic objection.
4. Judge verdict PASS (object per the [[Judge Object Rule]] — the PR branch at the Skeptic-verified SHA).
5. No `Needs Human` state or outstanding ruling on the card.

**SHA pinning:** the merge is `gh pr merge <PR> --match-head-commit <X>` where X is the exact SHA criterion 2 was read against; if the flag is unavailable, re-read `headRefOid` immediately before merging and abort on mismatch. A mismatch is a HALT, not a retry. Across EPIC-1's 18 merges this pinned every merge; the one gates-windows flake (a bun 5s cold-start timeout, FLLWUP-16) was resolved by rerun + clean re-read, not by lowering the bar.

## Related
[[Judge Object Rule]], [[Verify Cycle Cap]], [[Council Seats]], [[EPIC-1 Decision Record]]

## Sources
[[Judge Object Rule]], [[FLLWUP-5 Ruling]]
