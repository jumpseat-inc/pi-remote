# EV-4 Open-Judgment Rulings — product-owner seat

Date: 2026-08-31
Card: EV-4 — Pure pi-to-AG-UI translation mapper
Epic: EPIC-1
State at ruling: Deliberating (cap reached on 2 rounds — convergence on
implementation shape; two residuals routed to product-owner by the runner)

The wiki is empty (`vault/wiki/index.md` is a stub catalog with no module
pages). Authority is the spec itself (`docs/PI-SPEC.md`), `AGENTS.md`
(which names the spec as source of truth and binds it to reality),
the EV-4 deliberation record (`council/cards/EV-4.md`), the EV-1
precedent (a docs-only card whose Q1/Q2/Q3 rulings were binding here),
and the closed-red Skeptic results (S1, S2, S8) against the AG-UI repo,
the pi SDK source, and the JSONL format. No recorded human decision in
`council/board.md` bears on either of these two questions.

The operative pair is the one pi-remote's own grounding implies:
**mechanism** (does the wire hold; does the row map to a frame AG-UI
will accept) and **user value** (does the remote observer see what
the spec promises). PETA SPKLU grounding does not apply to pi-remote.

---

## Q1 — Governance of the locked-§4 corrections

### Ruling

The corrected mapping is **binding for EV-4's implementation**, and the
facilitator (not me, not the owner, not the consolidator) **may amend
§4 in the spec as part of the same work** that implements the corrected
rows. Three corrections land in §4:

| §4 row as written | §4 row as corrected | Evidence |
|---|---|---|
| "thinking content in `message_update` → `THINKING_TEXT_MESSAGE_*`" | `REASONING_MESSAGE_*` (the family AG-UI canonically ships; `REASONING_MESSAGE_START` carries the `role` field) | S1 — AG-UI `docs/concepts/reasoning.mdx` migration, TS `EventType` enum, Dart migration; §4's literal names a deprecated family |
| "`tool_execution_start` / `_update` / `_end` → `TOOL_CALL_START` / `_ARGS` / `_END`" | `message_update.assistantMessageEvent` `toolcall_start` / `toolcall_delta` / `toolcall_end` → `TOOL_CALL_START` / `_ARGS` / `_END`; `tool_execution_*` → `CUSTOM` `pi.tool.*` (or omitted — see below) | S2 — `tool_execution_*` fires in a separate execution lane AFTER `message_end` (false temporal order); `tool_execution_update` carries a static args snapshot + `partialResult`, not an args delta |
| `tool_result` message events → `TOOL_CALL_RESULT` (no content-shape row in §4 today) | mapper MUST flatten `(TextContent \| ImageContent)[]` blocks to a `string` (concatenate text, represent/skip images) | S8 — AG-UI `TOOL_CALL_RESULT.content` is `z.string()`; pi's `ToolResultMessage.content` is a block array |

These three corrections are the row-by-row replacement for the literal
§4 entries the Skeptic closed-red. Everything else in §4 stands:
`agent_start`/`agent_settled` → `RUN_STARTED`/`RUN_FINISHED`; `CUSTOM`
shape `{type:"CUSTOM", name:"pi.<category>", value:{pi:<raw>, data:<semantic>}}`;
`turn_start`/`turn_end` → `STEP_STARTED`/`STEP_FINISHED`; `tool_result`
message → `TOOL_CALL_RESULT` in assistant source order; user input →
`TEXT_MESSAGE_START` role `user`. The corrections do not change §4's
*column structure* (pi surface → AG-UI event) — they update *row
entries* to match the actual AG-UI protocol and pi SDK surface that
the implementation must bridge.

**Governance — who writes the §4 amendment, when, and how:**

1. **The §4 amendment is part of EV-4's work product**, not a separate
   contract change requiring steward. Two reasons bind this:

   (a) **EV-1 Q3 already settled the meta-question.** My EV-1 ruling
   for Q3 — "the §7.5 row-1 tenancy update ... is prose-sync within
   EV-1's mandate; EV-1 may rewrite these sections without escalating
   to steward" — established the operative test: a spec correction
   that does not change the security model and is forced by an
   authoritative upstream (here: the AG-UI protocol and the pi SDK
   source) is prose-sync within the implementing card's mandate. EV-4
   sits cleanly inside that test. The Skeptic's three red findings
   are not editorial preferences; they are protocol facts against
   which the current §4 rows are demonstrably wrong.

   (b) **`AGENTS.md` is dispositive in the corrections' favor.** The
   repo's own instruction file says: *"It is the source of truth for
   the design; keep it in sync with any change that affects the wire
   format."* The corrections *do* affect the wire format; the spec
   must stay in sync with them. A locked spec clause that contradicts
   the upstream protocol is, by the repo's own rule, the thing that
   has to move.

2. **The facilitator amends §4 once, in one coherent edit, alongside
   EV-4's implementation.** The amendment is **not** a silent
   rewrite. It rides as a §4 spec patch in the same branch/PR that
   carries `src/translate.ts`, with the test evidence (S1, S2, S8
   results) cited in the §4 row notes. The owner does **not**
   write the spec — the owner's seat produces code. The
   facilitator writes the spec at step 7's spec-write moment,
   splicing the corrected §4 rows alongside the corrected design
   table that EV-4's design spec already publishes. The three
   Skeptic red findings become row-level notes in the §4 table
   ("corrected against AG-UI reasoning migration, pi SDK
   generation-lane execution, AG-UI `TOOL_CALL_RESULT.content`
   string-typed shape").

3. **One place EV-1 Q3's precedent does NOT reach, and I rule on
   it explicitly:** §4 was named in EV-1 as the contract this
   repo pins and was *protected* from alteration there. EV-4 is
   the card whose acceptance *is* "the AG-UI frames of spec §4,"
   so EV-4 touching §4 is not a stealth side-effect — it is the
   card's stated scope. The protection in EV-1 was a deferral to
   EV-4's own work, not a prohibition. EV-4 exercising that
   authority is the predicted, not the surprising, path.

4. **Implementation binding.** Until the §4 amendment lands, EV-4
   implements the corrected rows. The acceptance line "maps each
   documented pi event and JSONL entry kind to the AG-UI frames
   of spec §4" is read against the corrected §4 — the *referent*
   of "the AG-UI frames" is the protocol-conformant frames §4 is
   supposed to specify, not the literal rows. Reading it the other
   way would make the goal self-defeating: an implementation that
   emits `THINKING_TEXT_MESSAGE_*` violates the AG-UI schema
   regardless of what §4 says, and EV-4's intent ("one wrong
   mapping here is visible to every remote user") would be
   unreachable. That reading is closed.

5. **Open objections O1, O2, O3 settle by green tests of the
   corrected implementation**, run at step 9 against the corrected
   impl. The tests are the same ones the Skeptic named — green
   once the corrected rows are implemented and exercised. The
   gating condition for EV-4's implementation acceptance is that
   the corrected impl passes the same Skeptic gates that closed
   red against the literal.

6. **Companion correction to consider (designer's open note,
   §4 row 4 area):** the per-block thinking id
   "<assistantId>:think:<contentIndex>" is already part of EV-4's
   converged implementation; whether to surface it as a §4 note
   ("thinking block ids use `<assistantId>:think:<contentIndex>`")
   is a documentation completeness call that travels with the
   amendment. I include it in the §4 amendment as a single
   parenthetical in the thinking row, since it falls out of the
   S1 reasoning-family correction.

### Reasoning

The runner packet frames Q1 as "who has authority to rewrite a LOCKED
contract clause in response to a test." That framing risks
overstating the dispute. EV-4's goal does not say "implement §4
literally"; it says "maps each documented pi event ... to the AG-UI
frames of spec §4." §4's role in the goal is to name the frames, not
to constrain the implementation to names that violate the AG-UI
schema. When the schema names a frame family that §4 does not list,
§4 is incomplete; when the schema deprecates a family §4 lists, §4
is wrong. The implementation cannot meet the goal by emitting
deprecated frames. The implementation cannot meet the goal by
mapping an event that fires after the message ended to a frame
that would attach a tool call to a closed assistant message.

Both sides of the runner packet's framing agree on this much:

- Side (a) — "test-settled correction the spec may absorb directly" —
  is correct on the merits but underspecified on *who*.
- Side (b) — "LOCKED means LOCKED ... amending §4 routes through
  product-owner→steward" — is correct on the *importance* of §4
  but wrong on the implication. EV-1's Q3 ruling already established
  that the implementing card is the right place to fix the spec it
  implements, when the fix is forced by an authoritative upstream
  and preserves the security model. §4 corrections are exactly that
  case.

I rule in seat, not by escalating to steward, because escalation
would itself be a portfolio change — declaring that §4 corrections
require a separate decision from EV-4's implementation would
decouple "spec is source of truth" from "spec must stay in sync,"
which is the very decoupling `AGENTS.md` rules out. The two are
inseparable; ruling them apart is the decision that would break
the contract the repo has set itself.

Mechanism check: closed-red tests against the AG-UI repo, pi SDK
source, and JSONL format are facts about the world, not opinions.
`THINKING_TEXT_MESSAGE_*` is deprecated; `tool_execution_*` fires
in a separate lane after `message_end`; `TOOL_CALL_RESULT.content`
is a string. An implementation that contradicts those facts does
not meet EV-4's goal no matter what §4 says.

User-value check: the remote observer sees AG-UI frames. If the
mapper emits deprecated reasoning frames, the AG-UI client ignores
them or fails validation — the reasoning pane is invisible to the
remote user regardless of how clean the §4 row looked on paper.
If the mapper attaches tool calls to closed assistant messages,
the client renders them after the message ended — the rich tool UI
the spec promises is broken for the remote user. If the mapper
passes a block array where a string is required, the frame is
rejected at validation — the tool result never reaches the remote
user at all. Every correction has a user-visible cost when
silently not made; none of them has a user-visible cost when made.

Reversibility check: the §4 amendment is trivial to undo. Reverting
the corrected rows restores the literal, and the implementation
that worked against the corrected rows would then fail validation
on first connect. The cost of being wrong is a re-do; the cost of
not amending is broken frames in production for every remote user.

### Sources

- `docs/PI-SPEC.md` §2 (translation boundary), §4 (the table in
  question), §10 (contract surfaces)
- `AGENTS.md` — "the spec is the source of truth; keep it in sync
  with any change that affects the wire format"
- EV-4 deliberation record: round-2 convergence on CUSTOM shape,
  stepName="turn", runId never minted by translate, parentMessageId
  on TOOL_CALL_START, `TOOL_CALL_ARGS.delta=JSON.stringify(args)`
  never partialResult, per-content-block thinking ids
- Skeptic results S1, S2, S8 — closed-red against the AG-UI repo
  (TS enum, Dart migration, `docs/concepts/reasoning.mdx`),
  against the pi SDK source (`message_update` discriminated
  toolcall_start/delta/end vs `tool_execution_*` separate lane;
  `ToolResultMessage.content` block array)
- EV-1 Q3 ruling: spec corrections forced by upstream authoritative
  facts and preserving the security model are prose-sync within
  the implementing card's mandate

### Options rejected

- **Steward escalation:** the corrections do not change the
  portfolio. They are protocol-conformance edits to a spec section
  the implementing card owns. EV-1 Q3 already settled the
  meta-question; escalating Q1 to steward would contradict that
  precedent without new evidence.
- **Implement against literal §4 and let the test fail at step 9:**
  this deadlocks the card. The implementation cannot meet its goal
  against the literal, so step 9's verify would red, the owner
  would have to fix the implementation, and §4 would still be
  wrong. The facilitator holding §4 "as written" until that
  sequence completes is the consolidator's stated interim
  position; it is not a defensible end state.
- **Split the corrections — implement S1/S2/S8 against the literal
  and file a separate spec card:** split-scope would delay every
  downstream card (EV-5/EV-8) on the §4 amendment landing
  separately, and the spec amendment's only consumer is EV-4's
  implementation. One card, one edit.

### Reversibility

Trivial. The §4 amendment rides in a single PR alongside
`src/translate.ts`. If a future agent disagrees, the spec rows
can be reverted and the implementation re-edited; the test suite
pinning the corrected behavior will catch any reversion. The
amendment's blast radius is the implementation and its tests; the
spec's other sections (§5, §6, §7, §8) are untouched by this
ruling.

---

## Q2 — Replay RUN framing (one pair per past run vs. one outer pair)

### Ruling

**One `RUN_STARTED` / `RUN_FINISHED` pair per past run.** Replay
mirrors what the live session emitted. Per-run boundaries are
meaningful to a remote observer, and per-run deterministic `runId`s
preserve live/replay dedupe (a frame produced live with `runId`
`X` and the same frame produced on replay with `runId` `X` are
the same frame to the client; an outer `runId` wrapping the
batch breaks that by definition). `translate.ts` never mints
`runId`s — it consumes them from input. EV-5 (the replay owner)
mints a deterministic `runId` per past run from the JSONL entry
sequence and threads it through `TranslateContext` for the
duration of that past run's frames. EV-4 publishes the contract
that `runId` is input-driven; EV-5 publishes the rule that
"past-run boundary" is a user entry through the last assistant
or toolResult message before the next user entry (the same
user-message-bounded rule the consolidated design uses for turn
derivation).

### Reasoning

Two facts settle mechanism. (1) Skeptic closed-green that the
JSONL has no turn/run entries; replay must infer boundaries via
fold state. That inference must produce the same boundaries the
live session emitted, or replay is *not* the live history
translated — it is a re-narrated version of it. A remote
observer comparing live to replay, or resuming a session after
disconnect, would see "RUN" boundaries that are not present in
the live session if the replay wraps the whole batch in a single
RUN. (2) Skeptic closed-green that dedupe ids live in the §6
envelope. Per-past-run deterministic `runId`s make the *inner*
correlation ids stable across live and replay (a replay-derived
`runId` for past run N matches the live-derived `runId` for the
same past run N if the JSONL entry sequence is the same). One
outer `runId` for the whole batch breaks that stability: live's
`runId` is per-run; replay's `runId` is per-batch. The §6
envelope dedupe catches exact byte-duplicates; the AG-UI client
catches exact byte-duplicates; the *user experience* of "this
session resumed" requires the inner `runId` to match.

The user-value lens is the deciding one. A driver (or any
remote observer) reading the AG-UI stream sees RUN as "the
agent did a thing." Per-past-run RUN pairs match that mental
model — past run 1 = "the agent did a thing," past run 2 =
"the agent did another thing." One outer RUN pair matches the
mental model "the agent caught up" — which is true, but is the
*transport* fact, not the *content* fact the RUN frame is for.
AG-UI's `RUN_STARTED`/`RUN_FINISHED` semantics are about agent
runs, not about transport resyncs. EV-4's goal text reinforces
this: "`agent_start` / `agent_settled` → `RUN_STARTED` /
`RUN_FINISHED`" — the row is keyed to per-agent-run events,
not to a resync event. Replay that wraps the batch in one RUN
is using a transport frame as a content frame; it works, but it
ships a semantic mismatch the remote observer will notice
(why does this one RUN say "FINISHED" 10x faster than the
others, with 10 assistant-message cycles inside?).

Per-run RUN pairs are also cheapest to reverse if the design
team disagrees later. The fold signature `translate(input,
state) → {frames, state}` accepts a `runId` field in
`TranslateContext`; switching to one-outer-RUN means EV-5
threads a single `runId` for the whole batch instead of minting
per-past-run — a small refactor inside EV-5's
derivation-and-thread step, not a redesign of `translate.ts`.
Switching back is equally small. Either direction is a
follow-up card if the remote UX is wrong.

### Sources

- `docs/PI-SPEC.md` §4 `agent_start` / `agent_settled` row —
  per-run semantics keyed to per-prompt-cycle agent events
- EV-4 round-2 convergence: "`runId` never minted by translate"
  (owner + principal + designer — unanimous)
- EV-4 intent: "`agent_settled` (not `agent_end`) driving
  `RUN_FINISHED`" — agent_settled fires once per prompt cycle
- Skeptic results S5 (agent_settled safe), S9 (JSONL has no
  turn/run entries; replay infers via fold state), S10
  (agent_settled reachable via `pi.on`)
- EV-1 Q2 ruling precedent: per-state-set discipline (footer
  states are *per-phase*, not transport-level; the same discipline
  applies to RUN frames — they are per-agent-run, not per-batch)

### Options rejected

- **One outer RUN pair wrapping the whole replay batch:**
  contradicts §4's per-prompt-cycle mapping (the row is keyed to
  `agent_start`/`agent_settled`, both per-prompt); breaks
  per-run deterministic `runId` stability between live and
  replay (a fact Skeptic closed-green on); uses a content frame
  as a transport frame, which the AG-UI client may render with
  timing that does not match its semantics ("RUN finished in
  200ms with 20 message cycles inside"). Rejected on mechanism
  AND on user value.
- **Per-message RUN pairs (one per assistant message):** no seat
  argued for this; would explode the AG-UI stream for the remote
  observer; rejects the §4 row's per-`agent_settled` semantics.
  Mentioned only to close the door on it.

### Reversibility

Trivial, but at a cost. Switching the per-run rule means EV-5's
JSONL → `runId` derivation rule changes, and EV-4's contract
note ("`runId` input-driven") is unchanged. If the remote UX
turns out wrong, EV-5 changes its derivation, the test suite
pins the new behavior, and no `translate.ts` code changes. The
reverse (per-batch → per-run) is the same shape. Either
direction is one card, not a refactor.

---

## Closing note for the runner

EV-4 may proceed to step 7 with these two rulings recorded.

- **Q1** clears the §4 governance question. The owner implements
  the corrected rows (REASONING_MESSAGE_*, generation-lane
  toolcall_*, TOOL_CALL_RESULT content flattening). The
  facilitator amends §4 in the same work, citing S1/S2/S8
  evidence in the row notes, in a single coherent PR alongside
  `src/translate.ts`. O1/O2/O3 settle at step 9 by green tests
  of the corrected impl.

- **Q2** settles replay RUN framing to one pair per past run,
  with `runId` input-driven (never minted by translate.ts) and
  EV-5 publishing the past-run-derivation rule
  (user-message-bounded). This rolls into the consolidated
  design's turn-derivation rule, which is the same shape —
  user entry through last assistant/toolResult before next user
  entry.

The follow-up the designer's round-2 surfaced —
`agent_end`-without-`agent_settled` — stays open at the
principal seat for EV-8's contract (does pi ever emit
`agent_end` without `agent_settled`, and what does it mean?).
EV-4 does not add a `RUN_ERROR` row; designer proposed
`CUSTOM` `pi.session.unsettled_end` as a back-pressure signal
for the principal seat. I take no position on that here — it
is the principal seat's call, not the product-owner seat's.

EV-4 may now resume at step 7 (design spec write → step 8 owner
implementation → step 9 Skeptic verify on the corrected
implementation → step 10 judge on the corrected
implementation → step 11/12 merge gated by the deterministic
five-criteria check).