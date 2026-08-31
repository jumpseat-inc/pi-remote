/**
 * EV-8 — SessionEntry → JsonlEntry adapter dedicated test (spec §5.4).
 */
import { describe, expect, test } from "bun:test";
import { sessionEntriesToJsonl, type SessionEntry } from "../src/replay-adapter";

describe("sessionEntriesToJsonl", () => {
  test("maps a message with text + thought blocks", () => {
    const out = sessionEntriesToJsonl([
      {
        entryId: "e1",
        type: "message",
        role: "assistant",
        content: [
          { type: "thought", text: "hmm" },
          { type: "text", text: "hello" },
        ],
      },
    ]);
    expect(out).toEqual([
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

  test("defaults message role to assistant when absent", () => {
    const out = sessionEntriesToJsonl([{ entryId: "e1", type: "message", content: [] }]);
    expect(out[0]).toMatchObject({ kind: "message", role: "assistant" });
  });

  test("maps tool_result with content", () => {
    const out = sessionEntriesToJsonl([
      {
        entryId: "e2",
        type: "tool_result",
        messageId: "m1",
        toolCallId: "tc1",
        content: [{ type: "text", text: "42" }],
      },
    ]);
    expect(out).toEqual([
      {
        kind: "tool_result",
        entryId: "e2",
        messageId: "m1",
        toolCallId: "tc1",
        content: [{ type: "text", text: "42" }],
      },
    ]);
  });

  test("maps compaction, model_change, thinking_level_change, session_info", () => {
    const out = sessionEntriesToJsonl([
      { entryId: "c1", type: "compaction", summary: "s" },
      { entryId: "m1", type: "model_change", model: "gpt-5" },
      { entryId: "t1", type: "thinking_level_change", level: "high" },
      { entryId: "i1", type: "session_info", info: { a: 1 } },
    ]);
    expect(out).toEqual([
      { kind: "compaction", entryId: "c1", summary: "s" },
      { kind: "model_change", entryId: "m1", model: "gpt-5" },
      { kind: "thinking_level_change", entryId: "t1", level: "high" },
      { kind: "session_info", entryId: "i1", info: { a: 1 } },
    ]);
  });

  test("maps bash_execution, custom, custom_message", () => {
    const out = sessionEntriesToJsonl([
      { entryId: "b1", type: "bash_execution", data: { cmd: "ls" } },
      { entryId: "cu1", type: "custom", name: "x", data: 1 },
      { entryId: "cm1", type: "custom_message", name: "y", data: 2 },
    ]);
    expect(out).toEqual([
      { kind: "bash_execution", entryId: "b1", data: { cmd: "ls" } },
      { kind: "custom", entryId: "cu1", name: "x", data: 1 },
      { kind: "custom_message", entryId: "cm1", name: "y", data: 2 },
    ]);
  });

  test("skips unrecognized entry types (forward-compatible)", () => {
    const out = sessionEntriesToJsonl([
      { entryId: "e1", type: "message", content: [] },
      { entryId: "unknown", type: "future_kind" as SessionEntry["type"] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "message" });
  });

  test("empty input → empty output", () => {
    expect(sessionEntriesToJsonl([])).toEqual([]);
  });
});
