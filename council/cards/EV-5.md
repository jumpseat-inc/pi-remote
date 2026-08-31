---
id: EV-5
title: "JSONL history replay and resync"
state: Deliberating
owner: null
epic: EPIC-1
goal: history.ts replays the active JSONL branch through translate.ts on connect and on resync, framing the batch with replay true and deterministic event ids derived from entry id plus content hash, then answers with resync_done up to the highest replayed seq.
---

## Intent

Implements §5 in `src/history.ts`. Replay walks the active branch with
`buildContextEntries()` semantics (compaction, branch_summary honored) via
`ctx.sessionManager`, falling back to direct JSONL reading for large tails.
User-visible surface — a remote client that connects mid-session, or reconnects
after the relay's cache is gone, sees the session's meaningful history (not
raw file noise) exactly once, even if the replay batch is delivered twice.
This is also what keeps the server dumb (§2) — resync is answered from the
host's JSONL, never from server state.

## Acceptance

- Replaying a session containing compaction and branch summaries emits the
  active branch only — no orphaned or pre-compaction entries — and matches
  what a local reader would consider the session's meaning.

## Deliberation record

### Step 1 — path classification

- Full council (not mechanical): design-judgment + cross-seam — a new `src/history.ts` that reads the active JSONL branch (via `ctx.sessionManager`/`buildContextEntries()` semantics, falling back to direct read for large tails), walks it through the pure `translate.ts` mapper, and feeds the transport envelope. Live design questions: the `resync_done` wire shape, deterministic `runId` derivation + the past-run boundary rule EV-4's Q2 ruling assigns EV-5 to publish, the deterministic event-id derivation (entry id + content hash), where `MESSAGES_SNAPSHOT` (EV-4's acceptance demands it; EV-4's mapper only emits `CUSTOM pi.context.compaction`) actually gets produced, and the replay-twice-dedupe acceptance test.
- Surface-touching: yes — the replay batch is what a remote client sees on connect/resent (session meaning, dedupe, per-run boundaries). Same surface as EV-4; `designer` is seated as a third generator in steps 2–3.
- Cross-seam: reads JSONL/sessionManager, calls the pure mapper unchanged, feeds the EV-3 transport envelope; consumed on connect and on resync.
- Binding context carried in (not open for relitigation): runId is input-driven (one RUN_STARTED/RUN_FINISHED pair per past run, EV-4 Q2); replay event ids are deterministic = JSONL entry id + content hash, never overwritten by transport UUID stamping (EV-3: injected `newId` stamping leaves a pre-existing `id` untouched); resyncing status reaches footer only via EV-8; transport failure is honest metadata, never `kind:"error"`.

### Step 2 — independent first pass (round 1)

**owner** (job-18.1, verbatim). src/history.ts exposes `replayActiveBranch(deps)→{frames, resyncDone:{uptoSeq}}`; reads branch via injected `ctx.sessionManager.getBranch()` from current leaf with direct-JSONL fallback, both normalized to translate's `JsonlEntry` surface, honoring compaction/`branch_summary` for active-branch-only. Drives translate.ts UNCHANGED; emits one RUN_STARTED/RUN_FINISHED per past run by synthesizing `agent_start`/`agent_settled` PiEvents through the LIVE mapping (one mapper, second trigger). MESSAGES_SNAPSHOT produced by history.ts (not translate.ts) — EV-4 §6 drew that boundary; history accumulates active-branch messages and synthesizes MESSAGES_SNAPSHOT at compaction, then calls translate(compaction) for CUSTOM pi.context.compaction. Deterministic id = `fnv1a(entryId + "\u0000" + contentHash + "\u0000" + ordinal)`. runId = `run-<fnv1a(sessionId + "\u0000" + firstUserEntryId)>`, fresh createState per past run. Past-run boundary = a message entry with role "user" through the next role:"user" entry (reads "last assistant/toolResult" as next-user-entry in JSONL, since translate's surface has no tool_result kind). resync_done = `{type:"resync_done", uptoSeq}` — NOT assignable to AgUiFrameLike, so requires widening the transport frame-slot type to `AgUiFrameLike | {type:"resync_done";uptoSeq}` (a minimal additive touch to EV-3's type) — flagged as a ruling question. replay:true rides on the frame structurally (no EV-3 behavior change). Tests: replay-twice identical ids + within-batch uniqueness; compaction → both frames; one RUN pair per run; resync_done uptoSeq; active-branch-only.

**principal** (job-18.2, verbatim). The contract as it stands: translate.ts's JsonlEntry surface is only `message|compaction|model_change|thinking_level_change|session_info` (no tool_result/custom/custom_message/bashExecution; message content only thought|text); compaction emits only CUSTOM — so acceptance "compaction → MESSAGES_SNAPSHOT + CUSTOM" cannot be met by history.ts translating through an unchanged translate.ts; EV-5's PR must touch translate.ts. transport envelope is exactly {v,seq,ack,frame} (settled exact-key test) → replay:true must be a FRAME field, not an envelope field; widen `AgUiFrameLike` (one-line, behavior-preserving) or tsc fails. Multi-frame entries need frame-granularity id (entryId+contentHash+frame ordinal) — "entry id + content hash" alone collides for multi-frame entries and dedupe would drop later frames. One RUN pair per past run requires history to SYNTHESIZE agent_start/agent_settled PiEvents at derived boundaries with a fresh deterministic runId via createState per run. resync_done/resync/resume have no home in settled types and §5.3 handshake names CONTRADICT §2 "AG-UI frame and nothing else" — EV-5 must publish the wire decision (replay:true frame-level; resync_done a frame type; inbound resync/resume runtime-discriminated string control frames) as a spec amendment EV-5 owns. Testable claims: frame-id uniqueness within batch; replay:true survives envelope unchanged; run-boundary deterministic (2 runs → 2 pairs, distinct runIds, RUN_FINISHED immediately before next RUN_STARTED); compaction differs live vs replay (live session_compact → CUSTOM only; replay compaction entry → MESSAGES_SNAPSHOT then CUSTOM); resync terminator honesty (uptoSeq === max replayed seq AND a send-returns-null mid-replay must NOT produce a lying resync_done).

**designer** (job-18.3, verbatim). A remote client should experience replay as the session's meaning, in order, one pass, past visibly framed as past: RUN_STARTED → body → RUN_FINISHED per past run, then RESYNC_DONE, then seamless live. Compaction as INLINE legible collapse: MESSAGES_SNAPSHOT carrying the summary as a readable assistant pane, THEN CUSTOM pi.context.compaction. MESSAGES_SNAPSHOT = a NEW frame type in translate.ts called from the translateJsonl compaction branch (so a stock AG-UI client renders it); CUSTOM carries pi-provenance. Deterministic-id recipe = FNV-1a prefixed "replay-". RESYNC_DONE as CUSTOM {name:"pi.resync.done", value:{uptoSeq}} (escape-hatch discipline keeps AG-UI vocabulary pure). Past-run degenerate single-run session = one RUN pair, no special-case. branch_summary: add a JsonlEntry kind → CUSTOM pi.session.branch_summary. Replay OMITS STEP frames entirely (live-only). Open rulings: MESSAGES_SNAPSHOT payload shape; id recipe; RESYNC_DONE placement; branch_summary.

### Step 3 — bounded exchange (rounds 2–3)

Round 2 (cross-disclosure) and round 3 (final, at the ≤3 cap) went to owner/principal/designer. Convergence across all three, stabilized:

- **Deterministic frame id = `fnv1a(entryId + "\u0000" + contentHash + "\u0000" + frameOrdinal)`** — frame-granularity (a single entry yields multiple frames; entry+contentHash alone would collide and the client would dedupe-drop later frames). All three converged; the ordinal is the frame ordinal within the entry's translation.
- **runId = `run-<fnv1a(sessionId + "\u0000" + firstUserEntryId)>`**, fresh `createState` per past run; one RUN_STARTED/RUN_FINISHED pair per past run; past-run boundary = user entry through the last assistant/toolResult before the next user entry (EV-4 Q2, EV-5 publishes it); degenerate single-run session = one pair, no special-case. All three.
- **replay:true is FRAME-level** (widen `AgUiFrameLike` with `replay?: boolean`); the envelope stays exactly {v,seq,ack,frame} (settled exact-key test not relitigated; a 5th envelope key breaks it). Owner/principal held frame-level; designer accepted frame-level in round 3, abandoning envelope-level. Settled.
- **STEP frames: OMIT in replay.** JSONL has no turn entries (EV-4 S9 closed-green); synthetic STEPs would invent turn counts and mislead resumption; RUN pairs already delimit exactly the same boundaries. Owner/designer held omit; principal withdrew "emit" in round 3. Settled (3v1 after principal withdrew).
- **resync_done: CUSTOM `{type:"CUSTOM", name:"pi.resync.done", value:{uptoSeq}}`** — all three converged, contingent on the Skeptic's step-4 grounding confirming AG-UI has NO native `RESYNC_DONE` event type (string-literal `{type:"resync_done"}` would be a second wire format violating §2/§4; owner/principal held CUSTOM; designer converged to CUSTOM in round 3 once grounding showed no RESYNC_DONE in AG-UI's EventType enum). If the grounding surprises, the item reopens. Also carried forward: transport.ts's `parseInbound` casts any string-typed frame to AgUiFrame (silently typing inbound resync/resume as AG-UI frames it is not) — candidate to become a closed inbound union owned by transport.ts (principal's lean), an EV-5-hand contract.
- **Per-entry JSONL surface gaps** (tool_result, custom/custom_message, bashExecution JsonlEntry kinds, tool-call blocks inside message): §5.2 names them for replay but translate.ts's JsonlEntry union does not model them — EV-5's PR touches translate.ts additively for these per-entry kinds (principal/designer/owner all agree EV-5's PR touches translate.ts). tool_result is handled inside message handling, not a standalone kind (owner). bash_execution → CUSTOM passthrough in EV-5 with full semantic mapping deferred to FLLWUP-3 (principal lean, accepted).

**Residual (not closed by deliberation — genuinely open, 2v1 the other way on the two sub-parts): MESSAGES_SNAPSHOT.**
- Location: owner (r3) + principal (r3) hold MESSAGES_SNAPSHOT is emitted in translate.ts's translateJsonl compaction branch (single summary pane from the compaction entry's own `summary`; per locked §5.2 "through translate.ts" + §3 one-mapping; no branch-level snapshot is required by the acceptance). Designer (r3) holds MESSAGES_SNAPSHOT is a BRANCH-LEVEL cross-entry synthesis emitted by history.ts (accumulating the compacted tail; a stock client reconstructs the full compacted history, not a summary).
- Payload: owner/principal hold single-pane `{role:"assistant", content: summary}` (data-integrity — pi's compaction carries one summary string; a fabricated multi-message list would invent content not in the JSONL); designer holds multi-message role-tagged `{messages:[{role, content:string}]}` (a stock AG-UI MessagesSnapshotEventSchema expects MessageSchema[]; renders real panes). Principal additionally flagged that AG-UI's MESSAGES_SNAPSHOT is a state-reset event, so a reconstruction mid-replay could duplicate/reset already-streamed panes.
- This is the consolidator-carry-forward item for step 5 → route to product-owner at step 6.


- Replay frames carry `replay: true` and deterministic ids; delivering the
  same replay batch twice yields identical ids, so client-side dedupe by
  event id is sufficient (tested by running the replay twice and comparing).
- A `resync` request after a disconnect produces the replay batch followed by
  `resync_done` whose `uptoSeq` equals the highest replayed seq.
- Compaction entries surface as MESSAGES_SNAPSHOT plus CUSTOM
  `pi.context.compaction`.
