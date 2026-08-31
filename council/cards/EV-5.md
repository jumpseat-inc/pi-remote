---
id: EV-5
title: "JSONL history replay and resync"
state: In Progress
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
- Replay frames carry `replay: true` and deterministic ids; delivering the
  same replay batch twice yields identical ids, so client-side dedupe by
  event id is sufficient (tested by running the replay twice and comparing).
- A `resync` request after a disconnect produces the replay batch followed by
  `pi.resync.done` (CUSTOM) whose `value.uptoSeq` equals the highest replayed seq.
- Replay initialization emits MESSAGES_SNAPSHOT carrying the active-branch
  message list; each compaction point emits CUSTOM `pi.context.compaction` only.

> **Acceptance amendment (EV-5 ruling A, binding, facilitator-authored).** The
> former fourth bullet read "Compaction entries surface as MESSAGES_SNAPSHOT
> plus CUSTOM `pi.context.compaction`". Product-owner ruled (Side B, Skeptic's
> corrective, governing O1 closed-red): MESSAGES_SNAPSHOT is a destructive
> all-or-nothing state-reset (AG-UI, O9 closed-green) and pi compaction carries
> a single summary string (O10 closed-green), so it is emitted **only at
> replay init**, carrying the active branch, and the compaction point emits
> **CUSTOM `pi.context.compaction` only** — never MESSAGES_SNAPSHOT in-stream.
> The resync terminator bullet is likewise corrected (ruling B1): the §5.3
> literal `{type:"resync_done", uptoSeq}` is `CUSTOM {type:"CUSTOM",
> name:"pi.resync.done", value:{uptoSeq}}` (O8 closed-green — no RESYNC_DONE in
> the AG-UI enum). Both ride EV-5's PR per the EV-1 Q3 + EV-4 Q1 precedent.

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

### Step 5 — Consolidator synthesis (job-18.11, verbatim)

Note: the vault wiki is empty; the consolidator worked from docs/PI-SPEC.md directly.

SETTLED: deterministic frame id = fnv1a(entryId+"\0"+contentHash+"\0"+frameOrdinal), frame-granularity; runId = run-<fnv1a(sessionId+"\0"+firstUserEntryId)> with fresh createState per past run and one RUN_STARTED/RUN_FINISHED pair per past run; past-run boundary = user entry through last assistant/toolResult before next user entry (EV-5 publishes it); replay:true frame-level optional field via widening AgUiFrameLike with replay?:boolean, envelope stays exactly {v,seq,ack,frame} (O2 green); STEP_* frames OMITTED in replay (O7 green); resync_done = CUSTOM {type:"CUSTOM",name:"pi.resync.done",value:{uptoSeq}} (O8 green — no RESYNC_DONE in AG-UI enum); EV-5 touches translate.ts additively for per-entry kinds §5.2 names (tool_result, custom/custom_message, bashExecution); translateJsonl is entry-level, emits no RUN_* itself (O5 green); JsonlEntry union gaps acknowledged (O4 green); AG-UI facts grounded (no RESYNC_DONE; MESSAGES_SNAPSHOT destructive all-or-nothing reset O9; pi compaction carries a single summary string O10).

OPEN JUDGMENT (for product-owner, escalating to steward):
1. MESSAGES_SNAPSHOT presentation — binding acceptance vs grounded semantics. Side A (literal acceptance): card acceptance line 4 ("compaction surfaces as MESSAGES_SNAPSHOT + CUSTOM") and §5.2 step 3 are binding; a compaction entry must surface as MESSAGES_SNAPSHOT + CUSTOM in-stream. Side B (Skeptic corrective, grounded): O1 closed-red both proposed forms; MESSAGES_SNAPSHOT is a destructive all-or-nothing state-reset and pi compaction is a single summary string, so neither in-stream form is semantically valid; emit MESSAGES_SNAPSHOT only as init and keep compaction CUSTOM-only in-stream. Not reconcilable by test — a ruling must choose whether acceptance 4 / §5.2 step 3 stays literal (and a valid snapshot payload is defined for a summary-only compaction) or is amended to init-only + CUSTOM-in-stream.
2. SPEC-AMENDMENT governance — (a) whether the §5.3 resync_done {type:"resync_done",uptoSeq} correction to CUSTOM rides EV-5's PR under the EV-4 Q1 precedent, or needs its own spec card first; (b) whether §2's "AG-UI and nothing else" lock admits a discriminated inbound resume/resync control union (Skeptic O6 cast-hole fix target) or must be amended. Steward ruling.

OPEN OBJECTIONS (settling test not passed; closeable by implementation+test on EV-5's PR, no human ruling): O3/U3 replay?:boolean widening (test: replay frame round-trips with replay:true, envelope still 4 keys); O6/U2 parseInbound cast-hole (test: parseInbound rejects/branches non-event inbound control frames, tied to open judgment 2b); U1 MESSAGES_SNAPSHOT final resolution (depends on open judgment 1); U4 runId derivation when a past run's first kept entry is not a user message (must not crash, stay stable).

Verbatim consolidator verdict: "No." Two rulings must precede finalization and hand-off to the owner: open judgment 1 (MESSAGES_SNAPSHOT presentation) and open judgment 2 (SPEC-AMENDMENT governance). Once ruled, the four open objections close by implementation + passing Skeptic run.

### Step 6 — routing

Both open-judgment items route to ruling seats per council.md step 6 (product-owner, escalating to steward for the governance/spec items). No Phase 1 ruling on this epic covers either question (orchestrator confirmed: all judgment delegated to council, none on record). Per the escalation contract the facilitator does not dispatch ruling seats; returning ESCALATION to the orchestrator for the rulings, then resuming this card on the rulings.

### Step 4 — Skeptic attack and tests (job-18.10, BLOCKS)

The Skeptic grounded AG-UI and pi sources via context7/web and ran tests against current translate.ts/transport.ts (49 suite green).

Grounding (citations): AG-UI EventType enum has TEXT_MESSAGE_/TOOL_CALL_/STATE_SNAPSHOT+DELTA/MESSAGES_SNAPSHOT/ACTIVITY_/RAW/CUSTOM/RUN_/STEP_/REASONING_/THINKING_* families — **NO RESYNC_DONE**. MESSAGES_SNAPSHOT schema = `MessagesSnapshotEventSchema = BaseEventSchema.extend({type: z.literal(EventType.MESSAGES_SNAPSHOT), messages: z.array(MessageSchema)})`; core `MessageSchema.content?: string` (optional plain string); semantics: destructive state-reset — "Replaces the conversation history with a new list of messages", "all-or-nothing update", Dart `messages.clear(); addAll()`. Pi JSONL compaction entry: `appendCompaction(summary, firstKeptEntryId, tokensBefore, ...)` carries a **single summary string**; `buildContextEntries()` returns `[compaction_entry, ...entries_after_firstKeptEntryId, ...entries_after_compaction]`.

Objections & results (as run):
- **O1 closed-red** — both MESSAGES_SNAPSHOT proposals fail. Current `translateJsonl` compaction emits only CUSTOM (`[{type:"CUSTOM",name:"pi.context.compaction"}]`), no MESSAGES_SNAPSHOT. Neither owner+principal's single-pane-in-translate nor designer's multi-message-in-history is semantically valid: AG-UI MESSAGES_SNAPSHOT is destructive reset (would clobber already-streamed panes mid-replay), and pi's compaction carries only a summary string (a fabricated message list invents content not in the JSONL). Skeptic's corrective: emit MESSAGES_SNAPSHOT as initialization (before replay starts / for new-client reconstruction), and keep the compaction path CUSTOM-only in the replay stream; or MESSAGES_SNAPSHOT for first-connect + CUSTOM during walk.
- **O2 closed-green** — envelope stays exactly {v,seq,ack,frame} (4 keys).
- **O3 closed-red** — `AgUiFrameLike` currently `AgUiFrame & { id?: string }`; must gain `replay?: boolean` for EV-5.
- **O4 closed-green** — JsonlEntry union lacks tool_result/custom_message/bashExecution kinds (acknowledged, to be added).
- **O5 closed-green** — translateJsonl is entry-level, emits no RUN_* per entry; history.ts owns RUN framing.
- **O6 closed-red** — parseInbound validates only `typeof frame.type === "string"`; inbound resume/resync control frames pass silently as AgUiFrame (no structural/EventType check) — must be hardened before the resync handshake works safely.
- **O7 closed-green** — STEP frames correctly absent from the JSONL path.
- **O8 closed-green** — no RESYNC_DONE in AG-UI enum → CUSTOM pi.resync.done confirmed.
- **O9 closed-green** — MESSAGES_SNAPSHOT is destructive all-or-nothing state-reset.
- **O10 closed-green** — pi compaction entry carries a single summary string, not a message list.

Open (open-untested until implementation): U1 MESSAGES_SNAPSHOT final resolution (emit as initialization before replay, not interleaved); U2 parseInbound cast-hole fix (discriminated inbound control union); U3 replay?:boolean widening; U4 runId derivation when a past run's first kept entry is not a user message (must not crash; fallback needed).

**Verdict: BLOCKS.** Three closed-red corrections (O1 MESSAGES_SNAPSHOT presentation, O3 replay-field widening, O6 parseInbound hardening) + U4 (runId edge) must be resolved before the design is ready for synthesis. The MESSAGES_SNAPSHOT presentation — how a compaction should surface to a remote client, given AG-UI's destructive-reset semantics and pi's summary-only data, and given the card's binding acceptance "compaction surfaces as MESSAGES_SNAPSHOT + CUSTOM" and §5.2's literal "compaction → MESSAGES_SNAPSHOT + CUSTOM" — is an open design judgment for step 6 routing.

## Step 6 continuation — product-owner ruling (binding, appended verbatim)

The orchestrator dispatched `product-owner` (judgment row, with routing
authority checked); it ruled on both open-judgment items, no steward
deferral needed. The ruling is binding and applied without re-asking. Full
ruling document: `vault/raw/2026-08-31-po-ev5-ruling.md`. Binding text as
delivered:

> **Ruling A — Side B.** `history.ts` emits exactly one `MESSAGES_SNAPSHOT` at
> replay init carrying the active-branch message list as `messages:
> MessageSchema[]` (destructive state-reset, AG-UI-native); each compaction
> point in the walk emits `CUSTOM pi.context.compaction` only, with no
> `MESSAGES_SNAPSHOT` in-stream. The card's acceptance line and §5.2 step 3
> are amended (one paragraph + one line, facilitator-authored, evidence-cited)
> to match the corrected emission. Grounds: MESSAGES_SNAPSHOT is a destructive
> state-reset (AG-UI Dart messages.clear(); addAll()) — an in-stream mid-replay
> emission would clobber already-streamed panes; pi's compaction entry carries
> one summary string (no messages list) — a snapshot at a compaction point
> cannot be built without fabricating content not in the JSONL.
>
> **Ruling B1.** §5.3's literal `{type:"resync_done", uptoSeq}` is corrected to
> `CUSTOM {type:"CUSTOM", name:"pi.resync.done", value:{uptoSeq}}`; the
> correction rides EV-5's PR per EV-1 Q3 + EV-4 Q1 precedent — no separate spec
> card, no steward.
>
> **Ruling B2.** §2's literal lock is outbound-only (the text says "every byte
> leaving the extension") and does not reach inbound; the inbound resume/resync
> shapes already live in §5.3's handshake contract; `transport.ts` hardens
> `parseInbound` to a discriminated union on the `frame` slot (`AgUiFrame |
> {type:"resume",deviceId,lastAckedSeq} | {type:"resync",fromSeq} | null`),
> the envelope stays exactly 4 keys, control frames are handled by transport
> (resume updates the inbound watermark, never reaches `onInbound`; resync
> triggers an injected `onResync(fromSeq)` callback wired by EV-8), and §5.3
> gets one clarifying sentence (facilitator-authored, O6 evidence-cited). §2 is
> not amended. No portfolio change; no steward. The hardening is additive:
> existing AG-UI shapes validate identically, and `protocol_violation` (the
> existing EV-3 reason taxonomy value) covers rejected inbound shapes —
> rejection is narrower than today's silent pass, so the security model is
> preserved.
>
> **General rule for EV-6 / EV-7 / EV-8 / FLLWUP-2:** The EV-1 Q3 + EV-4 Q1 +
> EV-5 precedent binds uniformly — a spec correction forced by authoritative
> upstream evidence, preserving the security model, belonging to the contract
> surface the implementing card owns, rides the implementing card's PR as
> facilitator-authored evidence-cited prose-sync; no separate spec card, no
> steward escalation. Specific emissions carry forward: MESSAGES_SNAPSHOT only
> at init (active-branch message list); CUSTOM `pi.context.compaction` only at
> compaction points in-stream; `pi.resync.done` is the resync terminator;
> `parseInbound` validates a discriminated union on the `frame` slot; envelope
> stays exactly `{v, seq, ack, frame}` (4 keys); resume updates the inbound
> watermark without surfacing to `onInbound`; resync triggers an injected
> `onResync(fromSeq)` callback wired by EV-8. Amendments that change the
> security model (new server contract surface, loosened tenancy, expanded
> threat model) are portfolio changes and route to steward — they do not ride
> the implementing card's PR. None of EV-6/EV-7/EV-8/FLLWUP-2 re-litigate A,
> B1, or B2.
