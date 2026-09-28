---
title: copy.ts
type: entity
summary: The dependency-free localization module — resolveCopy(key, englishTable) = id ?? english ?? key, a 22-key Bahasa Indonesia table, and the announced partial-coverage boundary.
aliases: [the copy resolver, localization module]
tags: [entity/module, copy, localization]
sources: ["[[FLLWUP-4 Ruling]]", "[[BUG-2 Run]]", "[[FLLWUP-47 Run]]", "[[EPIC-8 Run (EV-18, EV-19)]]"]
created: 2026-09-02
updated: 2026-09-28
---
FLLWUP-4's deliverable (PR #18). Pure `resolveCopy(key, englishTable) = id ?? english ?? key` — fail-open to English on missing locale or key, never crash on missing copy. The id table carries **22 keys**: the 16 reason/footer rows (the 6 `tunnelReasonCopy` rows plus EV-8's 10 footer rows) plus the 6 command-output rows (`rc.*`, `shutdown.closed`, `rc:login.refusal`) — ruled by OJ2 so the footer and its adjacent refusals never form a mixed-language seam. The 28 login-flow rows are deliberately out (a translation project re-introducing the unverified-non-native-Bahasa risk), and the keyless `inputPrompt` literal is named as outside the keyed surface — partial coverage announced at the module, per [[Fixture-Green Honesty]].

The [[BUG-2 Run]] did not change any row. `shutdown.closed` is still the English sentence `Remote tunnel closed` (the id row `Tunnel remote ditutup` matches `rc.offLifecycle`). Delivery of those rows is [[Notify Sink]], not a copy question. **Citation trap:** the *English* rows resolved against live in [[login.ts]] (`loginEnglishFor`); this module holds only the id overlay, so citing `copy.ts` for English row text is wrong. The twin rows `rc.offLifecycle`/`shutdown.closed` share English bytes ([[Twin-Row Delivery Hazard]], [[FLLWUP-47 Run]]).

Locale source (OJ3): `PI_REMOTE_LOCALE` env → `piRemote.locale` setting → `"en"`, matching the entry-point's env-over-setting precedence. `englishFor` / `loginEnglishFor` delegate with unchanged signatures; placeholder parity is required in id rows; `<serverUrl>` renders at the two re-pointed sites (OJ5). New keys are [[Stable Keys]] from merge.

**Referent-less key and stale-count flags (EPIC-8).** The EPIC-8 Phase-1 and product-owner rulings refer to a `login.urlPrompt` key for the consent sentence, but `grep -rn 'login.urlPrompt' src/` returns **zero hits** — the sentence is the keyless inline literal already named above. Separately, the code's own section comment still says "exactly the 22 settled keys" while line 11 says "exactly the 21 keys consumed by `englishFor`"; the page's "22" above should be read as pre-EV-15, and **FLLWUP-42** (Backlog) tracks the stale comment. Both are flagged, not silently overwritten ([[Stable Keys]], [[Record Accuracy]]).

## Related
[[Stable Keys]], [[Record Accuracy]], [[Notify Sink]], [[Twin-Row Delivery Hazard]], [[FLLWUP-47 Run]], [[Fixture-Green Honesty]], [[Copy Honesty Doctrine]], [[tunnel.ts]], [[login.ts]]

## Sources
[[FLLWUP-4 Ruling]], [[BUG-2 Run]], [[FLLWUP-47 Run]], [[EPIC-8 Run (EV-18, EV-19)]]
