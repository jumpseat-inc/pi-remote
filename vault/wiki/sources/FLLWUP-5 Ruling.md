---
title: FLLWUP-5 Ruling
type: source
summary: Product-owner ruling fixing the resolved-frame field set, scoping the card fixture-green after the raise path was found dead in production, and splitting the cast and typed-on fixes into their own cards.
aliases: [FLLWUP-5 ruling]
tags: [council/ruling, inject, copy, process]
sources: ["[[FLLWUP-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Seven rulings on FLLWUP-5 (2026-08-31). **J-FIELDSET** — `pi.human_input.resolved` carries `{promptId, occurrence, deviceId, ts}`; `kind` withdrawn (no production instance — the additive-escape-hatch principle). **J-ACCEPT** — the acceptance is rewritten fixture-green: the origin of [[Fixture-Green Honesty]] (Skeptic probe 8 proved the entire raise path dead in production — no `ui.confirm` event, no `deps.on("ui_prompt_start")`, `registerPrompt` never called). **J-REPLAY** — replay need not be self-sufficient for the resolved frame; clients treat replay as snapshot and continue on live frames. **J-FUTURE** — minimum contract now; everything else additive. **S-O1** — the raise wiring becomes its own card (FLLWUP-8). **S-O2** — the systemic `ev as PiEvent` cast (7 of 10 live subscriptions, with a proven misroute via a `kind`-collision) folds into FLLWUP-5 as manual construction — overruling the round-3 out-of-scope call. **S-O4** — the typed-`on()` fix stays its own card (FLLWUP-9): data-flow and type-honesty defects are opposing disciplines.

## Related
[[Fixture-Green Honesty]], [[inject.ts]], [[index.ts]], [[Spec Correction Governance]], [[FLLWUP-5 Ruling]]

## Sources
`vault/raw/2026-08-31-po-fllwup5-ruling.md`
