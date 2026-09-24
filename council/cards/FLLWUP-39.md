---
id: FLLWUP-39
title: "Declare or annotate the vendored PiThinkingContent's omitted optional thinkingSignature/thoughtSignature fields"
state: Backlog
owner: null
epic: null
goal: declare or annotate the omitted optional `thinkingSignature`/`thoughtSignature` fields on the vendored PiThinkingContent type (verify against the installed dist types as the first step).
---

## Intent

Filed from FLLWUP-38's step 13 (EPIC-5), held in-container, then confirmed
`File` by a `product-owner` ruling (job-6). Recorded disposition, verbatim:

> Mode: File — composite 0.48 < merge threshold 1.00 — Declare or annotate the vendored PiThinkingContent's omitted optional thinkingSignature/thoughtSignature fields (active)

FLLWUP-38's first-step verification established that the vendored
`PiTextContent` omitted a real optional field (`textSignature`) and closed
the gap by declaring it with provenance against the installed dist types.
The exact sibling case is open: the vendored `PiThinkingContent` in
`src/pi-sdk-events.ts` carries only `{ type: "thinking"; thinking: string }`
— no signature field and no annotation — so the omission is
indistinguishable from an audit gap. First step: verify against the
installed dist types whether the real thinking-content type carries optional
`thinkingSignature`/`thoughtSignature` fields. Then either declare them on
the vendored type (with provenance, per the R-TYPE-1 vendoring pattern,
mirroring FLLWUP-38's DECLARE path) or annotate the omission with why the
vendored surface deliberately leaves it out. `product-owner` observed that
grouping this new card under EPIC-5 (whose Acceptance names only
FLLWUP-32..38) is a separate grouping call, so it is filed ungrouped
(`epic: null`).

## Acceptance

- The vendored `PiThinkingContent` type either declares
  `thinkingSignature`/`thoughtSignature` as the installed dist types carry
  them (verified against those types, with provenance) or carries an
  annotation stating why they are deliberately omitted.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.