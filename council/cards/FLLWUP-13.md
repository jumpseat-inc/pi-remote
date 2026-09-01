---
id: FLLWUP-13
title: "Clean up registerPrompt signature to {promptId}"
state: Backlog
owner: null
epic: EPIC-1
goal: registerPrompt's signature carries only {promptId} — the kind/prompt params are dead since FLLWUP-8's live wiring — with inject.ts and fixtures updated to match.
---

## Intent

Filed from FLLWUP-8's step 13. FLLWUP-8 collapsed `forward()` to one general
stamp and wired the live raise path; the deliberation found `registerPrompt`'s
`kind`/`prompt` parameters are now dead — the pending-entry registry keys on
`(promptId, occurrence)` and needs nothing else. Dead parameters in the
resolution seam are the same contract-hazard class FLLWUP-6 removed for
`user_input`. Small mechanical cleanup touching inject.ts and its fixtures.

## Acceptance

- registerPrompt accepts `{promptId}` (plus `occurrence` if the registry key
  requires it — the deliberation verifies against the actual key).
- All call sites and fixtures updated; no dead parameters remain.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.
