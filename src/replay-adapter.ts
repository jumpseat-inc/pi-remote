/**
 * EV-8 — SessionEntry → JsonlEntry adapter (spec §5.4).
 *
 * `history.replayActiveBranch` consumes translate.ts's `JsonlEntry[]`, but
 * the live pi SDK exposes its own session-entry shape (`SessionEntry`). The
 * pi SDK `SessionEntry` type is NOT vendored in this repo, so this file is
 * the SINGLE boundary that touches that un-vendored shape: it declares a
 * minimal structural local type at the boundary (never importing a
 * non-existent SDK path) and normalizes it to the vendored `JsonlEntry`.
 *
 * Pure, deterministic, no I/O. Unknown / unsupported entry types are skipped
 * so a forward-compatible SDK never breaks replay.
 */
import type { JsonlEntry, JsonlContentBlock, ToolResultContentBlock } from "./translate";

/**
 * Minimal structural stand-in for the pi SDK's session entry shape. Only the
 * fields the adapter consumes are declared; the real SDK is free to carry
 * more. `entryId` matches `JsonlEntry.entryId`; `type` distinguishes kinds.
 */
export interface SessionEntry {
  entryId: string;
  type:
    | "message"
    | "tool_result"
    | "compaction"
    | "model_change"
    | "thinking_level_change"
    | "session_info"
    | "bash_execution"
    | "custom"
    | "custom_message";
  role?: "assistant" | "user";
  content?: SessionContentBlock[];
  summary?: string; // compaction
  model?: string; // model_change
  level?: string; // thinking_level_change
  info?: unknown; // session_info
  name?: string; // custom / custom_message
  data?: unknown; // custom / custom_message / bash_execution
  messageId?: string; // tool_result
  toolCallId?: string; // tool_result
}

/** Structural stand-in for a session content block. */
export type SessionContentBlock =
  | { type: "text"; text: string }
  | { type: "thought"; text: string };

function mapContent(block: SessionContentBlock): JsonlContentBlock {
  return { type: block.type, text: block.text };
}

/** Normalize a session entry stream to the vendored JsonlEntry surface. */
export function sessionEntriesToJsonl(entries: SessionEntry[]): JsonlEntry[] {
  const out: JsonlEntry[] = [];
  for (const e of entries) {
    switch (e.type) {
      case "message":
        out.push({
          kind: "message",
          entryId: e.entryId,
          role: e.role ?? "assistant",
          content: (e.content ?? []).map(mapContent),
        });
        break;
      case "tool_result":
        out.push({
          kind: "tool_result",
          entryId: e.entryId,
          messageId: e.messageId ?? "",
          toolCallId: e.toolCallId ?? "",
          // Tool results carry text blocks only; thought/image blocks are not
          // representable on the JSONL tool-result surface and are skipped.
          content: (e.content ?? [])
            .filter((b): b is { type: "text"; text: string } => b.type === "text")
            .map((b) => ({ type: "text" as const, text: b.text })),
        });
        break;
      case "compaction":
        out.push({ kind: "compaction", entryId: e.entryId, summary: e.summary });
        break;
      case "model_change":
        out.push({ kind: "model_change", entryId: e.entryId, model: e.model ?? "" });
        break;
      case "thinking_level_change":
        out.push({ kind: "thinking_level_change", entryId: e.entryId, level: e.level ?? "" });
        break;
      case "session_info":
        out.push({ kind: "session_info", entryId: e.entryId, info: e.info });
        break;
      case "bash_execution":
        out.push({ kind: "bash_execution", entryId: e.entryId, data: e.data });
        break;
      case "custom":
        out.push({ kind: "custom", entryId: e.entryId, name: e.name ?? "", data: e.data });
        break;
      case "custom_message":
        out.push({ kind: "custom_message", entryId: e.entryId, name: e.name ?? "", data: e.data });
        break;
      default:
        // Unrecognized SDK entry type — skip (forward-compatible).
        break;
    }
  }
  return out;
}
