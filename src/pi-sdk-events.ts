/**
 * FLLWUP-12 — vendored real SDK event payload shapes and derivation helpers.
 *
 * Provenance (R-TYPE-1): mirrors the installed pi SDK's
 * dist/core/extensions/types.d.ts (MessageStartEvent ~658, MessageUpdateEvent
 * ~663, MessageEndEvent ~669, ToolResultEventBase + per-tool union ~791–837,
 * UIPromptStartEvent ~629, UIPromptEndEvent ~636, TurnStartEvent ~643,
 * TurnEndEvent ~649, AgentStartEvent ~567, AgentSettledEvent ~624) and
 * pi-ai dist/types.d.ts (AgentMessage union via pi-agent-core types.d.ts:318;
 * AssistantMessageEvent type-union at :470; content blocks :242–266).
 * Re-diff on SDK upgrades. Only fields pi-remote consumes are declared; the
 * real SDK carries more. The SDK is NOT a dependency (R-TYPE-1).
 *
 * Derivation helpers (R-PAYLOAD-1): the real payloads carry no message id,
 * so the AG-UI messageId is derived from the `message` object itself —
 * object identity is stable across a message's lifetime (agent-session.js
 * forwards the same `event.message` to message_start/update/end and mutates
 * it in place via _replaceMessageInPlace), so a WeakMap-backed key is a
 * faithful correlation key. All helpers are total: malformed input →
 * undefined/null, never a throw (tool_result is an afterToolCall hook whose
 * handler contract forbids throwing; runner.js emitToolResult 803–849).
 */

/** Real pi-ai content blocks (pi-ai dist/types.d.ts:242–266). */
export interface PiTextContent { type: "text"; text: string }
export interface PiThinkingContent { type: "thinking"; thinking: string }
export interface PiImageContent { type: "image"; data: string; mimeType: string }
export interface PiToolCall { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }

/**
 * Real AgentMessage union (pi-agent-core types.d.ts:318; pi-ai types.d.ts
 * :331–387). Structural mirror; the real union allows custom roles via
 * CustomAgentMessages (empty in the installed SDK) — mirrored as an open
 * structural escape arm.
 */
export type AgentMessage =
  | { role: "system"; content: string | PiTextContent[]; timestamp: number }
  | { role: "user"; content: string | (PiTextContent | PiImageContent)[]; timestamp: number }
  | {
      role: "assistant";
      content: (PiTextContent | PiThinkingContent | PiToolCall)[];
      api: string;
      provider: string;
      model: string;
      usage: unknown;
      stopReason: string;
      timestamp: number;
    }
  | {
      role: "toolResult";
      toolCallId: string;
      toolName: string;
      content: (PiTextContent | PiImageContent)[];
      isError: boolean;
      timestamp: number;
    }
  | { role: string; [k: string]: unknown };

/**
 * Real AssistantMessageEvent union (pi-ai types.d.ts:470–527): a `type`-field
 * union, every variant carrying `partial: AssistantMessage`; `*_delta`
 * variants carry `delta: string`; toolcall variants locate the ToolCall via
 * `contentIndex` into `partial.content` (toolcall_end also carries a
 * top-level `toolCall`).
 */
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
  | { type: "toolcall_end"; contentIndex: number; toolCall: PiToolCall; partial: AgentMessage }
  | { type: "done"; reason: string; message: AgentMessage }
  | { type: "error"; reason: string; error: AgentMessage };

/** Real payload interfaces (dist/core/extensions/types.d.ts). */
export interface MessageStartEvent { type: "message_start"; message: AgentMessage }
export interface MessageUpdateEvent { type: "message_update"; message: AgentMessage; assistantMessageEvent: PiAssistantMessageEvent }
export interface MessageEndEvent { type: "message_end"; message: AgentMessage }

/** Real ToolResultEventBase (types.d.ts:791) + the union collapsed to the
 * fields pi-remote consumes (per-tool arms differ only in toolName/details). */
export interface ToolResultEvent extends ToolResultEventBase {
  toolName: string;
  details: unknown;
}
export interface ToolResultEventBase {
  type: "tool_result";
  toolCallId: string;
  input: Record<string, unknown>;
  content: (PiTextContent | PiImageContent)[];
  isError: boolean;
  usage?: unknown;
}

export interface UIPromptStartEvent { type: "ui_prompt_start"; reason: "ui_prompt"; kind: string; title?: string }
export interface UIPromptEndEvent { type: "ui_prompt_end"; reason: "ui_prompt"; kind: string; title?: string }
export interface TurnStartEvent { type: "turn_start"; turnIndex: number; timestamp: number }
/** Real TurnEndEvent minus the BoundaryState fields pi-remote's fold never
 * consumes (entries/context/continue/outcome are pi boundary-machinery
 * inputs, not fold data). */
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

// ---------------------------------------------------------------------------
// Derivation helpers (pure, total).
// ---------------------------------------------------------------------------

const keyStore = new WeakMap<object, string>();
let keyCounter = 0;

/**
 * Stable correlation key for an AgentMessage object: identity-based
 * (WeakMap-backed), stable across in-place mutation, undefined for
 * non-objects. Note on AGENTS.md's "never module-level mutable state": that
 * rule targets session-scoped state that would leak across a session switch
 * (tunnels, footers, fold state, prompt registries). This is a key MINT — an
 * opaque, monotonically-labeled counter with no session data in it; the fold
 * state that consumes the keys stays in TranslateState (closure-scoped).
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
  const e = ev as {
    type?: unknown;
    contentIndex?: unknown;
    delta?: unknown;
    partial?: unknown;
    toolCall?: unknown;
  };
  switch (e.type) {
    case "text_delta":
      return typeof e.delta === "string" ? { kind: "text", delta: e.delta } : null;
    case "thinking_delta":
      return typeof e.delta === "string" && typeof e.contentIndex === "number"
        ? { kind: "thinking", contentIndex: e.contentIndex, delta: e.delta }
        : null;
    case "toolcall_start": {
      const block = toolCallAt(e.partial, e.contentIndex);
      return block ? { kind: "toolcall_start", id: block.id, toolName: block.name } : null;
    }
    case "toolcall_end": {
      // Real shape: top-level toolCall (pi-ai types.d.ts:517). Defensive
      // fallback: the block at contentIndex (older-shape tolerance).
      const top = toolCallOf(e.toolCall);
      const block = top ?? toolCallAt(e.partial, e.contentIndex);
      return block ? { kind: "toolcall_end", id: block.id } : null;
    }
    case "toolcall_delta": {
      const block = toolCallAt(e.partial, e.contentIndex);
      return block && typeof e.delta === "string" ? { kind: "toolcall_delta", id: block.id, delta: e.delta } : null;
    }
    // start/text_start/text_end/thinking_start/thinking_end/done/error →
    // no fold action (the fold keys on START-less text deltas and closes on
    // message_end, not on text_end/done).
    default:
      return null;
  }
}

function toolCallAt(partial: unknown, contentIndex: unknown): { id: string; name: string } | null {
  if (typeof partial !== "object" || partial === null) return null;
  const c = (partial as { content?: unknown }).content;
  if (!Array.isArray(c) || typeof contentIndex !== "number") return null;
  const b = c[contentIndex];
  if (typeof b !== "object" || b === null) return null;
  return toolCallOf(b);
}

function toolCallOf(b: unknown): { id: string; name: string } | null {
  if (typeof b !== "object" || b === null) return null;
  const blk = b as { type?: unknown; id?: unknown; name?: unknown };
  if (blk.type !== "toolCall" || typeof blk.id !== "string" || typeof blk.name !== "string") return null;
  return { id: blk.id, name: blk.name };
}

/** Role gate: only assistant/user messages open AG-UI message framing. */
export function roleOfAgentMessage(msg: unknown): "assistant" | "user" | undefined {
  if (typeof msg !== "object" || msg === null) return undefined;
  const role = (msg as { role?: unknown }).role;
  return role === "assistant" || role === "user" ? role : undefined;
}
