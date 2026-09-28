---
title: Real-Surface Verification
type: concept
summary: A fixture-green suite against a local stand-in does not prove a component works against the installed host — verify at the real boundary, prove the gate non-vacuous by defect injection, and keep "correct-or-document" a strict boundary.
aliases: [real-surface verification, stand-in boundary, real-boundary verification]
tags: [concept/process, doctrine, testing, sdk]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-4 Decision Record]]", "[[EPIC-6 Run (FLLWUP-39..40)]]", "[[BUG-2 Run]]", "[[EPIC-8 Run (EV-18, EV-19)]]"]
created: 2026-09-24
updated: 2026-09-28
---
FLLWUP-9's deliberation (S-O5) found that pi-remote was entirely fixture-tested against a local `ExtensionAPI` stand-in, and that the stand-in had drifted from the installed pi SDK: `pi.configDir()` would be a **TypeError at load** in a real host. The severity flag was "if the load-time TypeError is real, the extension may not load in production at all." EPIC-4 proved it real and closed it.

**The failure shape.** A stand-in that diverges from the installed surface is a latent runtime defect that every green fixture hides — the same class as [[Fixture-Green Honesty]], moved to the host boundary. A local suite can be arbitrarily thorough about the stand-in and still say nothing about the real SDK. The remedy is not more fixtures against the stand-in.

**The three-part remedy the run established.**
1. **Verify at the real boundary.** FLLWUP-11 loaded the extension through the installed production loader (`loadExtensionFromFactory`) and asserted `REAL LOAD OK` — commands registered, eleven subscriptions live. Where runtime loading is not testable in-repo, the real **type surface** (`dist/core/extensions/types.d.ts`) is the authority, vendored locally with provenance and a re-diff-on-upgrade note (R-TYPE-1; [[pi-sdk-on.ts]], [[pi-host.ts]], [[pi-sdk-events.ts]]).
2. **Prove the gate non-vacuous by defect injection.** A smoke that cannot fail is not evidence. The FLLWUP-11 skeptic injected the exact defect class and reproduced `pi.getSetting is not a function`, showing the load gate actually detects a missing member. (Compare [[Normativity Test]]'s observation-point rule.)
3. **Keep "correct-or-document" a strict boundary.** R-PAYLOAD-1 required every handler's narrowing to be **corrected** to the real shape; a documentation-only divergence was permitted *only* where the real payload genuinely lacks a field the frame needs. Exactly one qualified (FLLWUP-12's `tool_result`: `messageId := toolCallId`, justified on the card). The default is correction, not annotation.

**Where it lives.** The audit found 13 non-`on` base members: 2 kept typed-to-real (`registerCommand`, `sendUserMessage`), 5 re-homed to the real `ExtensionContext`, 5 to local capabilities ([[pi-host.ts]]), 1 dropped (`version`). The SDK is **not** a dependency; the vendored mirrors are the boundary. See [[Emission-Semantics Fidelity]] for the sibling lesson at the payload layer.

**Rendered surface, not just the type (BUG-2).** A stand-in `notify` that records the string does not prove the line left the prompt box. The [[BUG-2 Run]] Skeptic read installed `pi-tui` 0.87.1: `notify` binds to `showExtensionNotify`, info routes to `showStatus`, and `showStatus` appends to `chatContainer`, never `this.editor`. The vendored signature on [[pi-sdk-on.ts]] was diffed against `types.d.ts:77` (byte-identical), and a required-`type` injection produced `TS2554` before the file was restored. That is the same non-vacuous-gate move as the load smoke, applied to the TUI paint path ([[Notify Sink]]).

**Declare-or-annotate-with-reason (EPIC-6).** The vendored-surface remedy sharpens into two obligations, exercised by the [[EPIC-6 Run (FLLWUP-39..40)]]: **declare** every real optional field the consumed surface carries, with line-referenced provenance (FLLWUP-39 added `PiThinkingContent.thinkingSignature` and `PiToolCall.thoughtSignature` against `pi-ai dist/types.d.ts`), **and annotate, with the reason stated**, every real field knowingly omitted — FLLWUP-39 left `redacted?` and `namespace?` out of the vendored mirror but named why in the provenance comment. The point is that an omission must never be indistinguishable from an audit gap: a silent omission is the vendoring form of [[Record Accuracy]]'s defect.

**Rendered output and the real enrollment round-trip (EPIC-8).** The [[EPIC-8 Run (EV-18, EV-19)]] extended the boundary from load/paint to the **rendered interactive TUI**: it drove the installed pi 0.87.1 in a tmux pane, invoked the attended `/rc:login`, and proved a signed negative over the input-line span — the placeholder argument reaches a host that does not render it. It also completed a **real attended enrollment round-trip** (empty-Enter) against a local mock control plane, with the persisted credential's `serverUrl` byte-equal to the resolved URL, discharging the non-construction residue (env propagation into the real process, loopback bind, discovery → authorize → token over live HTTP, atomic 0600 write). The method is [[Real-Host TUI Observation]]; its secret-hygiene companion is [[Capture Redaction]]. The three-fact join (forward + render + host-discard) makes the negative legible where a fixture could only prove forwarding ([[Fixture-Green Honesty]]).

## Related
[[Fixture-Green Honesty]], [[Notify Sink]], [[Emission-Semantics Fidelity]], [[pi-sdk-on.ts]], [[pi-host.ts]], [[pi-sdk-events.ts]], [[Normativity Test]], [[pi-remote]], [[Real-Host TUI Observation]], [[Capture Redaction]], [[EPIC-4 Decision Record]], [[Batched Card Delivery]], [[EPIC-6 Decision Record]], [[EPIC-8 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-4 Decision Record]], [[EPIC-6 Run (FLLWUP-39..40)]], [[BUG-2 Run]], [[EPIC-8 Run (EV-18, EV-19)]]