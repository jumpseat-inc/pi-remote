---
title: Judge Object Rule
type: source
summary: The step-10 judge evaluates the implementation on the PR branch at the Skeptic-verified SHA, never pre-merge main — procedural doctrine from EV-1 that unblocked every later card.
aliases: [step-10 judge object, judge measures the PR branch]
tags: [concept/process, judge, verification]
sources: ["[[EV-1 Step-10 Judge-Object Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Ruled by product-owner (2026-08-31) after the EV-1 judge REJECTed on merge-state grounds while conceding the branch implemented the goal. The rule, applied uniformly for the rest of the epic:

1. The judge's stop condition is the **PR branch at the Skeptic-verified SHA**, not `main`.
2. A REJECT whose stated basis is the pre-merge state of the target file on `main` is vacated and re-dispatched against the correct object — the card does not return to In Progress, the verify-cycle counter does not increment, no owner work cycle is owed.
3. The re-dispatch input explicitly names the PR number, head SHA, and the object ("the implementation on the PR branch at `<SHA>`, not `main`") because judge dispatches are stateless.
4. A REJECT that survives correct-object framing is real and follows the normal REJECT branch.

Without this rule the run deadlocks: the owner never merges, so a merge-state REJECT is untouchable by any owner work product. Recorded at `vault/raw/2026-08-31-po-ev1-step10-judge-object.md` and cited in every step-10 dispatch.

## Related
[[Verify Cycle Cap]], [[Deterministic Merge Check]], [[Council Seats]], [[EV-1 Step-10 Judge-Object Ruling]]

## Sources
[[EV-1 Step-10 Judge-Object Ruling]]
