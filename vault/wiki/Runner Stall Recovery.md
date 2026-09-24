---
title: Runner Stall Recovery
type: concept
summary: A council-runner blocked on a long child dispatch looks stalled to the anti-stall monitor and can be killed mid-wait — size the window above the longest child timeout, and recover by cancel plus one re-dispatch carrying an explicit resumption note.
aliases: [stall recovery, runner resumption, autonomous-run recovery]
tags: [concept/process, autonomous-runs, operations]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-4 Decision Record]]"]
created: 2026-09-24
updated: 2026-09-24
---
The anti-stall monitor cancels a job after a window of **no activity**. A `council-runner` waiting on a child seat dispatch produces none: it has handed the work off and blocks. When the child is the owner implementation — bounded at 45 minutes — a runner dispatched with a shorter stall window is killed while legitimately waiting.

**The EPIC-4 incident.** Runner `job-10` was dispatched with `stall_minutes: 15`; it reached step 8, dispatched the owner, and was cancelled at ~17 minutes with a zero-artifact owner child. Because the runner is the single writer of `board.md` and its card, recovery had to avoid a second writer racing it.

**The recovery recipe the run used.**
1. **Cancel the orphaned child** and confirm no branch/worktree/PR artifact exists before re-dispatching (the owner child had created only an empty worktree).
2. **Re-dispatch the same seat once** (the dispatch discipline's single permitted re-dispatch) with `stall_minutes: 60` — comfortably above the 45-minute owner ceiling — and a **resumption note**: the card is already `In Progress`; resume at step 8; do **not** re-run step 7; treat step 1's Ready check as not applying. The note is what lets a fresh container recover from durable state rather than restarting.
3. **Record it**: `job-11` then ran to `DONE`; its `<return_contract>` report carries the whole recovery in the card's run record.

**Sibling case.** One `product-owner` dispatch failed transiently on a `@modelcontextprotocol/sdk` extension-load error (the dependency resolves a moment later). That is a job that produced **no output**, so the dispatch discipline's single re-dispatch applies; the retry succeeded. Contrast with a job that timed out *after* its deliverable landed — that is a settled dispatch to cancel and verify, not to retry.

**Why it is doctrine.** The failure was not the runner's reasoning; it was a timeout chosen too tight for the work it delegated. The rule generalizes: **the parent's stall window must exceed the longest child dispatch timeout**, or the parent dies waiting. See [[Execution-Mode Recording]] for the mode mechanics the runner re-derives on resumption.

## Related
[[Execution-Mode Recording]], [[Council Seats]], [[Deterministic Merge Check]], [[Record-Push Discipline]], [[EPIC-4 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-4 Decision Record]]