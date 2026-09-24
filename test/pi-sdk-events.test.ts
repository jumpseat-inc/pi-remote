import { describe, expect, test } from "bun:test";
import { agentMessageId, messageFrameRole, realAssistantMessageEventOf, roleOfAgentMessage } from "../src/pi-sdk-events";
import type { MessageStartEvent } from "../src/pi-sdk-events";

describe("FLLWUP-12: vendored real payload derivation helpers", () => {
  test("agentMessageId: (role, timestamp)-derived; identical across spread copies (real engine emits a fresh copy per event, agent-loop.js:284/295-299/309)", () => {
    const a = { role: "assistant", timestamp: 1727123456789 };
    const copy = { ...a, content: [{ type: "text", text: "hello" }] }; // what agent-loop.js emits per event
    expect(agentMessageId(a)).toBe(agentMessageId(copy));
    expect(agentMessageId(a)).toBe("assistant:1727123456789");
  });

  test("agentMessageId: distinct timestamps → distinct ids (separate assistant streams never collide)", () => {
    expect(agentMessageId({ role: "assistant", timestamp: 1 })).not.toBe(agentMessageId({ role: "assistant", timestamp: 2 }));
  });

  test("agentMessageId: total — non-objects, wrong roles, non-finite timestamps → undefined", () => {
    expect(agentMessageId(null)).toBeUndefined();
    expect(agentMessageId(undefined)).toBeUndefined();
    expect(agentMessageId("m1")).toBeUndefined();
    expect(agentMessageId(42)).toBeUndefined();
    expect(agentMessageId({ role: "system", timestamp: 0 })).toBeUndefined(); // role gate
    expect(agentMessageId({ role: "assistant" })).toBeUndefined(); // missing timestamp
    expect(agentMessageId({ role: "assistant", timestamp: Number.NaN })).toBeUndefined();
    expect(agentMessageId({ role: "assistant", timestamp: Number.POSITIVE_INFINITY })).toBeUndefined();
    expect(agentMessageId({ role: "assistant", timestamp: "0" })).toBeUndefined();
  });

  test("messageFrameRole: back-derives role from a minted id; undefined for foreign formats", () => {
    expect(messageFrameRole("assistant:1727123456789")).toBe("assistant");
    expect(messageFrameRole("user:0")).toBe("user");
    expect(messageFrameRole("assistant:")).toBe("assistant"); // colon, empty ts — role still decodable
    expect(messageFrameRole("msg-11")).toBeUndefined(); // replay path / opaque ids
    expect(messageFrameRole("system:0")).toBeUndefined(); // gated roles
    expect(messageFrameRole("toolResult:0")).toBeUndefined();
    expect(messageFrameRole(":5")).toBeUndefined(); // empty role
    expect(messageFrameRole("nouserr")).toBeUndefined(); // no colon
    expect(messageFrameRole("")).toBeUndefined();
  });

  test("realAssistantMessageEventOf: text_delta/thinking_delta map with delta+contentIndex", () => {
    const partial = { role: "assistant", content: [] };
    expect(realAssistantMessageEventOf({ type: "text_delta", contentIndex: 0, delta: "hi", partial })).toEqual({ kind: "text", delta: "hi" });
    expect(realAssistantMessageEventOf({ type: "thinking_delta", contentIndex: 2, delta: "th", partial })).toEqual({ kind: "thinking", contentIndex: 2, delta: "th" });
  });

  test("realAssistantMessageEventOf: toolcall_start derives id+toolName from partial.content[contentIndex]", () => {
    const partial = { role: "assistant", content: [{ type: "toolCall", id: "call_9", name: "bash", arguments: {} }] };
    expect(realAssistantMessageEventOf({ type: "toolcall_start", contentIndex: 0, partial })).toEqual({ kind: "toolcall_start", id: "call_9", toolName: "bash" });
  });

  test("realAssistantMessageEventOf: toolcall_end prefers the top-level toolCall, falls back to the content block", () => {
    // Real shape (pi-ai types.d.ts:517): toolcall_end carries toolCall: ToolCall.
    const partial = { role: "assistant", content: [{ type: "text", text: "x" }] };
    expect(realAssistantMessageEventOf({ type: "toolcall_end", contentIndex: 0, toolCall: { type: "toolCall", id: "call_7", name: "read", arguments: {} }, partial })).toEqual({ kind: "toolcall_end", id: "call_7" });
    // Defensive fallback: block at contentIndex (older SDK shape tolerance).
    const partial2 = { role: "assistant", content: [{ type: "toolCall", id: "call_8", name: "edit", arguments: {} }] };
    expect(realAssistantMessageEventOf({ type: "toolcall_end", contentIndex: 0, partial: partial2 })).toEqual({ kind: "toolcall_end", id: "call_8" });
  });

  test("realAssistantMessageEventOf: toolcall_delta derives id from the content block; missing block → null", () => {
    const partial = { role: "assistant", content: [{ type: "toolCall", id: "call_9", name: "bash", arguments: {} }] };
    expect(realAssistantMessageEventOf({ type: "toolcall_delta", contentIndex: 0, delta: '{"a"', partial })).toEqual({ kind: "toolcall_delta", id: "call_9", delta: '{"a"' });
    expect(realAssistantMessageEventOf({ type: "toolcall_delta", contentIndex: 3, delta: "x", partial })).toBeNull();
    expect(realAssistantMessageEventOf({ type: "toolcall_delta", delta: "x" })).toBeNull();
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
    const good: MessageStartEvent = { type: "message_start", message: { role: "user", content: "x", timestamp: 0 } };
    expect(good.type).toBe("message_start");
    // @ts-expect-error missing required `message` field must be a type error
    const bad: MessageStartEvent = { type: "message_start" };
    void bad;
  });
});
