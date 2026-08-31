---
id: EV-4
title: "Pure pi-to-AG-UI translation mapper"
state: Deliberating
owner: null
epic: EPIC-1
goal: translate.ts maps each documented pi event and JSONL entry kind to the AG-UI frames of spec §4 with no I/O and no socket references, emitting CUSTOM events with pi-prefixed payloads for anything AG-UI cannot express.
---

## Intent

Implements §4's mapping table as a pure function in `src/translate.ts` — the
single translator both the live path (EV-8 wiring) and the replay path (EV-5)
call. User-visible surface — on the remote client: streaming assistant text
appears as TEXT_MESSAGE events, reasoning as THINKING_TEXT_MESSAGE events,
tool executions as TOOL_CALL_START/ARGS/END plus TOOL_CALL_RESULT in assistant
source order, turns as STEP events, and approval prompts as CUSTOM
`pi.human_input`. One wrong mapping here is visible to every remote user, so
the table is implemented row by row with tests.

## Acceptance

- A fixture suite feeds one representative pi event per §4 table row and
  asserts the exact AG-UI frames emitted, including START/END framing around
  streamed messages and `agent_settled` (not `agent_end`) driving RUN_FINISHED.
- pi concepts with no AG-UI equivalent (context/compaction, model and thinking
  selection, session info) come out as CUSTOM events shaped
  `{ pi: <event-name>, data: … }` — no second wire format exists in the output.
- The module performs no I/O and holds no socket or session references (its
  type signature and a lint/test guard show this).
- The same function is called unchanged by the replay path (EV-5 test
  imports it directly).

## Deliberation record

### Step 1 — path classification

- Full council (not mechanical): design-judgment — the AG-UI frame shapes for
  streamed text, thinking, tool calls (START/ARGS/END), STEP numbering, and
  the CUSTOM event payload shape are not fully pinned by §4's table; the
  START/END framing timing and event-id scheme are real design choices. The
  goal admits more than one reasonable way to frame a streamed assistant
  message.
- Surface-touching: yes — the remote client is the user-visible surface
  (assistant text → TEXT_MESSAGE, reasoning → THINKING_TEXT_MESSAGE, tool
  executions → TOOL_CALL_START/ARGS/END + TOOL_CALL_RESULT, turns → STEP,
  approvals → CUSTOM `pi.human_input`). `designer` is seated as a third
  generator in steps 2–3.
- Cross-seam: consumed by both the live path (EV-8) and the replay path
  (EV-5); the mapper must be importable and unchanged by replay.
- Locked human/phase-1 decisions carried by the card (not open for
  relitigation): the §4 mapping table is the contract (unchanged by EV-1);
  the envelope is §6; replay event ids follow §5.2 (deterministic
  id = entry id + content hash); CUSTOM payloads carry `{ pi: <name>, data: … }`
  and no second wire format exists.
