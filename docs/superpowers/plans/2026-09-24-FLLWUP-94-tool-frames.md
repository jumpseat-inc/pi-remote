# FLLWUP-94 Implementation Plan — Wire the missing tool_execution_* live subscriptions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. TDD throughout.

**Goal:** The live path emits the tool frames the web client's tool card needs — `pi.tool.start`, `pi.tool.update`/`pi.tool.progress`, `pi.tool.end` — by subscribing to the SDK's `tool_execution_start/update/end` events with real-shape payload narrowing, so a live session's transcript matches the local terminal's tool activity.

**Architecture:** No mapper change. `src/translate.ts`'s `translateLive` already maps all three `tool_execution_*` `PiEvent` variants to CUSTOM `pi.tool.*` frames (FLLWUP-3 §4 split); they were dead code because `index.ts` never subscribed. The fix is three `deps.on(...)` subscriptions with the FLLWUP-12 narrowing discipline (real SDK payload shapes, manual field validation, never `ev as PiEvent`), plus two type-level corrections that follow from grounding the real payloads: the `PiEvent` update variant's `partialResult` widens `string → unknown`, and the real shapes are vendored into `src/pi-sdk-events.ts` per R-TYPE-1.

**Tech Stack:** Bun + TypeScript (no runtime deps), `bunx tsc --noEmit`, `bun test`.

**Spec:** `council/cards/FLLWUP-94.md` (goal + Intent + Root cause + Deliverable and constraints). Payload authority: installed SDK `dist/core/extensions/types.d.ts` (0.85.1) lines 608–628; emission-site authority: `dist/core/agent-session.js` lines 528–553.

---

## Grounding facts (installed SDK 0.85.1, read 2026-09-24)

- The installed SDK emits BOTH `tool_call` (a mutable *pre-execution hook* — `ToolCallEvent` carries `input`, can block/mutate, types.d.ts:678–724) and `tool_execution_start/update/end` (execution lifecycle, types.d.ts:608–628). The lifecycle trio is what translate.ts's cases map; `tool_call` is a different seam and is NOT subscribed.
- `agent-session.js:528–553` forwards the trio to extension handlers verbatim:
  - `tool_execution_start`: `{type, toolCallId: string, toolName: string, args: any}`
  - `tool_execution_update`: `{type, toolCallId, toolName, args: any, partialResult: any}`
  - `tool_execution_end`: `{type, toolCallId, toolName, result: any, isError: boolean}`
- `partialResult`/`result` are **not strings**: bash's onUpdate passes the tool's own ToolResult-shaped object `{content: [{type:"text",text}], details}` (bundle chunk-JVUZSMYM.js, `onUpdate(snapshot)`). The `PiEvent` variant's `partialResult?: string` was a stale claim; translate.ts only does presence checks, so widening to `unknown` is type-level only.
- Reasoning deltas arrive via `message_update`'s `assistantMessageEvent` (`thinking_delta`, pi-ai types.d.ts:470–527) and already render: FLLWUP-12 (merged, `524bc90` on origin/main) corrected the message-family handlers to the real `{type, message, assistantMessageEvent}` payloads and adapts `thinking_delta → {kind:"thinking"}` via `realAssistantMessageEventOf`, pinned by test "real thinking_delta → REASONING pane". Reasoning was NOT a separate live defect on origin/main — it WAS separately dropped on the FLLWUP-58/92 branches (pre-FLLWUP-12 handlers narrowed on `{messageId, events}`, which real payloads never carry), which is why this card's branch stacks on origin/main.
- Base reconciliation (recorded deviation): the card says "branch from `848074a`", but `848074a` predates the FLLWUP-12 merge — its message-family handlers drop every real payload, which makes the card's own acceptance (reasoning appears; transcript matches) unreachable. Per AGENTS.md R-CONV-1 (owner branches cut from `origin/main`), the branch is `origin/main` + cherry-picked `848074a` (FLLWUP-92), preserving the card's stated intent — "the installed extension carries FLLWUP-92 too" — while carrying FLLWUP-12, which FLLWUP-94's acceptance requires.

## Global Constraints

- SDK is NOT a dependency (R-TYPE-1); vendored shapes carry provenance and a re-diff-on-upgrade discipline.
- Handlers validate fields manually, never `ev as PiEvent` (FLLWUP-5 S-O2); malformed payload → zero frames, no throw.
- Fixtures feed REAL-shaped payloads (R-PAYLOAD-1).
- Execution-lane events map ONLY to CUSTOM `pi.tool.*`, never `TOOL_CALL_*` (FLLWUP-3 S2); update-before-progress order in the same batch.
- Conventional Commits; work in the isolated worktree; the shared main worktree's branch state is immutable.

## Review Focus

- Object-valued `partialResult`/`result` (bash real shape) must flow through unharmed — expect `pi.tool.progress` carrying the object, not a string. Pinned by the update test.
- Non-boolean `isError` on `tool_execution_end` → zero frames, no crash. Pinned by the malformed barrage test.
- Frame order across a full lifecycle (start → update → progress → end → TOOL_CALL_RESULT) must match the SDK's emission order. Pinned by the lifecycle test.
- Malformed payloads must not wedge the wiring: after the barrage, a well-formed start still emits. Pinned by the malformed test's recovery step.

---

### Task 1: RED — real-shaped tool_execution_* payloads through the wiring emit zero frames today

- [x] **Step 1: Write the failing tests** (`test/index.test.ts`, new describe `FLLWUP-94: tool_execution_* live wiring`): start → `pi.tool.start`; update (args + OBJECT partialResult) → `pi.tool.update` then `pi.tool.progress` in order; end → `pi.tool.end` with result+isError; full lifecycle ordering incl. `TOOL_CALL_RESULT`; malformed barrage → zero frames, wiring still works after.
- [x] **Step 2: Verify RED.** Run `bun test test/index.test.ts` → 5 fail (waitFor timeout: no subscriptions exist; the frames never arrive), 37 pre-existing pass.
- [x] **Step 3: Verify tsc state** — `bunx tsc --noEmit` must be clean or fail ONLY on deliberately-malformed fixture typing; fix by widening the payload builders' parameter types to `unknown` (they mirror the SDK's `any` runtime surface).

### Task 2: GREEN — the three subscriptions + type corrections

- [x] **Step 1: Wire the trio** in `index.ts` after the `tool_result` handler, FLLWUP-12-style narrowing: `toolCallId`/`toolName` must be strings on all three; `args`/`partialResult`/`result` pass through as `unknown` (presence-based emission downstream); `isError` must be boolean or the event is dropped. Events forwarded: `tool_execution_start` (toolCallId, toolName), `tool_execution_update` (toolCallId, args, partialResult), `tool_execution_end` (toolCallId, result, isError).
- [x] **Step 2: Widen the stale type** in `src/translate.ts`: `tool_execution_update` variant `partialResult?: string → partialResult?: unknown`, with a provenance comment (real `any`; bash object shape; presence-based emission unchanged).
- [x] **Step 3: Vendor the real shapes** in `src/pi-sdk-events.ts`: `ToolExecutionStartEvent`, `ToolExecutionUpdateEvent`, `ToolExecutionEndEvent` with provenance (types.d.ts:608–628; agent-session.js:528–553).
- [x] **Step 4: Verify GREEN.** `bun test test/index.test.ts` → 42 pass / 0 fail. `bun test test/translate.test.ts test/pi-sdk-events.test.ts` → 62 pass / 0 fail (type widening broke no pin).
- [x] **Step 5: Commit** `fix(transport): subscribe tool_execution_start/update/end and vendor their real payload shapes (FLLWUP-94)`.

### Task 3: Full gates (repo-authoritative: AGENTS.md Development section)

- [x] **Step 1: `bunx tsc --noEmit`** — exit 0.
- [x] **Step 2: `bun test`** (whole suite, ONCE) — all pass; only expected non-pass is the Windows-gated credential-ACL skip on non-Windows runners.
- [x] **Step 3: Record the push blocker** — this account cannot push to `jumpseat-inc/pi-remote` (card-stated `push: false`); the deliverable is the local branch `fix/fllwup-94-tool-frames` (origin/main + FLLWUP-92 cherry-pick + this fix), no PR. The installed extension at `~/Codes/pi-remote/index.ts` serves the main checkout, which stays on `fix/fllwup-92-host-liveness` (shared-worktree immutability); switching it to this branch is the human's one-command step (`git switch fix/fllwup-94-tool-frames` in `/Users/kresnahendri/Codes/pi-remote`).