---
type: spec
card: FLLWUP-6
epic: EPIC-1
title: "Remove the dead user_input PiEvent strand and reconcile §4 with the live message lifecycle"
created: 2026-09-01
status: settled
---

# FLLWUP-6 design — remove the dead `user_input` strand; document the live message boundary events

This spec writes up the FLLWUP-6 design as settled by the Council's capped
deliberation (steps 2–6) and the binding product-owner ruling of 2026-09-01
(message_end §4 coverage form — Form (a), its own §4 row). It is the sole
handoff to the owner. Nothing in steps 2–6 is reopened; the ruling resolves
what the deliberation left open, and this document folds it in.

An owner reading only this file must implement one design, not two. Where the
deliberation settled a thing, that settlement is stated without alternatives.

## Goal (unchanged)

Remove the dead `user_input` PiEvent strand in full, so `translate.ts` carries
no mapping the real pi SDK never emits; reconcile the §4 table with the live
message lifecycle (message_start / message_update / message_end) so the module
and the spec agree on which events are mapped.

The deliberation chose **removal** over annotation: the strand is dead in the
live path (the installed SDK's `ExtensionEvent` union and typed `on()`
overloads contain zero `user_input` occurrences), and retention would leave a
type-level lie plus a §4 row whose mechanism description is false. Retention
also preconditions a trap: the natural next step for a reader — wiring the
real SDK's `InputEvent {type, text, source, streamingBehavior?}` (no
`messageId`) onto the `{messageId, text}` case — does not fit the shape.

## Scope

IN SCOPE, in full:

1. Delete the entire `user_input` strand (source, subscription, tests, §4 row).
2. Amend the §4 message row (PI-SPEC.md:89) to name `message_start` +
   `message_update` text deltas, with role from the message (user or
   assistant).
3. Add an explicit §4 row for `message_end` (ruling, Form (a)) adjacent to the
   message row, naming the `message_end` pi event and its `TEXT_MESSAGE_END`
   AG-UI counterpart, in the same row-shape the rest of the §4 table uses.
4. Ship a replacement coverage unit test proving user-role `TEXT_MESSAGE_START`
   survives the deletion (message_start role user → message_update delta →
   message_end ⇒ START/CONTENT/END).

OUT OF SCOPE:

- The `ui.confirm` / `ui_prompt_start` deadness (row 8 names events with no
  live SDK presence) — FLLWUP-5 scope, fenced by the Skeptic; not this card.
- The FLLWUP-9 typed-`on()` bridge. Deleting the `user_input` subscription
  pre-clears the one subscription FLLWUP-9's typed `on()` would reject; the
  bridge itself is a separate card.
- `inject.ts` — contains zero `user_input` references; untouched.

## 1. Strand deletion — exact positions

### 1.1 `src/translate.ts`

- **PiEvent union** — remove the final member
  `| { event: "user_input"; messageId: string; text: string };` (line 147).
  The union's closing `;` becomes the end of the `session_info_changed`
  member's line.
- **`translateLive` switch** — remove the `case "user_input":` block (lines
  532–537), including its comment line `// Injected locally, then echoed like
  any other message — role "user".` and the three pushes it makes.

### 1.2 `index.ts` — the subscription block

Remove the `deps.on("user_input", (ev) => { … });` block (lines 615–619) in
full — the subscription **and** the `forward({ event: "user_input",
messageId: e.messageId, text: e.text })` call it makes. Note for the owner:
removing the union member alone makes `tsc --noEmit` fail at the `forward`
call (TS2322, `event: "user_input"` no longer assignable to `PiEvent`), but
does **not** fail at the `deps.on("user_input", …)` line itself (`deps.on` is
the permissive `on(event: string)` stand-in). Deleting the whole block is
still required: the subscription is the producer-side mirror of the dead
event and would be the exact line FLLWUP-9's typed `on()` rejects. This is a
semantic cleanup the settled design performs in full.

### 1.3 Tests

- `test/translate.test.ts` — delete the whole test
  `test("user input → TEXT_MESSAGE_* with role 'user'", …)` (lines 268–278).
- `test/index.test.ts:555-557` — delete the entire step-6 block of that harness test: the comment `// 6: user_input →
  TEXT_MESSAGE_* role user`, the `userStartBefore` capture, the emission, the wait, and the assertions — exactly this
  block:
  ```ts
  // 6: user_input → TEXT_MESSAGE_* role user
  const userStartBefore = types().filter((t) => t === "TEXT_MESSAGE_START").length;
  h.emit("user_input", { event: "user_input", messageId: "m3", text: "hi" });
  await h.waitFor(() => types().filter((t) => t === "TEXT_MESSAGE_START").length === userStartBefore + 1);
  const us = h.relay.received.filter((e) => e.frame?.type === "TEXT_MESSAGE_START").at(-1)!.frame as { role?: string };
  expect(us.role).toBe("user");
  ```
  Steps 5 and 7 of that test (ui.confirm, ui_prompt_end) remain, renumbered
  if the owner prefers; renumbering is cosmetic and must not change
  assertions.
- `test/index.test.ts:716` — delete
  `h.emit("user_input", { event: "user_input", messageId: "m1", text: "hi" });`
  from the fold/runId test ("fresh per agent_start cycle, distinct across
  cycles, thread through the fold"). The surrounding
  `h.emit("message_start", { event: "message_start", messageId: "m1", role:
  "user" })` and `h.emit("message_end", …)` lines remain — behaviorally inert
  without a text delta (no `TEXT_MESSAGE_*` frames fire on a textless
  message), and the test's assertions (distinct runIds across cycles,
  `run1 === "uuid-1"`) do not touch user_input frames. No assertion changes
  are required in this test.

### 1.4 `docs/PI-SPEC.md` §4 table

Delete the row (line 98):

```
| user input (from a client) | `TEXT_MESSAGE_START` (role `user`) | injected locally, then echoed onto the wire like any other message |
```

As amended below, every surviving row either names a pi event the module
maps or is a pre-existing FLLWUP-5-scope row (`ui.confirm` / `ui_prompt_*`)
left untouched by this card, and every `translateLive` case has a row.

## 2. §4 message lifecycle rows (amended + new)

### 2.1 Amend the message row (line 89)

Replace:

```
| `message_update` (`assistantMessageEvent` text deltas) | `TEXT_MESSAGE_CONTENT` (+ `TEXT_MESSAGE_START`/`END` around the message) | streaming assistant reply |
```

with:

```
| `message_start` + `message_update` (`assistantMessageEvent` text deltas) | `TEXT_MESSAGE_START` / `TEXT_MESSAGE_CONTENT` | role comes from the message (user or assistant); `TEXT_MESSAGE_START` fires on the first text delta, deltas stream as `TEXT_MESSAGE_CONTENT` |
```

This names the real producer of user-role `TEXT_MESSAGE_START` — the
`message_start` event carrying `role: "assistant" | "user"` — replacing the
deleted "user input" row's attribution of the user echo to the dead event.
The role-user rendering path it documents is verified green on current code
(Skeptic probe 1, step 4): `translate([message_start role user,
message_update text delta, message_end])` ⇒ `TEXT_MESSAGE_START
{role:"user"}`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`, in that order.

### 2.2 Add the `message_end` row (ruling Form (a))

Insert, adjacent to (immediately after) the amended message row, in the same
row-shape (three cells: pi surface | AG-UI event | Notes):

```
| `message_end` | `TEXT_MESSAGE_END` | symmetric close of the message framing pair; emitted once the message has streamed text (`translate.ts` fires it only for a message whose `message_start`/`message_update` opened text) |
```

Binding content per the ruling: the row names the `message_end` pi event and
its `TEXT_MESSAGE_END` AG-UI counterpart. The Notes cell is confined to
factual behavior of the existing mapper (no design invention).

Resulting §4 row set (11 rows): agent_start/agent_settled; the amended
message row; the new message_end row; thinking content in message_update;
toolcall events in message_update; tool_execution_start/_update/_end;
tool_result; turn_start/turn_end; ui.confirm/approval prompts; context/
compaction; model_select/thinking_level_select/session_info_changed. The
"user input (from a client)" row is gone.

## 3. Replacement coverage unit test

Delete the user_input unit test (§1.3) and add, in `test/translate.test.ts`:

```ts
test("user role: message_start → message_update delta → message_end renders TEXT_MESSAGE_START/CONTENT/END", () => {
  const frames = runSequence(
    [
      { event: "message_start", messageId: "user-1", role: "user" },
      { event: "message_update", messageId: "user-1", events: [{ kind: "text", delta: "hel" }] },
      { event: "message_update", messageId: "user-1", events: [{ kind: "text", delta: "lo" }] },
      { event: "message_end", messageId: "user-1" },
    ],
    { sessionId: "s1", runId: "r1" }
  );
  expect(frames).toEqual([
    { type: "TEXT_MESSAGE_START", messageId: "user-1", role: "user" },
    { type: "TEXT_MESSAGE_CONTENT", messageId: "user-1", delta: "hel" },
    { type: "TEXT_MESSAGE_CONTENT", messageId: "user-1", delta: "lo" },
    { type: "TEXT_MESSAGE_END", messageId: "user-1" },
  ]);
});
```

The fixture shape above matches the `AssistantMessageEvent` text variant
(`{kind:"text", delta}`) and the `runSequence` helper conventions of the
existing tests in that file. This is coverage-preserving
in the precise sense the deliberation required: it is the only remaining
unit-level assertion of user-role `TEXT_MESSAGE_START` after the deleted
test's assertion (translate.test.ts:274) is gone, and it passed
on the current code before the deletion (Skeptic probe 1, closed-green).

## 4. Spec amendment on the PR

The §4 amendments of §2 ride the PR as facilitator-authored, evidence-cited
spec corrections (standing precedent: EV-1 Q3, FLLWUP-5). Evidence cited: the
installed SDK's event surface (no `user_input`; `message_start`/
`message_update`/`message_end` with messageId), Skeptic probe 1 (role-user
path green), probe 3 (message_start/message_end live cases with no rows —
the gap this amendment closes), and the product-owner ruling of 2026-09-01
(Form (a)). The card's own acceptance criterion ("the §4 table and
translate.ts agree on which events are mapped") requires this amendment; it
is not discretionary.

## 5. Acceptance

- No `user_input` occurrence anywhere in `src/`, `index.ts`, `test/`, or
  `docs/PI-SPEC.md` — the mapped-event surfaces and the §4 table agree.
- Every `translateLive` case label (17 after deletion) has a §4 row, and
  every §4 row names a pi event the module maps — the two existing
  FLLWUP-5-scope rows (`ui.confirm`/`ui_prompt_*`, `session_compact`)
  are untouched with their pre-existing annotations. In particular
  `message_start` (row 2 amendment) and
  `message_end` (row 3, new) are no longer row-less live cases.
- User-role `TEXT_MESSAGE_START` unit coverage survives (§3).
- `bunx tsc --noEmit` exit 0; `bun test` exit 0 with the full suite green
  (155 baseline; one test deleted and one added in translate.test.ts, one
  harness step-6 block and one fixture line removed in index.test.ts).

## Test plan

- The §3 replacement unit test (green on pre-change code; stays green after).
- Full suite green: `bun test` exit 0 — the deletions in index.test.ts must
  not leave dangling assertions or unused locals.
- `bunx tsc --noEmit` exit 0 — proves the union-member removal and the
  subscription-block removal are type-coherent (the `forward` call at the
  deleted subscription was the only `user_input`-typed reference the
  compiler could see).
- Mechanical sweep: `grep -rn "user_input" src index.ts test docs` returns
  nothing. (The standalone word `user input` may still appear in prose such
  as EV-6 copy or comments; the underscore-string `user_input` must be fully
  gone.)

## Gates

- `bunx tsc --noEmit` exit 0.
- `bun test` exit 0, full suite green.
- No Mongo, no boot gate for this card.

## Non-goals (closed by ruling / deliberation)

- No dead-code annotation retained anywhere — removal, not documentation, is
  the settled form; the one-sentence-annotation option the card's `goal`
  named was rejected by both independent positions (two-sources-of-truth
  hazard).
- No `message_end` footnote/implication form — the ruling chose its own §4
  row (Form (a)); the row is a table row, not a note inside the amended
  message row.
- No change to the `ui.confirm`/`ui_prompt_start` row (FLLWUP-5 scope).
- No lifecycle or inject changes — the strand is confined to the mapped-event
  surface, the subscription block, the tests, and the §4 table.