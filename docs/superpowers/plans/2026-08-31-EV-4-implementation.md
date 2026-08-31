# EV-4 — Pure pi-to-AG-UI Translation Mapper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development (implement each task test-first). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `src/translate.ts` — the pure pi-event / JSONL-entry → AG-UI frame mapper per design spec §1–§2 — land the repo's first real test suite under `test/`, and apply the §4 amendment to `docs/PI-SPEC.md` verbatim.

**Architecture:** A pure state-threading fold `translate(input, state) → { frames, state }` with no I/O, no socket/session/transport imports, no `crypto.randomUUID`/`Date.now`/`Math.random`, no hidden closure. Input shapes are normalized pi-event and JSONL-entry unions declared locally in `translate.ts` (the repo has no AG-UI SDK dependency; frame types are declared locally). The fold threads `TranslateState` (sessionId, runId, openMessages, eventOrdinal) so START/END framing closes correctly across calls and replay is deterministic. Both the live path (EV-8) and the replay path (EV-5) import this one module unchanged.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `bundler` resolution), Bun (`bun test`, `bunx tsc --noEmit`), git worktree isolation.

**Spec:** `docs/superpowers/specs/2026-08-31-EV-4-design.md` — the ONLY authoritative handoff. This plan argues from that spec; executors read the spec's §2 mapping table, §3 fixture contract, §4 verbatim replacement blocks, and §5 gate table.

## Global Constraints

- **Pure fold (binding, §1.1):** `translate(input: PiEvent | JsonlEntry, state: TranslateState): { frames: AgUiFrame[]; state: TranslateState }`. No I/O, no socket/session references, no hidden closure, no `crypto.randomUUID`, no `Date.now`, no `Math.random`, no side effects on import. `translate.ts` imports type definitions only.
- **runId is input-driven (§1.4, ruling Q2):** translate NEVER mints a run id. It reads `state.runId` and emits it on `RUN_STARTED`/`RUN_FINISHED`. threadId = `state.sessionId`. stepName constant `"turn"`.
- **CUSTOM frame shape (§1.3, converged):** `{ type: "CUSTOM", name: "pi.<category>", value: { pi: <raw pi event name>, data: <semantic payload> } }`. `name` is the sole dispatch key. No second wire format.
- **Corrected rows (ruling Q1, binding):** thinking → `REASONING_MESSAGE_*` (never `THINKING_TEXT_MESSAGE_*`); tool generation lane (`message_update.assistantMessageEvent` `toolcall_start`/`toolcall_delta`/`toolcall_end`) → `TOOL_CALL_START`/`TOOL_CALL_ARGS`/`TOOL_CALL_END`; `tool_execution_*` → `CUSTOM` `pi.tool.*` (never `TOOL_CALL_*`); `TOOL_CALL_RESULT.content` flattened to a `string` from `(TextContent|ImageContent)[]`.
- **`agent_settled` → `RUN_FINISHED`** — never `agent_end`, no `RUN_ERROR` row.
- **Touch list (exhaustive):** `src/translate.ts` (new), `test/` fixtures (new), `docs/PI-SPEC.md` §4 (rows 4/5/6 + closing paragraph only), `docs/superpowers/plans/2026-08-31-EV-4-implementation.md` (this plan). Nothing else. No new runtime npm dependencies.
- **Worktree:** `.worktrees/ev-4-translate` on branch `ev-4-translate`, created fresh from `origin/main` (459c9f3). Never commit on `main`. Do NOT use the stale EV-1 worktrees.
- **Gates (§5, all must pass locally in order):** G-1 `bunx tsc --noEmit` (exit 0); G-2 `bun test` (exit 0, tests discovered — this card lands the repo's first real tests); G-3..G-10 §4 greps; G-11..G-14 purity/replay/runId guards. Record every command's real stdout + exit code.

---

### Task 1: Write the failing test suite (RED)

**Files:**
- Create: `test/translate.test.ts` (all fixtures)

**Interfaces:**
- Consumes: nothing (this task only references the module API from the spec's §1/§2 — signature, frame types, event names — it does not import anything real yet).
- Produces: the full fixture suite that Task 4 must make green. This IS the acceptance in executable form (§3). The producer will fail to compile against the missing `src/translate.ts` (RED).

- [ ] **Step 1: Define the expected module API surface (from spec §1/§2)**

The test imports from `../src/translate`:
- `translate(input, state) → { frames, state }`
- `createState({ sessionId, runId })` — a pure factory returning `TranslateState` with `openMessages: new Map()`, `eventOrdinal: 0`.
- A `PiEvent` union, a `JsonlEntry` union, and `AgUiFrame` types.

- [ ] **Step 2: Write the fixture suite**

Write `test/translate.test.ts` covering every §4 row plus the settleable/determinism/purity claims. The reference assertions (exact frames), one representative event per row. See the full test file content in this plan's Task 4 (the test comes first, but the reference frames define the contract).

```ts
import { describe, expect, test } from "bun:test";
import { convert } from "../src/translate";
// NOTE: convert() below is illustrative; the real exported name is
// translate(input, state) → { frames, state } per spec §1.1.
```

- [ ] **Step 3: Confirm it fails**

Run: `bun test` — Expected: RED (fails to resolve/compile `../src/translate`). Record the actual error.

---

### Task 2: Declare the frame + input + state types (first GREEN slice)

**Files:**
- Create: `src/translate.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the exported `AgUiFrame` union, `TranslateState`, `OpenMessageState`, `PiEvent`, `JsonlEntry`, `createState`, and (stub first, then real) `translate`.

- [ ] **Step 1: Write the failing test for the type surface**

```ts
import { createState } from "../src/translate";
test("createState seeds empty fold state", () => {
  const s = createState({ sessionId: "s1", runId: "r1" });
  expect(s.sessionId).toBe("s1");
  expect(s.runId).toBe("r1");
  expect(s.eventOrdinal).toBe(0);
  expect(s.openMessages.size).toBe(0);
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test` — Expected: module-not-found / import error.

- [ ] **Step 3: Declare types + createState only (`translate` remains a stub returning a refused call or empty for now)**

```ts
export type AgUiFrame =
  | RunStartedFrame | RunFinishedFrame
  | StepStartedFrame | StepFinishedFrame
  | TextMessageStartFrame | TextMessageContentFrame | TextMessageEndFrame
  | ReasoningMessageStartFrame | ReasoningMessageContentFrame | ReasoningMessageEndFrame
  | ToolCallStartFrame | ToolCallArgsFrame | ToolCallEndFrame | ToolCallResultFrame
  | CustomFrame;
```

Declare each frame per §2 (fields exactly as the spec enumerates). Declare `TranslateState`, `OpenMessageState`, `createState`, the `PiEvent`/`JsonlEntry` unions. Provide a minimal `translate` that returns `{ frames: [], state }` so the type test can pass while row tests still fail.

- [ ] **Step 4: Verify GREEN for this slice**

Run: `bun test test/translate.test.ts` — Expected: `createState` test passes; row tests RED.

- [ ] **Step 5: Commit**

```bash
git add src/translate.ts test/translate.test.ts
git commit -m "test: seed fold-state types and createState fixture (EV-4)"
```

---

### Task 3: Implement `translate` row-by-row (GREEN), TDD per row

**Files:**
- Modify: `src/translate.ts`

**Interfaces:**
- Consumes: the types from Task 2.
- Produces: the complete pure fold. Each row is added with its own failing test first (below), then the minimal implementation, then re-run.

- [ ] **Step 1: `agent_start` / `agent_settled` → RUN_* (G-14)**

Failing test: `translate({event:"agent_start"}, state)` emits `[{type:"RUN_STARTED", threadId: state.sessionId, runId: state.runId}]`, and `translate({event:"agent_settled"}, state)` emits `RUN_FINISHED` — asserted to be `RUN_FINISHED` (`agent_settled`), never `RUN_ERROR`.

Implement: `RUN_STARTED`/`RUN_FINISHED` from `state.sessionId`/`state.runId`; advance `eventOrdinal` per frame.

- [ ] **Step 2: `turn_start`/`turn_end` → STEP_* (stepName "turn")**

Failing test: each `STEP_STARTED`/`STEP_FINISHED` has `stepName === "turn"`.

- [ ] **Step 3: assistant text + thinking message folding → TEXT_* / REASONING_* (O1)**

Failing tests (split by content-block type):
- `message_start{role:"assistant"}` + `message_update{text}` + `message_end` → `TEXT_MESSAGE_START{messageId,role:"assistant"}` → `TEXT_MESSAGE_CONTENT{messageId,delta}` → `TEXT_MESSAGE_END{messageId}`.
- thinking blocks → `REASONING_MESSAGE_START{messageId:"<assistantId>:think:<contentIndex>",role}` → `REASONING_MESSAGE_CONTENT` → `REASONING_MESSAGE_END`. Assert `frame.type === "REASONING_MESSAGE_START"` etc. (O1 green — never `THINKING_TEXT_MESSAGE_*`).
- A `think,think,text` message_update → `REASONING_MESSAGE_START`/2×`REASONING_MESSAGE_CONTENT`/`REASONING_MESSAGE_END` then `TEXT_MESSAGE_START`/`TEXT_MESSAGE_CONTENT`/`TEXT_MESSAGE_END`.

- [ ] **Step 4: tool generation lane → TOOL_CALL_* (O2)**

Failing tests:
- `toolcall_start{messageId,toolCallId,toolCallName}` → `TOOL_CALL_START{toolCallId,toolCallName,parentMessageId: messageId}`.
- `toolcall_delta{toolCallId,delta}` → `TOOL_CALL_ARGS{toolCallId,delta}`.
- `toolcall_end{toolCallId}` → `TOOL_CALL_END{toolCallId}`.
- Assert `parentMessageId === requesting assistant messageId`.

- [ ] **Step 5: `tool_execution_*` → CUSTOM `pi.tool.*`, never TOOL_CALL_* (O2)**

Failing tests:
- `tool_execution_start/update/end` → only `CUSTOM` with `name` starting `pi.tool`.
- `tool_execution_update{args,partialResult}` → NO `TOOL_CALL_*` frame; value has `pi` and `data` keys.

- [ ] **Step 6: `tool_result` message → TOOL_CALL_RESULT with flattened content (O3)**

Failing test: content blocks `(TextContent|ImageContent)[]` flatten to a single `string` (text concatenated, images skipped); assert `typeof frame.content === "string"`, in assistant source order.

- [ ] **Step 7: CUSTOM row families + CUSTOM shape invariant**

Failing tests:
- `ui.confirm` → `CUSTOM` `name:"pi.human_input"`, `value:{pi:"ui.confirm", data:{promptKind, prompt, schemaVersion:1, promptId}}`.
- `session_compact` → `CUSTOM` `pi.context.*`; `model_select`/`thinking_level_select`/`session_info_changed` → `CUSTOM` `pi.session.*`.
- Invariant: every `CUSTOM` frame has `type==="CUSTOM"`, `name` starting `pi.`, and `value` with keys `pi` and `data`.

- [ ] **Step 8: user input → TEXT_MESSAGE_* role "user"**

Failing test: user input → `TEXT_MESSAGE_START{role:"user"}` → `TEXT_MESSAGE_CONTENT` → `TEXT_MESSAGE_END`.

- [ ] **Step 9: replay determinism (G-13) + runId input-driven (G-14)**

Failing tests:
- Translating the same entry sequence twice → byte-identical frames and identical correlation ids.
- Threading a provided `runId`/`sessionId` yields expected `RUN_*`; one `RUN_STARTED`/`RUN_FINISHED` pair per runId; no `RUN_ERROR`.
- `JsonlEntry` messages → `messageId "msg-<entryId>"`, deterministic toolCallId.

- [ ] **Step 10: purity guards (G-11, G-12)**

Static guard test: read `src/translate.ts` source, assert it contains no `crypto.randomUUID`/`Date.now`/`Math.random`, no `from "..."` importing tunnel/transport/session modules. Import guard: `import("../src/translate")` has no side effects (module-level `let` unchanged).

- [ ] **Step 11: Commit (once all row tests green)**

```bash
git add src/translate.ts test/translate.test.ts
git commit -m "feat(translate): pure pi-to-AG-UI mapping fold (EV-4)"
```

---

### Task 4: Apply the §4 amendment to `docs/PI-SPEC.md` (verbatim, per §4)

**Files:**
- Modify: `docs/PI-SPEC.md` — §4 only (rows 3, 5, 6 + closing paragraph). Nothing else.

**Interfaces:**
- Consumes: the verbatim replacement blocks in design spec §4.1/§4.2/§4.3.
- Produces: G-3..G-10.

- [ ] **Step 1: Replace §4.1 (thinking row)**

Replace the current row text
```
| thinking content in `message_update` | `THINKING_TEXT_MESSAGE_*` | reasoning pane |
```
with the §4.1 verbatim block (see spec page — the `REASONING_MESSAGE_*` row).

- [ ] **Step 2: Replace §4.2 (tool rows)**

Replace the current two rows
```
| `tool_execution_start` / `_update` / `_end` | `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END` | rich tool UI |
| `tool_result` message events | `TOOL_CALL_RESULT` | final result, assistant source order |
```
with the §4.2 three-row verbatim block (toolcall generation lane row, tool_execution→CUSTOM row, tool_result flatten row).

- [ ] **Step 3: Replace §4.3 (CUSTOM closing paragraph)**

Replace the current closing paragraph
```
pi concepts AG-UI cannot express are **always** `CUSTOM` events — never a second
wire format. `CUSTOM` payloads carry `{ pi: <event-name>, data: … }`.
```
with the §4.3 verbatim paragraph (the `{ type: "CUSTOM", name: "pi.<category>", value: {...} }` shape).

- [ ] **Step 4: Verify blast radius (G-10)**

Run `git diff docs/PI-SPEC.md | grep -E '^@@'` — hunks confined to §4, no other § touched.

- [ ] **Step 5: Commit**

```bash
git add docs/PI-SPEC.md
git commit -m "docs: amend PI-SPEC §4 per product-owner ruling Q1 (S1/S2/S8 evidence)"
```

---

### Task 5: Full gate sweep (G-1…G-14) — hard stop

**Files:** none modified.

- [ ] **Step 1: Spec amendment greps (G-3..G-9)**

```bash
grep -n 'REASONING_MESSAGE' docs/PI-SPEC.md        # ≥1 hit in §4 (G-3)
grep -n 'THINKING_TEXT_MESSAGE' docs/PI-SPEC.md    # exit 1 (G-4)
grep -n 'toolcall_delta' docs/PI-SPEC.md           # ≥1 hit in §4 (G-5)
grep -n 'pi.tool' docs/PI-SPEC.md                  # ≥1 hit in §4 (G-6)
grep -nE 'content.*flattened to a string' docs/PI-SPEC.md   # ≥1 hit in §4 (G-7)
grep -n ':think:<contentIndex>' docs/PI-SPEC.md   # ≥1 hit in §4 (G-8)
grep -n 'name.*sole dispatch key' docs/PI-SPEC.md  # ≥1 hit in §4 (G-9)
git diff docs/PI-SPEC.md | grep -E '^@@'           # hunks in §4 only (G-10)
```

Record every stdout + exit code. A failing grep is a hard stop: fix the doc block, re-run.

- [ ] **Step 2: Purity guards (G-11, G-12)**

```bash
grep -nE 'crypto\.randomUUID|Date\.now|Math\.random' src/translate.ts   # exit 1
grep -nE 'from ".*(tunnel|transport|@pi-.*session)"' src/translate.ts   # exit 1
```

- [ ] **Step 3: Typecheck (G-1)**

```bash
bunx tsc --noEmit; echo "G-1 exit: $?"
```
Expected: exit 0, no output.

- [ ] **Step 4: Tests (G-2, G-13, G-14)**

```bash
bun test; echo "G-2 exit: $?"
```
Expected: exit 0, all `test/*.test.ts` discovered and green (replay-determinism G-13 and agent_settled→RUN_FINISHED G-14 inside the suite).

- [ ] **Step 5: Confirm no other file changed**

```bash
git status --short
git diff --stat
```
Expected: only `src/translate.ts`, `test/translate.test.ts`, `docs/PI-SPEC.md`, this plan.

---

### Task 6: Commit the plan, push, open PR (no merge)

- [ ] **Step 1: Commit the plan**

```bash
git add docs/superpowers/plans/2026-08-31-EV-4-implementation.md
git commit -m "docs: add EV-4 implementation plan"
```

- [ ] **Step 2: Final full verification pass**

Re-run the Task-5 gate sweep once more AFTER all commits so the committed state is verified.

- [ ] **Step 3: Push**

```bash
git push -u origin ev-4-translate
```
Do NOT push `main`.

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --head ev-4-translate \
  --title "feat(translate): pure pi-to-AG-UI translation mapper (EV-4)" \
  --body "Carries src/translate.ts (pure pi→AG-UI fold), the fixture suite under test/, and the §4 amendment (Q1: REASONING_MESSAGE_*, generation-lane toolcall_*, TOOL_CALL_RESULT content flattening, citing S1/S2/S8 in row notes)."
```

Record the PR number/URL. Do NOT merge. Do not poll CI.

- [ ] **Step 5: Report**

Report: worktree path, branch name, PR number/URL, every gate's actual output (G-1…G-14 greps, tsc, bun test), and any gate that had to be fixed to pass and how.
