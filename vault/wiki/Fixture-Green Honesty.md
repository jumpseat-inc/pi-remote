---
title: Fixture-Green Honesty
type: concept
summary: Acceptance text may only claim what has been proven — runtime behavior requires runtime evidence, and knowingly partial coverage is announced at the surface itself.
aliases: [fixture honesty, partial coverage announcement]
tags: [concept/process, doctrine, testing]
sources: ["[[FLLWUP-5 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[FLLWUP-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Born in FLLWUP-5: the Skeptic proved the entire raise path was dead in production (no `ui.confirm` event in the SDK, no `deps.on("ui_prompt_start")`, `registerPrompt` never called), so the acceptance was rewritten **fixture-green** — contract (b) emits correctly and is testable today; the runtime path is gated on FLLWUP-8. J-ACCEPT's principle: shipping an acceptance that implies runtime behavior the scope cannot deliver is "a half-truth."

Two generalizations (FLLWUP-4 ruling): **partial coverage is announced at the surface itself** — the id-table module comment names the 22-key boundary and the keyless `inputPrompt` literal, not just the card record (FLLWUP-14's honest-boundaries discipline moved from docs to code); and **a spec row documents the contract, not runtime reachability**. The companion discipline is S-O5's discovery (FLLWUP-9): stand-in surfaces that diverge from the real SDK are latent runtime defects even when every fixture is green — filed as FLLWUP-11 with a load-time TypeError severity flag.

## Related
[[Spec Correction Governance]], [[Stable Keys]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]], FLLWUP-11

## Sources
[[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]]
