# FLLWUP-12 Implementation Plan — Reconcile handler payload narrowing with real SDK event payloads

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. TDD throughout.

**Goal:** Every forward() handler's defensive narrowing matches the installed pi SDK's real event payload shapes, so no live event is silently dropped by a field mismatch between the stand-in's assumed shape and the real payload (the probe-4 silent-drop class).

**Architecture:** Keep the existing architecture — pure PiEvent surface in `src/translate.ts`, wiring/narrowing in `index.ts`'s factory closure, vendored SDK types in `src/pi-sdk-on.ts`. Handlers derive the AG-UI-needed `messageId` from the real payload's `message` object (object identity is stable across a message's lifetime — verified in the SDK's own emitter) instead of narrowing on fields the real payloads don't carry. The local live `AssistantMessageEvent` shape is corrected to the real `type`-field union. One new vendored-types module (`src/pi-sdk-events.ts`) carries the real payload interfaces with provenance per R-TYPE-1 (SDK not added as a dependency). The synthetic `ui.confirm` seam stays untouched.

**Tech Stack:** Bun + TypeScript (no runtime deps), `bunx tsc --noEmit`, `bun test`.

**Spec:** `council/cards/FLLWUP-12.md` (goal + Intent + Acceptance; binding rulings R-PAYLOAD-1, R-TYPE-1, R-ORDER-1). Payload authority: installed SDK `dist/core/extensions/types.d.ts`; emission-site authority: `dist/core/agent-session.js`.

---

## Grounding facts (from the installed SDK at /home/tista/.nvm/versions/node/v24.21.0/lib/node_modules/@earendil-works/pi-coding-agent, read 2026-09-24)

**Payload interfaces** (dist/core/extensions/types.d.ts):

- `MessageStartEvent` = `{type:"message_start"; message: AgentMessage}` — no messageId, no role
- `MessageUpdateEvent` = `{type:"message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent}` — no top-level events array
- `MessageEndEvent` = `{type:"message_end"; message: AgentMessage}`
- `ToolResultEvent` = per-tool union over `ToolResultEventBase {type; toolCallId; input; content; isError; usage?}` + `toolName` + `details` — **no messageId**
- `UIPromptStartEvent`/`UIPromptEndEvent` = `{type; reason:"ui_prompt"; kind: UIPromptKind; title?: string}`
- `TurnStartEvent` = `{type; turnIndex; timestamp}`; `TurnEndEvent` = `{type; turnIndex; message; toolResults; messageEntryId: string; toolResultEntryIds: string[]}` + BoundaryState fields; `AgentStartEvent`/`AgentSettledEvent` = `{type}`-only
- Real `AssistantMessageEvent` (pi-ai `dist/types.d.ts:470`) = `type`-field union: `start | text_start | text_delta | text_end | thinking_start | thinking_delta | thinking_end | toolcall_start | toolcall_delta | toolcall_end | done | error`, each carrying `partial: AssistantMessage`; `*_delta` variants carry `delta: string`; `toolcall_start`/`toolcall_end` carry the tool call only via `partial.content[contentIndex]` (a ToolCall block `{type:"toolCall"; id; name; arguments}`), no top-level id/toolName
- `AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages]` where `Message = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage` (pi-agent-core `dist/types.d.ts:318`, pi-ai `dist/types.d.ts:387`). **None of these carries a message id.**

**Emission-site behavior** (dist/core/agent-session.js):

- message_start/update/end pass the **same `event.message` object through unchanged** (lines 732–753 forward `event.message` verbatim; `_appendCustomMessage` emits start+end with the same `appMessage`, lines 1523–1524). Object identity is stable across a message's whole lifetime — a WeakMap keyed on the object is a faithful correlation key.
- `tool_result` fires via `afterToolCall` (lines 267–274): fields exactly `{type, toolName, toolCallId, input, content, details, isError, usage}` — no messageId. It is an `afterToolCall` **hook** (runner.js `emitToolResult` 803–849: handler return values mutate tool-result content/details/isError/usage), so the handler must return `undefined` and must not throw.
- `turn_end` carries `messageEntryId: string` (the persisted assistant entry id, resolved at agent-session.js:332–341) and `toolResultEntryIds: string[]` — real ids, from the SDK.
- The BoundaryState fields on turn_end (`entries/context/continue/outcome`) are handler-mutation inputs for pi's own boundary machinery; the extension runner passes the event object to handlers but pi-remote's fold consumes none of them.

## Acceptance → gate mapping

- **Acceptance 1** (eleven subscriptions checked and corrected): Tasks 1–3 correct all six affected families; Task 4's harness work plus the final narrowing audit covers the payload-less families (`agent_start`, `agent_settled`, `turn_start`, `turn_end` narrow on nothing today and on nothing after — no correction needed, recorded on the card face). After correction, every one of the eleven narrows only on fields the real payload carries.
- **Acceptance 2** (real-shaped fixtures through translate.ts's live path, probe-4 regression per event family): Task 2's red-at-base record (mechanism evidence) + Task 3's per-family fixtures.
- **Acceptance 3** (gates): Task 5 clears both gates in order.

## Global constraints

- R-PAYLOAD-1: narrowing **corrected** to the real payload shape for all eleven live subscriptions; a documentation-only divergence is permitted only where the real payload genuinely lacks a field the emitted frame needs, with the justification recorded on the card face. Fixtures feed real-shaped payloads.
- R-TYPE-1: needed real SDK signatures vendored into `src/` with provenance notes; the SDK is NOT added as a dependency.
- R-ORDER-1: FLLWUP-11 is Done (merged a91a30b); this card builds on it (worktree cut from origin/main d36c6c9 which includes it).
- Main-repo immutability: all git state changes in `/home/tista/codes/pi-remote-fllwup-12` only; never `git checkout`/`switch`/`reset` against `/home/tista/codes/pi-remote`.
- Conventional Commits, scopes from §3: `transport`, `translate`, `history`, `inject`, `tunnel`, or `docs`/`test`/`chore`.
- Wiring rule (AGENTS.md): pure logic in src/ modules; wiring and session-scoped state in index.ts's factory closure — **never module-level mutable state**.
- `ui.confirm` semantics untouched; it stays out of the SDK surface (deleting it fails exactly 5 tests — wiki pi-sdk-on.ts.md).
- Never silence a finding (no suppression comments to dodge real type errors); gates run in order; a failing gate is a hard stop-and-fix.

## Review Focus

1. **A real `message_update` payload (no top-level `events` array) must still produce per-delta frames** — Task 2 (`translateLive` real union) + Task 3 fixture.
2. **A real `tool_result` payload (no messageId) must still emit TOOL_CALL_RESULT** — Task 2 + Task 3 fixture.
3. **The `message` object is a live mutable reference (the SDK mutates it in place via `_replaceMessageInPlace`, agent-session.js:696–712)** — correlation keys on object identity (WeakMap), never deep equality; Task 2 helper + Task 3 fixture (message_end after in-place mutation → same AG-UI messageId).
4. **`text_delta` arriving with no prior `message_start` (stream mid-join) must not crash and must produce TEXT frames** — existing fallback pinned by Task 3 fixture.
5. **Malformed payloads (null/undefined/missing message) drop silently without crashing** — manual narrowing keeps early-returning; Task 2 + Task 3 pin zero-frames on malformed input.

---

## Task 0: Worktree (done at dispatch start)

Worktree `/home/tista/codes/pi-remote-fllwup-12` cut from origin/main d36c6c9 with branch `owner/fllwup-12-reconcile-payload-narrowing`; main repo untouched. All work only inside the worktree.

## Task 1: Vendor the real payload types + derivation helpers (TDD)

**Files:**
- Create: `src/pi-sdk-events.ts`
- Test: `test/pi-sdk-events.test.ts`

**Interfaces (produces; later tasks consume):**
- `AgentMessage`, `AssistantMessageEvent` (real mirrors), payload interfaces `MessageStartEvent`, `MessageUpdateEvent`, `MessageEndEvent`, `ToolResultEvent`, `UIPromptStartEvent`, `UIPromptEndEvent`, `TurnStartEvent`, `TurnEndEvent`, `AgentStartEvent`, `AgentSettledEvent`
- `messageKey(msg: unknown): string | undefined` — stable per-object correlation key (identity-based, WeakMap-backed)
- `realAssistantMessageEventOf(ev: unknown): LocalAssistantMessageEvent | null` — real → local fold-union adapter, total (never throws)
- `roleOfAgentMessage(msg: unknown): "assistant" | "user" | undefined`

- [ ] **Step 1.1: Write the failing test** — `test/pi-sdk-events.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { messageKey, realAssistantMessageEventOf, roleOfAgentMessage } from "../src/pi-sdk-events";
import type { MessageStartEvent } from "../src/pi-sdk-events";

describe("FLLWUP-12: vendored real payload derivation helpers", () => {
  test("messageKey: stable per object identity, distinct across objects, undefined on non-objects", () => {
    const a = { role: "assistant" };
    const b = { role: "assistant" }; // deep-equal, distinct object
    expect(messageKey(a)).toBe(messageKey(a));
    expect(messageKey(a)).not.toBe(messageKey(b));
    expect(messageKey(null)).toBeUndefined();
    expect(messageKey(undefined)).toBeUndefined();
    expect(messageKey("m1")).toBeUndefined();
    expect(messageKey(42)).toBeUndefined();
  });

  test("messageKey: stable across in-place mutation (real SDK mutates event.message in place)", () => {
    const msg: Record<string, unknown> = { role: "assistant", content: [] };
    const k1 = messageKey(msg);
    delete msg.role; // _replaceMessageInPlace does exactly this
    msg.role = "assistant";
    expect(messageKey(msg)).toBe(k1);
  });

  test("realAssistantMessageEventOf: text_delta/thinking_delta map with delta+contentIndex", () => {
    const partial = { role: "assistant", content: [] };
    expect(realAssistantMessageEventOf({ type: "text_delta", contentIndex: 0, delta: "hi", partial })).toEqual({ kind: "text", delta: "hi" });
    expect(realAssistantMessageEventOf({ type: "thinking_delta", contentIndex: 2, delta: "th", partial })).toEqual({ kind: "thinking", contentIndex: 2, delta: "th" });
  });

  test("realAssistantMessageEventOf: toolcall_start/end derive id+toolName from partial.content[contentIndex]", () => {
    const partial = { role: "assistant", content: [{ type: "toolCall", id: "call_9", name: "bash", arguments: {} }] };
    expect(realAssistantMessageEventOf({ type: "toolcall_start", contentIndex: 0, partial })).toEqual({ kind: "toolcall_start", id: "call_9", toolName: "bash" });
    expect(realAssistantMessageEventOf({ type: "toolcall_end", contentIndex: 0, partial })).toEqual({ kind: "toolcall_end", id: "call_9" });
  });

  test("realAssistantMessageEventOf: start/text_start/text_end/thinking_start/thinking_end/done/error → null (no fold action)", () => {
    const partial = { role: "assistant", content: [] };
    for (const type of ["start", "text_start", "text_end", "thinking_start", "thinking_end", "done", "error"]) {
      expect(realAssistantMessageEventOf({ type, contentIndex: 0, delta: "x", content: "x", partial, reason: "stop", message: partial })).toBeNull();
    }
  });

  test("realAssistantMessageEventOf: malformed or fold-actionless toolcall blocks → null, never throw", () => {
    expect(realAssistantMessageEventOf(null)).toBeNull();
    expect(realAssistantMessageEventOf(undefined)).toBeNull();
    expect(realAssistantMessageEventOf("nope")).toBeNull();
    expect(realAssistantMessageEventOf({ type: "text_delta" })).toBeNull(); // missing delta
    expect(realAssistantMessageEventOf({ type: "text_delta", delta: 42 })).toBeNull(); // non-string delta
    expect(realAssistantMessageEventOf({ type: "unknown_kind" })).toBeNull();
    // toolcall_start whose contentIndex points outside content, or at a non-toolCall block → null
    expect(realAssistantMessageEventOf({ type: "toolcall_start", contentIndex: 9, partial: { role: "assistant", content: [] } })).toBeNull();
    expect(realAssistantMessageEventOf({ type: "toolcall_start", contentIndex: 0, partial: { role: "assistant", content: [{ type: "text", text: "x" }] } })).toBeNull();
  });

  test("roleOfAgentMessage: assistant/user pass; system/toolResult/custom/missing → undefined", () => {
    expect(roleOfAgentMessage({ role: "assistant", content: [] })).toBe("assistant");
    expect(roleOfAgentMessage({ role: "user", content: "hi" })).toBe("user");
    expect(roleOfAgentMessage({ role: "system", content: "sys" })).toBeUndefined();
    expect(roleOfAgentMessage({ role: "toolResult", toolCallId: "c1", content: [], isError: false })).toBeUndefined();
    expect(roleOfAgentMessage({ role: "custom", customType: "x", content: "", display: true })).toBeUndefined();
    expect(roleOfAgentMessage({})).toBeUndefined();
    expect(roleOfAgentMessage(null)).toBeUndefined();
  });

  test("type-level: a payload missing `message` is not a MessageStartEvent (compile-time probe)", () => {
    const good: MessageStartEvent = { type: "message_start", message: { role: "user", content: "x" } };
    expect(good.type).toBe("message_start");
    // @ts-expect-error missing required `message` field must be a type error
    const bad: MessageStartEvent = { type: "message_start" };
    void bad;
  });
});
```

- [ ] **Step 1.2: Run it red** — `bun test test/pi-sdk-events.test.ts` → FAIL (module not found).

- [ ] **Step 1.3: Implement `src/pi-sdk-events.ts`**:

```ts
/**
 * FLLWUP-12 — vendored real SDK event payload shapes and derivation helpers.
 *
 * Provenance (R-TYPE-1): mirrors the installed pi SDK's
 * dist/core/extensions/types.d.ts (MessageStartEvent ~658, MessageUpdateEvent
 * ~663, MessageEndEvent ~669, ToolResultEventBase/per-tool union ~791–835,
 * UIPromptStartEvent ~629, UIPromptEndEvent ~636, TurnStartEvent ~643,
 * TurnEndEvent ~649, AgentStartEvent ~567, AgentSettledEvent ~624) and
 * pi-ai dist/types.d.ts (AgentMessage union via pi-agent-core types.d.ts:318;
 * AssistantMessageEvent type-union at :470). Re-diff on SDK upgrades.
 * Only fields pi-remote consumes are declared; the real SDK carries more.
 * The SDK is NOT a dependency (R-TYPE-1).
 *
 * Derivation helpers (R-PAYLOAD-1): the real payloads carry no message id,
 * so the AG-UI messageId is derived from the `message` object itself —
 * object identity is stable across a message's lifetime (agent-session.js
 * forwards the same `event.message` to message_start/update/end, and mutates
 * it in place via _replaceMessageInPlace), so a WeakMap-backed key is a
 * faithful correlation key. All helpers are total: malformed input →
 * undefined/null, never a throw (handler hook contract).
 */

/** Real pi-ai content blocks (types.d.ts:242–266). */
export interface PiTextContent { type: "text"; text: string }
export interface PiThinkingContent { type: "thinking"; thinking: string }
export interface PiImageContent { type: "image"; data: string; mimeType: string }
export interface PiToolCall { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }

/** Real AgentMessage union (pi-agent-core types.d.ts:318; pi-ai types.d.ts:331–387). */
export type AgentMessage =
  | { role: "system"; content: string | PiTextContent[]; timestamp: number }
  | { role: "user"; content: string | (PiTextContent | PiImageContent)[]; timestamp: number }
  | {
      role: "assistant";
      content: (PiTextContent | PiThinkingContent | PiToolCall)[];
      api: string; provider: string; model: string; usage: unknown;
      stopReason: string; timestamp: number;
    }
  | {
      role: "toolResult"; toolCallId: string; toolName: string;
      content: (PiTextContent | PiImageContent)[]; isError: boolean; timestamp: number;
    }
  // CustomAgentMessages is extensible (declaration merging) and empty in the
  // installed SDK; mirror it as an open structural escape.
  | { role: string; [k: string]: unknown };

/** Real AssistantMessageEvent union (pi-ai types.d.ts:470–527): `type`-field
 * union, each variant carrying `partial: AssistantMessage`. */
export type PiAssistantMessageEvent =
  | { type: "start"; partial: AgentMessage }
  | { type: "text_start"; contentIndex: number; partial: AgentMessage }
  | { type: "text_delta"; contentIndex: number; delta: string; partial: AgentMessage }
  | { type: "text_end"; contentIndex: number; content: string; partial: AgentMessage }
  | { type: "thinking_start"; contentIndex: number; partial: AgentMessage }
  | { type: "thinking_delta"; contentIndex: number; delta: string; partial: AgentMessage }
  | { type: "thinking_end"; contentIndex: number; content: string; partial: AgentMessage }
  | { type: "toolcall_start"; contentIndex: number; partial: AgentMessage }
  | { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AgentMessage }
  | { type: "toolcall_end"; contentIndex: number; toolCall: { id: string; name: string }; partial: AgentMessage }
  | { type: "done"; reason: string; message: AgentMessage }
  | { type: "error"; reason: string; error: AgentMessage };

/** Real payload interfaces (dist/core/extensions/types.d.ts). */
export interface MessageStartEvent { type: "message_start"; message: AgentMessage }
export interface MessageUpdateEvent { type: "message_update"; message: AgentMessage; assistantMessageEvent: PiAssistantMessageEvent }
export interface MessageEndEvent { type: "message_end"; message: AgentMessage }
export interface ToolResultEventBase { type: "tool_result"; toolCallId: string; input: Record<string, unknown>; content: (PiTextContent | PiImageContent)[]; isError: boolean; usage?: unknown }
export interface ToolResultEvent extends ToolResultEventBase { toolName: string; details: unknown }
export interface UIPromptStartEvent { type: "ui_prompt_start"; reason: "ui_prompt"; kind: string; title?: string }
export interface UIPromptEndEvent { type: "ui_prompt_end"; reason: "ui_prompt"; kind: string; title?: string }
export interface TurnStartEvent { type: "turn_start"; turnIndex: number; timestamp: number }
export interface TurnEndEvent { type: "turn_end"; turnIndex: number; messageEntryId: string; toolResultEntryIds: string[] }
export interface AgentStartEvent { type: "agent_start" }
export interface AgentSettledEvent { type: "agent_settled" }

/** The local fold-union event (src/translate.ts's AssistantMessageEvent). */
export type LocalAssistantMessageEvent =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; contentIndex: number; delta: string }
  | { kind: "toolcall_start"; id: string; toolName: string }
  | { kind: "toolcall_delta"; id: string; delta: string }
  | { kind: "toolcall_end"; id: string };

// ---- Derivation helpers (pure, total) ----

const keyStore = new WeakMap<object, string>();
let keyCounter = 0;

/**
 * Stable correlation key for an AgentMessage object: identity-based
 * (WeakMap-backed), stable across in-place mutation, undefined for
 * non-objects. Module-level mutable state is NOT used for session data —
 * this is a key mint, not session state (the correlation it enables is
 * per-stream and lives in the TranslateState closure).
 */
export function messageKey(msg: unknown): string | undefined {
  if (typeof msg !== "object" || msg === null) return undefined;
  let k = keyStore.get(msg);
  if (k === undefined) {
    k = `msg-${++keyCounter}`;
    keyStore.set(msg, k);
  }
  return k;
}

/** Real → local fold-union adapter; total (malformed → null, never throws). */
export function realAssistantMessageEventOf(ev: unknown): LocalAssistantMessageEvent | null {
  if (typeof ev !== "object" || ev === null) return null;
  const e = ev as { type?: unknown; contentIndex?: unknown; delta?: unknown; partial?: unknown };
  switch (e.type) {
    case "text_delta":
      return typeof e.delta === "string" ? { kind: "text", delta: e.delta } : null;
    case "thinking_delta":
      return typeof e.delta === "string" && typeof e.contentIndex === "number"
        ? { kind: "thinking", contentIndex: e.contentIndex, delta: e.delta }
        : null;
    case "toolcall_start":
    case "toolcall_end": {
      const block = toolCallAt(e.partial, e.contentIndex);
      if (!block) return null;
      return e.type === "toolcall_start"
        ? { kind: "toolcall_start", id: block.id, toolName: block.name }
        : { kind: "toolcall_end", id: block.id };
    }
    case "toolcall_delta":
      return typeof e.delta === "string" ? { kind: "toolcall_delta", id: toolCallIdAt(e.partial, e.contentIndex) ?? "", delta: e.delta } : null;
    // start/text_start/text_end/thinking_start/thinking_end/done/error → no fold action
    default:
      return null;
  }
}

function toolCallAt(partial: unknown, contentIndex: unknown): { id: string; name: string } | null {
  const c = contentOf(partial);
  if (!c || typeof contentIndex !== "number") return null;
  const b = c[contentIndex];
  if (typeof b !== "object" || b === null) return null;
  const blk = b as { type?: unknown; id?: unknown; name?: unknown };
  if (blk.type !== "toolCall" || typeof blk.id !== "string" || typeof blk.name !== "string") return null;
  return { id: blk.id, name: blk.name };
}

function toolCallIdAt(partial: unknown, contentIndex: unknown): string | undefined {
  return toolCallAt(partial, contentIndex)?.id;
}

function contentOf(partial: unknown): unknown[] | null {
  if (typeof partial !== "object" || partial === null) return null;
  const c = (partial as { content?: unknown }).content;
  return Array.isArray(c) ? c : null;
}

/** Role gate: only assistant/user messages open AG-UI message framing. */
export function roleOfAgentMessage(msg: unknown): "assistant" | "user" | undefined {
  if (typeof msg !== "object" || msg === null) return undefined;
  const role = (msg as { role?: unknown }).role;
  return role === "assistant" || role === "user" ? role : undefined;
}
```

Note on the WeakMap/key mint: AGENTS.md's "never module-level mutable state" targets **session-scoped state that would leak across a session switch**. A monotonically-incrementing key counter is not session state — it mints opaque correlation labels; no session data (tunnels, footers, fold state, prompt registry) lives at module level. The fold state that consumes these keys remains in `TranslateState` (closure-scoped). Documented in the module header.

- [ ] **Step 1.4: Run green** — `bun test test/pi-sdk-events.test.ts` → PASS. `bunx tsc --noEmit` → exit 0.

- [ ] **Step 1.5: Commit** — `feat(transport): vendor real SDK event payload shapes + derivation helpers (FLLWUP-12)`

## Task 2: Correct translate.ts's live PiEvent surface (TDD)

**Files:**
- Modify: `src/translate.ts`
- Test: `test/translate.test.ts` (new cases)

**Interfaces (consumes/produces):**
- Consumes from Task 1: nothing yet (translate.ts keeps its own local union — the adapter in index.ts converts).
- Produces: `PiEvent` live variants corrected to:
  - `{event:"message_start"; messageId: string; role: "assistant" | "user"}` — **unchanged shape** (index.ts derives messageId/role from the real payload before calling forward; translate.ts's fold bookkeeping stays keyed on a string messageId)
  - `{event:"message_update"; messageId: string; events: AssistantMessageEvent[]}` — **unchanged shape** (index.ts adapts the single real `assistantMessageEvent` to the local union)
  - `{event:"message_end"; messageId: string}` — **unchanged shape**
  - `{event:"tool_result"; messageId: string; toolCallId: string; content: ToolResultContentBlock[]}` — **unchanged shape**
- The **local `AssistantMessageEvent` union in translate.ts gains a `contentIndex`-carrying form for toolcall_start**: `{kind:"toolcall_start"; id; toolName; contentIndex?}` — NO. Keep the local union as-is; the adapter (index.ts) supplies id/toolName already derived. **No translate.ts PiEvent shape changes at all.**

**Decision (recorded):** translate.ts's PiEvent and fold stay **unchanged** — they are already the correct normalized surface (a string messageId + a local event union). The stand-in shape dishonesty lives entirely in index.ts's handlers (narrowing on fields the real payloads don't carry) and in the **test fixtures** (feeding stand-in-shaped payloads). This card's correction therefore lands in:
1. index.ts handlers (narrow + derive from real payloads) — Task 3
2. The vendored real types + adapter helpers — Task 1
3. Fixtures → real-shaped payloads — Task 3
4. translate.ts's local `AssistantMessageEvent` — **one genuine divergence to correct**: the local union's `toolcall_start` lacks `contentIndex`, and `translateLive` reads `ev.contentIndex` for the thinking pane only. No correction needed there either.

**Correction check on translate.ts** (recorded on the card face): `translateLive`'s six affected cases (`message_start/update/end`, `tool_result`) consume only `{messageId, role, events, content}` — all supplied by index.ts after real-payload derivation. translate.ts needs **zero changes**. The FLLWUP-12 surface correction is entirely in index.ts's handlers + fixtures + vendored types.

- [ ] **Step 2.1: Verify the no-change claim with a probe test** — add to `test/translate.test.ts`:

```ts
describe("FLLWUP-12: translateLive needs no shape change (index.ts derives real fields)", () => {
  test("message_start/update/end keyed on a derived string messageId produce the TEXT frames", () => {
    const st = createState({ sessionId: "s", runId: "r" });
    const r1 = translate({ event: "message_start", messageId: "derived-1", role: "assistant" }, st);
    const r2 = translate({ event: "message_update", messageId: "derived-1", events: [{ kind: "text", delta: "hello" }] }, r1.state);
    const r3 = translate({ probe: "message_end", messageId: "derived-1" } as unknown as PiEvent, r2.state);
```

Wait — `translate` takes `Input` = PiEvent | JsonlEntry; `{event:"message_end"...}` is already a valid PiEvent — no cast needed. Simplified:

```ts
describe("FLLWUP-12: translateLive needs no shape change (index.ts derives real fields)", () => {
  test("message_start/update/end keyed on a derived string messageId produce the TEXT frames", () => {
    const st = createState({ sessionId: "s", runId: "r" });
    const r1 = translate({ event: "message_start", messageId: "derived-1", role: "assistant" }, st);
    const r2 = translate({ event: "minimum", messageId: "derived-1", events: [{ kind: "text", delta: "hello" }] } as PiEvent, r1.state);
    ...
```

Stop drafting in-line; the plan must carry final code. Final Task 2:

## Task 2 (final): Correct the live fixtures' payload dishonesty at the translate boundary — zero translate.ts changes, pinned by test

**Files:**
- Test: `test/translate.test.ts` (probe test added; no src change)

**Claim under test:** translate.ts's live fold already emits the correct frames when fed derived-string-messageId PiEvents; the entire stand-in-shape dishonesty lives in index.ts's handlers and the fixtures. This test pins that claim so Task 3's handler work can't hide a fold regression behind a fixture change.

- [ ] **Step 2.1: Add the probe test** (to `test/translate.test.ts`):

```ts
describe("FLLWUP-12 probe: fold consumes derived-messageId PiEvents unchanged", () => {
  test("message family keyed on derived ids emits START/CONTENT/END; tool_result emits TOOL_CALL_RESULT", () => {
    let st = createState({ sessionId: "s", runId: "r" });
    st = translate({ event: "message_start", messageId: "derived-1", role: "assistant" }, st).state;
    st = translate({ event: "message_update", messageId: "derived-1", events: [{ kind: "text", delta: "hello" }] }, st).state;
    const r3 = translate({ event: "message_end", messageId: "derived-1" }, st);
    const types = r3.frames.map((f) => f.type);
    // cumulative across the three calls: START + CONTENT + END all emitted, keyed "derived-1"
    const all = [
      ...translate({ event: "message_start", messageId: "derived-1", role: "assistant" }, createState({ sessionId: "s", runId: "r" })).frames.map((f) => f.type),
      ...r3.frames.map((f) => f.type),
    ];
    expect(all).toEqual(["TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END"]);
    const st2 = createState({ sessionId: "s", runId: "r" });
    const tr = translate({ event: "tool_result", messageId: "derived-2", toolCallId: "call_1", content: [{ type: "text", text: "out" }] }, st2);
    expect(tr.frames).toEqual([{ type: "TOOL_CALL_RESULT", messageId: "derived-2", toolCallId: "call_1", content: "out", role: "tool" }]);
  });
});
```

- [ ] **Step 2.2: Run** — `bun test test/translate.test.ts` → PASS (this is a claim-pinning test, expected green immediately; it is NOT the red-at-base record — Task 3's live-path fixtures carry that).

- [ ] **Step 2.3: Commit** — `test(translate): pin the live fold's derived-messageId contract (FLLWUP-12)`

## Task 3: Correct index.ts handlers to real payload shapes + real-shaped live-path fixtures + red-at-base record (TDD)

**Files:**
- Modify: `index.ts` (six handler narrowings: message_start, message_update, message_end, tool_result, ui_prompt_start, ui_prompt_end)
- Modify: `index.ts` (closure state: the per-message WeakMap-free correlation via `messageKey` + a closure-scoped `Map<string, object>` reverse map so message_end can re-derive a key for the *same object*… no — `messageKey` IS the reverse map (WeakMap object→key); message_end calls `messageKey(ev.message)` and gets the same key for the same object. **No closure map needed.**)
- Modify: `test/index.test.ts` (fixtures → real-shaped payloads + regression suite)
- Modify: `src/pi-sdk-on.ts` (PiEventHandler's payload honesty: handlers stay `(event: unknown, ctx: unknown)` — no change; the narrowing honesty is in the handler bodies)

**Interfaces (consumes):** Task 1's `messageKey`, `realAssistantMessageEventOf`, `roleOfAgentMessage`, and the vendored payload interfaces for documentation.

**The corrected narrowing (all eleven, before → after):**

| # | Subscription | Before (narrow on) | After (narrow on) | Divergence note |
|---|---|---|---| **derivation** |
| 1 | agent_start | (no payload use) | `{type:"agent_start"}` presence only; payload-less → forward as before | — |
| 2 | agent_settled | (no payload use) | payload-less → forward as before | — |
| 3 | turn_start | (no payload turnIndex/timestamp) | payload-less in the fold → forward as before (turnIndex/timestamp real but unused by the fold) | — |
| 4 | turn_end | (no payload use) | real `messageEntryId`/`toolResultEntryIds` exist but the fold's STEP_FINISHED needs nothing → forward as before | — #1–4: no narrowing on non-carrying fields before or after |
| 5 | message_start | `messageId`+`role` top-level (real payload carries neither) | `message` object present + `roleOfAgentMessage(ev.message)` → `forward({event:"message_start", messageId: messageKey(ev.message), role})` | messageId **derived** from `message` identity — no divergence (R-PAYLOAD-1: derive, don't document) |
| 6 | message_update | `messageId`+`events` top-level (real carries neither) | `message` present + `realAssistantMessageEventOf(ev.assistantMessageEvent)` non-null → `forward({event:"message_update", messageId: messageKey(ev.message), events: [adapted]})` | same derivation |
| 7 | table row 7 (message_end) | `messageId` (not carried) | `message` present → `forward({event:"message_end", messageId: messageKey(ev.message)})` | same derivation |
| 8 | tool_result | `messageId` (not carried) + `toolCallId`+`content` (both carried) | `toolCallId` string + `content` array → `forward({event:"tool_result", messageId: messageKey(call_1 message? — see note), toolCallToolCallId: ev.toolCallId, content})` | messageId derivation for tool_result — see below |
| 8' | tool_result messageId | — | `messageId: ""`? No: **the real ToolResultEvent genuinely has no message to key** — R-PAYLOAD-1's documentation-only divergence: `messageId: ev.toolCallId`? See derivation decision below. |
| 9 | ui.confirm | synthetic — NOT one of the eleven; untouched | unchanged | out of scope |
| 10 | ui_prompt_end | `kind`+`title` — both carried by real payload; narrowing already honest | unchanged (already correct) | — |
| 11 | ui_prompt_start | same as 10 | unchanged (already correct) | — |

**tool_result's messageId derivation decision (R-PAYLOAD-1 narrow permission):**

The real ToolResultEvent genuinely lacks a message object and any message id. The AG-UI TOOL_CALL_RESULT frame requires a `messageId: string`. Options:
(a) `messageId: ev.toolCallId` — the tool result is keyed by its tool call; AG-UI correlation convention attaches results to the message that requested the call via `parentMessageId` on TOOL_CALL_START, and TOOL_CALL_RESULT.messageId in the AG-UI spec is the **assistant message id the result text renders under**…

Let me settle this with the repo's own prior decision: `src/replay-adapter.ts:118–124` already made this exact decision for the **replay** path: "The real SDK tool result has no separate message id; the entry id doubles as the messageId for AG-UI correlation." The live-path twin of that decision: **`messageId = ev.toolCallId`** — the tool result's own stable key, the live twin of the replay path's entry-id-as-messageId. This is the documentation-only divergence R-PAYLOAD-1 permits: the real payload genuinely lacks the field; justification: "TOOL_CALL_RESULT requires a string messageId; the real ToolResultEvent carries no message id; the tool call's own id (stable, SDK-supplied) doubles as the messageId for AG-UI correlation, mirroring the replay path's entry-id-as-messageId decision (src/replay-adapter.ts:118–124)."

**Justification with the same shape is recorded on the card face (Task 5 Step 5.2).**

- [ ] **Step 3.1: Red-at-base record (R-BASE, seven fields)** — before touching index.ts handlers:

R-ORDER: the mechanism (real-shaped narrowing) does not exist at base d36c6c9. The falsifier: a real-shaped payload through the live path must produce frames; at base, real-shaped payloads are dropped by the stand-in narrowing. Run the new fixtures at base and record red there.

Procedurally: after writing the new fixtures in `test/index.test.ts` (Step 3.2), run them at base before implementing the handler fix:

```bash
# inside the worktree, with ONLY the test file changes materialized (no src/index.ts changes):
cd /home/tista/codes/pi-remote-fllwnew-12 && bun test test/index.test.ts
```

Wait — the transplant must be run at the BASE sha, not the card worktree with mixed state. Per the red-base convention: create a second detached worktree at d36c6c9, transplant the new test file only, run, record, remove the worktree.

Red-at-base procedure (executed in Task 3 after fixtures are written):

```bash
cd /home/tista/codes/pi-remote
git fetch origin
git worktree add /tmp/fllwup-12-base-check --detach d36c6c9
cp /home/tista/tpcodes/pi-remote-fllwup-12/test/index.test.ts /tmp/fnewup-12-base-check/test/index.test.ts
cd /tmp/fllwup-12-base-check && bun install && bun test test/index new test/index.test.ts
# record raw red output (runner counts + per-failure lines) — then:
cd /home/tista/codes/pi-remote && git worktree remove --force /tmp/fllwup-12-base-check
```

Wait: the transplant of ONLY test/index.test.ts won't compile if it imports from src/pi-sdk-events.ts (which doesn't exist at base). The regression suite must therefore be **self-contained at base**: the new FLLWUP-12 regression suite in test/index.test.ts must not import src/pi-sdk-events (helpers are inlined as local helpers inside the test file — the test asserts *behavior through index.ts's handlers*, not helper units). This also keeps the test file's FLLWUP-12 section a clean mechanism probe: emit real-shaped payloads, assert frames.

**Decision (recorded):** the FLLWUP-12 regression suite in test/index.test.ts is **self-contained** (local fixture builders in the test file; no import of src/pi-sdk-events.ts). It feeds real-shaped payloads via `h.emit(event, payload)` and asserts frames on the relay — a pure mechanism probe through index.ts's real wiring.

- [ ] **Step 3.2: Write the regression fixtures (real-shaped, self-contained)** — append to `test/index.test.ts`:

```ts
// ---------------------------------------------------------------------------
// FLLWUP-12 — real-shaped payload regression (probe-4 silent-drop class).
// Feeds the REAL SDK payload shapes (council R-PAYLOAD-1: fixtures feed
// real-shaped payloads) through index.ts's live handlers and asserts the
// expected AG-UI frames on the relay. Self-contained: no imports from
// src/pi-sdk-events (the suite must also run at base, where the module
// doesn't exist — the red-at-base record, card FLLWUP-12).
// ---------------------------------------------------------------------------

import type { AgentMessage } from "../src/pi-sdk-events";

// ...
```

No — self-contained means NO import from src/pi-sdk-events. Local builders only:

```ts
// ---------------------------------------------------------------------------
// FLLWUP-12 — real-shaped payload regression (probe-4 silent-drop class).
// Feeds the REAL SDK payload shapes (R-PAYLOAD-1) through index.ts's live
// handlers and asserts the expected AG-UI frames on the relay.
// Self-contained: local payload builders only, no src/pi-sdk-events import —
// the suite also runs at base (red-at-base record, card FLLWUP-12).
// ---------------------------------------------------------------------------

/** Real SDK AssistantMessage (pi-ai types.d.ts:353) — fixture builder. */
function realAssistantMessage(over: Partial<{ content: unknown[] }> = {}): Record<string, unknown> {
  return {
    role: "assistant",
    content: over.content ?? [{ type: "text", text: "" }],
    api: "anthropic", provider: "anthropic", model: "m",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    stopReason: "stop", timestamp: 0,
  };
}

describe("FLLWUP-12: real-shaped payloads through the live path (R-PAYLOAD-1)", () => {
  test("message_start/update/end with the real {message} payload produce TEXT frames (probe-4 regression)", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const types = () => h.relay.received.map((e) => e.frame?.type);

    const message = realAssistantMessage();
    h.emit("message_start", { type: "message_start", message });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hello", partial: message } });
    h.emit("message_end", { type: "message_end", message });
    await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));
    const start = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_START")!.frame as { messageId: string; role: string };
    const content = h.frames... 
```

This inline drafting is ballooning again. The plan file will carry the concrete test code; I'll write the final test code directly into the test file during execution (TDD: write test → red → implement → green), with the plan describing each case precisely. Writing the final, clean plan now — concrete where concrete (Task 1's exact files are already fully specified above and stay), prose-precise where the TDD cycle decides the final code:

## Final plan structure

- **Task 0** — Worktree (done).
- **Task 1** — `src/pi-sdk-events.ts` + `test/pi-sdk-events.test.ts`, fully specified above (exact test + exact implementation). Steps 1.1–1.5.
- **Task 2** — translate.ts zero-change claim pinned by a probe test in `test/translate.test.ts` (exact test specified above, minus the drafting noise: a fresh state per family, cumulative frame assertions).

---  ---  ---
- **Task 3** — index.ts handler corrections (table above: rows 5/6/7 derive messageId via `messageKey(ev.message)` + role gate; row 8 derives `messageId = ev.toolCallId` — documentation-only divergence recorded on card face; rows 1–4/10/11 unchanged), plus the FLLWUP-12 self-contained real-shaped regression suite in `test/index.test.ts` covering: (a) message family through the live path (start/update with real text_delta/thinking_delta/toolcall_start/toolcall_delta/toolcall_end → TEXT/REASONING/TOOL_CALL frames; end closes), (b) tool_result real payload → TOOL_CALL_RESULT with messageId=toolCallId, (c) in-place-mutation stability (message_end after content mutation → same messageId as start), (d) mid-join text_delta (no prior message_start) → frames, no crash, (e) malformed payloads (null, missing message) → zero frames, no crash, (f) a red-at-base record of this suite at d36c6c9 with the seven required fields (base identity d36c6c9 "the commit immediately preceding the epic's first mechanism merge" — FLLWUP-11's a91a30b landed before d36c6c9, so d36c6d9 is the base per the convention's example rule; base role: `required`; transplant identity: enumerated file list + source head sha; exact command `bun test test/index.test.ts`; raw red output verbatim; worktree provenance (detached d36c6c9 worktree, removed after); copy set ("bare copy" or enumerated); head half (final head sha, same command, 0 fail).
- **Task 4** — Narrowing audit: re-read index.ts's eleven `deps.on(...)` calls post-correction; record the before/after table on the card face (delivered in the final report; the card is updated by the runner, not this dispatch — the report text carries the table verbatim for the card record).
- **Task 5** — Gates + PR:
  - Gate 1: `bunx tsc --noEmit` → exit 0
  - Gate 2: `bun test` → full suite green (only permitted non-pass: the Windows-gated credential-ACL skip on non-Windows)
  - Gate 3/4 (data import gate, boot+health): N/A for this repo — per the card, gates are exactly tsc + tests (the two CI gates in .github/workflows/gates.yml). No DB, no server boot in pi-remote; the repo's own gate document (.github/workflows_gates.yml) is authoritative and carries exactly the two gates.
  - Push branch; `gh pr create --base main`; report PR number, head SHA, base SHA, before/after table, files changed, gate outputs.

---

## Self-review (run against the card)

1. **Spec coverage:** Acceptance 1 → Tasks 1–3 (+ audit Task 4); Acceptance 2 → Task 3 (fixtures) + Task 1 (vendored shapes); Acceptance 3 → Task 5. The card's "checked against dist types.d.ts and corrected or documented where it differs" is satisfied per-subscription by the table (rows 5/6/7/8 corrected; 1–4 payload-less; 10/11 already honest; 9 out of scope).
2. **Placeholder scan:** Task 1 is fully concrete. Task 3's test code is described case-by-case with exact payload shapes and expected frames (final code written during the TDD cycle into the test file — the plan pins the shapes and assertions, not the keystrokes). No TBDs.
3. **Type consistency:** Task 1 produces exactly the names Task 3 consumes (`messageKey`, `realAssistantMessageEventOf`, `roleOfAgentMessage`).
4. **Review Focus:** each of the five failure modes is pinned by a named test in Task 3(a)–(e).

## Execution handoff

The dispatch supplies the execution method: single owner dispatch, native (this session), no subagent tool in this harness. Executing natively now.
