---
id: FLLWUP-31
title: "Update AGENTS.md's stale unit-suite count in Current state (218 pass → observed 234)"
state: Backlog
owner: null
epic: null
goal: Correct the `AGENTS.md` "Current state" suite line so it no longer asserts the stale 218-pass figure, reflecting the observed `bun test` result (234 pass / 1 Windows-gated skip) without pinning it as eternal; no other content change.
---

## Intent

Filed from the FLLWUP-30 run (EPIC-3) at step 13, confirmed `File` by a
`product-owner` ruling in the same run. The runner's dedup pass found no
existing board card or sibling candidate naming the count.

This repository's `AGENTS.md` "Current state" section claims the unit suite is
"`bun test` 218 pass / 1 Windows-gated skip". Three independent observations in
this run disagree: the FLLWUP-30 owner and runner and the FLLWUP-27 owner at
base `cb02823` all observed **234 pass / 1 skip / 0 fail** across 11 files. The
218 figure is demonstrably stale, and a stale gate number in the file every
agent in this repo reads first can mislead a later run's preflight into
suspecting a regression that did not happen ([[Fixture-Green Honesty]]: an
acceptance claim should state only what is proven).

The product-owner ruling binds the scope: state the count **without pinning it
as eternal** (observe-and-state, or a count-free wording such as "typecheck
clean, `bun test` all-pass"), so the line does not rot into a new false claim
on the next test addition. The ruling is on the *what* (the stale number must
not survive this card), not the *how*.

## Acceptance

- `AGENTS.md`'s "Current state" no longer asserts the stale `218 pass` figure.
- The replacement either states the observed result (`bun test` 234 pass / 1
  Windows-gated skip) or is count-free; it does not hard-code a "must always be
  234" claim.
- No other `AGENTS.md` content changes; `bunx tsc --noEmit` exit 0 and
  `bun test` green.