---
title: Fixture-Green Honesty
type: concept
summary: Acceptance text may only claim what has been proven — runtime behavior requires runtime evidence, and knowingly partial coverage is announced at the surface itself.
aliases: [fixture honesty, partial coverage announcement]
tags: [concept/process, doctrine, testing]
sources: ["[[FLLWUP-5 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]", "[[EPIC-3 Run (FLLWUP-27..30)]]"]
created: 2026-09-02
updated: 2026-09-23
---
Born in FLLWUP-5: the Skeptic proved the entire raise path was dead in production (no `ui.confirm` event in the SDK, no `deps.on("ui_prompt_start")`, `registerPrompt` never called), so the acceptance was rewritten **fixture-green** — contract (b) emits correctly and is testable today; the runtime path is gated on FLLWUP-8. J-ACCEPT's principle: shipping an acceptance that implies runtime behavior the scope cannot deliver is "a half-truth."

Two generalizations (FLLWUP-4 ruling): **partial coverage is announced at the surface itself** — the id-table module comment names the 22-key boundary and the keyless `inputPrompt` literal, not just the card record (FLLWUP-14's honest-boundaries discipline moved from docs to code); and **a spec row documents the contract, not runtime reachability**. The companion discipline is S-O5's discovery (FLLWUP-9): stand-in surfaces that diverge from the real SDK are latent runtime defects even when every fixture is green — filed as FLLWUP-11 with a load-time TypeError severity flag.

**Closure corollary (EPIC-2, steward's ruling).** The principle generalizes from modules to epic closure: an audit that can only pass by finding nothing is an audit incentivized to find nothing. EV-14's conformance audit found two contradictions in the shipped server spec; the run's governance routed them to Backlog cards (FLLWUP-22, FLLWUP-23) instead of silently patching them on the assembly PR, and steward closed the epic `Done` with the residuals **announced at the closure record** — the surface-equivalent of the module-level partial-coverage announcement, because the document itself must stay self-contained (R5). Surfaced-and-carded beats suppressed.

**Probe-proven ≠ fixture-pinned (device-flow polish run).** A behavior the Skeptic proves by an ad-hoc probe but no committed fixture covers is honest but not durable; each such gap files a card so the behavior becomes fixture-pinned — FLLWUP-28 (cancellation during the five-second slowdown) and FLLWUP-29 (the attended PKCE path's no-detail boundary) are the worked examples. **Both were delivered by the [[EPIC-3 Run (FLLWUP-27..30)]]:** each gap is now a committed, red-capable fixture carrying a seven-field red-at-base record, so the corollary's loop is closed, not merely queued.

## Related
[[Spec Correction Governance]], [[Stable Keys]], [[Cause-Distinguished Expiry]], [[Run Workspace Isolation]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]], FLLWUP-11

## Sources
[[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], [[EPIC-3 Run (FLLWUP-27..30)]]
