---
id: FLLWUP-46
title: "§7.2 \"login.cancelled outcome\" gloss"
state: Backlog
owner: null
epic: EPIC-7
goal: Separate the outcome kind from the copy key in PI-SPEC §7.2's attended-flow gloss — the outcome kind is `LoginOutcome { kind: "cancelled" }` (closed vocabulary), while `login.cancelled` is the copy key naming the printed line; the gloss should read "ends the flow at once with the `cancelled` outcome — printing the `login.cancelled` copy — and no credential written", exact wording the owner's.
---

## Intent

Filed from EV-17's step 13, held in-container by draft title, then confirmed `File` with
**no amendment to the title** by a `product-owner` ruling (job-24). Recorded disposition,
verbatim:

> **Ruling: File**, no amendment to the title; the goal should target the precise
> separation — the outcome kind is `LoginOutcome { kind: "cancelled" }` (closed
> vocabulary), and `login.cancelled` is the copy key naming the printed line, so the gloss
> reads "ends the flow at once with the `cancelled` outcome — printing the
> `login.cancelled` copy — and no credential written" (exact wording is the owner's).

Source: PI-SPEC §7.2's attended-flow bullet (EV-17's in-scope prose-sync, Q3 ruling)
currently reads "…ends the flow at once with the `login.cancelled` outcome and no
credential written" — conflating the outcome kind (`LoginOutcome { kind: "cancelled" }`,
closed vocabulary fixed by EV-17's implementation) with `login.cancelled`, which is the
copy key naming the printed line `Sign-in cancelled — no credentials were saved.`. The
card fixes the gloss, not the vocabulary: both names already exist and are correct; the
sentence is what muddles them.

## Acceptance

1. §7.2's attended-flow cancel sentence distinguishes the outcome kind
   (`LoginOutcome { kind: "cancelled" }`, closed vocabulary) from the copy key
   (`login.cancelled`, the printed line), per the ruling's target gloss — exact wording
   is the owner's.
2. No other PI-SPEC changes ride this card; no wire-format, replay, auth, or
   security-model change, so SERVER-SIDE-SPEC needs no sync (client-side gloss only).
