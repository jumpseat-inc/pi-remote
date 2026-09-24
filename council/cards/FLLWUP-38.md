---
id: FLLWUP-38
title: "Declare or annotate the vendored PiTextContent's omitted optional textSignature field"
state: Backlog
owner: null
epic: EPIC-5
goal: declare or annotate the omitted optional `textSignature` field on the vendored PiTextContent type (verify against the installed dist types as the first step).
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.36 < merge threshold 1.00 — Declare or annotate the vendored PiTextContent's omitted optional textSignature field (active)

FLLWUP-12's verification flagged that the vendored `PiTextContent` type in
`src/pi-sdk-events.ts` omits the optional `textSignature` field the real
SDK surface carries. First step: verify against the installed dist types
that the field exists and is optional. Then either declare it on the
vendored type (with provenance, per R-TYPE-1's vendoring pattern) or
annotate the omission with why the vendored surface deliberately leaves it
out — so a later reader does not mistake the omission for an audit gap.

## Acceptance

- The vendored `PiTextContent` type either declares `textSignature`
  (verified against the installed dist types, with provenance) or carries an
  annotation stating why it is deliberately omitted.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.
