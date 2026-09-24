---
title: Real-Surface Verification
type: concept
summary: A fixture-green suite against a local stand-in does not prove a component works against the installed host — verify at the real boundary, prove the gate non-vacuous by defect injection, and keep "correct-or-document" a strict boundary.
aliases: [real-surface verification, stand-in boundary, real-boundary verification]
tags: [concept/process, doctrine, testing, sdk]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-4 Decision Record]]"]
created: 2026-09-24
updated: 2026-09-24
---
FLLWUP-9's deliberation (S-O5) found that pi-remote was entirely fixture-tested against a local `ExtensionAPI` stand-in, and that the stand-in had drifted from the installed pi SDK: `pi.configDir()` would be a **TypeError at load** in a real host. The severity flag was "if the load-time TypeError is real, the extension may not load in production at all." EPIC-4 proved it real and closed it.

**The failure shape.** A stand-in that diverges from the installed surface is a latent runtime defect that every green fixture hides — the same class as [[Fixture-Green Honesty]], moved to the host boundary. A local suite can be arbitrarily thorough about the stand-in and still say nothing about the real SDK. The remedy is not more fixtures against the stand-in.

**The three-part remedy the run established.**
1. **Verify at the real boundary.** FLLWUP-11 loaded the extension through the installed production loader (`loadExtensionFromFactory`) and asserted `REAL LOAD OK` — commands registered, eleven subscriptions live. Where runtime loading is not testable in-repo, the real **type surface** (`dist/core/extensions/types.d.ts`) is the authority, vendored locally with provenance and a re-diff-on-upgrade note (R-TYPE-1; [[pi-sdk-on.ts]], [[pi-host.ts]], [[pi-sdk-events.ts]]).
2. **Prove the gate non-vacuous by defect injection.** A smoke that cannot fail is not evidence. The FLLWUP-11 skeptic injected the exact defect class and reproduced `pi.getSetting is not a function`, showing the load gate actually detects a missing member. (Compare [[Normativity Test]]'s observation-point rule.)
3. **Keep "correct-or-document" a strict boundary.** R-PAYLOAD-1 required every handler's narrowing to be **corrected** to the real shape; a documentation-only divergence was permitted *only* where the real payload genuinely lacks a field the frame needs. Exactly one qualified (FLLWUP-12's `tool_result`: `messageId := toolCallId`, justified on the card). The default is correction, not annotation.

**Where it lives.** The audit found 13 non-`on` base members: 2 kept typed-to-real (`registerCommand`, `sendUserMessage`), 5 re-homed to the real `ExtensionContext`, 5 to local capabilities ([[pi-host.ts]]), 1 dropped (`version`). The SDK is **not** a dependency; the vendored mirrors are the boundary. See [[Emission-Semantics Fidelity]] for the sibling lesson at the payload layer.

## Related
[[Fixture-Green Honesty]], [[Emission-Semantics Fidelity]], [[pi-sdk-on.ts]], [[pi-host.ts]], [[pi-sdk-events.ts]], [[Normativity Test]], [[pi-remote]], [[EPIC-4 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-4 Decision Record]]