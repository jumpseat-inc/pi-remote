---
id: FLLWUP-6
title: "Remove or document the dead user_input PiEvent in translate.ts"
state: Ready
owner: null
epic: EPIC-1
goal: translate.ts's user_input PiEvent mapping is either removed or explicitly documented as dead live-path code, so the module carries no mapping that the real pi SDK never emits.
---

## Intent

Filed from EV-6's step-4 Skeptic finding: the real SDK emits
`message_start`/`message_update`/`message_end` and has zero occurrences of a
`user_input` event; the translate.ts mapping for it is dead code in the live
path, and EV-6's injection design correctly bypasses it. Dead mappings in the
single shared translator are a correctness hazard — a future reader may treat
the row as a live contract and build on it.

## Acceptance

- Either the `user_input` mapping is removed from translate.ts and its tests,
  or a comment at the mapping site states in one sentence that the real SDK
  never emits this event and why the mapping is retained (whichever the
  deliberation justifies).
- The §4 table in docs/PI-SPEC.md and translate.ts agree on which events are
  mapped — no documented live event lacks a row and no row names a dead event
  without the dead-code annotation.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.
