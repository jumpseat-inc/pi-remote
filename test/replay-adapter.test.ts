/**
 * EV-8 / FLLWUP-11 — SessionEntry → JsonlEntry adapter tests.
 *
 * Fixtures use the REAL installed pi SDK session-entry shape
 * (dist/core/session-manager.d.ts): `{ id, parentId, timestamp, type, … }`
 * with the message payload embedded as `message: AgentMessage`
 * (pi-ai `Message`: roles system | user | assistant | toolResult).
 */
import { describe, expect, test } from "bun:test";
import { sessionEntriesToJsonl, type SessionEntry } from "../src/replay-adapter";

describe("sessionEntriesToJsonl", () => {
  test("maps user + assistant message entries (real embedded-message shape)", () => {
    const out = sessionEntriesToJsonl([
      {
        id: "e0",
        parentId: null,
        timestamp: "2026-01-01T00:00:00.000Z",
        type: "message",
        message: { role: "user", content: "hi" },
      },
      {
        id: "e1",
        parentId: "e0",
        timestamp: "2026-01-01T00:00:01.000Z",
        type: "message",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "hmm" },
            { type: "text", text: "hello" },
          ],
        },
      } as unknown as SessionEntry,
    ]);
    expect(out).toEqual([
      { kind: "message", entryId: "e0", role: "user", content: [{ type: "text", text: "hi" }] },
      {
        kind: "message",
        entryId: "e1",
        role: "assistant",
        content: [
          { type: "thought", text: "hmm" },
          { type: "text", text: "hello" },
        ],
      },
    ]);
  });

  test("maps an assistant toolCall + toolResult message pair", () => {
    const out = sessionEntriesToJsonl([
      {
        id: "e1",
        parentId: null,
        timestamp: "t",
        type: "message",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "running" },
            { type: "toolCall", id: "tc1", name: "bash", arguments: {} },
          ],
        },
      } as unknown as SessionEntry,
      {
        id: "e2",
        parentId: "e1",
        timestamp: "t",
        type: "message",
        message: {
          role: "toolResult",
          toolCallId: "tc1",
          toolName: "bash",
          content: [{ type: "text", text: "42" }],
          isError: false,
        },
      } as unknown as SessionEntry,
    ]);
    expect(out).toEqual([
      { kind: "message", entryId: "e1", role: "assistant", content: [{ type: "text", text: "running" }] },
      { kind: "tool_result", entryId: "e2", messageId: "e2", toolCallId: "tc1", content: [{ type: "text", text: "42" }] },
    ]);
  });

  test("skips system messages and toolCall/thinking-only assistant noise is reduced to kept blocks", () => {
    const out = sessionEntriesToJsonl([
      {
        id: "s0",
        parentId: null,
        timestamp: "t",
        type: "message",
        message: { role: "system", content: "base prompt" },
      } as unknown as SessionEntry,
      {
        id: "e1",
        parentId: null,
        timestamp: "t",
        type: "message",
        message: { role: "assistant", content: [{ type: "toolCall", id: "tc9", name: "x", arguments: {} }] },
      } as unknown as SessionEntry,
    ]);
    expect(out).toEqual([
      { kind: "message", entryId: "e1", role: "assistant", content: [] },
    ]);
  });

  test("maps compaction, model_change, thinking_level_change, session_info", () => {
    const out = sessionEntriesToJsonl([
      { id: "c1", parentId: null, timestamp: "t", type: "compaction", summary: "s" } as unknown as SessionEntry,
      { id: "m1", parentId: null, timestamp: "t", type: "model_change", provider: "openai", modelId: "gpt-5" } as unknown as SessionEntry,
      { id: "t1", parentId: null, timestamp: "t", type: "thinking_level_change", thinkingLevel: "high" } as unknown as SessionEntry,
      { id: "i1", parentId: null, timestamp: "t", type: "session_info", name: "my session" } as unknown as SessionEntry,
    ]);
    expect(out).toEqual([
      { kind: "compaction", entryId: "c1", summary: "s" },
      { kind: "model_change", entryId: "m1", model: "openai/gpt-5" },
      { kind: "thinking_level_change", entryId: "t1", level: "high" },
      { kind: "session_info", entryId: "i1", info: "my session" },
    ]);
  });

  test("maps custom and custom_message via customType/details", () => {
    const out = sessionEntriesToJsonl([
      { id: "cu1", parentId: null, timestamp: "t", type: "custom", customType: "x", data: 1 } as unknown as SessionEntry,
      { id: "cm1", parentId: null, timestamp: "t", type: "custom_message", customType: "y", details: 2 } as unknown as SessionEntry,
    ]);
    expect(out).toEqual([
      { kind: "custom", entryId: "cu1", name: "x", data: 1 },
      { kind: "custom_message", entryId: "cm1", name: "y", data: 2 },
    ]);
  });

  test("skips usage / branch_summary / context_edit / label entries (no JSONL representation)", () => {
    const out = sessionEntriesToJsonl([
      { id: "u1", parentId: null, timestamp: "t", type: "usage", kind: "cache_warm", provider: "p", model: "m", usage: {} } as unknown as SessionEntry,
      { id: "b1", parentId: null, timestamp: "t", type: "branch_summary", fromId: "x", summary: "s" } as unknown as SessionEntry,
      { id: "l1", parentId: null, timestamp: "t", type: "label", targetId: "x", label: "L" } as unknown as SessionEntry,
      { id: "ce1", parentId: null, timestamp: "t", type: "context_edit", targetId: "x", replacement: null } as unknown as SessionEntry,
    ] as unknown as SessionEntry[]);
    expect(out).toEqual([]);
  });

  test("skips unrecognized entry types (forward-compatible)", () => {
    const out = sessionEntriesToJsonl([
      {
        id: "e1",
        parentId: null,
        timestamp: "t",
        type: "message",
        message: { role: "user", content: "hi" },
      },
      { id: "unknown", parentId: null, timestamp: "t", type: "future_kind" } as unknown as SessionEntry,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "message", role: "user" });
  });

  test("empty input → empty output", () => {
    expect(sessionEntriesToJsonl([])).toEqual([]);
  });
});
