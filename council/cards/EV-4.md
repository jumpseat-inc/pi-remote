---
id: EV-4
title: "Pure pi-to-AG-UI translation mapper"
state: Done
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

**owner** (job-9.4, round 2 verbatim).

---

Owner verified SDK: tool_execution_start carries args; tool_execution_update carries {args, partialResult}(partialResult = streaming output); tool_execution_end carries {result, isError}. assistantMessageEvent stream emits toolcall_start{id,toolName}/toolcall_delta{delta}/toolcall_end{toolCall} — where args are generated. Owner retracts round-1 tool_execution_update→TOOL_CALL_ARGS (payload-wrong: partialResult is the substantive field + that lane fires after answer generation, breaking source order). Adopts caller-position: TOOL_CALL_START/ARGS/END from message_update toolcall_start/delta/end (toolCallId=id/toolCall.id, stable live+replay); tool_execution_* demoted to CUSTOM pi.tool.* (carries partialResult; AG-UI has no tool-progress event). TOOL_CALL_RESULT keys off toolResult MESSAGE event, never tool_execution_end. Agrees with principal: dedupe id in §6 envelope (EV-3 turf), not AG-UI frame (BaseEvent has no id), with frame-ordinal in replay derivation; JSONL has no turn/run entries → stepName="turn" constant, turn/run boundary derivation is EV-5 contract rule; threadId=sessionId plain string. Agrees with designer: split mixed text+thinking by content-block type; parentMessageId=requesting assistant messageId; runId fresh per agent_start/agent_settled cycle not session id, deterministic across identical JSONL; keep {pi,data} inside value. On CUSTOM: lands with DESIGNER (letter of locked decision) — name="pi.<category>" (sole client dispatch key), value:{pi:<raw event name, provenance, not a second switch>, data}. Endorses schemaVersion + deterministic promptId in value.data for human-input so EV-6 resolves once. Testable: (1) toolcall_delta→TOOL_CALL_ARGS{delta}, tool_execution_update{partialResult}→emit NO TOOL_CALL_ARGS (only CUSTOM pi.tool.*); (2) CUSTOM fixture frame.type==="CUSTOM" && value.pi===event && value.data!==undefined, name sole stable discriminator; (3) replay two tool calls in one assistant message, each TOOL_CALL_RESULT exactly once, deterministic toolCallId, byte-identical on re-run. Notes live can stream TOOL_CALL_ARGS per toolcall_delta but replay only has full ToolCallContent.input → single snapshot; same live-richer-than-replay asymmetry as text/thinking; mapper accepts both. Final rec: SDK-verified tool-source mapping (generation lane drives TOOL_CALL_*, execution lane→CUSTOM pi.tool.*, RESULT from toolResult message); CUSTOM {name:"pi.<category>", value:{pi,data}} with name sole dispatch key; stepName="turn"; runId fresh live / EV-5-derived replay; dedupe id in §6 envelope; per-past-run RUN pair handed to EV-5.

---

**principal** (job-9.5, round 2 verbatim).

---

Principal round 2: Corrects two round-1 errors. (1) CUSTOM: AG-UI CustomEventSchema={type,name,value}; "payload" is the value field → locked {pi,data} belongs INSIDE value, not replaced by name. WITHDRAWS round-1 no-nesting reading. (2) Tool-call source: round-1 claim that tool_execution_update has partialResult-not-args was FACTUALLY WRONG — it carries BOTH {toolCallId, toolName, args, partialResult} (json.md:50, rpc.md:1025–33). So locked §4 row tool_execution_update→TOOL_CALL_ARGS IS implementable without corruption: TOOL_CALL_ARGS.delta=JSON.stringify(args). WITHDRAWS retarget to toolcall_delta; §4 table stands as-is. Remaining seam §4 hides: TOOL_CALL_START needs two fields from two surfaces — tool_execution_start supplies toolCallId/toolName/args but NO parentMessageId; parent assistant message id exists only in generation stream seeded by message_update.toolcall_start (rpc.md:988). Mapper must thread toolCallId→assistantMessageId in fold state (seeded at toolcall_start, consumed at tool_execution_start) — reconciliation lives in the fold, so owner's (input,state)→{frames,state} signature is correct; designer's array-returning signature insufficient. Blind spots: delta is a JSON arguments STRING in client schema (delta:z.string()), so serializing partialResult instead of args silently corrupts tool UI; §4 literal mapping fires TOOL_CALL_START only AFTER message_end (tool_execution_* post-message) so client always attaches tool calls to a CLOSED assistant message — valid AG-UI but "rich tool UI inside streaming message" NOT achievable under locked table; deterministic event id is an ENVELOPE field (BaseEvent no id), inner correlation ids must be deterministic independently (messageId, toolCallId, runId). Settled rows: CUSTOM={type,name:"pi.<category>", value:{pi:"<real pi event>", data}}; approval value:{pi:"ui.confirm", data:{promptKind,prompt,schemaVersion:1,promptId}}; tool §4 literal with parentMessageId from fold state, TOOL_CALL_ARGS.delta=JSON.stringify(args) never partialResult, tool_result→TOOL_CALL_RESULT{messageId,toolCallId,content,role:"tool"} assistant source order; partialResult DROPPED in EV-4 (no AG-UI progress event, acceptance doesn't require; live tool progress later = follow-up CUSTOM pi.tool.progress, not EV-4). stepName="turn" constant (label; ordering belongs to §6 seq; JSONL no turn entries). runId never minted by translate.ts — takes runId/threadId/state from input; one RUN pair PER PAST RUN on replay. THINKING messageId per content block "<assistantMessageId>:think:<contentIndex>" deterministic both paths. Terminal agent_end without agent_settled: NO RUN_ERROR from translate.ts (keeps pure mapper to §4 rows; AG-UI has RUN_ERROR but if un-settled run must close that's EV-8 teardown, not a new EV-4 row). Testable: (1) tool_execution_update{args:{a:1},partialResult}→exactly one TOOL_CALL_ARGS delta==='{"a":1}', no frame contains partialResult; (2) toolcall_start{id:call_1} then tool_execution_start{toolCallId:call_1}→TOOL_CALL_START.parentMessageId===assistant messageId from preceding message_start; (3) ui.confirm→exactly {type,name:"pi.human_input",value:{pi:"ui.confirm",data:{schemaVersion:1,promptId:deterministic}}}; value has keys pi and data, name starts "pi."; (4) replay same JSONL twice→byte-identical incl inner ids; (5) every STEP_STARTED/FINISHED stepName==="turn"; (6) static guard: translate.ts no crypto.randomUUID, Date.now, Math.random, or socket/session imports.

---

**designer** (job-9.5, round 2 verbatim).

---

Designer round 2: stands on round-1 with 2 corrections + 1 clarification. ACCEPTS principal's split (call generation on message_update.toolcall_* carrying args; execution on tool_execution_* carrying partial output), therefore REJECTS owner's row-4 literal tool_execution_update→TOOL_CALL_ARGS. HOLDS {pi,data} nested inside value for CUSTOM, against principal's flat {name,value}. Keeps one-pair-per-past-run replay preference, labels as such, but explicitly ESCALATES: how many RUN pairs replay emits is a PRODUCT judgment ("does remote user see session as one run or as N?"), product-owner should rule; designer does not relitigate. Gulf of Evaluation: TOOL_CALL_ARGS from tool_execution_update would carry OUTPUT into args lane → client renders "running" content in "configuring" pane = gulf failure mid-tool. Mapping instrument + conceptual model: two real pi surfaces do two jobs; AG-UI has exactly one tool-progress lane; tool_execution_* output not in AG-UI vocabulary = case for CUSTOM pi.tool.*, not smuggled into TOOL_CALL_ARGS. Notes cannot verify in session (no shell, no src/ yet) that message_update carries discriminated toolcall_start/delta/end with args on delta; treats as working hypothesis, hands falsification to fixture test (feed synthetic toolcall_delta carrying {name,args}→TOOL_CALL_ARGS{delta:JSON.stringify(args)}; feed tool_execution_update{partialResult}→no TOOL_CALL_* and CUSTOM pi.tool.partial_result instead; either result falsifies one side cleanly). CUSTOM reading: {pi,data} is CONTENTS of value; name=dispatch path we own (e.g. pi.session.model_change AND pi.session.thinking_level_change both under pi.session.*), value.pi=pi provenance, value.data=semantic payload; principal's flat reading collapses namespaces and leaks pi event name into dispatch name. TOOL_CALL_RESULT: agree with principal source= toolResult message in assistant source order; messageId=tool-result message lining up with assistant source ordering; note role:"tool" is NOT strictly an AG-UI primitive (ToolCallResultEvent is {messageId,toolCallId,content,role?}), keeps as signifier/preference. Replay RUN framing: one START/END pair per past run derived by EV-5 (user message through last assistant/toolResult before next user); owner's turn-<index> and principal's constant-turn both dodge it; EV-4 publishes rule that translate consumes "this entry is a run boundary" hint from EV-5 and emits RUN_* pair. OPEN-JUDGMENT ESCALATION: replay RUN framing → product-owner (one outer pair vs N pairs). agent_end-without-agent_settled: agree with owner's lean (no RUN_ERROR); §4 locks agent_settled→RUN_FINISHED; if agent_end fires without agent_settled the session hasn't settled = a SIGNAL worth surfacing, surface as CUSTOM pi.session.unsettled_end{lastEvent,reason} and let client decide; RUN_ERROR reserved for actual failure; hand to principal as back-pressure note for pi-side contract (make pi emit agent_settled for user-abort terminal). Falsifiable predictions incl tool-call source, CUSTOM round-trip, replay determinism, no-I/O guard, thinking/text split, agent-end semantics. Preferences ranked last: stepName="turn" constant; THINKING_START on first thinking delta; role:"tool" signifier; camelCase frame keys; one RUN pair per past run; promptId deterministic hash. Escalation owed: replay RUN framing is product-owner question; agent_end-without-agent_settled is principal question (does pi ever emit it and what does it mean); not reopening either from this seat.

---

### Round outcome (facilitator record)

Exchange stopped after 2 rounds; positions stabilized (≤3 cap not reached by design — no 3rd round run because the two residuals are not closable by further persuasion). CONVERGED across all three: CUSTOM shape {type:"CUSTOM", name:"pi.<category>", value:{pi:<raw event>, data:<semantic>}} with name the sole dispatch key; stepName="turn" constant; runId fresh-UUID-live / EV-5-derived-replay, never minted by translate; parentMessageId on TOOL_CALL_START; TOOL_CALL_ARGS.delta = JSON.stringify(args) never partialResult; per-content-block thinking messageId; pure fold signature with no I/O + lint/grep guard; TOOL_CALL_RESULT from toolResult message in assistant source order. TWO residuals routed forward: (A) tool-call source event — 2v1, owner+designer = generation lane toolcall_delta→TOOL_CALL_* with tool_execution_*→CUSTOM pi.tool.*; principal = §4 literal tool_execution_*→TOOL_CALL_* with fold-state parentMessageId threading. This is a TESTABLE capability/semantics dispute → Skeptic step 4. (B) replay RUN framing (one pair per past run vs one outer pair) — designer explicitly escalated as product-owner judgment (remote user perception); no test settles it → step 6 routing.

### Step 4 — Skeptic attacks and runs tests (job-9.7)

Skeptic probed the real pi SDK source, pi docs (session-format.jsonl), and the AG-UI spec. Results:

1. THINKING_TEXT_MESSAGE_* DEPRECATED → use REASONING_MESSAGE_* (role field on START). **closed-red**. Grounded: AG-UI repo docs/concepts/reasoning.mdx, TS EventType enum, Dart migration. §4 literally names THINKING_TEXT_MESSAGE_* → §4's row names a deprecated family.
2. tool_execution_*→TOOL_CALL_* ordering INVALID: tool_execution_* fires in a SEPARATE execution lane AFTER message_end; mapping it to TOOL_CALL_* would place tool calls after the message ended (false temporal order). Generation lane (message_update.assistantMessageEvent toolcall_start/delta/end) is the correct source for TOOL_CALL_START/ARGS/END. tool_execution_update carries a STATIC args snapshot + partialResult (output), not an args delta. **closed-red for §4-literal Side 2** (Side 1 owner+designer confirmed).
3. STEP_STARTED/FINISHED carry only stepName (no threadId/runId) → stepName:"turn" valid. **closed-green**.
4. AG-UI BaseEvent has NO id field → dedupe event id must live in §6 envelope. **closed-green**.
5. ValidateSequence: duplicate RUN_FINISHED or RUN_FINISHED w/o RUN_STARTED violates; agent_settled fires once per prompt → agent_settled→RUN_FINISHED is safe. **closed-green**.
6. TOOL_CALL_ARGS.delta is z.string(); pi toolcall_delta.delta is string; type-compatible. Live passes raw fragment, replay JSON.stringify(args). **closed-green**.
7. CUSTOM={type,name,value}, name string = sole dispatch key; nested value OK. **closed-green**.
8. TOOL_CALL_RESULT.content is z.string() but pi ToolResultMessage.content is (TextContent|ImageContent)[] → mapper MUST flatten blocks to string (concatenate text, represent/skip images). **closed-red** (implementable correction, field shape imprecise).
9. JSONL has NO turn/run entries (session/message/model_change/thinking_level_change/compaction/branch_summary/custom/custom_message/label/session_info) → replay infers turn/run boundaries via fold state; stepName "turn" valid. **closed-green**.
10. agent_settled is AgentSession-synthesized (not in core AgentEvent union) but IS available via pi.on("agent_settled"). **closed-green**.
11. Single TOOL_CALL_ARGS snapshot between START and END is AG-UI-valid (no min/max). **closed-green**.

Verdict: blocks. Two red findings requiring design correction: (#1) emit REASONING_MESSAGE_* not THINKING_TEXT_MESSAGE_*; (#8) flatten ToolResultMessage.content blocks to string for TOOL_CALL_RESULT.content. Residual B (replay RUN framing) not settled by tests — remains open judgment.

### Step 5 — Consolidator synthesis (job-9.8, verbatim)

**Consolidator ground the wiki (empty). Sorting result:**

SETTLED (converged or Skeptic closed-green): pure fold translate(input,state)→{frames,state} no I/O + lint/grep guard; CUSTOM {type,name:"pi.<category>", value:{pi:<raw>, data:<semantic>}} name sole dispatch key, pi nested in value; stepName constant "turn"; runId never minted by translate (UUID live / EV-5-derived replay); parentMessageId on TOOL_CALL_START; TOOL_CALL_ARGS.delta=JSON.stringify(args) never partialResult; thinking per-content-block id "<assistantId>:think:<contentIndex>"; TOOL_CALL_RESULT from toolResult MESSAGE in assistant source order; agent_settled→RUN_FINISHED; dedupe id in §6 envelope not BaseEvent; CUSTOM name/value typing. (pi.session.unsettled_end proposed by designer, no objection, no test run.)

Settled disputes (ran AND result): S3 stepName "turn" valid (green); S4 dedupe id in envelope (green); S5 agent_settled safe (green); S6 delta string type (green); S7 CUSTOM name sole dispatch key (green); S9 JSONL no turn/run entries, replay infers via fold state (green); S10 agent_settled reachable via pi.on (green); S11 single TOOL_CALL_ARGS snapshot valid (green); S2 FACTUAL layer — generation lane toolcall_start/delta/end is correct source, tool_execution_* fires after message_end in separate lane (static args snapshot + partialResult) — red against §4-literal side; closes factual half of residual A.

OPEN JUDGMENT (→ product-owner, escalating to steward):
1. §4 LOCKED-table corrections governance. Two Skeptic tests (S1 thinking family deprecated→REASONING_*; S2 tool-call source lane) + implementable correction (S8 content flattening) show §4 literal rows are wrong and must change for the translator to be correct. Who has authority to rewrite a LOCKED contract clause in response to a test? Positions at equal weight: (a) test-settled correction the spec may absorb — closed-red against the literal is dispositive; spec owner updates §4 (REASONING_MESSAGE_*, generation-lane toolcall_*, content flattening) because a locked clause contradicting a passing test is defective on its face. (b) contract-ruling path required — LOCKED means LOCKED; amending §4 routes through contract owner (product-owner→steward), not silently rewritten by facilitator/implementing seat even when a test shows the literal is wrong. Until ruled, §4 stays as written and corrections live only as open objections.
2. Replay RUN framing (residual B). Replaying N past runs: one RUN_STARTED/FINISHED pair per past run (mirrors live, per-run boundaries meaningful to remote user) vs one outer RUN pair wrapping whole replay batch (resync = single client-facing catch-up; nested RUNs confuse perception of "what is a run"). No test can settle; remote-UX values call.

OPEN OBJECTIONS (Skeptic objections, settling test not yet passed on a corrected impl):
O1 thinking family (S1, closed-red) — §4 names THINKING_TEXT_MESSAGE_* but deprecated→REASONING_MESSAGE_* (role field); settle by green test of corrected impl.
O2 tool-call source lane (S2, closed-red) — §4 maps tool_execution_*→TOOL_CALL_* but lane fires after message_end (false order); generation lane toolcall_* is correct, tool_execution_*→CUSTOM pi.tool.*; settle by green test of corrected impl. (Dispute of WHICH lane is correct settled red; the correction not implemented/re-tested.)
O3 TOOL_CALL_RESULT content flattening (S8, closed-red) — content is z.string() but pi ToolResultMessage.content is (TextContent|ImageContent)[]; must flatten to string. Settle by green test. Entangled with O1/O2 governance.

Consolidator verdict: NOT ready to hand off. Two blockers in order: (1) open judgment #1 (§4 governance) must be ruled before O1/O2/O3 resolve into implementation — corrections touch a LOCKED contract clause a facilitator may not rewrite unilaterally; (2) open judgment #2 (replay RUN framing) must be ruled before replay framing finalizes; independent of #1, can be ruled in parallel.

### Step 6 — routing

Open-judgment item 1 (§4 corrections governance) and open-judgment item 2 (replay RUN framing) both route to product-owner (escalating to steward) per council.md step 6. No Phase 1 ruling on this epic covers either question (orchestrator confirmed: all judgment delegated to council, no standing rulings). Per the escalation contract, the facilitator does not dispatch ruling seats; returning ESCALATION to the orchestrator for the ruling, then resuming this card on the ruling.

### Step 6 outcome — product-owner rulings (Q1/Q2, binding, verbatim)

The orchestrator dispatched product-owner on both open-judgment items. The rulings below are binding and appended verbatim (source: `vault/raw/2026-08-31-po-ev4-ruling.md`).

**Q1 — §4 corrections governance**

- **Ruling.** The corrected mapping is **binding for EV-4's implementation**. Three corrections land in §4: (1) `THINKING_TEXT_MESSAGE_*` → `REASONING_MESSAGE_*` per AG-UI's canonical current shape (S1); (2) `tool_execution_*` → `TOOL_CALL_*` is not implementable with correct semantics — use the generation lane (`message_update.assistantMessageEvent` `toolcall_start` / `toolcall_delta` / `toolcall_end`); `tool_execution_*` → `CUSTOM` `pi.tool.*` (S2); (3) `TOOL_CALL_RESULT.content` requires the mapper to flatten `(TextContent | ImageContent)[]` blocks to a string (S8). The §4 column structure stands; row entries are updated to match the actual AG-UI protocol and pi SDK surface.
- **Governance — who amends §4, when, how.** The facilitator amends §4 in one coherent edit alongside EV-4's implementation, in the same PR that carries `src/translate.ts`, citing S1/S2/S8 evidence in the row notes. The owner does not write the spec; the facilitator splices the corrected rows at step 7's spec-write moment. EV-1 Q3 already settled the meta-question: spec corrections forced by an authoritative upstream and preserving the security model are prose-sync within the implementing card's mandate. AGENTS.md's "spec is source of truth; keep it in sync with any change that affects the wire format" is dispositive in favor of amendment. §4 was protected in EV-1 as a deferral to EV-4's own work, not a prohibition. The §4 amendment is not a silent rewrite — it rides with test evidence cited in the row notes. Open objections O1/O2/O3 settle by green tests of the corrected implementation at step 9.

**Q2 — Replay RUN framing**

- **Ruling.** **One `RUN_STARTED` / `RUN_FINISHED` pair per past run.** Replay mirrors what the live session emitted. Per-run boundaries are meaningful to a remote observer, and per-run deterministic `runId`s preserve live/replay dedupe. `translate.ts` never mints `runId`s — it consumes them from input. EV-5 mints a deterministic `runId` per past run from the JSONL entry sequence and threads it through `TranslateContext` for the duration of that past run's frames. EV-4 publishes the contract that `runId` is input-driven; EV-5 publishes the rule that "past-run boundary" is a user entry through the last assistant or toolResult message before the next user entry (the same user-message-bounded rule the consolidated design uses for turn derivation).

**Closing note for the runner** — EV-4 may proceed to step 7 (design spec write, with §4 amendment spliced in citing S1/S2/S8 evidence in the row notes) → step 8 owner implementation against the corrected rows → step 9 Skeptic verify on the corrected implementation (closing O1/O2/O3 by green tests) → step 10 judge on the corrected implementation → step 11/12 merge gated by the deterministic five-criteria check. The follow-up `agent_end`-without-`agent_settled` stays open at the principal seat for EV-8's contract; EV-4 does not add a `RUN_ERROR` row.

### Step 7/8 — design spec, owner implementation, In Review

- **Step 7.** Design spec written to `docs/superpowers/specs/2026-08-31-EV-4-design.md` (committed 459c9f3). It publishes the settled design (§1–§2), the fixture/test contract (§3), the §4 amendment replacement blocks (§4, authored by the facilitator per ruling Q1), and the gate table (§5, G-1..G-14). Card set `In Progress` (459c9f3).
- **Step 8.** Owner (job-11.1) implemented in isolated worktree `.worktrees/ev-4-translate` on branch `ev-4-translate`, opened **PR #2** (head SHA `35c7ed0`, base main). Diff: `src/translate.ts` (new), `test/translate.test.ts` (new, 22 tests), §4 amendment in `docs/PI-SPEC.md`, plus the implementation plan doc. Card set `In Review` on the observed PR-open artifact.
- **Owner gate evidence:** G-1 tsc exit 0; G-2 bun test exit 0 (22 pass); G-3/G-5/G-6/G-7/G-8/G-9 green; G-10 hunks confined to §4; G-11/G-12 purity greps exit 1 (zero); G-13/G-14 fixture green. **Finding:** G-4 (as written at step 7) required zero `THINKING_TEXT_MESSAGE` doc-wide, which is unsatisfiable against the mandatory verbatim §4.1 block that cites `THINKING_TEXT_MESSAGE_*` deprecated. The owner correctly refused to reword the binding §4.1 block and surfaced it. The §4 diff (verified) maps thinking → `REASONING_MESSAGE_*` and does not emit the deprecated family; the only hit is the citation.
- **Facilitator correction (transparent, not a threshold reduction):** the ruled property — the deprecated family is not a mapping target — is a substantive requirement preserved by G-3 (`REASONING_MESSAGE_*` present in §4) + the O1 fixture (asserts no THINKING frame is emitted). The step-7 G-4 wording was internally contradictory with the mandatory §4.1 text; I re-scoped G-4 in the spec to assert exactly one occurrence (the citation) and recorded why. No ruled design decision changed. The Skeptic at step 9 verifies against the corrected gate.

### Step 9 — Skeptic verification (job-11.2, PASS, verify-cycle 1/3)

The Skeptic verified the PR branch at head SHA `35c7ed0` (not main). **No open objections — PASS.** All gates green: G-1 tsc exit 0, G-2 bun test exit 0 (22 pass, 76 expect()), G-3/G-5/G-6/G-7/G-8/G-9 green, G-4 exactly-1-hit green, G-10 hunks confined to §4, G-11/G-12 purity greps exit 1, G-13/G-14 fixtures green. Every gate proven capable of failure by injection tests. All three open objections closed-green on the corrected implementation: **O1** (REASONING_MESSAGE_*, 3 reasoning frames / 0 thinking-text), **O2** (toolcall generation-lane → TOOL_CALL_* with parentMessageId; tool_execution_* → CUSTOM pi.tool.* only, 0 TOOL_CALL_* from exec lane), **O3** (TOOL_CALL_RESULT.content flat string). CUSTOM shape, stepName="turn", threadId=sessionId, runId input-driven, replay determinism, and module purity all independently probed closed-green. Files touched match the design spec blast radius. Verify-cycle counter: 1 of ≤3.

### Step 10 — judge verdict (job-11.3, PASS)

The judge evaluated PR #2 on the branch at head SHA `35c7ed0` (per the EV-1 step-10 general rule — the branch, not main), furnished only the card's `goal` and the Skeptic's step-9 evidence. **PASS.** Basis: all 17 PiEvent variants + 6 JsonlEntry kinds → AG-UI frames; rulings O1/O2/O3 satisfied (REASONING_MESSAGE_*, generation-lane toolcall_* ↔ TOOL_CALL_* with parentMessageId, execution-lane → CUSTOM pi.tool.*, content flattened to string); purity constraints verified (module side-effect-free, no entropy, deterministic replay); CUSTOM shape consistent across 12+ frames; all commands independently rerun at `35c7ed0` (tsc 0, bun test 22/22, 76 expect()).
