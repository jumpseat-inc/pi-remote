---
id: FLLWUP-41
title: "Key the /rc:login consent sentence as login.urlPrompt with a verified Indonesian row (EV-15 boundary-expansion follow-up)"
state: Backlog
owner: null
epic: EPIC-7
goal: The `/rc:login` consent sentence — shipped keyless in EV-15 per its step-6 product-owner ruling — becomes the keyed copy surface `login.urlPrompt`: an en row in a home that feeds `englishDefaults`, a *verified* (not seat-authored) Indonesian row in `indonesianCopy`, the explicit `test/copy.test.ts` derivation edit, the `src/copy.ts` COVERAGE BOUNDARY rename, and the boundary expansion named in the PR description.
---

## Intent

Filed from EV-15's step 13, held in-container by draft title, then confirmed
`File` by a `product-owner` ruling (job-15). Recorded disposition, verbatim:

> Mode: File — This is the exact card my binding EV-15 Step-6 ruling ordered
> ("Any future keying runs as its own boundary-expansion card, and that card
> must carry a *verified* Indonesian row — not an in-run, seat-authored
> one"). The draft title encodes both halves of that order: the key and the
> verified-row requirement. No amendment needed.

EV-15's step-6 ruling shipped the consent sentence keyless (English under
every locale) under `src/copy.ts`'s announced boundary, deliberately
deferring localization to exactly this card. The deliberation record
(EV-15 rounds 2–3) already settled the keyed landing's shape: en row in a
`LOGIN_PROMPT_ROW` home next to `NON_FAILURE_ROWS` (not `FOOTER_ROWS`), id
row in `indonesianCopy`, `test/copy.test.ts`'s data-derived `expected`
edited explicitly to include the key (never hand-edited as a bare count),
the COVERAGE BOUNDARY paragraph renamed and the prompt literal removed from
the "Remaining English under every locale, by design" list, and the
expansion named in the PR description. The keyless→keyed move is one
bounded change — the prompt has a single emission site, already rewritten
by EV-15 — so no cross-emission-site refactor is implied.

## Acceptance

1. The consent sentence is keyed as `login.urlPrompt`: an en row in a home
   that feeds `englishDefaults` (per the deliberation: `LOGIN_PROMPT_ROW`
   adjacent to `NON_FAILURE_ROWS`, not `FOOTER_ROWS`), substituted through
   the existing `renderCopy` path with `<serverUrl>` → the resolved value.
2. The Indonesian row carries a *verified* translation — checked by a
   competent Indonesian reader or equivalent verification, not authored
   in-run by a seat — per the EV-15 step-6 ruling.
3. `test/copy.test.ts`'s derivation is edited explicitly to include
   `"login.urlPrompt"`; with EV-15 landed at 21 keys, the terminal set is
   22 keys, all non-empty, and the suite is green.
4. `src/copy.ts`'s COVERAGE BOUNDARY paragraph is updated to name the new
   key, and the consent-sentence literal is removed from the "Remaining
   English under every locale, by design" list.
5. The boundary expansion is named in the PR description.
