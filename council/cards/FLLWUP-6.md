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

### Step 2 — independent first pass (round 1, final — owner job-37.1, principal job-37.2, dispatched in parallel, each with only the card + binding context)

**owner (job-37.1, verbatim).** Remove the `user_input` strand in full, not annotate — the whole strand, not just the translate.ts case: the SDK is checked and contains zero occurrences of user_input in dist/core/extensions/types.d.ts (grep -c → 0; the ExtensionEvent union at :813 and the typed on() overloads at :941-942 list user_bash and input, never user_input). The strand is: translate.ts PiEvent union member (last member, in a union whose own header comment calls it the "Pi event surface (live path)"), the case "user_input" at translate.ts:~532, the deps.on("user_input", …) + forward({event:"user_input",…}) at index.ts:615-619 (typed by forward(input: PiEvent) at :397, registered against the permissive stand-in on(event: string) at index.ts:46 — the exact subscription FLLWUP-9's typed on() cannot express), the test at translate.test.ts:268-278, the two harness emissions at index.test.ts:555-557 and :716, and the §4 row "user input (from a client) → TEXT_MESSAGE_START (role user) / injected locally, then echoed onto the wire like any other message" (PI-SPEC.md ~:98). The table row's own mechanism description is false: live user text is never "echoed" off a user_input event — injection goes through pi.sendUserMessage (index.ts entry wiring) and the user's message arrives on the wire via the SDK's normal message_start (role user) → message_update → message_end stream, which translate.ts already renders through the st.role path (:415-418). inject.ts contains zero user_input references. Removal is behaviorally inert — nothing in any live path emits it — so the only gate risk is the deliberate test replacement below. Tradeoffs: (1) stop mirroring the stand-in's compliance surface (accepted — the stand-in is replaced wholesale by FLLWUP-9); (2) give up the "living documentation" a dead-code annotation provides (accepted — a comment at one site doesn't fix the type-level lie, the §4 row, or the harness tests; retention mitigates the card's stated hazard only partially); (3) retention actively creates a trap annotation can't defuse: the natural next step for a reader is to wire the real SDK's input event (InputEvent at types.d.ts:657 — {type, text, source, streamingBehavior?}, no messageId) onto this case, and that shape doesn't fit {messageId, text}, so the dead case preconditions a mapping that must be redesigned anyway. Testable claims: (1) strand isolation — grep -rn "user_input" src test docs index.ts matches only translate.ts, index.ts, translate.test.ts, index.test.ts, PI-SPEC.md; (2) live user-role rendering doesn't depend on the dead event — replacement unit test shipping with the removal: translate([message_start role user, message_update text delta, message_end]) must produce TEXT_MESSAGE_START(role user)/CONTENT/END — passes on current code, proving coverage survives the deletion; required because translate.test.ts:274 is currently the only unit-level assertion of user-role TEXT_MESSAGE_START; (3) SDK absence mechanically checkable — grep -c "user_input" in the SDK types.d.ts exits 0; §4 row's removal keeps the table consistent with translate.ts, since every other PiEvent case has a documented row.

**principal (job-37.2, verbatim).** Cross-seam reading: the contract is split across three surfaces that do not agree. (1) translate.ts:147 declares {event:"user_input"; messageId; text} as a member of the PiEvent union documented as "normalized pi.event bus shapes per spec §2" — so the module presents user_input as a live SDK shape; translate.ts:532 maps it to TEXT_MESSAGE_START(role user)/CONTENT/END. (2) index.ts:615-619 subscribes deps.on("user_input", …) and forwards it — but deps.on is the permissive on(event: string) on the local ExtensionAPI stand-in (index.ts:34, :672), not the real SDK's typed overload set; the real ExtensionEvent union has no user_input and the ExtensionAPI.on() overloads list message_start/message_update/message_end etc. — no user_input. The producer side can never fire. (3) The real user-role echo producer already exists and is already wired: index.ts:590-594 normalizes message_start to {messageId, role} where role is "assistant" | "user", and translate.ts:380 opens fold bookkeeping with that role; message_update text deltas (translate.ts:396-405) then emit TEXT_MESSAGE_START with st.role. So user_input is not "the user-echo path" — it is a second, dead echo path sitting next to the live one. EV-6 injection bypasses the translator entirely (inject.ts:147-174 consumes inbound AG-UI frames and calls deps.sendUserMessage; the echo comes back through the real SDK's message_start/message_update, not through any user_input PiEvent). The §4 table (PI-SPEC.md:89 and :98) names message_update as "streaming assistant reply" and names "user input (from a client)" as the producer of role-user TEXT_MESSAGE_START — i.e. the table attributes the user echo to the dead event and does not name message_start at all. The real SDK does have events that carry user text — InputEvent {type:"input"; text; source; streamingBehavior?} and BeforeAgentStartEvent {type:"before_agent_start"; prompt} — but neither has the {messageId, text} shape the dead mapping models, and the repo subscribes to neither. The dead user_input shape matches no real event: not a faithful stub of input (no messageId) and not the live message_start path (which carries message, per the real MessageStartEvent). Blind spots: the index.ts wiring view cannot see that forward({event:"user_input"}) is the only thing keeping the case reachable and that the permissive stand-in hides that the real SDK has no such event; the translate.ts view cannot see that no producer can emit the union member, nor that the message_start role path already carries user role (the case would double-emit if anyone ever wired it); the §4 spec view cannot see that its "user input (from a client)" row names a producer that exists only in a local union while the actual role-carrying event (message_start) is unnamed in the table. Reframe: removal is correct, but the card's remove-vs-annotate framing is one notch too narrow — deleting the user_input case alone still leaves the §4 table attributing the user echo to the wrong producer, because the real producer (message_start, role user|assistant) has no row. Concrete design: (1) remove user_input from the PiEvent union (translate.ts:147) and its switch case (:532); (2) remove the deps.on("user_input", …) subscription (index.ts:615-619) — forced anyway, since with the union member gone tsc --noEmit rejects forward({event:"user_input"}); pre-clears the exact subscription FLLWUP-9's typed on() would reject; (3) delete the translate.test.ts user input → TEXT_MESSAGE_* test and the user_input harness emissions in test/index.test.ts (S-O2 step 6 and the incidental one in the EV-8 runId test); (4) in §4, delete the "user input (from a client)" row and amend the message row (line 89) so it names message_start + message_update text deltas and states the role comes from the message (user or assistant) — replacing the dead row with the live producer, not just erasing it. Retention (annotate + keep) is strictly worse: two artifacts describing the same user-echo contract — a dead user_input row and a live message_start path — precisely the two-sources-of-truth hazard this seat exists to name. Testable claims: (1) translate([message_start role user, message_update text delta, message_end]) yields TEXT_MESSAGE_START {messageId, role:"user"} then CONTENT then END — the contract the §4 table must document; if it fails, the removal argument is wrong; (2) after removing user_input from PiEvent, bunx tsc --noEmit must fail until index.ts:615-619 is deleted — proving the subscription was the mirror dead code on the producer side of the seam; (3) post-reconciliation invariant: every case in translateLive's switch has a §4 row, and every §4 row names a PiEvent member (or an annotated non-member) — grep for user_input across the mapping/subscription/table positions returns nothing, and §4 line 89 must name message_start.

### Round outcome (facilitator record)

Exchange stopped after 1 round; positions stabilized (≤3 cap not approached). Both seats independently converged on: **remove** the entire user_input strand, and **reconcile §4 by naming the real producer** (message_start role user) rather than merely erasing the row — i.e. the agreed design exceeds the card's binary (remove-vs-annotate pair) into "remove the dead mapping AND fix the table to document the live user-role path". Both seats filed the same replacement-unit-test claim for user-role TEXT_MESSAGE_START via message_start (a coverage-preserving test shipping with the removal, passing on current code). Both seats state tsc forces the index.ts subscription removal once the union member is gone. No residual disagreement between seats. The §4 producer-substitution (amending the message row to name message_start) is a spec correction riding the PR as a facilitator-authored evidence-cited amendment per the standing precedent, and is required by the card's own acceptance ("the §4 table and translate.ts agree").
