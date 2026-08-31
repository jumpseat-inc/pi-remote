---
id: EV-4
title: "Pure pi-to-AG-UI translation mapper"
state: Ready
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
