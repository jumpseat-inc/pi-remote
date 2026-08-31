# EV-5 Open-Judgment Rulings — product-owner seat

Date: 2026-08-31
Card: EV-5 — JSONL history replay and resync
Epic: EPIC-1
State at ruling: Deliberating (full capped rounds + Skeptic + consolidation
complete; two open-judgment items routed to product-owner by the council-runner)

The wiki is empty (`vault/wiki/index.md` is a stub catalog with no module
pages). Authority is the spec itself (`docs/PI-SPEC.md`), `AGENTS.md`
(which names the spec as source of truth and binds it to reality), the
EV-5 deliberation record, and the prior ruling precedents on the
seven-state footer set (EV-1 Q2), the transport typed-event seam (EV-3
Sub-questions 1–4), the spec-correction governance mechanism (EV-1 Q3 +
EV-4 Q1), and the §4 correction pattern (EV-4 Q1). No recorded human
decision in `council/board.md` bears on the questions in this packet.

The operative pair is **mechanism** (does the wire hold; does the
emission shape satisfy AG-UI; does the inbound parse handle the contract
honestly) and **user value** (does a remote observer see the session's
meaning; can they trust a compaction point to mean what the spec
promises; can they trust a replay to be a state-reset and not a
fabrication). Both lenses converge on the same ruling for A and B2; B1
is settled by precedent.

The runner packet correctly frames A as "binding acceptance text vs
grounded semantics." But the framing slightly understates how clearly
the grounded semantics resolve it: a literal acceptance line that
demands a semantically invalid wire shape is defective on its face — the
acceptance must be read against the AG-UI semantic the frame has, not
against the literal name of the frame. AG-UI's MESSAGES_SNAPSHOT is a
destructive all-or-nothing state-reset carrying `messages:
MessageSchema[]`; pi's compaction entry carries a single summary
string. A snapshot cannot carry a summary as a state-reset, and the
compaction point cannot emit a snapshot as a *point event*. The literal
"compaction → MESSAGES_SNAPSHOT + CUSTOM" therefore cannot be met as
written — it can only be met by relocating MESSAGES_SNAPSHOT to a place
where its state-reset semantics are coherent (init, before the replay
walk) and letting the compaction point itself emit only CUSTOM. That is
the corrective the Skeptic named, and it is the ruling here.

---

## A — MESSAGES_SNAPSHOT presentation

### Ruling

**Side B (Skeptic corrective): MESSAGES_SNAPSHOT is emitted at
**initialization only** (before the replay walk begins, and on
new-client reconstruction), and the **compaction point itself emits
CUSTOM `pi.context.compaction` only** — no MESSAGES_SNAPSHOT in-stream
at compaction.**

Concretely:

1. **At init (start of every replay / new-client resync):** `history.ts`
   emits **exactly one** `MESSAGES_SNAPSHOT` carrying the **active
   branch's message list as it stood at the moment replay begins**. The
   payload is `{type:"MESSAGES_SNAPSHOT", messages: MessageSchema[]}`,
   where each `Message` is a `{role, content: string}` for the
   user/assistant text the active branch contains at init time. This is
   the AG-UI-native shape and is the destructive state-reset a stock
   client expects — a new client renders the active branch as a
   starting state.

2. **At each compaction point in the walk:** `history.ts` emits
   `{type:"CUSTOM", name:"pi.context.compaction", value:{pi:"session_compact",
   data:{summary, firstKeptEntryId, tokensBefore}}}` only — no
   MESSAGES_SNAPSHOT. The CUSTOM frame is the established escape-hatch
   discipline (§4 of the spec) and carries the pi provenance of the
   compaction entry without claiming to be a state-reset it is not.

3. **translate.ts's compaction branch emits CUSTOM only.** The
   translate-time compaction path (live and replay through
   `translateJsonl`) does not need to know about MESSAGES_SNAPSHOT at
   all. The mapper stays pure and entry-level (O5 closed-green). The
   init snapshot is a `history.ts` responsibility because it owns the
   active-branch accumulation; the in-stream CUSTOM is a
   `translate.ts` responsibility because it owns the per-entry
   translation.

4. **Spec amendment scope (rider).** The card acceptance line
   "Compaction entries surface as MESSAGES_SNAPSHOT plus CUSTOM
   `pi.context.compaction`" is amended to read: "**Replay
   initialization emits MESSAGES_SNAPSHOT carrying the active-branch
   message list; each compaction point emits CUSTOM
   `pi.context.compaction` only.**" The amendment is a one-paragraph
   update to the card's acceptance section and a corresponding one-line
   update to §5.2 step 3 of the spec ("compaction →
   `CUSTOM` `pi.context.compaction`; MESSAGES_SNAPSHOT is emitted at
   init, carrying the active branch"). Both ride EV-5's PR per the
   EV-1 Q3 + EV-4 Q1 precedent (facilitator-authored, evidence-cited,
   prose-sync within the implementing card's mandate; preserves the
   security model; forced by authoritative upstream — AG-UI's
   destructive-reset semantics, O9 closed-green; pi's single-summary
   compaction data, O10 closed-green).

5. **Test contract.**
   - **Init snapshot at start of replay**: one MESSAGES_SNAPSHOT,
     `messages` array contains the active-branch messages as they were
     at init (assistant text + user text), no compaction summaries
     inside `messages`.
   - **In-stream at compaction**: zero MESSAGES_SNAPSHOT frames; one
     CUSTOM `pi.context.compaction` per compaction entry; the
     `value.data` carries `{summary, firstKeptEntryId, tokensBefore}`.
   - **Replay-twice**: identical init-snapshot content on each run
     (deterministic from JSONL), identical in-stream CUSTOM per
     compaction.
   - **Active-branch-only**: the init snapshot's `messages` reflects
     only the active branch — no orphaned or pre-compaction entries.

### Reasoning

Three facts decide it.

(1) **AG-UI's MESSAGES_SNAPSHOT is a destructive all-or-nothing
state-reset** (Skeptic O9 closed-green, grounded in the AG-UI repo's
Dart implementation `messages.clear(); addAll();` and the schema
`messages: z.array(MessageSchema)`). This is not a "single event in
the stream" frame; it is a state-replacement frame. Treating it as an
in-stream event at a compaction point would clobber the panes the
replay has already streamed (the principal's round-3 flag) and would
silently lie to the client about what the compaction means. The frame
has a use, but the use is "set the conversation state for a client
joining now," not "mark a point in the stream."

(2) **pi's compaction entry carries a single summary string** (Skeptic
O10 closed-green, grounded in `appendCompaction(summary,
firstKeptEntryId, tokensBefore, ...)`). There is no `messages: []`
array to map; the JSONL does not preserve the compacted messages at
all. A MESSAGES_SNAPSHOT emitted *at* a compaction point would have to
either (a) carry the summary string as a fabricated message list
(inventing content not in the JSONL — the designer's payload was
exactly this fabrication), or (b) carry only the summary as a single
pane, which violates AG-UI's `messages: z.array(MessageSchema)` shape
and is not a state-reset. Neither is valid. The corrective — emit
MESSAGES_SNAPSHOT at init where there *is* a message list to reset to,
and let compaction points emit only CUSTOM where there is genuinely
just a summary to surface — fits both constraints.

(3) **The acceptance line's intent survives the amendment.** EV-5's
goal is "matches what a local reader would consider the session's
meaning." A local reader sees compaction as: "the conversation was
collapsed; here is the summary; new messages continue from the
compaction point." The init snapshot gives a remote client the same
view: "here is the conversation state when you joined; compactions
inside the walk are summarized CUSTOM events the client renders as
pi-provenance notes, not as additional panes." The literal acceptance
text was defective; the goal is met by the corrected emission.

The seat's mechanism check passes: AG-UI will validate
`MESSAGES_SNAPSHOT` at init (it carries the right shape, the right
semantics, and the right place in the stream); AG-UI will not see a
MESSAGES_SNAPSHOT at a compaction point (where it would have
invalidated); the CUSTOM `pi.context.compaction` will validate as
`{type:"CUSTOM", name:"pi.*", value:{pi,data}}` per §4's escape-hatch
discipline. The seat's user-value check passes: a remote observer
joining mid-session sees the active branch state, sees compactions as
pi-provenance notes inline with the walk, and dedupes by deterministic
id as designed. Reversibility: trivial — the corrected emission is
two changes (history.ts emits the init snapshot; translate.ts emits
CUSTOM only), both inside EV-5's PR blast radius. The acceptance
amendment is a paragraph; the §5.2 amendment is one line.

### Sources

- `docs/PI-SPEC.md` §4 (CUSTOM escape-hatch discipline —
  `{type:"CUSTOM", name:"pi.<category>", value:{pi, data}}` is the
  established shape for anything AG-UI cannot express)
- `docs/PI-SPEC.md` §5.2 (the replay algorithm; step 3 names
  compaction → MESSAGES_SNAPSHOT + CUSTOM as the literal text amended
  by this ruling)
- AG-UI protocol facts (Skeptic O9 closed-green): MESSAGES_SNAPSHOT
  schema = `MessagesSnapshotEventSchema = BaseEventSchema.extend({
  type: z.literal(EventType.MESSAGES_SNAPSHOT), messages:
  z.array(MessageSchema) })`; semantics = destructive state-reset
  ("Replaces the conversation history with a new list of messages",
  "all-or-nothing update", Dart `messages.clear(); addAll();`)
- pi JSONL facts (Skeptic O10 closed-green):
  `appendCompaction(summary, firstKeptEntryId, tokensBefore, ...)`
  carries a single summary string
- EV-5 step-5 consolidator SETTLED list: deterministic frame id,
  per-past-run RUN pair, replay:true frame-level, STEP_* omitted,
  resync_done = CUSTOM pi.resync.done (all converged by deliberation,
  none of them disturbed by this ruling)
- EV-1 Q3 ruling (spec-correction governance mechanism: corrections
  forced by authoritative upstream and preserving the security model
  are prose-sync within the implementing card's mandate)
- EV-4 Q1 ruling (the same precedent applied to a locked §4
  correction; the §4 row-replacement blocks the facilitator writes in
  EV-4's PR are the model for how the §5.2 step-3 amendment is
  written here)

### Options rejected

- **Side A (literal acceptance):** demands a semantically invalid
  wire shape. A MESSAGES_SNAPSHOT at a compaction point cannot be a
  state-reset (it would clobber already-streamed panes) and cannot
  carry a single summary string as `messages: z.array(MessageSchema)`.
  The acceptance line was defective; reading it literally would
  require either AG-UI to relax its schema or pi to start storing
  compacted messages in the JSONL. Neither is in scope; both are
  portfolio changes.
- **Designer's branch-level multi-message reconstruction:**
  fabricates content not in the JSONL. The compacted messages are
  *not* in the JSONL by design (compaction discards them in favor of
  the summary). Reconstructing them on the client from non-existent
  data is a wire-format lie; a remote client that rendered the
  reconstruction would render content the user never saw. The user-
  value test fails decisively. The AG-UI schema test also fails: a
  snapshot is a state-reset, not a reconstruction.
- **Owner's single-pane `{role:"assistant", content: summary}`
  inside MESSAGES_SNAPSHOT:** schema violation (`messages:
  z.array(MessageSchema)`) and semantic violation (a snapshot is a
  state-reset, not a single pane). The schema validator would reject
  it; the client would either ignore it or display it in the wrong
  pane.

### Reversibility

Trivial. The init snapshot emission is a single function in
`history.ts` (called once at the start of every replay, before the
walk). The CUSTOM-only in-stream compaction is one branch of
`translateJsonl`. The acceptance amendment is one paragraph in
`council/cards/EV-5.md`; the §5.2 amendment is one line in
`docs/PI-SPEC.md`. No downstream card (EV-6, EV-7, EV-8) depends on
MESSAGES_SNAPSHOT semantics at a compaction point; they inherit the
corrected emission as the only behavior they ever saw.

---

## B1 — §5.3 resync_done wire-shape correction (literal `{type:"resync_done"}` → CUSTOM `pi.resync.done`)

### Ruling

**The §5.3 literal `{type:"resync_done", uptoSeq}` is corrected to
`{type:"CUSTOM", name:"pi.resync.done", value:{uptoSeq}}`. The
correction rides EV-5's PR per the EV-1 Q3 + EV-4 Q1 precedent — no
separate spec card, no steward escalation, no portfolio change.**

### Reasoning

This is exactly the EV-4 Q1 pattern, applied to §5.3 instead of §4.

(1) **The Skeptic closed-green O8:** AG-UI's `EventType` enum has no
`RESYNC_DONE` (the families in the enum are TEXT_MESSAGE_/TOOL_CALL_/
STATE_SNAPSHOT+DELTA/MESSAGES_SNAPSHOT/ACTIVITY_/RAW/CUSTOM/RUN_/STEP_/
REASONING_/THINKING_*). A literal `{type:"resync_done", uptoSeq}` would
not validate against AG-UI's schema; it would be a second wire format
silently violating §2/§4's "AG-UI and nothing else" / "pi concepts
escape as CUSTOM" discipline.

(2) **§4 already pins the escape hatch:** `CUSTOM {type:"CUSTOM",
name:"pi.<category>", value: { pi: <event-name>, data: … }}` with
`name` as the sole dispatch key and `pi` inside `value` as
provenance. The corrected `pi.resync.done` shape
(`{type:"CUSTOM", name:"pi.resync.done", value:{uptoSeq}}`) is a
direct application of that discipline — no new convention, no new
vocabulary class, no new wire surface.

(3) **§2's lock is preserved.** The server still receives only AG-UI
frames; the relay still has no notion of `pi.resync.done` as anything
other than a `CUSTOM` event; the resumability semantics ride inside
the `value` payload, opaque to the server. The blast radius is
unchanged: the server remains a dumb relay; the host remains the only
pi-aware code.

(4) **§5.3 amendment is one line.** The current §5.3 reads:
"`ext → client : replay batch (§5.2), then { type: \"resync_done\",
uptoSeq }`". The amended line reads: "`ext → client : replay batch
(§5.2), then { type: \"CUSTOM\", name: \"pi.resync.done\", value:
{ uptoSeq } }`". That is the full spec delta. The §5.3 prose around
it ("The extension treats `resync` requests as replay triggers and
answers from the JSONL — it never assumes the server has anything.")
stands unchanged.

(5) **EV-4 Q1's test is met exactly.** The correction (a) is forced
by an authoritative upstream (AG-UI protocol fact — O8 closed-green);
(b) preserves the security model (server stays dumb; tenancy carried
by credentials per §7.5; no new contract surface); (c) belongs to the
card whose contract surface it implements (EV-5 is the card that
implements §5.3, end-to-end). The facilitator authors the one-line
amendment with the O8 evidence cited in the §5.3 row note, in the
same PR that carries `src/history.ts`. No separate spec card. No
steward.

### Sources

- `docs/PI-SPEC.md` §5.3 (the literal text being corrected)
- `docs/PI-SPEC.md` §4 (CUSTOM escape-hatch discipline, the
  corrected shape's home)
- Skeptic O8 closed-green: AG-UI `EventType` enum contains NO
  `RESYNC_DONE`
- EV-5 deliberation convergence: all three seats (owner + principal +
  designer) converged on CUSTOM `pi.resync.done` once the AG-UI enum
  was grounded; the only ambiguity was the literal §5.3 text vs the
  converged design
- EV-1 Q3 ruling + EV-4 Q1 ruling: spec corrections forced by
  authoritative upstream and preserving the security model ride the
  implementing card's PR; facilitator authors the prose-sync with
  evidence cited in row notes

### Options rejected

- **File a separate spec card before EV-5 can implement:** delays
  every downstream card (EV-6, EV-7, EV-8) on a one-line amendment
  whose only consumer is EV-5's implementation. EV-4 Q1 rejected this
  shape for the same reason; the precedent binds here.
- **Mint a new wire surface for resync_done (a fifth envelope key
  or a parallel control channel):** relaxes §2's lock for no reason.
  AG-UI's CUSTOM escape hatch already covers the case cleanly; a new
  surface is cost without benefit.

### Reversibility

Trivial. The amendment is one line in §5.3; if a future card decides
AG-UI has added a `RESYNC_DONE` family, the line reverts and the
literal `{type:"resync_done", uptoSeq}` takes its place. The
implementation is one branch in `translateJsonl`'s terminator
emission. No seam with downstream cards changes; no wire contract
beyond the one literal changes.

---

## B2 — Inbound resume/resync control union: does §2 admit it, or require amendment?

### Ruling

**§2's literal lock is outbound-only and does not reach inbound
control frames. The inbound `{type:"resume", deviceId, lastAckedSeq}`
and `{type:"resync", fromSeq}` shapes are already part of §5.3's
handshake contract (the server relays them verbatim per §5.3 and
§7.3). Transport.ts hardens `parseInbound` to recognize the inbound
control union; the hardening rides EV-5's PR. §2 is not amended;
§5.3 gets one facilitator-authored clarifying sentence. No steward
escalation; no portfolio change.**

### Reasoning

§2's literal text (docs/PI-SPEC.md §2, lines 39–44):

> "**All AG-UI translation happens in this extension.** Two consequences:
> 1. **The server only accepts standardized messages.** Every byte
> leaving the extension over the tunnel is a well-formed AG-UI frame
> (inside the framing envelope of §6). The server never learns what a
> `pi` session file, a `BashExecutionMessage`, or a compaction entry
> is. It relays, caches, and forwards opaque standardized frames."

Three observations settle the directional question:

(1) **The lock is about bytes *leaving* the extension.** The phrase
"every byte leaving the extension over the tunnel" names the
direction explicitly. §2 does not say "every byte reaching the
extension" or "the extension only accepts AG-UI frames" — the inbound
direction is outside §2's literal reach.

(2) **§5.3 is the inbound contract, not §2.** §5.3 literally names the
inbound shapes: `client → server : { type: "resume", deviceId,
lastAckedSeq }` and `server → ext : { type: "resync", fromSeq } ←
relayed as-is`. The server's relay role for these frames is already
settled (the server does not translate them; it forwards them
opaquely, exactly as §5.3 says). The §5.3 contract is the
extension-side complement of the server's relay behavior, and §5.3 is
EV-5's lane.

(3) **§2's spirit — "server stays dumb and swappable" — is preserved.**
The inbound union is *received* by the extension and *acted on* by
the extension (resume: log + ack; resync: trigger
`history.replayActiveBranch({fromSeq})`). The extension does not
*emit* any inbound-control-frame shape back to the server. The
extension's only outbound response to a resync is the replay batch
(AG-UI frames in the §6 envelope) followed by the `resync_done`
terminator (which is itself a CUSTOM `pi.resync.done` AG-UI frame per
B1). The server's role does not grow: it relays the inbound control
frame as-is and forwards the outbound AG-UI batch as-is.

So **§2 does not require amendment** for the inbound union. §2's
literal lock is intact; §5.3 is the inbound contract; EV-5's
implementing PR completes the §5.3 contract by hardening
`parseInbound`.

**The parseInbound hardening shape.** The current `parseInbound` (EV-3,
src/transport.ts:159) validates `{v, seq, ack, frame: AgUiFrame |
null}` and accepts any `frame.type` that is a string. The Skeptic's
O6 closed-red is correct: today, an inbound `{v:1, seq, ack, frame:
{type:"resume", deviceId:"…", lastAckedSeq:N}}` would silently pass
through as a "valid AgUiFrame" with `type === "resume"` and would be
dispatched via `onInbound` as if it were an AG-UI event. The
hardening:

1. **The envelope stays exactly `{v, seq, ack, frame}`** (4 keys —
   the EV-3 O2 closed-green exact-key test is preserved). The
   discriminated union widens **the `frame` slot**, not the envelope.

2. **`frame` widens to a discriminated union:**

   ```ts
   type InboundFrame =
     | AgUiFrame
     | { type: "resume"; deviceId: string; lastAckedSeq: number }
     | { type: "resync"; fromSeq: number }
     | null; // heartbeat / ack-only
   ```

   This is the O6 fix target. `parseInbound` runtime-validates the
   union: `AgUiFrame` shapes are accepted as today (existing O2 / O8
   tests remain green); resume / resync shapes are validated against
   their structural fields (`deviceId` is a string, `lastAckedSeq` is
   a finite number, etc.); `null` remains the heartbeat / ack-only
   shape. Anything that does not match one of these four shapes is
   rejected as `protocol_violation` (the existing closed-taxonomy
   `reason` value handles the rejection cleanly — EV-3 Sub-question
   3 ruling).

3. **The control frames never reach `onInbound`.** They are handled
   directly by transport.ts:
   - `resume`: logged (debug-level structured log; never surfaces to
     the footer per EV-3 Sub-question 4 — terminality is EV-8's
     call); the extension honors `lastAckedSeq` by updating its
     inbound watermark (the existing `inboundSeq` field; principal
     convergence #5 in EV-3).
   - `resync`: triggers an injected `onResync(fromSeq)` callback.
     The callback is supplied by EV-8's wiring (the same way `rearm`
     is supplied today — `transport.ts` is a protocol state machine
     with injected seams; this is one more seam of the same shape).
     EV-8 sequences `onResync(fromSeq)` → `history.resyncActiveBranch(
     {fromSeq})` → AG-UI replay batch + `pi.resync.done` per B1.

4. **No new attack surface.** The server is already trusted to relay
   these frames per §5.3; §7.3's grant enforcement happens at the
   server before the relay. A hostile server scenario is the wrong
   threat model — §7.4 lists the server's blast radius, and a
   hostile server is already inside it. The discriminated union
   admits the *shapes §5.3 already names*; it does not admit new
   shapes. The `protocol_violation` rejection of unknown shapes is a
   *narrower* surface than today's "any string-typed frame passes."

5. **§5.3 clarifying sentence (facilitator-authored).** The current
   §5.3 prose says only "server → ext : served from ring buffer if
   possible, else { type: \"resync\", fromSeq } ← relayed as-is". One
   sentence is added at the end of §5.3: "**Inbound resume and resync
   control frames are runtime-validated by `transport.ts`'s
   `parseInbound` against a discriminated union (resume, resync,
   AG-UI event, ack-only); control frames do not surface to the
   `onInbound` AG-UI consumer. The relay server's role is unchanged:
   it relays these frames opaquely per §5.3 and §7.3.**" That
   sentence completes the §5.3 contract on the extension side; it is
   the only spec delta. It rides EV-5's PR with the O6 evidence
   cited in the §5.3 row note, per the EV-1 Q3 + EV-4 Q1 precedent.

6. **Security model preserved.**
   - Server still dumb: §2's lock intact, no new contract surface.
   - Tenancy by credentials: §7.5 unchanged.
   - Device grants: §7.3 unchanged — the server enforces; the
     extension's only device-awareness remains the inbound
     `deviceId` field, which `parseInbound` already accepts as a
     top-level envelope field (InboundEnvelope.deviceId exists
     today).
   - Host holds only OAuth2 enrollment credential: §7.2 unchanged.
   - Tunnel token single-use: §7.2 unchanged.
   - Re-arm on reconnect: §6 unchanged — the `resync` callback is a
     separate seam from `rearm` and does not interact with the
     tunnel lifecycle.

### Sources

- `docs/PI-SPEC.md` §2 (the locked translation-boundary decision;
  exact text quoted above; outbound-only by literal reading)
- `docs/PI-SPEC.md` §5.3 (the inbound resync handshake contract;
  literal shapes `{type:"resume", deviceId, lastAckedSeq}` and
  `{type:"resync", fromSeq}`)
- `docs/PI-SPEC.md` §6 (envelope shape `{v, seq, ack, frame}`;
  the 4-key exact-key test — O2 closed-green)
- `docs/PI-SPEC.md` §7.3 (device grants; `deviceId` carried in the
  envelope; server enforces grants)
- Skeptic O6 closed-red: parseInbound validates only
  `typeof frame.type === "string"`; inbound resume/resync control
  frames pass silently as AgUiFrame (cast hole)
- EV-3 Sub-question 3 ruling (closed 5-value `reason` taxonomy;
  `protocol_violation` is the existing reason for inbound-shape
  rejections — reused here, no new taxonomy)
- EV-3 step-3 convergence #1 (typed state-event seam; transport
  emits events, EV-8 renders — the inbound-union handler fits the
  same pattern)
- EV-3 step-3 convergence (transport owns WHEN, EV-8 owns WHAT for
  injected seams; `onResync(fromSeq)` is the same shape as `rearm`)
- EV-1 Q3 + EV-4 Q1 rulings (spec-correction governance: corrections
  forced by authoritative upstream and preserving the security model
  ride the implementing card's PR)

### Options rejected

- **§2 amendment to admit the inbound union:** would be a
  portfolio-level wire-contract change to the locked translation-
  boundary decision. The literal lock does not reach inbound (per
  the textual read above), so an amendment is unnecessary; it is
  also wrong on the principle (amending a locked decision the spec
  text does not require is a bigger blast radius than the
  implementing-card-rides-it path). Rejected.
- **Steward escalation for the parseInbound widening:** the
  widening (a) is forced by authoritative upstream (Skeptic O6
  closed-red), (b) preserves the security model (no new surface;
  `protocol_violation` rejection is *narrower* than today's silent
  pass), (c) belongs to the card whose contract surface it
  implements (EV-5 is the §5.3 contract owner). EV-1 Q3 + EV-4 Q1
  precedent binds: this rides EV-5's PR; the facilitator authors
  the one-sentence §5.3 clarifying addition with O6 evidence cited.
- **Hardening `parseInbound` to reject all non-AG-UI inbound
  frames:** breaks §5.3's resume/resync handshake — the server
  would relay `{type:"resync"}` and the extension would reject it,
  leaving the resync flow dead. Wrong direction.
- **Treating resume/resync as AG-UI events with `type:"resume"` and
  `type:"resync"`:** they aren't; AG-UI's enum doesn't name them
  (O8 closed-green); a client would either ignore them or
  mis-render them. The discriminated union is the AG-UI-clean
  shape; AG-UI is not polluted.

### Reversibility

Trivial. The parseInbound widening is a discriminated union addition
(an additive type; existing AG-UI shapes still validate identically).
The §5.3 clarifying sentence is one sentence; the §5.3 wire shapes
are unchanged. If a future card decides to amend §2 to explicitly
cover inbound (e.g., for a future protocol expansion), the
discriminated union design carries forward — `InboundFrame` already
has the right shape to extend.

---

## General rule for the remaining cards — EV-6, EV-7, EV-8, FLLWUP-2

**A — MESSAGES_SNAPSHOT emission contract.**

- **`history.ts` emits exactly one MESSAGES_SNAPSHOT per replay**, at
  the **start of the replay walk**, carrying the active-branch
  message list (`messages: MessageSchema[]`, each entry
  `{role, content: string}`). The snapshot is a destructive
  state-reset and never appears in-stream at a compaction point.
- **The compaction point emits `{type:"CUSTOM",
  name:"pi.context.compaction", value:{pi:"session_compact",
  data:{summary, firstKeptEntryId, tokensBefore}}}` only.** No
  MESSAGES_SNAPSHOT at the compaction point.
- **translate.ts's compaction branch emits CUSTOM only** (one
  mapper, two triggers — live and replay). The mapper does not
  know about MESSAGES_SNAPSHOT.
- **Test contract (post-change gates for EV-5):** init emits one
  MESSAGES_SNAPSHOT with the active-branch messages; in-stream emits
  zero MESSAGES_SNAPSHOT and one CUSTOM per compaction entry;
  replay-twice yields byte-identical emission. EV-6 / EV-7 / EV-8 /
  FLLWUP-2 inherit this emission; they do not relitigate it.

**B1 — resync_done terminator shape.**

- The resync terminator is `{type:"CUSTOM", name:"pi.resync.done",
  value:{uptoSeq}}`. EV-5 emits this as the last frame of the
  replay batch. Downstream cards inherit; no one re-decides this.

**B2 — Inbound frame discrimination.**

- **`parseInbound` validates a discriminated union** on the `frame`
  slot of the `{v, seq, ack, frame}` envelope: `AgUiFrame` (today's
  shape) | `{type:"resume", deviceId, lastAckedSeq}` |
  `{type:"resync", fromSeq}` | `null` (heartbeat / ack-only).
- **Resume control frame:** handled by transport.ts directly —
  updates the inbound watermark (`inboundSeq`); logged debug-level;
  never reaches `onInbound`.
- **Resync control frame:** triggers an injected `onResync(fromSeq)`
  callback, supplied by EV-8's wiring. EV-8 sequences
  `onResync(fromSeq)` → `history.resyncActiveBranch({fromSeq})` →
  replay batch + `pi.resync.done` per B1. EV-8 owns the callback
  contract; EV-5 defines the shape of the callback's `fromSeq`
  argument (a `number` — the seq to start replaying from; `null` /
  `0` semantics TBD at EV-5's impl but defaulting to "replay all" is
  acceptable).
- **§2 is not amended.** Inbound control frames are §5.3's contract,
  not §2's lock.
- **Test contract for EV-5 step 9:** parseInbound accepts the four
  union members and rejects everything else as `protocol_violation`
  (no new reason taxonomy needed). Resume updates the inbound
  watermark without surfacing to `onInbound`. Resync invokes the
  injected callback exactly once per inbound resync control frame.

**Governance — spec-correction pattern binding for the remainder.**

The EV-1 Q3 + EV-4 Q1 precedent is now applied three times in this
epic (§7.4/§7.5/§9.1 prose sync by EV-1, §4 row corrections by EV-4,
§5.3 line + one-sentence clarifying addition by EV-5). The pattern
binds: **a spec correction forced by authoritative upstream
evidence, preserving the security model, that belongs to the
contract surface the implementing card owns, rides the implementing
card's PR as a facilitator-authored, evidence-cited prose-sync.
Separate spec cards are not required; steward escalation is not
required.** This general rule applies uniformly to EV-6, EV-7, EV-8,
FLLWUP-2, and any follow-up card whose work requires a spec-section
edit forced by upstream facts.

The rule is not a license to silently rewrite the spec: every
amendment must carry the upstream evidence in the row note (Skeptic
objection number, protocol citation, or runtime test). Amendments
that *change* the security model (e.g., admitting a new server
contract surface, loosening tenancy boundaries, expanding the threat
model) are portfolio changes and route to steward — they do not
ride the implementing card's PR.

---

## Closing note for the runner

EV-5 may proceed to step 7 (design spec + facilitator-authored §5.2
step-3 amendment + §5.3 resync_done line correction + §5.3 inbound-
union clarifying sentence, all with O8/O6/O9/O10 evidence cited in
the row notes) → step 8 owner implementation against the corrected
contract → step 9 Skeptic verify on the corrected implementation
(closing O1 / U1 by green tests of init-snapshot + in-stream-CUSTOM
emission; closing O3 / U3 by green tests of `replay?:boolean`
frame-level field; closing O6 / U2 by green tests of the inbound
discriminated union; U4 by green tests of the runId derivation edge
case) → step 10 judge on the corrected implementation → step 11/12
merge gated by the deterministic five-criteria check.

The general rule above binds for EV-6, EV-7, EV-8, and FLLWUP-2.
None of those cards should re-litigate A, B1, or B2.
