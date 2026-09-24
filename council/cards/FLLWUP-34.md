---
id: FLLWUP-34
title: "Update AGENTS.md's 'Current state' once FLLWUP-12 lands"
state: Ready
owner: null
epic: EPIC-5
goal: AGENTS.md's stale "not yet loadable" claim is half-overtaken by FLLWUP-11's landing; full update waits for FLLWUP-12.
---

## Intent

Filed from FLLWUP-11's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.70 < merge threshold 1.00 — Update AGENTS.md's 'Current state' once FLLWUP-12 lands (active)

FLLWUP-11 landed (PR #38, merged `a91a30b`): the ExtensionAPI stand-in now
reconciles with the real SDK surface and a real load through the installed
production loader was proven green. That half-overtakes `AGENTS.md`'s
"Current state" claim that the extension is "**Not yet loadable in a real
`pi` host**".

The other half of the claim — handler payload narrowing — is FLLWUP-12's
work, still open. The ruling's timing is explicit: the full "Current state"
rewrite waits for FLLWUP-12 to land, so this card is **blocked on
FLLWUP-12** and must not land first (it would trade one stale claim for
another). When it runs: rewrite the "Current state" bullet to state the
loadability reality as of both cards' landing — loadable against the real
SDK surface, with whatever qualification FLLWUP-12's outcome warrants —
without pinning counts as eternal (same discipline as FLLWUP-31's ruling).

## Acceptance

- This card is not promoted to `Ready` before FLLWUP-12 is `Done`.
- `AGENTS.md`'s "Current state" no longer carries the stale "not yet
  loadable" claim; the replacement states the post-FLLWUP-12 reality and
  follows FLLWUP-31's observe-and-state discipline for any counts.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass (docs-only change, gates
  run as hygiene).
