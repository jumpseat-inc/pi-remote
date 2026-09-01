---
title: EV-4 Ruling
type: source
summary: Product-owner ruling binding the §4 protocol corrections into the spec via in-PR amendment, and fixing replay RUN framing at one pair per past run.
aliases: [EV-4 Open-Judgment Rulings]
tags: [council/ruling, translate, replay, spec-governance]
sources: ["[[EV-4 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Two rulings on EV-4 (2026-08-31). **Q1** — three Skeptic-verified corrections to the locked §4 table (`THINKING_TEXT_MESSAGE_*` → `REASONING_MESSAGE_*`; generation-lane `toolcall_*` drives `TOOL_CALL_*` with `tool_execution_*` → CUSTOM `pi.tool.*`; `TOOL_CALL_RESULT.content` flattened to a string) are binding, and the facilitator amends §4 in the same PR, evidence-cited — the canonical application of [[Spec Correction Governance]]. **Q2** — replay emits one `RUN_STARTED`/`RUN_FINISHED` pair per past run; `translate.ts` never mints runIds; EV-5 mints deterministic per-past-run runIds and owns the past-run-boundary rule (user entry through last assistant/toolResult before the next user entry).

## Related
[[Spec Correction Governance]], [[translate.ts]], [[history.ts]], [[Closed Vocabulary Discipline]]

## Sources
`vault/raw/2026-08-31-po-ev4-ruling.md`
