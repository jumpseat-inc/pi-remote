import { describe, expect, test } from "bun:test";
import { createInjector, pickDeliverAs } from "../src/inject";
import type { DeliverAs } from "../src/inject";
import type { InboundEnvelope } from "../src/transport";
import type { AgUiFrame } from "../src/translate";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function env(deviceId: string | undefined, frame: AgUiFrame | null): InboundEnvelope {
  return { v: 1, seq: 1, ack: 0, deviceId, frame };
}

function start(messageId: string, role: "assistant" | "user", name?: string): AgUiFrame {
  const f: Record<string, unknown> = { type: "TEXT_MESSAGE_START", messageId, role };
  if (name !== undefined) f.name = name;
  return f as unknown as AgUiFrame;
}
function content(messageId: string, delta: string): AgUiFrame {
  return { type: "TEXT_MESSAGE_CONTENT", messageId, delta };
}
function end(messageId: string): AgUiFrame {
  return { type: "TEXT_MESSAGE_END", messageId };
}
function responseFrame(data: Record<string, unknown>): AgUiFrame {
  return { type: "CUSTOM", name: "pi.human_input.response", value: { pi: "ui.confirm.response", data } };
}

interface Fake {
  deps: {
    sendUserMessage: (content: string, opts?: { deliverAs?: DeliverAs }) => Promise<void>;
    isStreaming: () => boolean;
    resolvePendingPrompt: (promptId: string, result: unknown, deviceId?: string) => boolean | Promise<boolean>;
    emitCustom: (name: string, value: unknown) => void;
  };
  calls: Array<[string, { deliverAs?: DeliverAs } | undefined]>;
  customs: Array<[string, unknown]>;
  setStreaming: (v: boolean) => void;
}

function fakeDeps(opts: {
  streaming?: boolean;
  resolvePendingPrompt?: (promptId: string, result: unknown, deviceId?: string) => boolean | Promise<boolean>;
  announce?: { has: () => boolean; mark: () => void };
} = {}): Fake {
  const calls: Fake["calls"] = [];
  const customs: Fake["customs"] = [];
  let streaming = opts.streaming ?? false;
  return {
    deps: {
      sendUserMessage: async (content, o) => { calls.push([content, o]); },
      isStreaming: () => streaming,
      resolvePendingPrompt: opts.resolvePendingPrompt ?? (async () => false),
      emitCustom: (name, value) => { customs.push([name, value]); },
      ...(opts.announce ?? {}),
    },
    calls,
    customs,
    setStreaming: (v) => { streaming = v; },
  };
}

// ---------------------------------------------------------------------------
// pickDeliverAs — never-throw truth table (spec §1.1, §4)
// ---------------------------------------------------------------------------

describe("EV-6 pickDeliverAs (never-throw truth table)", () => {
  test("idle: no deliverAs for steer / followUp / absent", () => {
    expect(pickDeliverAs(false, "steer")).toEqual({});
    expect(pickDeliverAs(false, "followUp")).toEqual({});
    expect(pickDeliverAs(false, undefined)).toEqual({});
  });

  test("streaming + followUp → followUp", () => {
    expect(pickDeliverAs(true, "followUp")).toEqual({ deliverAs: "followUp" });
  });

  test("streaming + steer / absent / unknown → steer (never undefined)", () => {
    expect(pickDeliverAs(true, "steer")).toEqual({ deliverAs: "steer" });
    expect(pickDeliverAs(true, undefined)).toEqual({ deliverAs: "steer" });
    expect(pickDeliverAs(true, "bogus")).toEqual({ deliverAs: "steer" });
    // never-throw property: every streaming result carries a deliverAs
    for (const intent of ["steer", "followUp", "bogus", undefined] as const) {
      expect(pickDeliverAs(true, intent).deliverAs).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// User-message injection (spec §1.2, §4)
// ---------------------------------------------------------------------------

describe("EV-6 user-message injection", () => {
  test("idle: assembles at END, sends exactly once with no deliverAs", async () => {
    const { deps, calls } = fakeDeps({ streaming: false });
    const inj = createInjector(deps);
    const startR = await inj.handle(env(undefined, start("m1", "user")));
    const a = await inj.handle(env(undefined, content("m1", "Hello! ")));
    const b = await inj.handle(env(undefined, content("m1", "world")));
    expect(startR.kind).toBe("ignored");
    expect(a.kind).toBe("ignored");
    expect(b.kind).toBe("ignored");
    // no call before END
    expect(calls).toHaveLength(0);
    // injection only at END, assembled text, no deliverAs
    const finalR = await inj.handle(env(undefined, end("m1")));
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe("Hello! world");
    expect(calls[0]![1]?.deliverAs).toBeUndefined();
  });

  test("streaming + name:steer → deliverAs steer", async () => {
    const { deps, calls } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    await inj.handle(env(undefined, start("m1", "user", "steer")));
    const r = await inj.handle(env(undefined, end("m1")));
    expect(r).toEqual({ kind: "injected", deliverAs: "steer" });
    expect(calls[0]![1]?.deliverAs).toBe("steer");
  });

  test("streaming + name:followUp → deliverAs followUp", async () => {
    const { deps, calls } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    await inj.handle(env(undefined, start("m1", "user", "followUp")));
    const r = await inj.handle(env(undefined, end("m1")));
    expect(r).toEqual({ kind: "injected", deliverAs: "followUp" });
    expect(calls[0]![1]?.deliverAs).toBe("followUp");
  });

  test("streaming + absent name → steer (never reach pi undeliverAs'd)", async () => {
    const { deps, calls } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    await inj.handle(env(undefined, start("m1", "user")));
    const r = await inj.handle(env(undefined, end("m1")));
    expect(r).toEqual({ kind: "injected", deliverAs: "steer" });
    expect(calls[0]![1]?.deliverAs).toBe("steer");
  });

  test("streaming + unknown name value treated as absent → steer", async () => {
    const { deps, calls } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    await inj.handle(env(undefined, start("m1", "user", "not-a-valid-intent") as AgUiFrame));
    const r = await inj.handle(env(undefined, end("m1")));
    expect(r).toEqual({ kind: "injected", deliverAs: "steer" });
    expect(calls[0]![1]?.deliverAs).toBe("steer");
  });

  test("non-user role is ignored (no sendUserMessage)", async () => {
    const { deps, calls } = fakeDeps({ streaming: false });
    const inj = createInjector(deps);
    await inj.handle(env(undefined, start("m1", "assistant")));
    const r = await inj.handle(env(undefined, end("m1")));
    expect(r.kind).toBe("ignored");
    expect(calls).toHaveLength(0);
  });

  test("CONTENT/END for an unopened messageId is ignored, never throws", async () => {
    const { deps, calls } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    const a = await inj.handle(env(undefined, content("ghost", "x")));
    const b = await inj.handle(env(undefined, end("ghost")));
    expect(a.kind).toBe("ignored");
    expect(b.kind).toBe("ignored");
    expect(calls).toHaveLength(0);
  });

  test("START with non-string messageId is ignored, never throws", async () => {
    const { deps, calls } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    const bad = { type: "TEXT_MESSAGE_START", messageId: 42, role: "user" } as unknown as AgUiFrame;
    const r = await inj.handle(env(undefined, bad));
    expect(r.kind).toBe("ignored");
    expect(calls).toHaveLength(0);
  });

  test("deviceId is never smuggled into the sent text", async () => {
    const { deps, calls } = fakeDeps({ streaming: false });
    const inj = createInjector(deps);
    await inj.handle(env("dev42", start("m1", "user")));
    await inj.handle(env("dev42", content("m1", "Hello")));
    const r = await inj.handle(env("dev42", end("m1")));
    expect(r.kind).toBe("injected");
    expect(calls[0]![0]).toBe("Hello");
    expect(calls[0]![0]).not.toContain("dev42");
  });

  test("never-throw end-to-end: SDL-mirroring fake never observes streaming without deliverAs", async () => {
    const userCalls: Array<[string, DeliverAs | undefined]> = [];
    let streaming = true;
    const deps = {
      sendUserMessage: async (content: string, o?: { deliverAs?: DeliverAs }) => {
        // mirror the SDK: prompt() throws when streaming && no deliverAs
        if (streaming && o?.deliverAs === undefined) throw new Error("streaming requires streamingBehavior");
        userCalls.push([content, o?.deliverAs]);
      },
      isStreaming: () => streaming,
      resolvePendingPrompt: async () => false,
      emitCustom: () => {},
    };
    const inj = createInjector(deps);
    // streaming + absent, steer, followUp must all carry deliverAs
    await inj.handle(env(undefined, start("a", "user")));
    await inj.handle(env(undefined, content("a", "x")));
    await inj.handle(env(undefined, end("a")));
    await inj.handle(env(undefined, start("b", "user", "steer")));
    await inj.handle(env(undefined, end("b")));
    await inj.handle(env(undefined, start("c", "user", "followUp")));
    await inj.handle(env(undefined, end("c")));
    expect(userCalls.map(([, d]) => d)).toEqual(["steer", "steer", "followUp"]);
  });
});

// ---------------------------------------------------------------------------
// Approval resolution (spec §1.3, R1/R2/R3, §4)
// ---------------------------------------------------------------------------

describe("EV-6 approval resolution", () => {
  test("R1: registerPrompt scopes by (promptId, occurrence); resolving one occurrence leaves the other live", async () => {
    const { deps } = fakeDeps({ resolvePendingPrompt: () => true });
    const inj = createInjector(deps);
    expect(inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "Delete file?" })).toEqual({ occurrence: 1 });
    expect(inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "Delete file?" })).toEqual({ occurrence: 2 });
    // resolve occurrence 2 first
    const r2 = await inj.handle(env("d1", responseFrame({ promptId: "p1", occurrence: 2, response: "yes2" })));
    expect(r2).toEqual({ kind: "resolved", promptId: "p1", occurrence: 2, direct: true, deviceId: "d1" });
    // occurrence 2 now consumed → stale
    const stale = await inj.handle(env("d2", responseFrame({ promptId: "p1", occurrence: 2, response: "yes2b" })));
    expect(stale.kind).toBe("stale");
    // occurrence 1 was NOT resolved by resolving occurrence 2 → still live
    const r1 = await inj.handle(env("d3", responseFrame({ promptId: "p1", occurrence: 1, response: "yes1" })));
    expect(r1).toEqual({ kind: "resolved", promptId: "p1", occurrence: 1, direct: true, deviceId: "d3" });
  });

  test("live → resolved (fixture seam, R3): direct:true, no sendUserMessage, no R2 notice", async () => {
    const { deps, calls, customs } = fakeDeps({ resolvePendingPrompt: () => true });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const r = await inj.handle(env("dev1", responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(r).toEqual({ kind: "resolved", promptId: "p1", occurrence: 1, direct: true, deviceId: "dev1" });
    expect(calls).toHaveLength(0);
    expect(customs).toHaveLength(0); // not a fallback → no notice
  });

  test("live → steering fallback idle (R3 production default): never dropped, reason mode", async () => {
    const { deps, calls, customs } = fakeDeps({ streaming: false });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const r = await inj.handle(env("dev1", responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(r).toEqual({ kind: "steered_fallback", promptId: "p1", occurrence: 1, text: "yes", direct: false, deviceId: "dev1", reason: "mode", tracked: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe("yes");
    expect(calls[0]![1]?.deliverAs).toBeUndefined(); // idle → no deliverAs
  });

  test("live → steering fallback streaming: deliverAs steer, never dropped", async () => {
    const { deps, calls } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const r = await inj.handle(env("dev1", responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(r.kind).toBe("steered_fallback");
    expect(calls[0]![1]?.deliverAs).toBe("steer");
  });

  test("R2 loud-once: first fallback emits notice with a sentence; second fallback in session emits none", async () => {
    const { deps, customs } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    await inj.handle(env("d1", responseFrame({ promptId: "p1", occurrence: 1, response: "y" })));
    // second fallback in the same session (different prompt) → no new notice
    inj.registerPrompt({ promptId: "p2", kind: "confirm", prompt: "Q?" });
    await inj.handle(env("d2", responseFrame({ promptId: "p2", occurrence: 1, response: "n" })));
    const fallbackNotices = customs.filter(([n]) => n === "pi.human_input.fallback_to_steer");
    expect(fallbackNotices).toHaveLength(1);
    const [, value] = fallbackNotices[0]!;
    const v = value as { promptId: string; statement: string };
    expect(v.promptId).toBe("p1");
    // the notice is a sentence (ends with period), names the cause, states the surfacing
    expect(v.statement).toMatch(/\.$/);
    expect(v.statement).toContain("steering message");
    expect(v.statement).not.toBe("");
  });

  test("already-resolved (stale) is surfaced, NOT delivered, and triggers no R2 notice", async () => {
    const { deps, calls, customs } = fakeDeps({ streaming: true, resolvePendingPrompt: () => true });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const first = await inj.handle(env("win1", responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(first).toEqual({ kind: "resolved", promptId: "p1", occurrence: 1, direct: true, deviceId: "win1" });
    const stale = await inj.handle(env("los1", responseFrame({ promptId: "p1", occurrence: 1, response: "late no" })));
    expect(stale).toEqual({ kind: "stale", promptId: "p1", deviceId: "los1" });
    expect(calls).toHaveLength(0); // not delivered
    // exactly one stale custom, and NO fallback_to_steer notice
    expect(customs).toEqual([["pi.human_input.stale", { promptId: "p1", winnerDeviceId: "win1" }]]);
  });

  test("unknown promptId → steering fallback (never dropped), reason mode, R2 notice on first", async () => {
    const { deps, calls } = fakeDeps({ streaming: false });
    const inj = createInjector(deps);
    const r = await inj.handle(env("dev1", responseFrame({ promptId: "unknown-prompt", occurrence: 1, response: "yes" })));
    expect(r).toEqual({ kind: "steered_fallback", promptId: "unknown-prompt", occurrence: 1, text: "yes", direct: false, deviceId: "dev1", reason: "mode", tracked: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe("yes");
  });

  test("envelope deviceId is passed to resolvePendingPrompt structurally and into the result", async () => {
    const resolvedArgs: Array<[string, unknown, string | undefined]> = [];
    const { deps } = fakeDeps({
      resolvePendingPrompt: (pid, res, dev) => { resolvedArgs.push([pid, res, dev]); return false; },
    });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const r = await inj.handle(env("dev9", responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(resolvedArgs).toEqual([["p1", "yes", "dev9"]]);
    expect((r as { deviceId?: string }).deviceId).toBe("dev9");
  });

  test("absence of deviceId still resolves with deviceId undefined", async () => {
    const resolvedArgs: Array<[string, unknown, string | undefined]> = [];
    const { deps } = fakeDeps({
      resolvePendingPrompt: (pid, res, dev) => { resolvedArgs.push([pid, res, dev]); return false; },
    });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const r = await inj.handle(env(undefined, responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(resolvedArgs).toEqual([["p1", "yes", undefined]]);
    expect((r as { deviceId?: string }).deviceId).toBeUndefined();
  });

  test("FLLWUP-5 S-O3: live-entry fallback tracked:true, unknown-entry tracked:false, occurrence round-trips on both; stale carries no occurrence", async () => {
    const { deps } = fakeDeps({ streaming: false });
    const inj = createInjector(deps);
    // unknown entry: a prompt this host never raised — occurrence is the client's, tracked:false
    const unknown = await inj.handle(env("dev-u", responseFrame({ promptId: "ghost", occurrence: 3, response: "hi" })));
    expect(unknown).toEqual({
      kind: "steered_fallback", promptId: "ghost", occurrence: 3, text: "hi",
      direct: false, deviceId: "dev-u", reason: "mode", tracked: false,
    });
    // live entry: registered prompt resolved via steering fallback — tracked:true, occurrence from the registry key
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const live = await inj.handle(env("dev-l", responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(live).toEqual({
      kind: "steered_fallback", promptId: "p1", occurrence: 1, text: "yes",
      direct: false, deviceId: "dev-l", reason: "mode", tracked: true,
    });
    // direct resolution (fixture seam) also carries occurrence
    const direct = fakeDeps({ resolvePendingPrompt: () => true });
    const inj2 = createInjector(direct.deps);
    inj2.registerPrompt({ promptId: "p2", kind: "confirm", prompt: "Q?" });
    const resolved = await inj2.handle(env("dev-r", responseFrame({ promptId: "p2", occurrence: 1, response: "ok" })));
    expect(resolved).toEqual({ kind: "resolved", promptId: "p2", occurrence: 1, direct: true, deviceId: "dev-r" });
    // stale does NOT carry occurrence
    const stale = await inj2.handle(env("dev-s", responseFrame({ promptId: "p2", occurrence: 1, response: "late" })));
    expect(stale).toEqual({ kind: "stale", promptId: "p2", deviceId: "dev-s" });
  });

  test("malformed response values → ignored; no sendUserMessage, no emitCustom, no throw", async () => {
    const { deps, calls, customs } = fakeDeps({ streaming: true });
    const inj = createInjector(deps);
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const cases: AgUiFrame[] = [
      responseFrame({ promptId: "", occurrence: 1, response: "yes" }), // empty promptId
      responseFrame({ promptId: 123, occurrence: 1, response: "yes" }), // non-string promptId
      responseFrame({ promptId: "p1", occurrence: "x", response: "yes" }), // non-number occurrence
      responseFrame({ promptId: "p1", occurrence: Number.NaN, response: "yes" }), // non-finite
      { type: "CUSTOM", name: "pi.human_input.response", value: { pi: "ui.confirm.response", data: { promptId: "p1", occurrence: 1 } } as never } as AgUiFrame, // missing response
      { type: "CUSTOM", name: "pi.something.else", value: { pi: "x", data: {} } as never, } as AgUiFrame, // wrong CUSTOM name
    ];
    for (const frame of cases) {
      const r = await inj.handle(env("d1", frame));
      expect(r.kind).toBe("ignored");
    }
    expect(calls).toHaveLength(0);
    expect(customs).toHaveLength(0);
  });
});
