---
id: FLLWUP-2
title: "Reconcile EV-8 card text with the seven-state footer set"
state: Ready
owner: null
epic: EPIC-1
goal: council/cards/EV-8.md carries the authoritative seven-state footer set from spec §8 (off, not enrolled, authorizing, dialing, resyncing, live, error) before the EV-8 runner deliberates.
---

## Intent

Filed from EV-1's step 13 (objection O-11, cross-seam gap). Product-owner
ruling Q2 (binding) made §8's footer state set authoritative at seven states
in lifecycle order — off, not enrolled, authorizing, dialing, resyncing, live,
error — but EV-8's card text still names the pre-EV-1 four-state set
(off/dialing/live/resyncing) and would seed its deliberation with a
contradiction. This card edits EV-8's card face only; the actual
implementation of the states belongs to EV-8 itself.

## Acceptance

- EV-8's Intent and Acceptance name the seven-state set in lifecycle order,
  citing spec §8 as authoritative and product-owner ruling Q2 as source.
- No EV-8 card text contradicts the seven-state set or the /rc: colon
  namespace as pinned by EV-1.
- council/validate.py stays clean after the edit.
