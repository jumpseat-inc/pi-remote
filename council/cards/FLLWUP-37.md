---
id: FLLWUP-37
title: "Watch the duplicated message-family role decoder between translate.ts and pi-sdk-events.ts"
state: Backlog
owner: null
epic: EPIC-4
goal: track and scope removal of the duplicated role decoder (forced by the G-12 no-runtime-imports purity rule; lifting G-12 is steward authority, not this card's).
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.50 < merge threshold 1.00 — Watch the duplicated message-family role decoder between translate.ts and pi-sdk-events.ts (active)

FLLWUP-12 introduced `src/pi-sdk-events.ts` (vendored real payload
interfaces + derivation helpers, per R-TYPE-1) and in doing so duplicated
the message-family role decoder that translate.ts already carries. The
duplication is forced by the G-12 no-runtime-imports purity rule; lifting
G-12 is steward authority and out of this card's scope. This card watches
the duplication: track that both decoders stay in agreement (the static
pairing test pins them today) and scope what removal would look like if
G-12 is ever lifted, so the duplication is a tracked, bounded liability
rather than drift waiting to happen.

## Acceptance

- The duplication is tracked with a stated removal scope (what a G-12 lift
  would delete and what the pairing test pins), and the pairing test still
  holds.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.
