/**
 * EV-4 — pure pi-to-AG-UI translation mapper.
 *
 * A pure state-threading fold: `translate(input, state) → { frames, state }`.
 * No I/O, no socket/session/transport references, no hidden closure, no
 * random/clock/entropy primitives. `runId` is always input-driven (threaded
 * through `TranslateState.runId`), never minted here. Importing this module
 * has no side effects.
 *
 * Both the live path (EV-8) and the replay path (EV-5) import this module
 * unchanged. See docs/PI-SPEC.md §4 and the EV-4 design spec §1–§2.
 */

// ---------------------------------------------------------------------------
// AG-UI frame types (declared locally; the repo has no AG-UI SDK dependency).
// ---------------------------------------------------------------------------

export interface RunStartedFrame {
  type: "RUN_STARTED";
  threadId: string;
  runId: string;
}
export interface RunFinishedFrame {
  type: "RUN_FINISHED";
  threadId: string;
  runId: string;
}
export interface StepStartedFrame {
  type: "STEP_STARTED";
  stepName: "turn";
}
export interface StepFinishedFrame {
  type: "STEP_FINISHED";
  stepName: "turn";
}
export interface TextMessageStartFrame {
  type: "TEXT_MESSAGE_START";
  messageId: string;
  role: "assistant" | "user";
}
export interface TextMessageContentFrame {
  type: "TEXT_MESSAGE_CONTENT";
  messageId: string;
  delta: string;
}
export interface TextMessageEndFrame {
  type: "TEXT_MESSAGE_END";
  messageId: string;
}
export interface ReasoningMessageStartFrame {
  type: "REASONING_MESSAGE_START";
  messageId: string;
  role: "assistant";
}
export interface ReasoningMessageContentFrame {
  type: "REASONING_MESSAGE_CONTENT";
  messageId: string;
  delta: string;
}
export interface ReasoningMessageEndFrame {
  type: "REASONING_MESSAGE_END";
  messageId: string;
}
export interface ToolCallStartFrame {
  type: "TOOL_CALL_START";
  toolCallId: string;
  toolCallName: string;
  parentMessageId: string;
}
export interface ToolCallArgsFrame {
  type: "TOOL_CALL_ARGS";
  toolCallId: string;
  delta: string;
}
export interface ToolCallEndFrame {
  type: "TOOL_CALL_END";
  toolCallId: string;
}
export interface ToolCallResultFrame {
  type: "TOOL_CALL_RESULT";
  messageId: string;
  toolCallId: string;
  content: string;
  role: "tool";
}
export interface CustomFrame {
  type: "CUSTOM";
  name: string;
  value: { pi: string; data: unknown };
}

export type AgUiFrame =
  | RunStartedFrame
  | RunFinishedFrame
  | StepStartedFrame
  | StepFinishedFrame
  | TextMessageStartFrame
  | TextMessageContentFrame
  | TextMessageEndFrame
  | ReasoningMessageStartFrame
  | ReasoningMessageContentFrame
  | ReasoningMessageEndFrame
  | ToolCallStartFrame
  | ToolCallArgsFrame
  | ToolCallEndFrame
  | ToolCallResultFrame
  | CustomFrame;

// ---------------------------------------------------------------------------
// Pi event surface (live path) — normalized pi.event bus shapes per spec §2.
// ---------------------------------------------------------------------------

export type AssistantMessageEvent =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; contentIndex: number; delta: string }
  | { kind: "toolcall_start"; id: string; toolName: string }
  | { kind: "toolcall_delta"; id: string; delta: string }
  | { kind: "toolcall_end"; id: string };

export type ToolResultContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; image: unknown };

export type PiEvent =
  | { event: "agent_start" }
  | { event: "agent_settled" }
  | { event: "turn_start" }
  | { event: "turn_end" }
  | { event: "message_start"; messageId: string; role: "assistant" | "user" }
  | { event: "message_update"; messageId: string; events: AssistantMessageEvent[] }
  | { event: "message_end"; messageId: string }
  | { event: "tool_execution_start"; toolCallId: string; toolName: string }
  | { event: "tool_execution_update"; toolCallId: string; args?: unknown; partialResult?: string }
  | { event: "tool_execution_end"; toolCallId: string; result?: unknown; isError?: boolean }
  | { event: "tool_result"; messageId: string; toolCallId: string; content: ToolResultContentBlock[] }
  | { event: "ui.confirm"; promptKind: string; prompt: string }
  | { event: "session_compact"; summary?: string }
  | { event: "model_select"; model: string }
  | { event: "thinking_level_select"; level: string }
  | { event: "session_info_changed"; info: unknown }
  | { event: "user_input"; messageId: string; text: string };

// ---------------------------------------------------------------------------
// JSONL entry surface (replay path) — normalized entries per spec §5/§2.
// ---------------------------------------------------------------------------

export type JsonlContentBlock =
  | { type: "thought"; text: string }
  | { type: "text"; text: string };

export type JsonlEntry =
  | {
      kind: "message";
      entryId: string;
      role: "assistant" | "user";
      content: JsonlContentBlock[];
    }
  | { kind: "tool_result"; entryId: string; messageId: string; toolCallId: string; content: ToolResultContentBlock[] }
  | { kind: "compaction"; entryId: string; summary?: string }
  | { kind: "model_change"; entryId: string; model: string }
  | { kind: "thinking_level_change"; entryId: string; level: string }
  | { kind: "session_info"; entryId: string; info: unknown }
  | { kind: "bash_execution"; entryId: string; data: unknown }
  | { kind: "custom"; entryId: string; name: string; data: unknown }
  | { kind: "custom_message"; entryId: string; name: string; data: unknown };

export type Input = PiEvent | JsonlEntry;

// ---------------------------------------------------------------------------
// Fold state.
// ---------------------------------------------------------------------------

export interface OpenMessageState {
  role: "assistant" | "user";
  /** TEXT_MESSAGE_START has been emitted for this message. */
  textStarted: boolean;
  /** The currently-open reasoning pane messageId, if any. */
  thinkingPane: string | null;
  /** Open tool call ids (from the generation lane). */
  toolCalls: string[];
}

export interface TranslateState {
  /** Source of `threadId` on RUN_* frames (a plain string, not a session object). */
  sessionId: string;
  /** Input-driven; never minted here. Emitted on RUN_STARTED / RUN_FINISHED. */
  runId: string;
  /** Fold bookkeeping so START/END framing closes correctly across calls. */
  openMessages: Map<string, OpenMessageState>;
  /** Monotonic counter advanced per frame produced. */
  eventOrdinal: number;
}

export function createState(init: { sessionId: string; runId: string }): TranslateState {
  return {
    sessionId: init.sessionId,
    runId: init.runId,
    openMessages: new Map(),
    eventOrdinal: 0,
  };
}

// ---------------------------------------------------------------------------
// Deterministic (pure) helpers.
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hex hash — deterministic, pure, no entropy source. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Flatten (TextContent | ImageContent)[] blocks to a single string (S8). */
function flattenToolResultContent(blocks: ToolResultContentBlock[]): string {
  let out = "";
  for (const b of blocks) {
    if (b.type === "text") out += b.text;
    // images: represented/skipped (S8).
  }
  return out;
}

interface FoldResult {
  frames: AgUiFrame[];
  state: TranslateState;
}

function nextState(
  state: TranslateState,
  frames: AgUiFrame[],
  openMessages: Map<string, OpenMessageState>
): FoldResult {
  return { frames, state: { ...state, openMessages, eventOrdinal: state.eventOrdinal + frames.length } };
}

/** Emit a REASONING_MESSAGE_END for any open thinking pane of a message, then clear it. */
function closeThinking(
  st: OpenMessageState,
  frames: AgUiFrame[]
): void {
  if (st.thinkingPane !== null) {
    frames.push({ type: "REASONING_MESSAGE_END", messageId: st.thinkingPane });
    st.thinkingPane = null;
  }
}

// ---------------------------------------------------------------------------
// The mapper.
// ---------------------------------------------------------------------------

export function translate(input: Input, state: TranslateState): FoldResult {
  if ("kind" in input) {
    return translateJsonl(input, state);
  }
  return translateLive(input, state);
}

function translateJsonl(input: JsonlEntry, state: TranslateState): FoldResult {
  const frames: AgUiFrame[] = [];

  if (input.kind === "message") {
    const messageId = `msg-${input.entryId}`;
    const textStarted = false;
    let thinkingPane: string | null = null;

    const open: OpenMessageState = {
      role: input.role,
      textStarted,
      thinkingPane: null,
      toolCalls: [],
    };

    for (const block of input.content) {
      if (block.type === "thought") {
        if (open.thinkingPane === null) {
          open.thinkingPane = `${messageId}:think:0`;
          frames.push({
            type: "REASONING_MESSAGE_START",
            messageId: open.thinkingPane,
            role: "assistant",
          });
        }
        frames.push({ type: "REASONING_MESSAGE_CONTENT", messageId: open.thinkingPane, delta: block.text });
      } else {
        closeThinking(open, frames);
        if (!open.textStarted) {
          open.textStarted = true;
          frames.push({ type: "TEXT_MESSAGE_START", messageId, role: input.role });
        }
        frames.push({ type: "TEXT_MESSAGE_CONTENT", messageId, delta: block.text });
      }
    }
    closeThinking(open, frames);
    if (open.textStarted) {
      frames.push({ type: "TEXT_MESSAGE_END", messageId });
    }
    return nextState(state, frames, new Map(state.openMessages));
  }

  if (input.kind === "tool_result") {
    frames.push({
      type: "TOOL_CALL_RESULT",
      messageId: input.messageId,
      toolCallId: input.toolCallId,
      content: flattenToolResultContent(input.content),
      role: "tool",
    });
    return nextState(state, frames, state.openMessages);
  }
  if (input.kind === "bash_execution") {
    frames.push({ type: "CUSTOM", name: "pi.tool.bash_execution", value: { pi: "bash_execution", data: input.data } });
    return nextState(state, frames, state.openMessages);
  }
  if (input.kind === "custom" || input.kind === "custom_message") {
    frames.push({
      type: "CUSTOM",
      name: input.kind === "custom" ? "pi.custom" : "pi.custom_message",
      value: { pi: input.kind, data: { name: input.name, data: input.data } },
    });
    return nextState(state, frames, state.openMessages);
  }
  if (input.kind === "compaction") {
    frames.push({
      type: "CUSTOM",
      name: "pi.context.compaction",
      value: { pi: "session_compact", data: input.summary ? { summary: input.summary } : {} },
    });
    return nextState(state, frames, state.openMessages);
  }
  if (input.kind === "model_change") {
    frames.push({ type: "CUSTOM", name: "pi.session.model_change", value: { pi: "model_change", data: { model: input.model } } });
    return nextState(state, frames, state.openMessages);
  }
  if (input.kind === "thinking_level_change") {
    frames.push({ type: "CUSTOM", name: "pi.session.thinking_level_change", value: { pi: "thinking_level_change", data: { level: input.level } } });
    return nextState(state, frames, state.openMessages);
  }
  // session_info
  frames.push({ type: "CUSTOM", name: "pi.session.info_change", value: { pi: "session_info", data: { info: input.info } } });
  return nextState(state, frames, state.openMessages);
}

function translateLive(input: PiEvent, state: TranslateState): FoldResult {
  const frames: AgUiFrame[] = [];
  const openMessages = new Map(state.openMessages);

  switch (input.event) {
    case "agent_start":
      frames.push({ type: "RUN_STARTED", threadId: state.sessionId, runId: state.runId });
      break;

    case "agent_settled":
      // agent_settled → RUN_FINISHED, never agent_end, never RUN_ERROR (Q1/designer).
      frames.push({ type: "RUN_FINISHED", threadId: state.sessionId, runId: state.runId });
      break;

    case "turn_start":
      frames.push({ type: "STEP_STARTED", stepName: "turn" });
      break;

    case "turn_end":
      frames.push({ type: "STEP_FINISHED", stepName: "turn" });
      break;

    case "message_start": {
      // Opens fold bookkeeping only; TEXT_MESSAGE_START fires on the first text delta.
      openMessages.set(input.messageId, {
        role: input.role,
        textStarted: false,
        thinkingPane: null,
        toolCalls: [],
      });
      break;
    }

    case "message_update": {
      const st = openMessages.get(input.messageId) ?? {
        role: "assistant" as const,
        textStarted: false,
        thinkingPane: null,
        toolCalls: [],
      };
      for (const ev of input.events) {
        if (ev.kind === "text") {
          closeThinking(st, frames);
          if (!st.textStarted) {
            st.textStarted = true;
            frames.push({ type: "TEXT_MESSAGE_START", messageId: input.messageId, role: st.role });
          }
          frames.push({ type: "TEXT_MESSAGE_CONTENT", messageId: input.messageId, delta: ev.delta });
        } else if (ev.kind === "thinking") {
          if (st.thinkingPane === null) {
            st.thinkingPane = `${input.messageId}:think:${ev.contentIndex}`;
            frames.push({ type: "REASONING_MESSAGE_START", messageId: st.thinkingPane, role: "assistant" });
          }
          frames.push({ type: "REASONING_MESSAGE_CONTENT", messageId: st.thinkingPane, delta: ev.delta });
        } else if (ev.kind === "toolcall_start") {
          st.toolCalls.push(ev.id);
          frames.push({
            type: "TOOL_CALL_START",
            toolCallId: ev.id,
            toolCallName: ev.toolName,
            parentMessageId: input.messageId,
          });
        } else if (ev.kind === "toolcall_delta") {
          frames.push({ type: "TOOL_CALL_ARGS", toolCallId: ev.id, delta: ev.delta });
        } else {
          // toolcall_end
          st.toolCalls = st.toolCalls.filter((id) => id !== ev.id);
          frames.push({ type: "TOOL_CALL_END", toolCallId: ev.id });
        }
      }
      openMessages.set(input.messageId, st);
      break;
    }

    case "message_end": {
      const st = openMessages.get(input.messageId);
      if (st) {
        closeThinking(st, frames);
        if (st.textStarted) {
          frames.push({ type: "TEXT_MESSAGE_END", messageId: input.messageId });
        }
        openMessages.delete(input.messageId);
      }
      break;
    }

    case "tool_execution_start":
      // Execution lane → CUSTOM pi.tool.* (S2); never TOOL_CALL_*.
      frames.push({
        type: "CUSTOM",
        name: "pi.tool.start",
        value: { pi: "tool_execution_start", data: { toolCallId: input.toolCallId, toolName: input.toolName } },
      });
      break;

    case "tool_execution_update":
      frames.push({
        type: "CUSTOM",
        name: "pi.tool.update",
        value: {
          pi: "tool_execution_update",
          data: { toolCallId: input.toolCallId, args: input.args, partialResult: input.partialResult },
        },
      });
      break;

    case "tool_execution_end":
      frames.push({
        type: "CUSTOM",
        name: "pi.tool.end",
        value: {
          pi: "tool_execution_end",
          data: { toolCallId: input.toolCallId, result: input.result, isError: input.isError },
        },
      });
      break;

    case "tool_result":
      frames.push({
        type: "TOOL_CALL_RESULT",
        messageId: input.messageId,
        toolCallId: input.toolCallId,
        content: flattenToolResultContent(input.content),
        role: "tool",
      });
      break;

    case "ui.confirm":
      frames.push({
        type: "CUSTOM",
        name: "pi.human_input",
        value: {
          pi: "ui.confirm",
          data: {
            promptKind: input.promptKind,
            prompt: input.prompt,
            schemaVersion: 1,
            promptId: fnv1a(`${input.promptKind}\u0000${input.prompt}`),
          },
        },
      });
      break;

    case "session_compact":
      frames.push({
        type: "CUSTOM",
        name: "pi.context.compaction",
        value: { pi: "session_compact", data: input.summary ? { summary: input.summary } : {} },
      });
      break;

    case "model_select":
      frames.push({ type: "CUSTOM", name: "pi.session.model_change", value: { pi: "model_select", data: { model: input.model } } });
      break;

    case "thinking_level_select":
      frames.push({ type: "CUSTOM", name: "pi.session.thinking_level_change", value: { pi: "thinking_level_select", data: { level: input.level } } });
      break;

    case "session_info_changed":
      frames.push({ type: "CUSTOM", name: "pi.session.info_change", value: { pi: "session_info_changed", data: { info: input.info } } });
      break;

    case "user_input":
      // Injected locally, then echoed like any other message — role "user".
      frames.push({ type: "TEXT_MESSAGE_START", messageId: input.messageId, role: "user" });
      frames.push({ type: "TEXT_MESSAGE_CONTENT", messageId: input.messageId, delta: input.text });
      frames.push({ type: "TEXT_MESSAGE_END", messageId: input.messageId });
      break;

    default:
      // exhaustive guard — no fallthrough
      break;
  }

  return nextState(state, frames, openMessages);
}
