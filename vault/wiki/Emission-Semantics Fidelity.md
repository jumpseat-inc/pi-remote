---
title: Emission-Semantics Fidelity
type: concept
summary: Fixture the event-constructing layer's real emission semantics — the engine emits fresh spread-copies per event, so object identity never survives — not just the pass-through emitter's payload shape.
aliases: [emission semantics, constructing-layer fidelity, spread-copy semantics]
tags: [concept/process, doctrine, testing, translate]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-4 Decision Record]]"]
created: 2026-09-24
updated: 2026-09-24
---
FLLWUP-12's first Skeptic verify cycle **BLOCKED** on a subtle premise error: the pass-through fixtures fed the mapper event objects that shared identity with the accumulated message, so a `messageId` derived from object identity looked stable. In the installed engine it is not. `streamAssistantResponse` emits `message: { ...partialMessage }` on `message_start` **and on every `message_update`**, and the accumulated `finalMessage` object on `message_end` — object identity never survives an event. The identity-derived id therefore minted a fresh key per emission: two `TEXT_MESSAGE_START` frames and zero `END`.

**The rule.** Fixtures must encode the *constructing layer's* emission semantics, not just the pass-through shape. A shape-identical payload emitted as a fresh copy behaves differently from one carrying shared identity, and only a test that exercises the real emission path can see it.

**The fix shape.** Derive join keys from **payload-intrinsic** data the engine copies verbatim onto every emission of one logical message. FLLWUP-12 uses `agentMessageId = ${role}:${timestamp}` — `role`/`timestamp` are copied onto every spread-copy emission of one assistant stream and distinct across streams, so the id is stable within a message and distinct between messages. The fix was pinned by a "wedge" test that was red at the pre-fix head (`e1ef9c1`) and green after (`e502add`), giving the correction [[Real-Surface Verification]]'s non-vacuous shape. Known bound, documented on [[pi-sdk-events.ts]]: two same-role messages sharing one timestamp would fold into one AG-UI message (merged framing, not corruption).

**Why it matters here.** The whole epic is about silent event drops; this defect was a *silent misroute* introduced by the correction itself, caught only because the skeptic ran the construct-layer semantics. It is the payload-layer analogue of [[Real-Surface Verification]] and a worked example for [[Fixture-Green Honesty]].

## Related
[[Real-Surface Verification]], [[Fixture-Green Honesty]], [[translate.ts]], [[pi-sdk-events.ts]], [[EPIC-4 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-4 Decision Record]]