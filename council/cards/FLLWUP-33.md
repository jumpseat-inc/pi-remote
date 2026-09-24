---
id: FLLWUP-33
title: "Correct the member-count discrepancy in FLLWUP-11's record"
state: Backlog
owner: null
epic: EPIC-5
goal: The card text says "twelve"; the base stand-in had 13 non-`on` members; the run record's "none exist on the real ExtensionAPI" phrasing is inaccurate for the 2 kept members.
---

## Intent

Filed from FLLWUP-11's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.51 < merge threshold 1.00 — Correct the member-count discrepancy in FLLWUP-11's record (active)

FLLWUP-11's verification flagged this as a non-blocking record nit with two
faces:

1. The card text (Intent and Acceptance) repeatedly says "twelve" non-`on`
   members, but the skeptic's member audit counted **13** non-`on` base
   members on the stand-in.
2. The run record states all twelve were verified and "none exist on the
   real `ExtensionAPI`" — inaccurate for the **2 kept members** that do
   exist on the real SDK and were kept typed-to-real (the other 11 were
   re-homed to `ExtensionContext`/local capabilities or dropped).

The record is the durable account of what the run proved; a count and a
"none exist" claim that contradict the audited reality mislead the next
reader of the council record. Correct both in `council/cards/FLLWUP-11.md`
(and the board line only if it repeats the claim — it does not).

## Acceptance

- `council/cards/FLLWUP-11.md` states the member count as 13 non-`on` base
  members, with the audit breakdown (2 kept typed-to-real, 5 ctx re-home,
  5 local capability, 1 dropped) not contradicted anywhere in the record.
- The "none exist on the real `ExtensionAPI`" phrasing is corrected to
  distinguish the kept members (exist on the real SDK, typed against their
  real signatures) from the removed ones.
- No change to the card's `state` (`Done`), owner line, or merged-SHA facts.
