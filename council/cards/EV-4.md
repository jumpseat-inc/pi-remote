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

### Step 2 — independent first pass (round 1)

**owner** (job-9.1, verbatim).

---

Owner proposes translate.ts as a pure state-threading fold `(input, state)→{frames, state}` (no hidden closure) so START/END framing is testable; both EV-8 (live pi.on) and EV-5 (JSONL-normalized) call the identical translate(). Tools/events bound to real pi SDK: agent_start, agent_settled, message_start/update/end, turn_start/end, tool_execution_start/update/end, tool_result, ui_prompt_start/end, model_select, thinking_level_select, session_info_changed, session_compact, context. Frame table: agent_start→RUN_STARTED{threadId,runId}; agent_settled→RUN_FINISHED (never agent_end); message_start(assistant)→TEXT_MESSAGE_START{messageId,role:"assistant"}; message_update text→TEXT_MESSAGE_CONTENT{messageId,delta}; thinking→THINKING_TEXT_MESSAGE_* with messageId `<assistantId>:think`; message_end→TEXT_MESSAGE_END(+THINKING_END if open); turn_start/end→STEP_STARTED/FINISHED{stepName:"turn-"+turnIndex}; tool_execution_start→TOOL_CALL_START{toolCallId,toolCallName,parentMessageId}; tool_execution_update→TOOL_CALL_ARGS{delta:JSON.stringify(args)}; tool_execution_end→TOOL_CALL_END; tool_result→TOOL_CALL_RESULT{messageId,toolCallId,content}; ui_prompt→CUSTOM pi.human_input; others→CUSTOM pi.*. START/END framing via fold state map openMessages. Replay: deterministic ids at both envelope (entryId+contentHash) and AG-UI inner-id layer (messageId "m:"+entryId, toolCallId "tc:"+entryId, runId from run boundary) to satisfy EV-5 no-double-execute. Replay synthesizes tool calls from assistant message toolCall blocks. CUSTOM value = { pi: <event-name>, data: <semantic> } with name = stable dispatch path. Six testable claims: agent_settled-only RUN_FINISHED; message START/CONTENT/END incl :think pane; replay byte-identical determinism; tool START→RESULT assistant order with deterministic toolCallId; every CUSTOM value.pi===event && name pi.*-prefixed; module guard no I/O/socket/session imports + single shared translate. Open questions: exact MESSAGES_SNAPSHOT.messages shape; whether terminal non-retrying agent_end without agent_settled should emit RUN_ERROR (leans no); mixed text+thinking content in one message_update must be split by content-block type; queue_update/bash_execution_update/auto_retry_* outside required table left unmapped (follow-up). Notes §4 table omits message_start/message_end rows which acceptance requires (adds them).

---

**principal** (job-9.2, verbatim).

---

Principal's cross-seam reading: contract is three documents that don't align — §4 name-only table, pi's real event payloads, AG-UI actual schemas. Pinned/correct: §4 ALL_CAPS names are literally AG-UI wire type strings (RUN_STARTED etc.); THINKING_TEXT_MESSAGE_* is a real current family; agent_settled→RUN_FINISHED right; TOOL_CALL_RESULT must key off toolResult message events (never tool_execution_end) for assistant source order. Not pinned (the seam hurts): AG-UI requires correlation fields §4 never mentions (threadId/runId/stepName/messageId/toolCallId/toolCallName + name/value). §4 row 4 payload-wrong: pi's split is call generation (message_update toolcall_start/delta/end carrying args) vs execution (tool_execution_start/update/end where tool_execution_update carries partialResult = accumulated output, NOT args); no AG-UI tool-progress event, so TOOL_CALL_ARGS can only come from toolcall_delta (or full snapshot at toolcall_start). CUSTOM {pi,data} not the AG-UI wire shape (CustomEventSchema is {type,name,value}); as written the locked decision vs actual schema are two different shapes. Turns/runs not persisted in JSONL (entry types: session/message/model_change/thinking_level_change/compaction/branch_summary/custom/custom_message/label/session_info — no turn, no run entry) so replay cannot reproduce turnIndex/runId. §5.2 id formula is per-entry but frames are per-frame (collides; needs frame ordinal); AG-UI BaseEvent has no id field, so dedupe id must live in §6 envelope (EV-3 turf), not frame. Reframe: EV-4's deliverable is pinning the reconciled contract (fixture suite IS the contract in executable form), not "implement §4 literally." Concretely: (1) retarget tool-call rows to message_update.toolcall_start/delta/end→TOOL_CALL_START/ARGS/END using pi's toolCall.id as toolCallId (stable across live+replay); demote tool_execution_* to CUSTOM pi.tool.*. (2) Pin CUSTOM as {type:"CUSTOM", name:"pi.<event-name>", value:<data>} — do NOT nest {pi,data} inside value. (3) Correlation-id table: threadId=sessionId (plain string, not ctx.sessionManager); runId=UUID live, "run-<entryId>" replay; messageId minted live, "msg-<entryId>" replay, thinking "msg-<entryId>-thinking-<contentIndex>"; toolCallId=pi's call id; stepName="turn" constant (not turnIndex, replay can't reproduce it); eventId=UUID live, hash(entryId+contentHash+frameOrdinal) replay, living in envelope. (4) Fix §5.2 replay gap: write turn/run derivation into EV-5 contract (turn = user entry starting a run through last assistant/toolResult before next user entry; STEP_STARTED before user entry frames, STEP_FINISHED after turn's last frame) — a new rule, not something §5 says. Six testable claims: tool_execution_update→no TOOL_CALL_ARGS; toolcall_delta→TOOL_CALL_ARGS; every frame type equals AG-UI enum literal; replay twice identical bytes AND identical correlation ids; CUSTOM exactly {type,name,value}; import-guard grep test. Agreement: user-visible surface survives reframe; only pi event driving TOOL_CALL_START/ARGS/END changes (invisible to remote user).

---

**designer** (job-9.3, verbatim).

---

Designer position: translate.ts emits frames satisfying (a) AG-UI schema (threadId/runId on RUN_*, messageId on TEXT_*/TOOL_CALL_RESULT, toolCallId+toolCallName on TOOL_CALL_START, stepName on STEP_*), (b) §4 table row-for-row, (c) user's ability to perceive turn boundaries, reasoning vs answer, tool progress, approvals without reading JSONL. Closes Gulf of Evaluation (streaming answer/reasoning/tool lanes; approval prompts) and Gulf of Execution (replay reconstructs without gaps). Principles: (1) THINKING_* family not REASONING_* (spec chose it, streams like text). (2) THINKING_TEXT_MESSAGE_START on first thinking delta, THINKING_END when assistant pivots to non-thinking; must split mixed text+thinking token stream; fixture think(a),think(b),text(hi) → START/2×CONTENT/END then TEXT START/CONTENT/END. (3) TOOL_CALL_START carries toolCallId(camelCase)+toolCallName+parentMessageId(=assistant messageId that requested tool); TOOL_CALL_RESULT after END with own messageId + role:"tool"; fixture two back-to-back tool calls in one assistant message. (4) RUN_STARTED/RUN_FINISHED carry threadId+runId; runId is fresh UUID per agent_start/agent_settled cycle (NOT session id); replaying same JSONL twice produces identical runIds (§5.2 determinism). (5) STEP_STARTED/STEP_FINISHED around entire turn, keyed stepName="turn" (stable constant, per-turn grain, not per tool call/message). (7) CUSTOM uses AG-UI {name, value}; spec's {pi,data} lives INSIDE value: name:"pi.human_input", value:{pi:"ui.confirm", data:{promptKind, prompt, schemaVersion:1}}. (8) Human-input carries schemaVersion + idempotent promptId (deterministic hash) inside value so EV-6 inject resolves once across replay. (9) signature (input, ctx:TranslateContext)→AgUiFrame[], ctx carries only primitive deterministic fields (sessionId, runId, openMessageIds, monotonic eventId counter) — no socket/transport/logger/clock; type system + lint (no-restricted-imports/grep) enforce. Six falsifiable predictions incl AG-UI ValidateSequence acceptance, replay determinism with MESSAGES_SNAPSHOT+CUSTOM compaction pair. Preferences (ranked last): stepName "turn" constant; first thinking delta as THINKING_TEXT_MESSAGE_START; camelCase keys at frame boundary (conformance wins over snake_case). Open questions handed up (not deciding): MESSAGES_SNAPSHOT.messages inner shape (EV-5 more than EV-4, but confirm against MessageSchema); replay RUN_STARTED/RUN_FINISHED — one pair per past run (argued) vs one outer pair (design judgment EV-5 inherits).

---

### Step 3 — bounded exchange (round 2: cross-disclosure)

Re-dispatching owner, principal, designer with each other's positions.
