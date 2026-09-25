---
title: translate.ts
type: entity
summary: The pure pi-to-AG-UI mapper — translate(input, state) → {frames, state} — the single translator shared by the live path and the replay path, with entryId-based discrimination.
aliases: [the mapper, translation mapper]
tags: [entity/module, translate]
sources: ["[[EV-4 Ruling]]", "[[EV-5 Ruling]]", "[[FLLWUP-3 Design Position r3]]", "[[FLLWUP-5 Ruling]]", "[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-02
updated: 2026-09-24
---
Implements §4's mapping table as a pure fold: no I/O, no sockets, no session references (purity guards G-11/G-12 enforce it). Key shaped-by-ruling properties:

- CUSTOM convention: `{type:"CUSTOM", name:"pi.<category>", value:{pi:<raw>, data:<semantic>}}` — `name` is the sole dispatch key (EV-4 Q1); `value.data` is typed unknown with verbatim passthrough (FLLWUP-3).
- The §4 table carries the EV-4-corrected rows: `REASONING_MESSAGE_*` (not the deprecated THINKING family), generation-lane `toolcall_*` drives `TOOL_CALL_*` (execution-lane → `CUSTOM pi.tool.*`), flattened `TOOL_CALL_RESULT.content`.
- Live vs JSONL discrimination is `"entryId" in input` (FLLWUP-5's change — the old `"kind" in input` collided with `ui_prompt_end`'s `kind` field and misrouted to `translateJsonl`).
- `runId` is input-driven, never minted here (EV-4 Q2); STEP frames are omitted in replay; stepName = "turn"; thinking block ids `<assistantId>:think:<contentIndex>`.
- FLLWUP-3 added the four runtime-dead families (`queue_update`, `bash_execution_update`, `auto_retry_*`, `summarization_retry_*`) with payload-variant dispatch keys (`pi.session.summary_retry_branch` / `_compaction`).
- FLLWUP-6 removed the dead `user_input` strand; FLLWUP-4 mapped `urlExpired`'s remedy.
- The live path was re-narrowed on the real SDK payloads by the [[EPIC-4 Run (FLLWUP-11..12)]] (FLLWUP-12): the message-family AG-UI `messageId` is now **payload-intrinsic** — `${role}:${timestamp}` via [[pi-sdk-events.ts]]'s `agentMessageId` — replacing an identity-derived key that broke under the engine's per-emission spread-copies ([[Emission-Semantics Fidelity]]). One documented divergence: `tool_result` mints `messageId := toolCallId`, because the real payload carries no message id (R-PAYLOAD-1).
- FLLWUP-40 ([[EPIC-6 Run (FLLWUP-39..40)]]) corrected this file's pairing-test source comment in `test/translate.test.ts` — it had claimed the test fails if either side changes its minting/decoding rule, which the assertions do not enforce; the comment now states it pins derivation-text presence and role vocabulary in the 400-char signature windows, consistent with `docs/ROLE-DECODER-DUPLICATION.md` ([[Record Accuracy]]). Assertions byte-identical.

Shared unchanged by [[history.ts]] (replay) and [[index.ts]] (live) — the property that makes replay correct by construction.

## Related
[[Spec Correction Governance]], [[Closed Vocabulary Discipline]], [[history.ts]], [[index.ts]], [[pi-sdk-events.ts]], [[Emission-Semantics Fidelity]], [[Real-Surface Verification]], [[Record Accuracy]], [[EPIC-4 Decision Record]], [[EPIC-6 Decision Record]], [[AG-UI]], [[FLLWUP-3 Design Position r3]]

## Sources
[[EV-4 Ruling]], [[EV-5 Ruling]], [[FLLWUP-3 Design Position r3]], [[FLLWUP-5 Ruling]], [[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-6 Run (FLLWUP-39..40)]]
