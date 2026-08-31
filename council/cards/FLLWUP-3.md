---
id: FLLWUP-3
title: "Map EV-4's unmapped live pi events (queue_update, bash_execution_update, auto_retry_*)"
state: Ready
owner: null
epic: EPIC-1
goal: translate.ts maps the remaining live pi events that EV-4's §4 table did not cover — queue_update, bash_execution_update, auto_retry_* — and decides the AG-UI representation of live tool-progress (partialResult), extending the EV-4 mapper without changing its pure fold shape.
---

## Intent

Filed from EV-4's step 13. EV-4 implemented the §4 table rows and the JSONL
entry kinds the spec documents; several live pi events sit outside §4's table
and were deliberately left unmapped (owner round-1 flag; design spec §6
non-goal): `queue_update`, `bash_execution_update`, `auto_retry_*`. These are
live `pi.on()` events a remote user may reasonably want to see (bash output
upload progress, retry state), but §4 defines no AG-UI representation and
EV-4's scope is the §4 table. Separately, live tool-progress (`partialResult`)
has no AG-UI event; EV-4 dropped it because its acceptance requires no
tool-progress frame, with the agreed future representation deferred as
`CUSTOM pi.tool.progress`. This card decides and lands both.

User-visible surface — the remote client's perception of ongoing bash
uploads, retries, and tool progress; today these are silent beyond what the
§4 rows emit.

## Acceptance

- `queue_update`, `bash_execution_update`, and each `auto_retry_*` variant map
  to a defined AG-UI frame through the unchanged `translate(input, state)`
  signature — proposed shape: `CUSTOM` `pi.tool.*` / `pi.session.*` per the
  deliberation's CUSTOM conventions (`{type:"CUSTOM", name:"pi.<category>",
  value:{pi:<raw>, data:<semantic>}}`, name the sole dispatch key). The exact
  category assignment is a design decision for this card's deliberation.
- Live tool-progress (`partialResult`) surfaces as `CUSTOM pi.tool.progress`
  (if the deliberation adopts it), never smuggled into `TOOL_CALL_ARGS`.
- No I/O, no socket references added; the purity guard (G-11/G-12) stays
  green; module import remains side-effect-free.
- `bunx tsc --noEmit` exit 0 and `bun test` exit 0 with fixtures covering
  each newly mapped event.
- Any §4 (or §4-adjacent) representation added rides the same prose-sync path
  the EV-1 Q3 / EV-4 Q1 rulings established (facilitator-authored spec
  amendment alongside the implementation, evidence-cited).
