---
title: Stable Keys
type: concept
summary: Message and dispatch keys are free at authoring time but become stable, non-relitigable contract from merge — verbatim-ruled copy changes only through their own card and ruling.
aliases: [stable message keys, key immutability]
tags: [concept/copy, doctrine]
sources: ["[[EV-2 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[FLLWUP-3 Design Position r3]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]"]
created: 2026-09-02
updated: 2026-09-23
---
EV-2 Item 2 established the key-based copy seam: emitters reference stable message keys; English defaults live beside the emitter; localization adds lookups, never edits emission sites. Two immutability rules hardened across the run:

- **From merge onward, names are contract.** FLLWUP-4's general rule: "new key names are free at authoring time but become stable, non-relitigable contract from merge" — the same rule the FLLWUP-3 rider applies to dispatch names on the FLLWUP-8/9 card faces.
- **Verbatim-ruled copy changes only through its own card and ruling, however small the edit** (FLLWUP-4 OJ1: keying `ALREADY_LIVE_COPY` could not fold into the localization card because EV-2 Item 3 had ruled the string verbatim).
- **Additive lines over editing ruled rows** (FLLWUP-25). A new detail key (`login.failure.detail`) carries the server's `error_description` as a second line; the four ruled `login.failure.*` rows are untouched, so their byte-identity — and the absent-description output — is structural rather than test-asserted. This is the worked example of "new key names are free at authoring time".

The contrast case: copy *never* ruled verbatim (the `urlExpired` English row) may be amended in the same pass that keeps locales meaning-aligned (FLLWUP-4 OJ4). Related mechanics live in [[tunnel.ts]], [[copy.ts]], and [[login.ts]] (`loginEnglishFor`).

## Related
[[Closed Vocabulary Discipline]], [[Copy Honesty Doctrine]], [[Cause-Distinguished Expiry]], [[EV-2 Ruling]], [[FLLWUP-4 Ruling]], [[copy.ts]]

## Sources
[[EV-2 Ruling]], [[FLLWUP-4 Ruling]], [[FLLWUP-3 Design Position r3]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]
