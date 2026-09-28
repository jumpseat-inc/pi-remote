---
title: Stable Keys
type: concept
summary: Message and dispatch keys are free at authoring time but become stable, non-relitigable contract from merge — verbatim-ruled copy changes only through their own card and ruling.
aliases: [stable message keys, key immutability]
tags: [concept/copy, doctrine]
sources: ["[[EV-2 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[FLLWUP-3 Design Position r3]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]", "[[EPIC-8 Run (EV-18, EV-19)]]"]
created: 2026-09-02
updated: 2026-09-28
---
EV-2 Item 2 established the key-based copy seam: emitters reference stable message keys; English defaults live beside the emitter; localization adds lookups, never edits emission sites. Two immutability rules hardened across the run:

- **From merge onward, names are contract.** FLLWUP-4's general rule: "new key names are free at authoring time but become stable, non-relitigable contract from merge" — the same rule the FLLWUP-3 rider applies to dispatch names on the FLLWUP-8/9 card faces.
- **Verbatim-ruled copy changes only through its own card and ruling, however small the edit** (FLLWUP-4 OJ1: keying `ALREADY_LIVE_COPY` could not fold into the localization card because EV-2 Item 3 had ruled the string verbatim).
- **Additive lines over editing ruled rows** (FLLWUP-25). A new detail key (`login.failure.detail`) carries the server's `error_description` as a second line; the four ruled `login.failure.*` rows are untouched, so their byte-identity — and the absent-description output — is structural rather than test-asserted. This is the worked example of "new key names are free at authoring time".

The contrast case: copy *never* ruled verbatim (the `urlExpired` English row) may be amended in the same pass that keeps locales meaning-aligned (FLLWUP-4 OJ4). Related mechanics live in [[tunnel.ts]], [[copy.ts]], and [[login.ts]] (`loginEnglishFor`).

**Naming a key does not mint it (EPIC-8).** A ruling or record may refer to a key by name — `login.urlPrompt` in the EPIC-8 Phase-1 and product-owner rulings — while the tree carries no such key: the consent sentence is a **keyless inline literal** at `index.ts:676-678` (`grep -rn 'login.urlPrompt' src/` → zero hits; the name survives only in council records and FLLWUP-41, Backlog). "New key names are free at authoring time" applies to keys an author actually mints; a ruled *reference* is not a landing. Cite a key by its exact string only after confirming a referent, or cite the literal — otherwise the reference is [[Record Accuracy]]'s defect wearing a key name ([[copy.ts]] already names the literal as keyless).

## Related
[[Closed Vocabulary Discipline]], [[Copy Honesty Doctrine]], [[Cause-Distinguished Expiry]], [[Record Accuracy]], [[EV-2 Ruling]], [[FLLWUP-4 Ruling]], [[copy.ts]], [[login.ts]]

## Sources
[[EV-2 Ruling]], [[FLLWUP-4 Ruling]], [[FLLWUP-3 Design Position r3]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], [[EPIC-8 Run (EV-18, EV-19)]]
