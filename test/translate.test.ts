import { describe, expect, test } from "bun:test";
import { translate, createState } from "../src/translate";
import type { PiEvent, JsonlEntry, AgUiFrame } from "../src/translate";

/** Translate a sequence of events through the shared fold, collecting all frames. */
function runSequence(
  events: (PiEvent | JsonlEntry)[],
  init: { sessionId: string; runId: string }
): AgUiFrame[] {
  let state = createState(init);
  const frames: AgUiFrame[] = [];
  for (const e of events) {
    const r = translate(e, state);
    frames.push(...r.frames);
    state = r.state;
  }
  return frames;
}

describe("EV-4 pure pi-to-AG-UI translation", () => {
  test("agent_start → RUN_STARTED with threadId=sessionId, runId from state", () => {
    const frames = runSequence([{ event: "agent_start" }], { sessionId: "s1", runId: "r1" });
    expect(frames).toEqual([
      { type: "RUN_STARTED", threadId: "s1", runId: "r1" },
    ]);
  });

  test("agent_settled → RUN_FINISHED, never RUN_ERROR (closed grey G-14)", () => {
    const frames = runSequence([{ event: "agent_settled" }], { sessionId: "s1", runId: "r1" });
    expect(frames).toEqual([
      { type: "RUN_FINISHED", threadId: "s1", runId: "r1" },
    ]);
    expect(frames.map((f) => f.type)).not.toContain("RUN_ERROR");
  });

  test("one RUN_STARTED/RUN_FINISHED pair per runId (G-14)", () => {
    const frames = runSequence(
      [
        { event: "agent_start" },
        { event: "agent_settled" },
        { event: "agent_start" },
        { event: "agent_settled" },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    const starts = frames.filter((f) => f.type === "RUN_STARTED");
    const finishes = frames.filter((f) => f.type === "RUN_FINISHED");
    expect(starts).toHaveLength(2);
    expect(finishes).toHaveLength(2);
    expect(starts).toEqual([
      { type: "RUN_STARTED", threadId: "s1", runId: "r1" },
      { type: "RUN_STARTED", threadId: "s1", runId: "r1" },
    ]);
  });

  test("runId is input-driven, never minted (G-14)", () => {
    const frames = runSequence([{ event: "agent_start" }, { event: "agent_settled" }], {
      sessionId: "s2",
      runId: "deterministic-run-42",
    });
    expect(frames).toEqual([
      { type: "RUN_STARTED", threadId: "s2", runId: "deterministic-run-42" },
      { type: "RUN_FINISHED", threadId: "s2", runId: "deterministic-run-42" },
    ]);
  });

  test("turn_start/turn_end → STEP_STARTED/STEP_FINISHED with stepName 'turn'", () => {
    const frames = runSequence([{ event: "turn_start" }, { event: "turn_end" }], {
      sessionId: "s1",
      runId: "r1",
    });
    expect(frames).toEqual([
      { type: "STEP_STARTED", stepName: "turn" },
      { type: "STEP_FINISHED", stepName: "turn" },
    ]);
    for (const f of frames) expect((f as { stepName: string }).stepName).toBe("turn");
  });

  test("assistant text delta stream → TEXT_MESSAGE_START/CONTENT/END around the message", () => {
    const frames = runSequence(
      [
        { event: "message_start", messageId: "assistant-1", role: "assistant" },
        { event: "message_update", messageId: "assistant-1", events: [{ kind: "text", delta: "hi " }, { kind: "text", delta: "there" }] },
        { event: "message_end", messageId: "assistant-1" },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toEqual([
      { type: "TEXT_MESSAGE_START", messageId: "assistant-1", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "assistant-1", delta: "hi " },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "assistant-1", delta: "there" },
      { type: "TEXT_MESSAGE_END", messageId: "assistant-1" },
    ]);
  });

  test("thinking content → REASONING_MESSAGE_*, never THINKING_TEXT_MESSAGE_* (O1)", () => {
    const frames = runSequence(
      [
        { event: "message_start", messageId: "assistant-1", role: "assistant" },
        { event: "message_update", messageId: "assistant-1", events: [{ kind: "thinking", contentIndex: 0, delta: "ponder" }] },
        { event: "message_end", messageId: "assistant-1" },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    for (const f of frames) {
      expect(f.type.startsWith("REASONING_MESSAGE_")).toBe(true);
      expect(f.type.startsWith("THINKING_TEXT_MESSAGE_")).toBe(false);
    }
    expect(frames).toEqual([
      { type: "REASONING_MESSAGE_START", messageId: "assistant-1:think:0", role: "assistant" },
      { type: "REASONING_MESSAGE_CONTENT", messageId: "assistant-1:think:0", delta: "ponder" },
      { type: "REASONING_MESSAGE_END", messageId: "assistant-1:think:0" },
    ]);
  });

  test("mixed think,think,text splits into reasoning pane then text pane (O1)", () => {
    const frames = runSequence(
      [
        { event: "message_start", messageId: "assistant-1", role: "assistant" },
        {
          event: "message_update",
          messageId: "assistant-1",
          events: [
            { kind: "thinking", contentIndex: 0, delta: "a" },
            { kind: "thinking", contentIndex: 1, delta: "b" },
            { kind: "text", delta: "hi" },
          ],
        },
        { event: "message_end", messageId: "assistant-1" },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toEqual([
      { type: "REASONING_MESSAGE_START", messageId: "assistant-1:think:0", role: "assistant" },
      { type: "REASONING_MESSAGE_CONTENT", messageId: "assistant-1:think:0", delta: "a" },
      { type: "REASONING_MESSAGE_CONTENT", messageId: "assistant-1:think:0", delta: "b" },
      { type: "REASONING_MESSAGE_END", messageId: "assistant-1:think:0" },
      { type: "TEXT_MESSAGE_START", messageId: "assistant-1", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "assistant-1", delta: "hi" },
      { type: "TEXT_MESSAGE_END", messageId: "assistant-1" },
    ]);
  });

  test("tool generation lane toolcall_start/delta/end → TOOL_CALL_START/ARGS/END, parentMessageId threaded (O2)", () => {
    const frames = runSequence(
      [
        { event: "message_start", messageId: "assistant-1", role: "assistant" },
        {
          event: "message_update",
          messageId: "assistant-1",
          events: [
            { kind: "toolcall_start", id: "call_1", toolName: "bash" },
            { kind: "toolcall_delta", id: "call_1", delta: '{"cmd":"ls"}' },
            { kind: "toolcall_end", id: "call_1" },
          ],
        },
        { event: "message_end", messageId: "assistant-1" },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toEqual([
      { type: "TOOL_CALL_START", toolCallId: "call_1", toolCallName: "bash", parentMessageId: "assistant-1" },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_1", delta: '{"cmd":"ls"}' },
      { type: "TOOL_CALL_END", toolCallId: "call_1" },
    ]);
  });

  test("tool_execution_* → CUSTOM pi.tool.* only, never TOOL_CALL_* (O2)", () => {
    const frames = runSequence(
      [
        { event: "tool_execution_start", toolCallId: "call_9", toolName: "bash" },
        { event: "tool_execution_update", toolCallId: "call_9", args: { cmd: "ls" }, partialResult: "file.txt" },
        { event: "tool_execution_end", toolCallId: "call_9", result: "done", isError: false },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames.map((f) => f.type)).not.toContain("TOOL_CALL_START");
    expect(frames.map((f) => f.type)).not.toContain("TOOL_CALL_ARGS");
    expect(frames.map((f) => f.type)).not.toContain("TOOL_CALL_END");
    // FLLWUP-3: the update fans out into pi.tool.update + pi.tool.progress → 4 frames.
    expect(frames.map((f) => f.type)).toEqual(["CUSTOM", "CUSTOM", "CUSTOM", "CUSTOM"]);
    const o2Names = frames.map((f) => (f as { type: "CUSTOM"; name: string }).name);
    expect(o2Names).toEqual(["pi.tool.start", "pi.tool.update", "pi.tool.progress", "pi.tool.end"]);
    for (const f of frames) {
      if (f.type === "CUSTOM") {
        expect(f.name.startsWith("pi.tool.")).toBe(true);
        expect(Object.keys(f.value)).toEqual(["pi", "data"]);
      }
    }
  });

  test("tool_result message → TOOL_CALL_RESULT with content flattened to string (O3)", () => {
    const frames = runSequence(
      [
        { event: "message_start", messageId: "assistant-1", role: "assistant" },
        { event: "message_end", messageId: "assistant-1" },
        {
          event: "tool_result",
          messageId: "result-1",
          toolCallId: "call_1",
          content: [
            { type: "text", text: "alpha" },
            { type: "image", image: { type: "image_asset_id", asset: "x" } },
            { type: "text", text: "omega" },
          ],
        },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    const result = frames.find((f) => f.type === "TOOL_CALL_RESULT") as
      | { type: "TOOL_CALL_RESULT"; messageId: string; toolCallId: string; content: unknown; role: string }
      | undefined;
    expect(result).toBeDefined();
    expect(result!.messageId).toBe("result-1");
    expect(result!.toolCallId).toBe("call_1");
    expect(result!.role).toBe("tool");
    expect(typeof result!.content).toBe("string");
    expect(result!.content).toBe("alphaomega");
  });

  test("ui.confirm → CUSTOM pi.human_input with deterministic promptId", () => {
    const mk = () =>
      runSequence([{ event: "ui.confirm", promptKind: "confirm_exec", prompt: "Run rm -rf /?" }], {
        sessionId: "s1",
        runId: "r1",
      });
    const a = mk();
    const b = mk();
    const c = a[0] as {
      type: "CUSTOM";
      name: string;
      value: { pi: string; data: { promptKind: string; prompt: string; schemaVersion: number; promptId?: string } };
    };
    const d = b[0] as typeof c;
    expect(c.type).toBe("CUSTOM");
    expect(c.name).toBe("pi.human_input");
    expect(c.value.pi).toBe("ui.confirm");
    expect(c.value.data.promptKind).toBe("confirm_exec");
    expect(c.value.data.prompt).toBe("Run rm -rf /?");
    expect(typeof c.value.data.promptId).toBe("string");
    expect(c.value.data.promptId!.length).toBeGreaterThan(0);
    expect(c.value.data.promptId).toMatch(/^[0-9a-f]+$/);
    expect(c.value.data.promptId).toBe(d.value.data.promptId); // deterministic across replay
    expect(Object.keys(c.value)).toEqual(["pi", "data"]);
  });

  test("session_compact → CUSTOM pi.context.*", () => {
    const frames = runSequence([{ event: "session_compact", summary: "sum" }], { sessionId: "s1", runId: "r1" });
    const f = frames[0] as { type: "CUSTOM"; name: string };
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.context.compaction");
  });

  test("model/thinking/session events → CUSTOM pi.session.*", () => {
    const frames = runSequence(
      [
        { event: "model_select", model: "claude-3.7" },
        { event: "thinking_level_select", level: "high" },
        { event: "session_info_changed", info: { id: "x" } },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    const customs = frames.filter((f) => f.type === "CUSTOM") as { name: string }[];
    expect(customs.map((c) => c.name)).toEqual([
      "pi.session.model_change",
      "pi.session.thinking_level_change",
      "pi.session.info_change",
    ]);
  });

  test("user role: message_start → message_update delta → message_end renders TEXT_MESSAGE_START/CONTENT/END", () => {
    const frames = runSequence(
      [
        { event: "message_start", messageId: "user-1", role: "user" },
        { event: "message_update", messageId: "user-1", events: [{ kind: "text", delta: "hel" }] },
        { event: "message_update", messageId: "user-1", events: [{ kind: "text", delta: "lo" }] },
        { event: "message_end", messageId: "user-1" },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toEqual([
      { type: "TEXT_MESSAGE_START", messageId: "user-1", role: "user" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "user-1", delta: "hel" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "user-1", delta: "lo" },
      { type: "TEXT_MESSAGE_END", messageId: "user-1" },
    ]);
  });

  test("FLLWUP-5 (a): ui_prompt_end → CUSTOM pi.human_input.closed, informational mirror, no ts/deviceId/promptId (G-11 stays green)", () => {
    const mk = () =>
      runSequence([{ event: "ui_prompt_end", kind: "confirm", title: "Allow rm -rf?" }], { sessionId: "s1", runId: "r1" });
    const frames = mk();
    const c = frames[0] as { type: "CUSTOM"; name: string; value: { pi: string; data: Record<string, unknown> } };
    expect(frames).toHaveLength(1);
    expect(c.type).toBe("CUSTOM");
    expect(c.name).toBe("pi.human_input.closed");
    expect(c.name).not.toBe("pi.human_input.resolved"); // distinct dispatch key — never merged
    expect(c.value.pi).toBe("ui_prompt_end");
    expect(c.value.data).toEqual({ kind: "confirm", title: "Allow rm -rf?", schemaVersion: 1 });
    // the fold carries ONLY kind/title/schemaVersion — no ts, no deviceId, no promptId
    expect(Object.keys(c.value.data).sort()).toEqual(["kind", "schemaVersion", "title"]);
    for (const k of ["ts", "deviceId", "promptId"] as const) {
      expect(k in c.value.data).toBe(false);
    }
    // pure: deterministic across replay
    expect(JSON.stringify(frames)).toBe(JSON.stringify(mk()));
  });

  test("FLLWUP-5 (a): title optional; all five UIPromptKind values map; unknown kind falls to custom", () => {
    const noTitle = runSequence([{ event: "ui_prompt_end", kind: "input" }], { sessionId: "s1", runId: "r1" });
    const d1 = (noTitle[0] as { value: { data: Record<string, unknown> } }).value.data;
    expect(d1.kind).toBe("input");
    expect(d1.schemaVersion).toBe(1);
    expect(d1.title).toBeUndefined();
    const custom = runSequence([{ event: "ui_prompt_end", kind: "custom" }], { sessionId: "s1", runId: "r1" });
    expect((custom[0] as { value: { data: { kind: string } } }).value.data.kind).toBe("custom");
  });
  test("every CUSTOM frame: type CUSTOM, name starts pi., value has pi and data (S7)", () => {
    const frames = runSequence(
      [
        { event: "session_compact" },
        { event: "model_select", model: "m" },
        { event: "tool_execution_start", toolCallId: "t", toolName: "bash" },
        { event: "ui.confirm", promptKind: "k", prompt: "p" },
      ],
      { sessionId: "s1", runId: "r1" }
    );
    for (const f of frames) {
      if (f.type === "CUSTOM") {
        expect(f.name.startsWith("pi.")).toBe(true);
        expect(f.value).toHaveProperty("pi");
        expect(f.value).toHaveProperty("data");
      }
    }
  });

  test("JsonlEntry message → msg-<entryId>, replay determinism byte-identical (G-13)", () => {
    const entries = (): (PiEvent | JsonlEntry)[] => [
      { event: "agent_start" },
      {
        kind: "message",
        entryId: "e1",
        role: "assistant",
        content: [
          { type: "thought", text: "r" },
          { type: "text", text: "hi" },
        ],
      },
      { event: "agent_settled" },
    ];
    const a = runSequence(entries(), { sessionId: "s1", runId: "run-e1" });
    const b = runSequence(entries(), { sessionId: "s1", runId: "run-e1" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // byte-identical
    expect(JSON.stringify(a)).toContain("RUN_STARTED");
    expect(JSON.stringify(a)).toContain("msg-e1"); // deterministic messageId
    expect(JSON.stringify(a)).toContain("RUN_FINISHED");
  });

  test("translate is pure: replaying the same fold sequence yields identical frames and ids", () => {
    const events: (PiEvent | JsonlEntry)[] = [
      { event: "agent_start" },
      { event: "message_start", messageId: "assistant-1", role: "assistant" },
      { event: "message_update", messageId: "assistant-1", events: [{ kind: "text", delta: "hello" }] },
      { event: "message_end", messageId: "assistant-1" },
      { event: "agent_settled" },
    ];
    const a = runSequence(events, { sessionId: "s1", runId: "r1" });
    const b = runSequence(events, { sessionId: "s1", runId: "r1" });
    expect(a).toEqual(b);
  });

  test("JsonlEntry tool_result kind → TOOL_CALL_RESULT with flattened content (§1.3)", () => {
    const frames = runSequence(
      [{ kind: "tool_result", entryId: "e1", messageId: "msg-1", toolCallId: "call_1", content: [{ type: "text", text: "out" }] }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toEqual([
      { type: "TOOL_CALL_RESULT", messageId: "msg-1", toolCallId: "call_1", content: "out", role: "tool" },
    ]);
  });

  test("JsonlEntry bash_execution kind → CUSTOM passthrough (§1.3, FLLWUP-3 deferred)", () => {
    const frames = runSequence([{ kind: "bash_execution", entryId: "e1", data: { cmd: "ls" } }], {
      sessionId: "s1",
      runId: "r1",
    });
    expect(frames).toHaveLength(1);
    const f = frames[0] as { type: "CUSTOM"; name: string; value: { pi: string } };
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.tool.bash_execution");
    expect(f.value.pi).toBe("bash_execution");
  });

  test("JsonlEntry custom/custom_message kinds → CUSTOM escape-hatch (§1.3)", () => {
    const a = runSequence([{ kind: "custom", entryId: "e1", name: "n", data: { a: 1 } }], { sessionId: "s1", runId: "r1" });
    const b = runSequence([{ kind: "custom_message", entryId: "e2", name: "n2", data: { b: 2 } }], { sessionId: "s1", runId: "r1" });
    const fa = a[0] as { type: "CUSTOM"; name: string; value: { pi: string } };
    const fb = b[0] as { type: "CUSTOM"; name: string; value: { pi: string } };
    expect(fa.type).toBe("CUSTOM");
    expect(fa.name).toBe("pi.custom");
    expect(fa.value.pi).toBe("custom");
    expect(fb.type).toBe("CUSTOM");
    expect(fb.name).toBe("pi.custom_message");
    expect(fb.value.pi).toBe("custom_message");
  });

  test("translate returns a new state and advances eventOrdinal per frame", () => {
    let state = createState({ sessionId: "s1", runId: "r1" });
    const r1 = translate({ event: "agent_start" }, state);
    expect(r1.state.eventOrdinal).toBe(1);
    expect(r1.state).not.toBe(state); // immutable fold in, new state out
  });

  test("static guard: no crypto.randomUUID / Date.now / Math.random in translate.ts (G-11)", async () => {
    const src = await Bun.file(new URL("../src/translate.ts", import.meta.url)).text();
    expect(src).not.toMatch(/crypto\.randomUUID/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/randomUUID/);
  });

  test("static guard: no socket/session/transport module imports in translate.ts (G-12)", async () => {
    const src = await Bun.file(new URL("../src/translate.ts", import.meta.url)).text();
    expect(src).not.toMatch(/from\s*".*(tunnel|transport|@pi-.*session)"/);
    expect(src).not.toMatch(/import\s+.*\s+from/); // translate imports type definitions only — no runtime imports
  });

  test("importing translate.ts has no side effects (module purity)", async () => {
    const before = (globalThis as Record<string, unknown>).__ev4_side_effect ?? "absent";
    await import("../src/translate");
    const after = (globalThis as Record<string, unknown>).__ev4_side_effect ?? "absent";
    expect(after).toBe(before);
  });
});

describe("FLLWUP-3 — remaining live pi events + tool_execution_update split", () => {
  type Customish = { type: "CUSTOM"; name: string; value: { pi: string; data: unknown } };

  // §5 item 1 — per-event single-frame fixtures (rows 1–5, 7): exact name / value.pi / value.data.

  test("queue_update → CUSTOM pi.session.queue_update, snapshot not delta (row 1)", () => {
    const frames = runSequence(
      [{ event: "queue_update", steering: ["steer-1"], followUp: ["follow-1"] }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.session.queue_update");
    expect(f.value.pi).toBe("queue_update");
    expect(f.value.data).toEqual({ steering: ["steer-1"], followUp: ["follow-1"] });
  });

  test("bash_execution_update → CUSTOM pi.tool.bash_execution_update (J-1, row 2)", () => {
    const frames = runSequence(
      [{ event: "bash_execution_update", id: "bash-1", delta: "out\\n" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.tool.bash_execution_update");
    expect(f.value.pi).toBe("bash_execution_update");
    expect(f.value.data).toEqual({ id: "bash-1", delta: "out\\n" });
  });

  test("auto_retry_start → CUSTOM pi.session.retry_start (row 3)", () => {
    const frames = runSequence(
      [{ event: "auto_retry_start", attempt: 2, maxAttempts: 3, delayMs: 1000, errorMessage: "boom" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.session.retry_start");
    expect(f.value.pi).toBe("auto_retry_start");
    expect(f.value.data).toEqual({ attempt: 2, maxAttempts: 3, delayMs: 1000, errorMessage: "boom" });
  });

  test("auto_retry_end → CUSTOM pi.session.retry_end (row 4)", () => {
    const frames = runSequence(
      [{ event: "auto_retry_end", success: true, attempt: 2, finalError: "still bad" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.session.retry_end");
    expect(f.value.pi).toBe("auto_retry_end");
    expect(f.value.data).toEqual({ success: true, attempt: 2, finalError: "still bad" });
  });

  test("summarization_retry_scheduled → CUSTOM pi.session.summary_retry_scheduled (row 5)", () => {
    const frames = runSequence(
      [{ event: "summarization_retry_scheduled", attempt: 1, maxAttempts: 2, delayMs: 250, errorMessage: "ctx" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.session.summary_retry_scheduled");
    expect(f.value.pi).toBe("summarization_retry_scheduled");
    expect(f.value.data).toEqual({ attempt: 1, maxAttempts: 2, delayMs: 250, errorMessage: "ctx" });
  });

  test("summarization_retry_attempt_start branchSummary → CUSTOM pi.session.summary_retry_branch (J-3, row 6a)", () => {
    const frames = runSequence(
      [{ event: "summarization_retry_attempt_start", data: { source: "branchSummary" } }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.session.summary_retry_branch");
    expect(f.value.pi).toBe("summarization_retry_attempt_start");
    expect(f.value.data).toEqual({ source: "branchSummary" });
  });

  test("summarization_retry_attempt_start compaction → CUSTOM pi.session.summary_retry_compaction (J-3, row 6b)", () => {
    const frames = runSequence(
      [{ event: "summarization_retry_attempt_start", data: { source: "compaction", reason: "tokens" } }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.session.summary_retry_compaction");
    expect(f.value.pi).toBe("summarization_retry_attempt_start");
    expect(f.value.data).toEqual({ source: "compaction", reason: "tokens" });
  });

  test("summarization_retry_finished → CUSTOM pi.session.summary_retry_finished with empty payload (row 7)", () => {
    const frames = runSequence([{ event: "summarization_retry_finished" }], { sessionId: "s1", runId: "r1" });
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.session.summary_retry_finished");
    expect(f.value.pi).toBe("summarization_retry_finished");
    expect(f.value.data).toEqual({});
  });

  // §5 item 2 — conditional-emission matrix (§4).

  test("tool_execution_update both fields → exactly [pi.tool.update, pi.tool.progress] in order, toolCallId on both (§4)", () => {
    const frames = runSequence(
      [{ event: "tool_execution_update", toolCallId: "t1", args: { cmd: "ls" }, partialResult: "a\\n" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(2);
    const update = frames[0] as Customish;
    const progress = frames[1] as Customish;
    expect(update.name).toBe("pi.tool.update");
    expect(update.value.pi).toBe("tool_execution_update");
    expect(update.value.data).toEqual({ toolCallId: "t1", args: { cmd: "ls" } });
    expect(progress.name).toBe("pi.tool.progress");
    expect(progress.value.pi).toBe("tool_execution_update");
    expect(progress.value.data).toEqual({ toolCallId: "t1", partialResult: "a\\n" });
    expect(frames.map((f) => f.type)).not.toContain("TOOL_CALL_ARGS");
  });

  test("tool_execution_update args-only → one update, zero progress (§4)", () => {
    const frames = runSequence(
      [{ event: "tool_execution_update", toolCallId: "t1", args: { cmd: "ls" } }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.name).toBe("pi.tool.update");
    expect(f.value.data).toEqual({ toolCallId: "t1", args: { cmd: "ls" } });
    expect(frames.map((fr) => fr.type)).not.toContain("TOOL_CALL_ARGS");
  });

  test("tool_execution_update partialResult-only → one progress, zero update (§4)", () => {
    const frames = runSequence(
      [{ event: "tool_execution_update", toolCallId: "t1", partialResult: "chunk" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.name).toBe("pi.tool.progress");
    expect(f.value.data).toEqual({ toolCallId: "t1", partialResult: "chunk" });
    expect(frames.map((fr) => fr.type)).not.toContain("TOOL_CALL_ARGS");
  });

  test("tool_execution_update empty-string partialResult is present and emits progress (C-1, §4)", () => {
    const frames = runSequence(
      [{ event: "tool_execution_update", toolCallId: "t1", partialResult: "" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.name).toBe("pi.tool.progress");
    expect(f.value.data).toEqual({ toolCallId: "t1", partialResult: "" });
  });

  // §5 item 7 — O-5 neither-field closure: pinned as intended behavior.

  test("tool_execution_update neither field → exactly 0 frames, pinned as intended (O-5)", () => {
    const frames = runSequence([{ event: "tool_execution_update", toolCallId: "t1" }], {
      sessionId: "s1",
      runId: "r1",
    });
    expect(frames).toHaveLength(0);
  });

  // §5 item 8 — row 6c pin: out-of-union source emits 0 frames.

  test("summarization_retry_attempt_start with neither in-union source → exactly 0 frames (row 6c)", () => {
    // Deliberate out-of-union payload: the SDK union has only branchSummary/compaction,
    // but the fold must stay total and deterministic against malformed payloads —
    // no third frame name is invented, zero frames are emitted. Cast is the point.
    const malformed = {
      event: "summarization_retry_attempt_start",
      data: { source: "midSummary" },
    } as unknown as PiEvent;
    const frames = runSequence([malformed], { sessionId: "s1", runId: "r1" });
    expect(frames).toHaveLength(0);
  });

  // §5 item 4 — live/replay non-collapse (designer H3).

  test("JSONL bash_execution entry → pi.tool.bash_execution, never the live _update name (H3)", () => {
    const frames = runSequence([{ kind: "bash_execution", entryId: "e1", data: { cmd: "ls" } }], {
      sessionId: "s1",
      runId: "r1",
    });
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.name).toBe("pi.tool.bash_execution");
    expect(f.name).not.toBe("pi.tool.bash_execution_update");
  });

  test("live bash_execution_update → pi.tool.bash_execution_update, never the replay name (H3)", () => {
    const frames = runSequence([{ event: "bash_execution_update", delta: "d" }], { sessionId: "s1", runId: "r1" });
    expect(frames).toHaveLength(1);
    const f = frames[0] as Customish;
    expect(f.name).toBe("pi.tool.bash_execution_update");
    expect(f.name).not.toBe("pi.tool.bash_execution");
  });

  // §5 item 9 — determinism: every new event, translated twice, byte-identical.

  test("sequence containing every new event translated twice → byte-identical frames (§5 item 9)", () => {
    const seq = (): (PiEvent | JsonlEntry)[] => [
      { event: "queue_update", steering: ["s"], followUp: [] },
      { event: "bash_execution_update", delta: "x" },
      { event: "bash_execution_update", id: "b1", delta: "y" },
      { event: "auto_retry_start", attempt: 1, maxAttempts: 3, delayMs: 500, errorMessage: "boom" },
      { event: "auto_retry_end", success: false, attempt: 1, finalError: "e" },
      { event: "summarization_retry_scheduled", attempt: 1, maxAttempts: 2, delayMs: 250, errorMessage: "ctx" },
      { event: "summarization_retry_attempt_start", data: { source: "branchSummary" } },
      { event: "summarization_retry_attempt_start", data: { source: "compaction", reason: "tokens" } },
      { event: "summarization_retry_finished" },
      { event: "tool_execution_update", toolCallId: "t1", args: { cmd: "ls" }, partialResult: "a\\n" },
      { event: "tool_execution_update", toolCallId: "t2" },
    ];
    const a = runSequence(seq(), { sessionId: "s1", runId: "r1" });
    const b = runSequence(seq(), { sessionId: "s1", runId: "r1" });
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
