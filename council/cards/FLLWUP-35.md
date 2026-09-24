---
id: FLLWUP-35
title: "Add a fold-bookkeeping probe that catches a dropped message_start masked by the message_update fallback"
state: Backlog
owner: null
epic: EPIC-5
goal: add a regression probe ensuring a dropped `message_start` cannot be silently masked by the `message_update` fallback path (translate.ts's mid-join role back-derivation).
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.31 < merge threshold 1.00 — Add a fold-bookkeeping probe that catches a dropped message_start masked by the message_update fallback (active)

FLLWUP-12's verification found that translate.ts's mid-join role
back-derivation — the `message_update` fallback that infers a role when the
original `message_start` was never seen — can silently mask a dropped
`message_start`: the fold continues on the fallback path and the loss is
never observable in the emitted frames. A fold-bookkeeping probe makes that
masking detectable: when a `message_update` arrives with no matching
`message_start` bookkeeping entry, the probe records it, so a dropped start
shows up as a test failure instead of a silent role substitution.

## Acceptance

- A regression probe exists that fails when a `message_start` is dropped and
  its absence is masked by the `message_update` fallback path in
  translate.ts.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.
