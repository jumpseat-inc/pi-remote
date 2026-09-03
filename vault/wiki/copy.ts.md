---
title: copy.ts
type: entity
summary: The dependency-free localization module — resolveCopy(key, englishTable) = id ?? english ?? key, a 22-key Bahasa Indonesia table, and the announced partial-coverage boundary.
aliases: [the copy resolver, localization module]
tags: [entity/module, copy, localization]
sources: ["[[FLLWUP-4 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
FLLWUP-4's deliverable (PR #18). Pure `resolveCopy(key, englishTable) = id ?? english ?? key` — fail-open to English on missing locale or key, never crash on missing copy. The id table carries **22 keys**: the 16 reason/footer rows (the 6 `tunnelReasonCopy` rows plus EV-8's 10 footer rows) plus the 6 command-output rows (`rc.*`, `shutdown.closed`, `rc:login.refusal`) — ruled by OJ2 so the footer and its adjacent refusals never form a mixed-language seam. The 28 login-flow rows are deliberately out (a translation project re-introducing the unverified-non-native-Bahasa risk), and the keyless `inputPrompt` literal is named as outside the keyed surface — partial coverage announced at the module, per [[Fixture-Green Honesty]].

Locale source (OJ3): `PI_REMOTE_LOCALE` env → `piRemote.locale` setting → `"en"`, matching the entry-point's env-over-setting precedence. `englishFor` / `loginEnglishFor` delegate with unchanged signatures; placeholder parity is required in id rows; `<serverUrl>` renders at the two re-pointed sites (OJ5). New keys are [[Stable Keys]] from merge.

## Related
[[Stable Keys]], [[Fixture-Green Honesty]], [[Copy Honesty Doctrine]], [[tunnel.ts]], [[login.ts]]

## Sources
[[FLLWUP-4 Ruling]]
