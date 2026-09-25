---
title: pi-sdk-events.ts
type: entity
summary: FLLWUP-12's vendored real SDK event payload shapes plus the payload-intrinsic derivation helpers (agentMessageId = role:timestamp), the real→local fold adapter, and the one documented tool_result divergence; FLLWUP-39 added the thinking/tool-call signature fields with reasoned omissions.
aliases: [sdk event payloads, pi-sdk-events]
tags: [entity/module, sdk, translate]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-24
updated: 2026-09-24
---
Created by FLLWUP-12 (R-TYPE-1/R-PAYLOAD-1) to hold the real SDK event payload mirrors and the derivation logic that replaces the old stand-in-shaped assumptions. Provenance is the installed SDK's `dist/core/extensions/types.d.ts` and `pi-ai dist/types.d.ts`; only the fields pi-remote consumes are declared, and the SDK is **not** a dependency. Re-diff on SDK upgrades.

**Vendored payload shapes** (real, not stand-in): `MessageStartEvent` / `MessageUpdateEvent` / `MessageEndEvent` (each `{ type, message: AgentMessage, … }` — no `messageId`, no `events` field), the `AgentMessage` union, the `PiAssistantMessageEvent` `type`-union (every variant carries `partial`, `*_delta` carry `delta`, toolcall variants locate the block via `contentIndex`), `ToolResultEventBase` (carries `toolCallId`, not `messageId`), `UIPromptStartEvent`/`UIPromptEndEvent`, `TurnStartEvent`/`TurnEndEvent`, `AgentStartEvent`/`AgentSettledEvent`.

**Derivation helpers (pure, total — malformed input → `undefined`/`null`, never a throw).**
- `agentMessageId(msg)` = `${role}:${timestamp}` — payload-intrinsic, stable across every spread-copy emission of one logical message ([[Emission-Semantics Fidelity]]).
- `messageFrameRole(messageId)` — the inverse, back-deriving the role; the local mirror used by [[translate.ts]] (`messageFrameRoleLocal`) is deliberately duplicated here because the G-12 no-runtime-imports purity rule forbids `translate.ts` importing this module (tracked for scoped removal by FLLWUP-37).
- `realAssistantMessageEventOf(ev)` — the real→local fold-union adapter; `start`/`text_start`/`text_end`/`thinking_start`/`thinking_end`/`done`/`error` map to no fold action.

**The one documented divergence** (R-PAYLOAD-1): `tool_result` has no message id in the real payload, so `messageId := toolCallId` — justified on the FLLWUP-12 card because the real payload genuinely lacks the field. Every other subscription was corrected, not annotated. Known bound: two same-role messages sharing one timestamp fold into one AG-UI message (merged framing, not corruption). Covered by `test/pi-sdk-events.test.ts` and the `index.test.ts` live-path fixtures.

**Sibling signature fields (FLLWUP-39, EPIC-6).** The [[EPIC-6 Run (FLLWUP-39..40)]] completed the vendored-surface audit FLLWUP-38 began: `PiThinkingContent` now declares `thinkingSignature?: string` (pi-ai `dist/types.d.ts:247–255`, field `:250`) and `PiToolCall` declares `thoughtSignature?: string` (`:261–269`, field `:266`), each with line-referenced provenance. Two adjacent real optional fields — `redacted?` (`:254`) and `namespace?` (`:268`) — are **deliberately omitted with their reasons stated** in the provenance comments, so the omission is not mistaken for an audit gap ([[Real-Surface Verification]]'s declare-or-annotate-with-reason). SDK still not a dependency.

## Related
[[Emission-Semantics Fidelity]], [[Real-Surface Verification]], [[translate.ts]], [[pi-sdk-on.ts]], [[pi-host.ts]], [[index.ts]], [[Batched Card Delivery]], [[EPIC-4 Decision Record]], [[EPIC-6 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-6 Run (FLLWUP-39..40)]]