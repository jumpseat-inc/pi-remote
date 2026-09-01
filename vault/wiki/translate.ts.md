---
title: translate.ts
type: entity
summary: The pure pi-to-AG-UI mapper — translate(input, state) → {frames, state} — the single translator shared by the live path and the replay path, with entryId-based discrimination.
aliases: [the mapper, translation mapper]
tags: [entity/module, translate]
sources: ["[[EV-4 Ruling]]", "[[EV-5 Ruling]]", "[[FLLWUP-3 Design Position r3]]", "[[FLLWUP-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Implements §4's mapping table as a pure fold: no I/O, no sockets, no session references (purity guards G-11/G-12 enforce it). Key shaped-by-ruling properties:

- CUSTOM convention: `{type:"CUSTOM", name:"pi.<category>", value:{pi:<raw>, data:<semantic>}}` — `name` is the sole dispatch key (EV-4 Q1); `value.data` is typed unknown with verbatim passthrough (FLLWUP-3).
- The §4 table carries the EV-4-corrected rows: `REASONING_MESSAGE_*` (not the deprecated THINKING family), generation-lane `toolcall_*` drives `TOOL_CALL_*` (execution-lane → `CUSTOM pi.tool.*`), flattened `TOOL_CALL_RESULT.content`.
- Live vs JSONL discrimination is `"entryId" in input` (FLLWUP-5's change — the old `"kind" in input` collided with `ui_prompt_end`'s `kind` field and misrouted to `translateJsonl`).
- `runId` is input-driven, never minted here (EV-4 Q2); STEP frames are omitted in replay; stepName = "turn"; thinking block ids `<assistantId>:think:<contentIndex>`.
- FLLWUP-3 added the four runtime-dead families (`queue_update`, `bash_execution_update`, `auto_retry_*`, `summarization_retry_*`) with payload-variant dispatch keys (`pi.session.summary_retry_branch` / `_compaction`).
- FLLWUP-6 removed the dead `user_input` strand; FLLWUP-4 mapped `urlExpired`'s remedy.

Shared unchanged by [[history.ts]] (replay) and [[index.ts]] (live) — the property that makes replay correct by construction.

## Related
[[Spec Correction Governance]], [[Closed Vocabulary Discipline]], [[history.ts]], [[index.ts]], [[FLLWUP-3 Design Position r3]]

## Sources
[[EV-4 Ruling]], [[EV-5 Ruling]], [[FLLWUP-3 Design Position r3]], [[FLLWUP-5 Ruling]]
