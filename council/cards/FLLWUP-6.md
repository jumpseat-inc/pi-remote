---
id: FLLWUP-6
title: "Remove or document the dead user_input PiEvent in translate.ts"
state: Deliberating
owner: null
epic: EPIC-1
goal: translate.ts's user_input PiEvent mapping is either removed or explicitly documented as dead live-path code, so the module carries no mapping that the real pi SDK never emits.
---

## Intent

Filed from EV-6's step-4 Skeptic finding: the real SDK emits
`message_start`/`message_update`/`message_end` and has zero occurrences of a
`user_input` event; the translate.ts mapping for it is dead code in the live
path, and EV-6's injection design correctly bypasses it. Dead mappings in the
single shared translator are a correctness hazard — a future reader may treat
the row as a live contract and build on it.

## Acceptance

- Either the `user_input` mapping is removed from translate.ts and its tests,
  or a comment at the mapping site states in one sentence that the real SDK
  never emits this event and why the mapping is retained (whichever the
  deliberation justifies).
- The §4 table in docs/PI-SPEC.md and translate.ts agree on which events are
  mapped — no documented live event lacks a row and no row names a dead event
  without the dead-code annotation.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.

## Deliberation record

### Step 1 — path classification

- Full council (not mechanical): the goal is spec-ambiguous by construction —
  it explicitly admits two reasonable designs (remove the mapping, or retain
  it with a one-sentence dead-code annotation), each with a real tradeoff.
  Confined to the translation surface (translate.ts + its tests + PI-SPEC §4
  agreement), but spec-ambiguity is its own gate per council.md step 1.
- Surface-touching: no. The mapping is dead in the live path (see binding
  context), so removal vs. annotation is behaviorally identical at runtime;
  the only human-readable surface involved is the developer-facing §4 table,
  not user-visible copy or product surface. `designer` NOT seated.
- Binding context carried in (not open for relitigation):
  - The installed pi SDK's `ExtensionEvent` union contains NO `user_input`
    event — zero occurrences in `dist/core/extensions/types.d.ts`; the typed
    `on()` overloads list `message_start`/`message_update`/`message_end`,
    `tool_execution_*`, `model_select`, `thinking_level_select`, `tool_call`,
    plus the ui/context/session events, but no `user_input` (EV-6 step-4
    Skeptic finding; re-verified against the installed SDK at this run).
  - `index.ts:615` registers `deps.on("user_input", …)` against the local
    ExtensionAPI stand-in only (permissive `on(event: string)`); FLLWUP-9
    (Backlog) replaces the stand-in with the real SDK's typed exhaustive
    `on()`, under which this subscription cannot exist. It can never fire
    live.
  - The §4 table row "user input (from a client) → TEXT_MESSAGE_START (role
    user)" must agree with translate.ts whichever way the council settles: no
    documented live event may lack a row, and no row may name a dead event
    without the dead-code annotation (orchestrator binding constraint 3).
  - Spec corrections ride the PR as facilitator-authored evidence-cited
    amendments (standing precedent, EV-1 Q3 / FLLWUP-5).
  - Gates: `bunx tsc --noEmit` exit 0; `bun test` exit 0 (155 green on main),
    keep them. No Mongo for this card.
  - Grounding: `vault/wiki/index.md` is a stub catalog (no module pages);
    semantics grounded in docs/PI-SPEC.md §4/§5.4 and the installed pi SDK
    types.
- Seats resolved at card open: owner, principal, skeptic, consolidator,
  judge all resolve from the packaged pi-council agents dir; no repo-local
  override shadows them.
