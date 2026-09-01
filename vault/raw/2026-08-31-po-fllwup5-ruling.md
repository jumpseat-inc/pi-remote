---
id: po-fllwup5-ruling-2026-08-31
source: FLLWUP-5
title: "FLLWUP-5 ruling — seven items, binding"
seat: product-owner (judgment row)
date: 2026-08-31
scope: FLLWUP-5 / EPIC-1 only
---

# FLLWUP-5 ruling — seven items, binding

This ruling resolves the seven open items the FLLWUP-5 council-runner
escalated after capped rounds. It is binding for FLLWUP-5 unless explicitly
deferred to steward. Three of the seven (S-O1, S-O2, S-O4) are scope
questions that, taken together, decide what FLLWUP-5 ships; one of them
(S-O2) reverses a round-3 "out of scope as follow-up" call. Items 1–4 are
wire-contract and acceptance questions. The split — settle the wire shape
and the acceptance text, fold the systemic cast fix into this card, leave
the raise wiring as its own follow-up — is the cheapest-to-reverse
arrangement that keeps FLLWUP-5 honest about what it ships live.

## Settled design (binding, not reopened)

The consolidated Step 5 settled design stands. To restate for the ruling:

- **Contract (a)** — `translate.ts` adds a `ui_prompt_end` PiEvent and maps
  it to `CUSTOM name:"pi.human_input.closed", value:{pi:"ui_prompt_end",
  data:{kind,title,schemaVersion:1}}`. Constructed **manually**, never via
  `ev as PiEvent`. Fold carries only `kind,title` (no `ts`/`deviceId`/
  `promptId`). Purity holds (G-11/G-12).
- **Contract (b)** — `index.ts` captures the `InjectResult` from `onInbound`
  and emits `CUSTOM name:"pi.human_input.resolved"` for `resolved` and
  `steered_fallback`-with-`tracked:true`. **Never** untracked fallback or
  `stale`. `deviceId` from the result (recorded from the envelope, never
  from free text). `ts` from the injected `deps.now`.
- **S-O3** — `InjectResult.steered_fallback` gains `tracked: boolean`. This
  is in-scope prerequisite work, not a scope ruling.
- The raise (`ui_prompt_start` / `registerPrompt`) is **out of scope** for
  FLLWUP-5 — a hard runtime precondition, owned by a separate follow-up.

## Item 1 — J-FIELDSET (resolved-frame wire field set)

**Ruling.** `pi.human_input.resolved` carries **`{promptId, occurrence,
deviceId, ts}`** — principal's design (job-34.8), with `kind` withdrawn
across all three seats.

**Why this and not the other two.** The two design-defect tests the
council ran settle what the server knows but do not settle which fields
the client needs. They answer:

- "Occurrence dropped from InjectResult" — closed-green. The server does
  not need to carry occurrence to know which entry it cleared.
- "Raise publishes occurrence" — closed-green. The server stamps
  occurrence on the wire on the raise side.

What neither test answers is the consumer's question: when the client
receives the second resolve for a promptId the host raised twice, how
does it tell the two apart? The deliberate design in `inject.ts` keys
its in-memory registry on `(promptId, occurrence)` (R1, settled in EV-6
step 3 and reaffirmed by Skeptic in FLLWUP-5 probe 1). The raise frame
the host emits carries that compound key — `index.ts:383-388` stamps
`f.value.data = {...data, occurrence}` before sending. If the resolved
frame keys only on `promptId`, a client that received two raises sees
one resolved frame and cannot tell which occurrence it closed.

The owner's design (`{promptId, deviceId, ts}`) is honest about its
discipline — it is a strict deep-equal test on the wire shape — but it
underweights the user's interest in the second occurrence. The user's
interest is the operative question on this seat's grounding; the
discipline applies to *why* a field is included, not to whether it is
included at all.

The designer's design (`{promptId, occurrence, kind, deviceId, ts}`)
adds `kind:"won"|"fallback"`. Two grounds: (1) the loud-once
`fallback_to_steer` notice is a transient UI artifact, not a second
consumer-subscribeable surface — on the second steer fallback in a
session, the client has only the resolved frame and cannot tell steered
from won; (2) the designer's "SDK blocking-UI-singular" claim is
falsified by the `(promptId, occurrence)` registry itself. Ground (1)
survives: a second consumer that does not render the fallback notice
cannot recover the steered-vs-won distinction. But ground (2) does not
require `kind` on the wire — the answer comes from `deviceId`: a
client whose own deviceId matches the resolved `deviceId` knows it won
its own prompt; otherwise the response was steered. `kind` adds a
duplicate signal that the existing fields already carry. It costs a
discriminator in every consumer switch for one bit of information
already on the wire, and the designer's round-2 ground (1) is
incompatible with the `kind:"won"` value being unreachable in
production — kind:"won" only fires under the fixture seam (R3 Side B),
so shipping the discriminator with a value no production frame ever
takes is a lie about the contract.

**`{promptId, occurrence, deviceId, ts}`** is the minimum that round-trips
the raise identity key, costs no consumer a discriminator a production
frame never takes, and is the same shape a hypothetical
multi-occurrence-collision client already needs. It is also reversible:
adding `kind` later is non-breaking (an additive discriminator); dropping
`occurrence` later is not (consumers keyed only on promptId would lose
information).

**Reversibility.** Two settable moves: add `kind` later (additive, no
break); or drop `occurrence` (breaking for any consumer that keyed on
it). The ruling is one-way on occurrence; symmetric on kind.

## Item 2 — J-ACCEPT (acceptance (b): fixture-green vs runtime-observable)

**Ruling.** Acceptance (b) is **fixture-green only**, with the acceptance
text rewritten to say so explicitly.

**Why.** The card's acceptance text is the contract the user (and the
judge) can act on. As written, "flip the prompt to resolved state on
real feedback" implies runtime behavior; the deliberation ruled the
raise out of scope; probe 8 confirmed the raise path is dead in
production (the installed SDK has no `ui.confirm` event, the real
`ExtensionAPI.on` is exhaustively typed, and no `deps.on("ui_prompt_start")`
exists). Under the settled scope, contract (b) fires in fixtures but
cannot fire live.

Two paths out of this conflict exist:

1. Rewrite acceptance (b) so the user-visible claim matches the
   implementation: the resolved frame is correct, testable, and
   fixture-green; the runtime path is gated on a follow-up raise card.
2. Folding the raise wiring into FLLWUP-5 to make acceptance (b)
   runtime-observable.

Path 2 is rejected on scope grounds — see Item 5. Path 1 is therefore
binding, and the acceptance text rides the PR with a facilitator-authored
amendment citing probe 8 (per the EV-1 Q3 governance precedent).

**Concrete acceptance text** (binding, facilitator rewrites the
acceptance bullet on the PR; this ruling provides the language):

> The lifecycle wiring emits CUSTOM `pi.human_input.resolved` with
> `{promptId, occurrence, deviceId, ts}` from the captured `InjectResult`
> when a resolution (direct or steering-fallback-with-`tracked:true`) is
> applied to a prompt EV-6 tracked. The fixture path is green today;
> the runtime path is gated on FLLWUP-raise (a follow-up card that wires
> `ui_prompt_start` into the lifecycle layer). The acceptance criterion
> is fixture-green, not runtime-observable, until FLLWUP-raise ships.

This amendment is the same governance the EV-4 Q1 ruling and the EV-1
Q3 ruling established: a binding spec sentence with evidence cited in
the row notes, riding the implementing card's PR.

## Item 3 — J-REPLAY (replay self-sufficiency)

**Ruling.** Replay is **not** required to be self-sufficient for the
resolved frame. The §5.2 / EV-5 replay path reconstructs the raise from
JSONL (it does — the raise frame is emitted by `forward({event:"ui.confirm"})`
and live frames are JSONL-recorded). The resolved frame is **not**
JSONL-recorded because it is lifecycle-emitted, not translate-emitted,
and it has no JSONL entry kind to record against. A reconnecting client
re-sees the raise in replay, then sees the resolved frame in the live
stream as the host continues processing.

This is acceptable **iff** the remote client treats replay as a snapshot
and continues on live frames — which is exactly what EV-5's design
specifies ("replay reconstructs without gaps" was the designer's
Gulf-of-Evaluation goal in EV-4 step 2; EV-5's design carries it
through). The defect condition is a client that treats replay as
authoritative and never processes post-replay live frames — and that
client is already broken for every other lifecycle event the host emits
post-replay (a `pi.human_input.stale` or `pi.human_input.fallback_to_steer`
from after the resync would also be missed). The resolved frame is not
specially disadvantaged by this; it is in the same category as every
lifecycle frame.

**Reversibility.** Cheap. If a future product call wants replay
self-sufficient, the resolved frame can be (a) emitted into a synthetic
JSONL entry the EV-5 adapter replays (one-line; tests green); or (b)
buffered in a per-(promptId, occurrence) "resolved" set the EV-5
adapter checks on the resync boundary (one-line; tests green). Either
path is additive and non-breaking.

## Item 4 — J-FUTURE (forward-compat posture)

**Ruling.** No contract change. The Item 1 ruling already names the
fields a non-singular concurrency model or a future live resolve API
would need on the wire (`occurrence` for the multi-instance case; `kind`
is the additive escape hatch). The card ships `{promptId, occurrence,
deviceId, ts}` as the contract; the future paths are non-breaking
extensions, not reworks.

This is the cheapest-to-reverse posture: ship the minimum the current
design needs (occurrence, for the in-memory registry's compound key);
let a future product call decide whether to widen the discriminator.
There is no field the current contract excludes that a future design
*needs* — adding `kind` later, or a second discriminator, is additive
on `name` (the wire-level dispatch key is already distinct).

## Item 5 — S-O1 (acceptance scope: fixture-green or include raise wiring)

**Ruling.** FLLWUP-5 stays **fixture-scoped**. The raise wiring is a
follow-up card, named **FLLWUP-raise** (provisional id; the orchestrator
assignes the canonical id at backlog grooming).

**Why this and not the raise-folded-in option.** Two reasons.

First, scope arithmetic. The raise wiring is: (a) a `deps.on("ui_prompt_start", …)`
subscription; (b) manual construction of a `{event:"ui.confirm"}` PiEvent
from the SDK payload (note: `ui_prompt_start` payload carries `{kind, title?}`,
not `{promptKind, prompt}`, so the mapper needs a re-mapping or a
backward-compatible PiEvent variant); (c) wiring `registerPrompt` into
the host's response to `ui_prompt_start`; (d) updating `forward`'s
`ui.confirm` handler to handle both the synthetic and the (currently
dead) live path. That is a card of its own — its design space (what
fields on `ui_prompt_start` map to what fields on the raise frame; how
the synthetic handler in `forward` handles the canonical `ui.confirm`
event name) is real work that warrants its own deliberation. Folding it
into FLLWUP-5 triples the card's surface, contradicts the round-3
explicit "raise out of scope" settlement, and runs the council past the
3-round cap on the wrong card.

Second, mechanism. The user's value question — "does this serve the
person looking for a charger" — translates here to "does this card
honestly serve the remote user, or does it ship a half-truth?" The
half-truth path is shipping fixture-green acceptance text that implies
runtime behavior. The honest path is rewriting the acceptance text to
match what FLLWUP-5 actually ships (Item 2), and routing the runtime
gap to a follow-up card that owns it end-to-end.

**Card split (binding, name provisional):**

- **FLLWUP-5** (this card, scope unchanged): contracts (a) and (b);
  `tracked:boolean` on `InjectResult.steered_fallback` (S-O3); manual
  construction everywhere; acceptance text rewritten to fixture-green.
- **FLLWUP-raise** (follow-up, Backlog): wires the raise path end-to-end
  — `deps.on("ui_prompt_start")` with manual PiEvent construction;
  `registerPrompt` wired to the canonical SDK payload shape; acceptance
  re-opened to runtime-observable when this lands.

The acceptance-criterion amendment from Item 2 names FLLWUP-raise
explicitly so the user can trace the runtime gap. FLLWUP-raise
acceptance should say: "**Remote approval flow is end-to-end runtime-
observable:** a host that receives a `ui_prompt_start` raises a
`pi.human_input` CUSTOM frame with `(promptId, occurrence)`, the host
that resolves it emits `pi.human_input.resolved` live, and a reconnecting
client sees the resolved frame in the live stream after replay."

## Item 6 — S-O2 (systemic `ev as PiEvent` cast)

**Ruling.** The round-3 "out of scope as follow-up" call is **overruled**.
The systemic cast fix **folds into FLLWUP-5**.

**Why this is a reversal.** Round 3 ruled the cast pattern out of scope
when the bug was framed as a "probable live-path drop" — a single
subscription that might fail. The Skeptic later (probe 4) extended the
finding: the bug is worse than a silent drop, the misroute produces a
wrong `pi.session.info_change` frame via a `kind` collision with
`JsonlEntry`'s discriminator, and **the bug affects seven of ten live
subscriptions**, not one. Under that finding, "out of scope" stops being
a defensible call. A "follow-up" card for a single subscription's bug
makes sense; a follow-up card for seven of ten subscriptions whose
purity contract the §4 mapping table already binds is a hidden
rejection of the §4 design.

This is the specific case the seat's `<grounding>` clause points to:
"if a ruling would change the **portfolio** — not just this card —
**escalate to steward** rather than ruling." Overturning a round-3 call
is not in itself portfolio-level — round-3 was a council finding, not
a recorded human decision — but the call's effect is: seven
subscriptions become a separate card. That is a meaningful portfolio
rearrangement. This ruling is **not** deferring it to steward because
the right answer is in scope for the seat, not because it is
outside the seat's authority.

**Scope of the fold-in.** The fold-in is **manual construction across
all seven affected subscriptions**, mirroring `agent_start` (which is
already manual at `index.ts:556`). The seven subscriptions:

1. `message_start` (currently `forward(ev as PiEvent)`)
2. `message_update` (currently `forward(ev as PiEvent)`)
3. `message_end` (currently `forward(ev as PiEvent)`)
4. `tool_result` (currently `forward(ev as PiEvent)`)
5. `ui.confirm` (currently `forward(ev as PiEvent)`)
6. `user_input` (currently `forward(ev as PiEvent)`)
7. `ui_prompt_end` (new in FLLWUP-5 contract (a) — manual by design)

For each, the handler signature becomes `() => forward({event:"…"})`
(or, where the SDK payload carries fields the fold needs, manual
construction with the explicit field set). The pattern is uniform: the
handler does not pass the SDK event into the fold; it constructs the
PiEvent the fold expects.

This fold-in does not change the `forward` function. It changes the
seven handler call sites that currently cast. It also addresses the
naming bug — `forward`'s `ui.confirm` special-case (index.ts:373-394)
is preserved because `forward` itself is unchanged, but the cast that
fed into `forward` is replaced with a hand-built event.

**Why this is not a portfolio change.** Two checks. (1) The work is
mechanical: replace `forward(ev as PiEvent)` with `forward({event:"..."})`
in seven places, plus the new `ui_prompt_end` subscription (which
contract (a) already requires manual). The design space is
zero — there is no judgment call left after the contract settles
because the PiEvent types are already specified in `src/translate.ts`
lines 127-143. (2) The acceptance criterion is unchanged: tsc 0,
bun test green, contract (a) and (b) tested. The cast fix does not
add a new acceptance criterion — it removes a latent defect that
the existing acceptance criteria would catch if the harness fed real
SDK payloads instead of `{event:…}` synthetic ones.

**Reversibility.** Per-subscription: trivial — replace the
manually-constructed call with the cast (or vice versa). As a unit:
trivial — the seven changes are isolated to one `deps.on(...)` block
in `index.ts`.

## Item 7 — S-O4 (typed-on bridge)

**Ruling.** S-O4 **does not fold into FLLWUP-5**. It is a separate
follow-up, named **FLLWUP-typed-bridge** (provisional id).

**Why this stays out of scope.** The local `ExtensionAPI.on` in
`index.ts:43-65` is a structural stand-in that mirrors the real SDK's
shape with a permissive `event: string` overload. The real
`ExtensionAPI.on` is an exhaustively-typed interface (probe 8: no
string-generic overload exists). The `pi.on(event, handler)` bridge
at `index.ts:614` passes a generic string to a typed overloaded
`on()` — a compile-time error at the real type level, hidden by the
local type. This is a **type-honesty defect**, distinct from S-O2's
**data-flow defect**. The two are different defects:

- S-O2 is "we feed the fold an SDK-shaped object and the fold
  treats it as our shape" — runtime, structural, affects seven
  subscriptions.
- S-O4 is "we say `on(event: string, …)` and the real `on()` rejects
  it" — compile-time, type-level, affects every subscription.

The right fix for S-O4 is to **replace the local stand-in with the real
SDK's typed `on()`** (or a faithful re-declaration that mirrors its
exhaustive union). That is a real piece of work:

1. Vendor the real `ExtensionAPI.on` overload set (or its type
   union) from the installed SDK;
2. Replace `index.ts:43-65`'s `ExtensionAPI` declaration with the
   vendored type;
3. Update `createRemoteController`'s `RemoteControllerDeps.on` to
   match;
4. Verify tsc catches any future over-broad `on(event: string, …)`
   call at the real type level.

That is not a one-line fix. It is a type-cleanup card. Folding it
into FLLWUP-5 would **quadruple** the card's surface and would
*block* S-O2's fold-in, because the S-O2 fold-in assumes the local
type system tolerates `forward({event:"ui_prompt_end"})` style
construction — which is true today (the local type is permissive)
but is the exact kind of "hidden by the local type" defect S-O4
calls out. Two opposing moves in the same card cannot both be right:
either tighten the type (S-O4) or keep the cast fix compatible with
the loose type (S-O2). Doing both sequentially in one card is
incoherent; doing them in two cards lets the seat verify each
independently.

**S-O4's binding constraint for FLLWUP-5.** Until FLLWUP-typed-bridge
ships, the local type continues to hide the cast. FLLWUP-5's
acceptance must therefore pin the cast fix as the live path's defense
in depth: the local type hides S-O4, but S-O2's manual-construction
discipline keeps the seven affected subscriptions honest regardless of
what the type system catches. FLLWUP-5 ships with both manual
construction AND the existing permissive local type; FLLWUP-typed-bridge
later tightens the type to catch a future regression.

**Reversibility.** Per FLLWUP-5: zero impact — S-O4 is out of scope.
Per FLLWUP-typed-bridge: a one-PR type-replacement whose blast radius
is `index.ts`'s `ExtensionAPI` declaration + the `on` bridge.

## Summary of rulings (binding, in dependency order)

| # | Item | Ruling |
|---|------|--------|
| 1 | J-FIELDSET | `{promptId, occurrence, deviceId, ts}` (principal) |
| 2 | J-ACCEPT | Fixture-green only; acceptance text amended |
| 3 | J-REPLAY | Replay snapshot; live continues; not self-sufficient (acceptable per EV-5) |
| 4 | J-FUTURE | Ship minimum; future widening is additive |
| 5 | S-O1 | FLLWUP-5 stays fixture-scoped; raise becomes **FLLWUP-raise** (Backlog) |
| 6 | S-O2 | Cast fix folds into FLLWUP-5 (overrules round-3) |
| 7 | S-O4 | Out of scope; becomes **FLLWUP-typed-bridge** (Backlog) |

Two new follow-up cards are created by this ruling:

- **FLLWUP-raise** (Backlog) — wires the raise path end-to-end so
  acceptance (b) becomes runtime-observable.
- **FLLWUP-typed-bridge** (Backlog) — replaces the local `ExtensionAPI`
  stand-in with the real SDK's typed `on()`, closing S-O4.

Both are post-epic candidates (the epic is closing) — FLLWUP-raise
unblocks the user-visible promise FLLWUP-5's acceptance text rewrites
to fixture-green; FLLWUP-typed-bridge closes the type-honesty defect
the local `ExtensionAPI` is hiding. They are not in the epic's
delivery loop (Backlog), but they are recorded as pending portfolio
work.

## Effect on FLLWUP-5 (applied)

- **Contract (a)** — unchanged from Step 5: `translate.ts` adds
  `ui_prompt_end` → `pi.human_input.closed`, manual construction.
- **Contract (b)** — unchanged from Step 5: `index.ts` emits
  `pi.human_input.resolved` on `resolved` and `steered_fallback`-with-
  `tracked:true`, with field set `{promptId, occurrence, deviceId, ts}`.
- **S-O3** — `InjectResult.steered_fallback` gains `tracked: boolean`
  (in-scope implementation).
- **S-O2** — all seven `forward(ev as PiEvent)` call sites become
  manual construction; no `ev as PiEvent` cast survives in
  `index.ts`'s `deps.on(...)` block.
- **Acceptance text amendment** — fixture-green scope is explicit;
  FLLWUP-raise named as the runtime-gating follow-up.

## Effect on EPIC-1 portfolio

Two new cards. No card retired. FLLWUP-raise is the post-epic
runtime-observability enabler for FLLWUP-5's contract (b);
FLLWUP-typed-bridge is the post-epic type-cleanup enabler for the
cast discipline S-O2 enforces manually. Neither is required for the
epic's stated Done condition (every child card EV-1..EV-8 plus
FLLWUP-1..FLLWUP-7 reaches Done). Both are recorded in
`council/cards/` at Backlog priority.

## Reversibility

- Per Item 1 — symmetric on `kind`; one-way on `occurrence`. The
  ruling is reversible on `kind` (additive); irreversible on
  `occurrence` (dropping it would break compound-key consumers).
- Per Item 5 — fully reversible. Reverting FLLWUP-5 to the original
  scope and folding the raise in is one PR (large but mechanical).
- Per Item 6 — fully reversible. Reverting the seven manual-construction
  call sites to the cast pattern is one PR (mechanical).
- Per Items 2/3/4/7 — fully reversible.

The most expensive-to-reverse piece is the cast fold-in (Item 6),
because it touches seven subscriptions in the live path. The cheap
side of that: it is purely a code change with no protocol impact —
the wire shape is identical to what the cast *intended* to produce.
A mis-revert would manifest as a tsc error or a failing test, not
as a silent wire corruption. The cast fold-in is the cheapest
rearrangement that makes the live path honest.

## Citations

- FLLWUP-5 step 1 binding context, step 5 consolidated settled design,
  step 6 escalation handoff (`council/cards/FLLWUP-5.md`).
- EV-6 step 3 round-2 record on `(promptId, occurrence)` registry as
  the durable identity key (`council/cards/EV-6.md`); EV-6 step 6 R3
  Side B on permanent steering-fallback product behavior.
- EV-1 step 13 Q3 ruling on spec-amendment governance
  (`vault/raw/2026-08-31-po-ev1-ruling.md`).
- EV-4 step 6 Q1 ruling on spec corrections forced by tests
  (`vault/raw/2026-08-31-po-ev4-ruling.md`).
- Vault wiki is a stub catalog (`vault/wiki/index.md`) and carries no
  page relevant to this ruling. All grounding is in `docs/PI-SPEC.md`
  §4 / §5.4 / §7.3 and the installed pi SDK
  (`pi-coding-agent/dist/core/extensions/types.d.ts`), per the
  FLLWUP-5 step 1 grounding clause.