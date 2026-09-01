---
title: inject.ts
type: entity
summary: Converts inbound AG-UI user messages into pi.sendUserMessage calls — steer/followUp delivery, a (promptId, occurrence) pending-prompt registry, and zero transformation of its own injections.
aliases: [the injection module]
tags: [entity/module, inject]
sources: ["[[EV-6 Design Position]]", "[[FLLWUP-5 Ruling]]", "EV-8 Ruling (FLLWUP-8 shipped with no separate ruling)"]
created: 2026-09-02
updated: 2026-09-02
---
Implements §5.4 under EV-6's load-bearing principle: **no input handler, no filtering, no transformation** — remote injections must be indistinguishable from typed input in the JSONL, which is what makes replay correct by construction. Delivery: idle → plain `sendUserMessage`, mid-stream → `deliverAs: "steer"`, queued → `deliverAs: "followUp"`. Approval resolution: a `(promptId, occurrence)` pending-entry registry matches `pi.human_input.response` frames; `InjectResult` distinguishes `resolved` (fixture-only — `resolvePendingPrompt` is `() => false` in production per steward's R3 Side B) from `steered_fallback` with a `tracked` flag (FLLWUP-5 S-O3). Never-throw property verified 8/8; identical prompts isolated by the compound key. `deviceId` comes from the envelope and never enters free text. FLLWUP-8 made the raise live; FLLWUP-15 (Backlog) tracks the local-answer race; FLLWUP-13 (Backlog) slims `registerPrompt` to `{promptId}`.

## Related
[[Fixture-Green Honesty]], [[Closed Vocabulary Discipline]], [[index.ts]], [[translate.ts]], [[FLLWUP-5 Ruling]]

## Sources
[[EV-6 Design Position]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]]
