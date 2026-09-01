# FLLWUP-6 Implementation Plan — remove the dead `user_input` PiEvent strand; reconcile §4 with the live message lifecycle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the entire dead `user_input` PiEvent strand (source union member, `translateLive` case, `index.ts` subscription, test coverage, §4 row) and amend `docs/PI-SPEC.md` §4 so the module and the spec agree on which events are mapped — naming `message_start` + `message_update` as the real producers of user-role `TEXT_MESSAGE_START`, and giving `message_end` its own §4 row (product-owner ruling, Form (a)).

**Architecture:** The strand is confined to five surfaces: `src/translate.ts` (PiEvent union member + switch case), `index.ts` (the `deps.on("user_input", …)` subscription that forwards onto the live wire), `test/translate.test.ts` (unit test), `test/index.test.ts` (one harness step-6 block + one fixture line), and `docs/PI-SPEC.md` §4 (one row). Removal is behaviorally inert — nothing live ever emits `user_input` (zero occurrences in the installed pi SDK's `ExtensionEvent` union / typed `on()` overloads). A replacement unit test (message_start role user → message_update text deltas → message_end ⇒ `TEXT_MESSAGE_START {role:"user"}` / CONTENT / END) preserves the only remaining user-role `TEXT_MESSAGE_START` coverage; by deliberation mandate it is verified **green on the pre-change code** (it asserts existing live-path behavior — no new production behavior is introduced, so there is no red phase; the deletion tasks gate on the full suite staying green).

**Tech Stack:** Bun, TypeScript (native `bun test`, `bunx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-09-01-FLLWUP-6-design.md` — the sole handoff, one design, nothing to re-derive. `council/cards/FLLWUP-6.md` carries the intent/acceptance + full deliberation record.

## Global Constraints

- **No `user_input` occurrence anywhere in `src/`, `index.ts`, `test/`, or `docs/PI-SPEC.md`** after this change (spec §5 acceptance, mechanical sweep).
- Gates: `bunx tsc --noEmit` exit 0; `bun test` exit 0 with the full suite green (155 baseline; net-zero test-count change in `translate.test.ts`; `index.test.ts` loses fixture lines only). No Mongo, no boot gate for this card.
- The §4 amendments ride the PR as facilitator-authored, evidence-cited spec corrections (standing precedent EV-1 Q3 / FLLWUP-5) — part of the implementation, not an afterthought.
- The replacement unit test MUST pass on the pre-change code first (spec §3, Skeptic probe 1 closed-green), then stay green after the deletions — this is the coverage-preserving property.
- OUT OF SCOPE (do not touch): `ui.confirm`/`ui_prompt_start` deadness (FLLWUP-5), the FLLWUP-9 typed-`on()` bridge, `inject.ts` (zero `user_input` references), the `ui_prompt_end` ↔ `turn_start`/`turn_end` rows, and any other §4 rows.
- No dead-code annotation retained anywhere — removal, not documentation, is the settled form.
- Commits follow Conventional Commits (`<type>(<scope>): <description>`), scopes per AGENTS.md. The sweep string `user_input` may legitimately appear in this plan file and in dated historical council records under `docs/superpowers/` — the acceptance surface is `src/`, `index.ts`, `test/`, `docs/PI-SPEC.md`; historical records are immutable and not part of it.
- Work happens in the isolated worktree `.worktrees/flluwp-6-remove-user-input` on branch `flluwp-6-remove-user-input`, never on `main` directly. Push a branch and open a PR.

---

### Task 1: Replacement coverage unit test (green on pre-change code)

**Files:**
- Modify: `test/translate.test.ts` — insert the replacement test directly AFTER the `"user input → TEXT_MESSAGE_* with role 'user'"` test block (which still exists at this point; it is deleted in Task 2). The replacement test uses the `runSequence` helper already imported and used by every other test in the file.

**Interfaces:**
- Consumes: `runSequence(events: PiEvent[], { sessionId, runId }) → AgUiFrame[]` (existing helper in `test/translate.test.ts`); `PiEvent` `message_start` (`{event, messageId, role: "assistant" | "user"}`), `message_update` (`{event, messageId, events: AssistantMessageEvent[]}` with text variant `{kind: "text", delta}`), `message_end` (`{event, messageId}`).
- Produces: `test("user role: message_start → message_update delta → message_end renders TEXT_MESSAGE_START/CONTENT/END", …)` — the sole surviving unit assert of user-role `TEXT_MESSAGE_START`.

- [ ] **Step 1: Write the test** — append after the current `"user input → …"` test (line ~278):

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

- [ ] **Step 2: Run it to verify GREEN on pre-change code**

Run: `bun test test/translate.test.ts 2>&1 | tail -5` (tree still has the old `user_input` test and both source cases; suite is 156 tests here)
Expected: PASS — the new test passes against the existing live-path mapper (`message_start` opens bookkeeping at translate.ts:380, first text delta fires `TEXT_MESSAGE_START` with `st.role` at :396-405, `message_end` fires `TEXT_MESSAGE_END` at :432). This is the deliberation-mandated coverage proof; there is NO red phase for this test because it asserts existing behavior — deleting the dead strand introduces no new production code.

- [ ] **Step 3: Commit**

```bash
git add test/translate.test.ts
git commit -m "test(translate): cover user-role TEXT_MESSAGE_START via message_start→update→end"
```

### Task 2: Delete the dead test coverage

**Files:**
- Modify: `test/translate.test.ts:268-278` — delete the whole `"user input → TEXT_MESSAGE_* with role 'user'"` test (the replacement test from Task 1 stays).
- Modify: `test/index.test.ts:555-560` — delete the entire step-6 block of the harness test: the comment, the `userStartBefore` capture, the emission, the wait, and the two assertion lines. Steps 5 and 7 (ui.confirm, ui_prompt_end) remain; renumbering is cosmetic and NOT done.
- Modify: `test/index.test.ts:716` — delete the single line `h.emit("user_input", { event: "user_input", messageId: "m1", text: "hi" });` from the EV-8 runId test. The surrounding `h.emit("message_start", … role: "user")` and `h.emit("message_end", …)` lines remain — behaviorally inert without a text delta (no `TEXT_MESSAGE_*` frames fire on a textless message), and the test's assertions (distinct runIds across cycles, `run1 === "uuid-1"`) do not touch user_input frames. NO assertion changes.

- [ ] **Step 1: Delete the three blocks**

`test/translate.test.ts` — remove:

```ts
  test("user input → TEXT_MESSAGE_* with role 'user'", () => {
    const frames = runSequence([{ event: "user_input", messageId: "user-1", text: "hello" }], {
      sessionId: "s1",
      runId: "r1",
    });
    expect(frames).toEqual([
      { type: "TEXT_MESSAGE_START", messageId: "user-1", role: "user" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "user-1", delta: "hello" },
      { type: "TEXT_MESSAGE_END", messageId: "user-1" },
    ]);
  });
```

`test/index.test.ts` — remove:

```ts
    // 6: user_input → TEXT_MESSAGE_* role user
    const userStartBefore = types().filter((t) => t === "TEXT_MESSAGE_START").length;
    h.emit("user_input", { event: "user_input", messageId: "m3", text: "hi" });
    await h.waitFor(() => types().filter((t) => t === "TEXT_MESSAGE_START").length === userStartBefore + 1);
    const us = h.relay.received.filter((e) => e.frame?.type === "TEXT_MESSAGE_START").at(-1)!.frame as { role?: string };
    expect(us.role).toBe("user");
```

`test/index.test.ts` — remove the single line:

```ts
    h.emit("user_input", { event: "user_input", messageId: "m1", text: "hi" });
```

- [ ] **Step 2: Run full suite**

Run: `bun test 2>&1 | tail -8`
Expected: 155 pass / 0 fail (back to baseline count: −1 from translate.test.ts, −0 from index.test.ts which loses fixture lines only); expect() count drops by exactly 1 (the step-6 `us.role` assertion — 870 → 869).

- [ ] **Step 3: Commit**

```bash
git add test/translate.test.ts test/index.test.ts
git commit -m "test: remove dead user_input test coverage"
```

### Task 3: Delete the source strand (union member + case + subscription)

**Files:**
- Modify: `src/translate.ts:147` — remove the final union member.
- Modify: `src/translate.ts:532-537` — remove the `case "user_input":` block including its comment line.
- Modify: `index.ts:615-619` — remove the `deps.on("user_input", …)` subscription block in full (subscription + `forward({ event: "user_input", … })` call). Note: both files must be deleted in this same task/commit — removing only the union member makes `tsc --noEmit` fail at the `forward` call (TS2322) until the subscription is gone (Skeptic probe 2); deleting both together keeps every commit tsc-green.

- [ ] **Step 1: Remove the union member**

`src/translate.ts` — change:

```ts
  | { event: "session_info_changed"; info: unknown }
  | { event: "user_input"; messageId: string; text: string };
```

to:

```ts
  | { event: "session_info_changed"; info: unknown };
```

- [ ] **Step 2: Remove the `translateLive` case**

`src/translate.ts` — change:

```ts
    case "user_input":
      // Injected locally, then echoed like any other message — role "user".
      frames.push({ type: "TEXT_MESSAGE_START", messageId: input.messageId, role: "user" });
      frames.push({ type: "TEXT_MESSAGE_CONTENT", messageId: input.messageId, delta: input.text });
      frames.push({ type: "TEXT_MESSAGE_END", messageId: input.messageId });
      break;

    default:
```

to:

```ts
    default:
```

- [ ] **Step 3: Remove the subscription block**

`index.ts` — change:

```ts
  deps.on("user_input", (ev) => {
    const e = ev as { messageId?: unknown; text?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || typeof e.text !== "string") return;
    forward({ event: "user_input", messageId: e.messageId, text: e.text });
  });
  deps.on("ui_prompt_end", (ev) => {
```

to:

```ts
  deps.on("ui_prompt_end", (ev) => {
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit; echo "TSC_EXIT=$?"`
Expected: exit 0 — the deleted subscription's `forward` was the only `user_input`-typed reference the compiler could see; the exhaustive switch's `default:` guard absorbs the removed case.

- [ ] **Step 5: Full suite**

Run: `bun test 2>&1 | tail -8`
Expected: 155 pass / 0 fail — the deletions are type-coherent and no live behavior changed (removal is behaviorally inert).

- [ ] **Step 6: Commit**

```bash
git add src/translate.ts index.ts
git commit -m "fix(translate): remove dead user_input PiEvent strand and subscription"
```

### Task 4: Reconcile §4 — delete the user-input row, amend the message row, add the `message_end` row

**Files:**
- Modify: `docs/PI-SPEC.md` §4 table (rows 88-98).

- [ ] **Step 1: Amend the message row (line 89)**

Change:

```md
| `message_update` (`assistantMessageEvent` text deltas) | `TEXT_MESSAGE_CONTENT` (+ `TEXT_MESSAGE_START`/`END` around the message) | streaming assistant reply |
```

to:

```md
| `message_start` + `message_update` (`assistantMessageEvent` text deltas) | `TEXT_MESSAGE_START` / `TEXT_MESSAGE_CONTENT` | role comes from the message (user or assistant); `TEXT_MESSAGE_START` fires on the first text delta, deltas stream as `TEXT_MESSAGE_CONTENT` |
```

- [ ] **Step 2: Insert the `message_end` row immediately after the amended message row** (product-owner ruling, Form (a)):

```md
| `message_end` | `TEXT_MESSAGE_END` | symmetric close of the message framing pair; emitted once the message has streamed text (`translate.ts` fires it only for a message whose `message_start`/`message_update` opened text) |
```

- [ ] **Step 3: Delete the user-input row (line 98)**

Delete:

```md
| user input (from a client) | `TEXT_MESSAGE_START` (role `user`) | injected locally, then echoed onto the wire like any other message |
```

- [ ] **Step 4: Verify the resulting §4 table**

Expected row set (11 rows, in order): `agent_start`/`agent_settled`; amended message row (`message_start` + `message_update`); NEW `message_end` row; thinking content in `message_update`; `toolcall_*` in `message_update`; `tool_execution_*`; `tool_result`; `turn_start`/`turn_end`; `ui.confirm`/approval prompts; `context`/compaction; `model_select`/`thinking_level_select`/`session_info_changed`. The "user input (from a client)" row is gone. Every `translateLive` case label (17 after deletion) has a §4 row; the two FLLWUP-5-scope rows (`ui.confirm`/`ui_prompt_*`, `session_compact`) are untouched.

- [ ] **Step 5: Commit**

```bash
git add docs/PI-SPEC.md
git commit -m "docs(spec): reconcile §4 with live message lifecycle — message_start producer, message_end row, drop user input row"
```

### Task 5: Full gate set, push, PR

- [ ] **Step 1: Typecheck**

Run: `bunx tsc --noEmit; echo "TSC_EXIT=$?"` — expected exit 0.

- [ ] **Step 2: Full test suite**

Run: `bun test 2>&1 | tail -8` — expected 155 pass / 0 fail, 870 expect (net: +1 replacement × 1 expect, −1 old unit test × 1 expect, −1 step-6 assertion × 1 expect → 869; record verbatim what actually prints).

- [ ] **Step 3: Mechanical sweep**

Run: `grep -rn "user_input" src index.ts test docs/PI-SPEC.md` and `echo "EXIT=$?"` — expected `EXIT=1` (no matches). Also run the card's literal full-docs form `grep -rn "user_input" src index.ts test docs` and record honestly which hits remain: dated historical council records under `docs/superpowers/` (EV-6/FLLWUP-5 plans+specs, 2026-08-31) plus this plan file — all out of the acceptance surface (spec §5 scopes the sweep to `src/`, `index.ts`, `test/`, `docs/PI-SPEC.md`); historical records are immutable and must not be rewritten.

- [ ] **Step 4: Final commit if any file changed since last commit** (should be none; else amend/commit).

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin flluwp-6-remove-user-input
gh pr create --title "fix(translate): remove dead user_input strand; reconcile PI-SPEC §4 with live message lifecycle" --body "Closes FLLWUP-6 ..." --base main
gh pr view --json number,headRefOid -q '{number,headRefOid}'
```

Expected: PR opened against `main`, head SHA recorded for the report.