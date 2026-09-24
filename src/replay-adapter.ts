/**
 * EV-8 / FLLWUP-11 — SessionEntry → JsonlEntry adapter.
 *
 * `history.replayActiveBranch` consumes translate.ts's `JsonlEntry[]`, but the
 * live pi SDK session store carries a different shape. This file is the SINGLE
 * boundary that touches that shape: it declares a minimal structural vendor of
 * the real installed SDK's session entry (dist/core/session-manager.d.ts,
 * verified 2026-09-24 against pi-coding-agent dist) and normalizes it to the
 * vendored `JsonlEntry` surface.
 *
 * Pure, deterministic, no I/O. Unknown / unsupported entry types are skipped
 * so a forward-compatible SDK never breaks replay.
 *
 * Real SDK shape (SessionEntryBase): `{ type, id, parentId, timestamp }`.
 * Message entries embed the payload: `message: AgentMessage` (pi-ai `Message`,
 * roles system | user | assistant | toolResult). Content blocks: `text`,
 * `thinking` (text in `thinking`), `toolCall`, `image` (data + mimeType).
 */
import type { JsonlEntry, JsonlContentBlock, ToolResultContentBlock } from "./translate";

/**
 * Minimal structural vendor of the installed pi SDK's session entry.
 * Provenance: dist/core/session-manager.d.ts (SessionEntryBase + variants),
 * pi-ai `Message` content blocks. Re-diff on SDK upgrades (R-TYPE-1).
 * Only fields the adapter consumes are declared; the real SDK carries more.
 */
export interface SessionEntry {
  /** Real SDK: `SessionEntryBase.id`. Matches `JsonlEntry.entryId`. */
  id: string;
  /** Real SDK: `SessionEntryBase.parentId` (null for a root entry). */
  parentId: string | null;
  /** Real SDK: `SessionEntryBase.timestamp`. Unused by the adapter.
   * (Real SDK is ISO datetime strings; the fold ignores timestamps.) */
  timestamp?: unknown;
  type:
    | "message"
    | "usage"
    | "compaction"
    | "model_change"
    | "thinking_level_change"
    | "session_info"
    | "branch_summary"
    | "context_edit"
    | "label"
    | "custom"
    | "custom_message";
  /** Embedded message payload (real SDK: `message: AgentMessage`). */
  message?: {
    role: string;
    content?:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "thinking"; thinking: string }
          | { type: "toolCall"; id: string }
          | { type: "image"; data?: unknown }
          | { type: string; [k: string]: unknown }
        >;
    toolCallId?: string;
  };
  summary?: string; // compaction
  provider?: string; // model_change
  modelId?: string; // model_change
  thinkingLevel?: string; // thinking_level_change
  name?: string; // session_info
  customType?: string; // custom / custom_message
  data?: unknown; // custom
  details?: unknown; // custom_message
}

type MessageBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "toolCall"; id: string }
  | { type: "image"; data?: unknown }
  | { type: string; [k: string]: unknown };
type MessageBlocks = MessageBlock[];

function mapMessageContent(blocks: MessageBlocks): JsonlContentBlock[] {
  const out: JsonlContentBlock[] = [];
  for (const b of blocks) {
    if (b.type === "text" && typeof (b as { text?: unknown }).text === "string") {
      out.push({ type: "text", text: (b as { text: string }).text });
    } else if (b.type === "thinking" && typeof (b as { thinking?: unknown }).thinking === "string") {
      out.push({ type: "thought", text: (b as { thinking: string }).thinking });
    }
    // toolCall blocks carry no user-visible text for the AG-UI snapshot;
    // image blocks are not representable on the text-only JsonlContentBlock
    // surface — both are skipped.
  }
  return out;
}

function mapToolResultContent(blocks: MessageBlocks): ToolResultContentBlock[] {
  const out: ToolResultContentBlock[] = [];
  for (const b of blocks) {
    if (b.type === "text" && typeof (b as { text?: unknown }).text === "string") {
      out.push({ type: "text", text: (b as { text: string }).text });
    } else if (b.type === "image" && typeof (b as { data?: unknown }).data === "string") {
      out.push({ type: "image", image: (b as { data: string }).data });
    }
  }
  return out;
}

/** Normalize a real SDK session-entry stream to the vendored JsonlEntry surface. */
export function sessionEntriesToJsonl(entries: SessionEntry[]): JsonlEntry[] {
  const out: JsonlEntry[] = [];
  for (const e of entries) {
    switch (e.type) {
      case "message": {
        const msg = e.message;
        if (!msg) break; // malformed message entry — skip (never crash)
        if (msg.role === "user") {
          out.push({
            kind: "message",
            entryId: e.id,
            role: "user",
            content:
              typeof msg.content === "string"
                ? [{ type: "text", text: msg.content }]
                : mapMessageContent((msg.content ?? []) as MessageBlocks),
          });
        } else if (msg.role === "assistant") {
          out.push({
            kind: "message",
            entryId: e.id,
            role: "assistant",
            content: mapMessageContent((msg.content ?? []) as MessageBlocks),
          });
        } else if (msg.role === "toolResult") {
          out.push({
            kind: "tool_result",
            entryId: e.id,
            // The real SDK tool result has no separate message id; the entry
            // id doubles as the messageId for AG-UI correlation.
            messageId: e.id,
            toolCallId: msg.toolCallId ?? "",
            content: mapToolResultContent((msg.content ?? []) as MessageBlocks),
          });
        }
        // role "system" (base/system prompt) → not replayable, skip.
        break;
      }
      case "compaction":
        out.push({ kind: "compaction", entryId: e.id, summary: e.summary });
        break;
      case "model_change":
        out.push({
          kind: "model_change",
          entryId: e.id,
          model: e.provider && e.modelId ? `${e.provider}/${e.modelId}` : (e.modelId ?? ""),
        });
        break;
      case "thinking_level_change":
        out.push({ kind: "thinking_level_change", entryId: e.id, level: e.thinkingLevel ?? "" });
        break;
      case "session_info":
        out.push({ kind: "session_info", entryId: e.id, info: e.name });
        break;
      case "custom":
        out.push({ kind: "custom", entryId: e.id, name: e.customType ?? "", data: e.data });
        break;
      case "custom_message":
        out.push({ kind: "custom_message", entryId: e.id, name: e.customType ?? "", data: e.details });
        break;
      // usage / branch_summary / context_edit / label / unknown → no JSONL
      // representation; skip (forward-compatible).
    }
  }
  return out;
}
