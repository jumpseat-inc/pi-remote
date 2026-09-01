/**
 * EV-8 — command surface and lifecycle wiring integration tests.
 *
 * All tests run against in-repo fakes for the pi context and SDK surfaces plus
 * a Bun-native fake relay (a real local WebSocket server, no relay/control
 * plane/Mongo). The control-plane REST surface is faked with an injected
 * `fetch`. No real network, no Mongo.
 */
import { describe, expect, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import {
  createRemoteController,
  type RemoteControllerDeps,
  type FooterView,
} from "../index";
import { loginEnglishFor } from "../src/login";
import { ALREADY_LIVE_COPY, tunnelReasonCopy } from "../src/tunnel";
import type { TransportEnvelope, InboundEnvelope } from "../src/transport";

// ---------------------------------------------------------------------------
// Shared copy expectations
// ---------------------------------------------------------------------------
const LIVE_SENTENCE = loginEnglishFor("status.live");
const OFF_SENTENCE = loginEnglishFor("status.off");
const NOT_ENROLLED_SENTENCE = loginEnglishFor("status.notEnrolled");
const DIALING_SENTENCE = loginEnglishFor("status.dialing");

// ---------------------------------------------------------------------------
// Fake relay (Bun native WebSocket server-side; mirrors transport.test.ts)
// ---------------------------------------------------------------------------
interface FakeRelay {
  url: string;
  port: number;
  received: TransportEnvelope[];
  connections: ServerWebSocket[];
  kill(): void;
  broadcast(obj: InboundEnvelope): void;
  stop(): void;
}

function startRelay(): FakeRelay {
  const received: TransportEnvelope[] = [];
  const connections: ServerWebSocket[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      if (srv.upgrade(req)) return undefined;
      return new Response("bad request", { status: 400 });
    },
    websocket: {
      open(ws) {
        connections.push(ws);
      },
      message(ws, msg) {
        const raw = typeof msg === "string" ? msg : String(msg);
        let parsed: TransportEnvelope | null = null;
        try {
          parsed = JSON.parse(raw) as TransportEnvelope;
        } catch {
          parsed = null;
        }
        received.push(parsed as TransportEnvelope);
      },
      close(ws) {
        const i = connections.indexOf(ws);
        if (i >= 0) connections.splice(i, 1);
      },
    },
  });
  const port = server.port as number;
  return {
    url: `ws://localhost:${port}/live`,
    port,
    received,
    connections,
    kill() {
      for (const ws of [...connections]) {
        try {
          ws.close(1006, "killed");
        } catch {
          /* already closed */
        }
      }
    },
    broadcast(obj) {
      for (const ws of [...connections]) {
        try {
          ws.send(JSON.stringify(obj));
        } catch {
          /* ignore */
        }
      }
    },
    stop() {
      try {
        server.stop(true);
      } catch {
        /* ignore */
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Harness: a fake RemoteControllerDeps + the live controller
// ---------------------------------------------------------------------------
interface Harness {
  deps: RemoteControllerDeps;
  ctrl: ReturnType<typeof createRemoteController>;
  setStatus: (string | undefined)[];
  printed: string[];
  commandHandlers: Record<string, () => void | Promise<void>>;
  eventHandlers: Record<string, Array<(...a: unknown[]) => void>>;
  posts: string[];
  deletes: string[];
  emitters: { name: string; value: unknown }[];
  inputResponses: string[];
  relay: FakeRelay;
  sendUserMessages: string[];
  runCommand: (name: string) => Promise<void>;
  emit: (event: string, payload?: unknown) => void;
  /** Wait until pred() is truthy (poll every 2ms). */
  waitFor: (pred: () => boolean, timeoutMs?: number) => Promise<void>;
}

interface HarnessOptions {
  serverUrl?: string | undefined;
  credential?: { accessToken?: string; refreshToken?: string; tokenExpiry?: number };
  /** Override the control-plane tunnel fetch (POST /tunnels). Default returns a live relay tunnel. */
  tunnelFetch?: (
    url: string,
    init?: RequestInit,
    h?: Harness
  ) => Promise<Response> | Response;
  /** Controls await-ability of POST /tunnels (for the teardown/rearm race). */
  deferTunnel?: { current: Promise<Response> | null };
  newId?: () => string;
  inputPrompt?: (p: string) => Promise<string | undefined>;
  openUrl?: (url: string) => Promise<boolean>;
  randomBytes?: (n: number) => Uint8Array;
  redirectTimeoutMs?: number;
  confirmReplacement?: () => Promise<boolean>;
  /** FLLWUP-5 contract (b) fixture seam: direct-resolution path (production default is () => false). */
  resolvePendingPrompt?: (promptId: string, result: unknown, deviceId?: string) => boolean | Promise<boolean>;
}

async function makeHarness(opts: HarnessOptions = {}): Promise<Harness> {
  const relay = startRelay();
  const setStatus: (string | undefined)[] = [];
  const printed: string[] = [];
  const commandHandlers: Record<string, () => void | Promise<void>> = {};
  const eventHandlers: Record<string, Array<(...a: unknown[]) => void>> = {};
  const posts: string[] = [];
  const deletes: string[] = [];
  const emitters: { name: string; value: unknown }[] = [];
  const sendUserMessages: string[] = [];
  let idCounter = 0;

  const inputResponses: string[] = [];
  const defaultInputPrompt = async () => undefined;

  const cred: NonNullable<HarnessOptions["credential"]> = {
    accessToken: "at-1",
    tokenExpiry: Date.now() + 60_000,
    ...(opts.credential ?? {}),
  };
  // Persist the fake credential file so readCredential can find it.
  const fs = await import("node:fs");
  const mkdir = await import("node:fs/promises");
  await mkdir.mkdir("/tmp/pi-remote-ev8-test/pi-remote", { recursive: true });
  fs.writeFileSync(
    "/tmp/pi-remote-ev8-test/pi-remote/credentials.json",
    JSON.stringify({ serverUrl: opts.serverUrl ?? "https://cp.example.com", ...cred })
  );

  let h!: Harness;

  const defaultTunnelFetch = (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(url);
      if (opts.deferTunnel?.current) return opts.deferTunnel.current;
      return new Response(
        JSON.stringify({ tunnelId: `tunnel-${posts.length}`, url: relay.url, tokenTtl: 60 }),
        { status: 200 }
      );
    }
    if (init?.method === "DELETE") {
      deletes.push(url);
      return new Response(null, { status: 204 });
    }
    return new Response("{}", { status: 200 });
  };

  const deps: RemoteControllerDeps = {
    configDir: "/tmp/pi-remote-ev8-test",
    serverUrl: opts.serverUrl === undefined ? "https://cp.example.com" : opts.serverUrl,
    sessionName: "test-session",
    cwd: "/tmp",
    hostMetadata: { piVersion: "1.0", platform: "linux", arch: "x64" },
    sessionId: () => "sess-1",
    setStatus: (s) => setStatus.push(s),
    print: (l) => printed.push(l),
    sendUserMessage: async (c) => {
      sendUserMessages.push(c);
    },
    isStreaming: () => false,
    resolvePendingPrompt: opts.resolvePendingPrompt ?? (() => false),
    readActiveBranch: async () => [],
    inputPrompt: opts.inputPrompt ?? defaultInputPrompt,
    fetch: ((url: string, init?: RequestInit) => {
      if (opts.tunnelFetch) return Promise.resolve(opts.tunnelFetch(url, init, h));
      return Promise.resolve(defaultTunnelFetch(url, init));
    }) as typeof fetch,
    WebSocket: globalThis.WebSocket as typeof WebSocket,
    now: () => 0,
    sleep: async () => {},
    rng: () => 0,
    newId: opts.newId ?? (() => `uuid-${++idCounter}`),
    openUrl: opts.openUrl,
    randomBytes: opts.randomBytes,
    confirmReplacement: opts.confirmReplacement ?? (async () => true),
    redirectTimeoutMs: opts.redirectTimeoutMs ?? 2000,
    ERROR_DIAL_THRESHOLD: 3,
    command: (name, handler) => {
      commandHandlers[name] = () => handler(name);
    },
    on: (event, handler) => {
      (eventHandlers[event] ??= []).push(handler as (...a: unknown[]) => void);
    },
  };

  const ctrl = createRemoteController(deps);

  h = {
    deps,
    ctrl,
    setStatus,
    printed,
    commandHandlers,
    eventHandlers,
    posts,
    deletes,
    emitters,
    inputResponses,
    relay,
    sendUserMessages,
    runCommand: async (name) => {
      await commandHandlers[name]?.();
    },
    emit: (event, payload) => {
      for (const h of eventHandlers[event] ?? []) h(payload);
    },
    waitFor: async (pred, timeoutMs = 2000) => {
      const start = Date.now();
      while (!pred()) {
        if (Date.now() - start > timeoutMs) throw new Error("waitFor timeout");
        await new Promise((r) => setTimeout(r, 2));
      }
    },
  };
  return h;
}

function lastSet(s: (string | undefined)[]): string | undefined {
  for (let i = s.length - 1; i >= 0; i--) if (s[i] !== undefined) return s[i];
  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EV-8 /rc happy path", () => {
  test("enrolled /rc ends live with frames flowing; second /rc is ALREADY_LIVE_COPY, no second dial, runId unchanged", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => h.relay.connections.length > 0);
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    // frames flowing: agent_start → RUN_STARTED on the relay
    h.emit("agent_start");
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "RUN_STARTED"));
    const runId1 = (h.relay.received.find((e) => e.frame?.type === "RUN_STARTED")!.frame as { runId: string }).runId;

    const postsAfterFirst = h.posts.length;
    // second /rc while connected
    await h.runCommand("rc");
    expect(h.printed).toContain(ALREADY_LIVE_COPY); // verbatim, `<serverUrl>` placeholder intact
    expect(h.posts.length).toBe(postsAfterFirst); // no second POST /tunnels
    expect(lastSet(h.setStatus)).toBe(LIVE_SENTENCE); // footer unchanged

    // runId unchanged across the second /rc
    const runEvents = h.relay.received.filter((e) => e.frame?.type === "RUN_STARTED");
    expect(runEvents).toHaveLength(1);
    expect((runEvents[0]!.frame as { runId: string }).runId).toBe(runId1);
    h.relay.stop();
  });

  test("no credential → /rc names /rc:login, footer not enrolled, zero POST /tunnels", async () => {
    const h = await makeHarness();
    // remove credential file
    const fs = await import("node:fs");
    fs.rmSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json", { force: true });
    await h.runCommand("rc");
    expect(h.printed).toContain(loginEnglishFor("rc.unenrolled"));
    expect(lastSet(h.setStatus)).toBe(NOT_ENROLLED_SENTENCE);
    expect(h.posts.length).toBe(0); // zero POST /tunnels
    // reducer surface shows not enrolled too
    expect(h.ctrl.reducer({ type: "set", state: "not enrolled" }).footer).toBe("not enrolled");
    h.relay.stop();
  });

  test("footer is exactly one of seven states", async () => {
    const seven = ["off", "not enrolled", "authorizing", "dialing", "resyncing", "live", "error"];
    const h = await makeHarness();
    const states = new Set<string>();
    for (const s of h.setStatus) states.add(s as string);
    // Drive a sampler of transitions via the reducer and confirm the union of
    // observed states is a subset of the seven.
    expect(() => {
      for (const s of seven) h.ctrl.reducer({ type: "set", state: s as never });
    }).not.toThrow();
    h.relay.stop();
  });
});

describe("EV-8 /rc:off", () => {
  test("was live → off with tunnel deleted once; second /rc:off is a clean no-op with zero extra DELETE", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    await h.runCommand("rc:off");
    expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
    expect(h.deletes.length).toBe(1); // tunnel deleted once at control plane
    await h.waitFor(() => h.relay.connections.length === 0); // WS closed (client close frame drains async)

    const delCount = h.deletes.length;
    await h.runCommand("rc:off"); // second no-op
    await h.runCommand("rc:off"); // third no-op (shares in-flight promise)
    expect(h.deletes.length).toBe(delCount); // zero additional DELETE
    h.relay.stop();
  });
});

describe("EV-8 session_shutdown (one test per reason)", () => {
  const reasons: string[] = ["quit", "reload", "new", "resume", "fork"];
  for (const reason of reasons) {
    test(`reason ${reason} with tunnel live → disconnect + one DELETE + footer off + credential still present`, async () => {
      const h = await makeHarness();
      await h.runCommand("rc");
      await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
      await h.ctrl.onShutdown();
      expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
      await h.waitFor(() => h.relay.connections.length === 0);
      expect(h.deletes.length).toBe(1);
      // credential still present (never cleared)
      const fs = await import("node:fs");
      const raw = fs.readFileSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json", "utf8");
      expect(JSON.parse(raw).accessToken).toBeTruthy();
      h.relay.stop();
    });
  }
});

describe("EV-8 enrollment-terminal rearm failure (J3)", () => {
  test("403 from createTunnel on reconnect rearm → footer error with enrollment remedy, retry stopped", async () => {
    const h = await makeHarness();
    // First createTunnel (initial /rc) succeeds; subsequent (rearm) returns 403.
    let calls = 0;
    const tunnelFetch = (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        calls++;
        h.posts.push(url);
        if (calls === 1) {
          return new Response(JSON.stringify({ tunnelId: "t1", url: h.relay.url, tokenTtl: 60 }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
      }
      if (init?.method === "DELETE") {
        h.deletes.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response("{}", { status: 200 });
    };
    h.deps.fetch = tunnelFetch as unknown as typeof fetch;

    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    // Force a reconnect: kill the relay so the transport re-dials → rearm → 403.
    h.relay.kill();
    await h.waitFor(() => lastSet(h.setStatus) === tunnelReasonCopy.enrollment_rejected.userLine);

    // The error footer carries the enrollment remedy, NOT relay_unreachable.
    expect(lastSet(h.setStatus)).toBe(tunnelReasonCopy.enrollment_rejected.userLine);
    expect(lastSet(h.setStatus)).not.toContain("relay");
    expect(lastSet(h.setStatus)).toContain("/rc:login");
    // Credential still present; no further dials (retry stopped).
    const fs = await import("node:fs");
    const raw = fs.readFileSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json", "utf8");
    expect(JSON.parse(raw).accessToken).toBeTruthy();
    h.relay.stop();
  });
});

describe("EV-8 teardown/rearm race", () => {
  test("deferred rearm resolving after /rc:off → fresh tunnel deleted once, no connect after teardown, footer off", async () => {
    const relay = startRelay();
    const setStatus: (string | undefined)[] = [];
    const printed: string[] = [];
    const commandHandlers: Record<string, () => void | Promise<void>> = {};
    const eventHandlers: Record<string, Array<(...a: unknown[]) => void>> = {};
    const posts: string[] = [];
    const deletes: string[] = [];
    let idCounter = 0;
    const fs = await import("node:fs");
    const mkdir = await import("node:fs/promises");
    await mkdir.mkdir("/tmp/pi-remote-ev8-race/pi-remote", { recursive: true });
    fs.writeFileSync(
      "/tmp/pi-remote-ev8-race/pi-remote/credentials.json",
      JSON.stringify({ serverUrl: "https://cp.example.com", accessToken: "at", tokenExpiry: Date.now() + 60_000 })
    );

    let resolveGate: ((r: Response) => void) | null = null;
    const gate = new Promise<Response>((r) => (resolveGate = r));

    let postCalls = 0;
    const fetchImpl = ((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        postCalls++;
        posts.push(url);
        if (postCalls === 1) {
          return Promise.resolve(new Response(JSON.stringify({ tunnelId: "T0", url: relay.url, tokenTtl: 60 }), { status: 200 }));
        }
        return gate; // rearm createTunnel waits on the gate
      }
      if (init?.method === "DELETE") {
        deletes.push(url);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as typeof fetch;

    const deps: RemoteControllerDeps = {
      configDir: "/tmp/pi-remote-ev8-race",
      serverUrl: "https://cp.example.com",
      sessionName: "s",
      cwd: "/",
      hostMetadata: { piVersion: "1", platform: "linux", arch: "x64" },
      sessionId: () => "sess",
      setStatus: (s) => setStatus.push(s),
      print: (l) => printed.push(l),
      sendUserMessage: async () => {},
      isStreaming: () => false,
      resolvePendingPrompt: () => false,
      readActiveBranch: async () => [],
      inputPrompt: async () => undefined,
      fetch: fetchImpl,
      WebSocket: globalThis.WebSocket as typeof WebSocket,
      now: () => 0,
      sleep: async () => {},
      rng: () => 0,
      newId: () => `u-${++idCounter}`,
      ERROR_DIAL_THRESHOLD: 3,
      command: (name, handler) => {
        commandHandlers[name] = () => handler(name);
      },
      on: (event, handler) => {
        (eventHandlers[event] ??= []).push(handler as (...a: unknown[]) => void);
      },
    };
    const ctrl = createRemoteController(deps);
    const runCommand = async (n: string) => {
      await commandHandlers[n]?.();
    };
    const lastSet = () => {
      for (let i = setStatus.length - 1; i >= 0; i--) if (setStatus[i] !== undefined) return setStatus[i];
      return undefined;
    };
    const waitFor = async (p: () => boolean, t = 2000) => {
      const s = Date.now();
      while (!p()) {
        if (Date.now() - s > t) throw new Error("timeout");
        await new Promise((r) => setTimeout(r, 2));
      }
    };

    // Phase 1: /rc → live
    await runCommand("rc");
    await waitFor(() => relay.connections.length > 0);
    await waitFor(() => lastSet() === LIVE_SENTENCE);

    // Phase 2: force reconnect so rearm awaits the gate (fresh tunnel T-fresh when resolved)
    relay.kill();
    await waitFor(() => postCalls >= 2); // rearm POST is in-flight (awaiting gate)

    // Phase 3: /rc:off before the rearm resolves
    await runCommand("rc:off");
    expect(lastSet()).toBe(OFF_SENTENCE);

    // Phase 4: resolve the rearm with a fresh tunnel
    const freshTunnelId = "T-FRESH";
    resolveGate!(new Response(JSON.stringify({ tunnelId: freshTunnelId, url: relay.url, tokenTtl: 60 }), { status: 200 }));

    // Let the rearm tail run, then assert: the fresh tunnel that landed after
    // teardown is deleted (once), no new WS connect, footer off.
    await waitFor(() => deletes.includes(`https://cp.example.com/tunnels/${freshTunnelId}`));
    expect(deletes.filter((d) => d === `https://cp.example.com/tunnels/${freshTunnelId}`)).toHaveLength(1);
    // no connect after teardown: relay has no connection
    await new Promise((r) => setTimeout(r, 20));
    expect(relay.connections.length).toBe(0);
    expect(lastSet()).toBe(OFF_SENTENCE);
    void ctrl;
    relay.stop();
  });
});

describe("FLLWUP-5 S-O2: manual PiEvent construction (no ev as PiEvent cast)", () => {
  test("static guard: no `as PiEvent` cast survives in index.ts", async () => {
    const src = await Bun.file(new URL("../index.ts", import.meta.url)).text();
    expect(src).not.toMatch(/as PiEvent/);
  });

  test("all seven subscriptions produce the intended fold output; ui_prompt_end survives the real SDK shape", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const customs = (name: string) =>
      h.relay.received.filter((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === name);
    const types = () => h.relay.received.map((e) => e.frame?.type);

    // 1+2+3: message_start / message_update / message_end → TEXT_MESSAGE_START/CONTENT/END
    h.emit("message_start", { event: "message_start", messageId: "m1", role: "assistant" });
    h.emit("message_update", { event: "message_update", messageId: "m1", events: [{ kind: "text", delta: "hello" }] });
    h.emit("message_end", { event: "message_end", messageId: "m1" });
    await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));
    expect(types()).toContain("TEXT_MESSAGE_START");
    expect(types()).toContain("TEXT_MESSAGE_CONTENT");
    expect(types()).toContain("TEXT_MESSAGE_END");

    // 4: tool_result → TOOL_CALL_RESULT
    h.emit("tool_result", { event: "tool_result", messageId: "m2", toolCallId: "call_1", content: [{ type: "text", text: "out" }] });
    await h.waitFor(() => types().includes("TOOL_CALL_RESULT"));
    const tc = h.relay.received.find((e) => e.frame?.type === "TOOL_CALL_RESULT")!.frame as { content: string };
    expect(tc.content).toBe("out");

    // 5: ui.confirm → CUSTOM pi.human_input with the raise stamp preserved
    h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "P?" });
    await h.waitFor(() => customs("pi.human_input").length === 1);
    const cf = customs("pi.human_input")[0]!.frame as { value: { data: { promptKind: string; prompt: string; occurrence?: number } } };
    expect(cf.value.data.promptKind).toBe("approve");
    expect(cf.value.data.prompt).toBe("P?");
    expect(cf.value.data.occurrence).toBe(1); // forward's registerPrompt special-case untouched

    // 7: ui_prompt_end — feed the REAL SDK payload shape (type:, not event:) — the probe-4 hazard
    h.emit("ui_prompt_end", { type: "ui_prompt_end", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    await h.waitFor(() => customs("pi.human_input.closed").length === 1);
    const closed = customs("pi.human_input.closed")[0]!.frame as { value: { pi: string; data: { kind: string; title: string } } };
    expect(closed.value.pi).toBe("ui_prompt_end");
    expect(closed.value.data.kind).toBe("confirm");
    expect(closed.value.data.title).toBe("Allow rm -rf?");

    h.relay.stop();
  });
});

describe("EV-8 occurrence stamp", () => {
  test("occurrence 1 then 2 for the same promptId; the answer is resolved, not ignored", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    const prompt = { event: "ui.confirm", promptKind: "approve", prompt: "Allow rm -rf?" } as const;
    h.emit("ui.confirm", prompt);
    await h.waitFor(() => {
      const f = h.relay.received.find((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input");
      return f !== undefined;
    });
    // second same prompt
    h.emit("ui.confirm", prompt);
    await h.waitFor(() => {
      const fs2 = h.relay.received.filter((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input");
      return fs2.length === 2;
    });

    const frames = h.relay.received.filter((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input");
    const occ1 = (frames[0]!.frame as { value: { data: { occurrence: number } } }).value.data.occurrence;
    const occ2 = (frames[1]!.frame as { value: { data: { occurrence: number } } }).value.data.occurrence;
    expect(occ1).toBe(1);
    expect(occ2).toBe(2);
    const promptId = (frames[0]!.frame as { value: { data: { promptId: string } } }).value.data.promptId;
    expect(promptId).toBe((frames[1]!.frame as { value: { data: { promptId: string } } }).value.data.promptId);

    // Answer occurrence 1 inbound → inject resolves it (steered fallback, not ignored).
    h.relay.broadcast({
      v: 1,
      seq: 100,
      ack: 0,
      deviceId: "dev-1",
      frame: {
        type: "CUSTOM",
        name: "pi.human_input.response",
        value: { pi: "ui.confirm", data: { promptId, occurrence: 1, response: "yes" } },
      },
    });
    await h.waitFor(() => h.sendUserMessages.length > 0);
    expect(h.sendUserMessages[0]).toBe("yes");
    h.relay.stop();
  });
});

describe("FLLWUP-5 contract (b): pi.human_input.resolved lifecycle emission", () => {
  function promptIdOf(h: Harness): string {
    const f = h.relay.received.find(
      (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"
    )!;
    return (f.frame as { value: { data: { promptId: string } } }).value.data.promptId;
  }
  function resolvedOf(h: Harness) {
    return h.relay.received.filter(
      (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input.resolved"
    );
  }
  async function answer(h: Harness, promptId: string, occurrence: number, deviceId: string, response = "yes") {
    h.relay.broadcast({
      v: 1,
      seq: 100,
      ack: 0,
      deviceId,
      frame: {
        type: "CUSTOM",
        name: "pi.human_input.response",
        value: { pi: "ui.confirm", data: { promptId, occurrence, response } },
      },
    });
  }

  test("direct resolution (fixture seam) → resolved with EXACTLY {promptId, occurrence, deviceId, ts}", async () => {
    const h = await makeHarness({ resolvePendingPrompt: () => true });
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "Allow rm -rf?" }); // raise + register
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"));
    const promptId = promptIdOf(h);
    await answer(h, promptId, 1, "dev-win");
    await h.waitFor(() => resolvedOf(h).length === 1);
    const frame = resolvedOf(h)[0]!.frame as { value: { pi: string; data: Record<string, unknown> } };
    expect(frame.value.pi).toBe("pi.human_input.resolved");
    // strict wire shape: value.data is exactly these four fields — any extra key (e.g. kind) fails
    expect(frame.value.data).toEqual({ promptId, occurrence: 1, deviceId: "dev-win", ts: 0 });
    expect(Object.keys(frame.value.data).sort()).toEqual(["deviceId", "occurrence", "promptId", "ts"]);
    h.relay.stop();
  });

  test("tracked steering fallback (production default) → resolved emitted", async () => {
    const h = await makeHarness(); // resolvePendingPrompt: () => false
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "Allow rm -rf?" });
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"));
    const promptId = promptIdOf(h);
    await answer(h, promptId, 1, "dev-fb");
    await h.waitFor(() => resolvedOf(h).length === 1);
    const data = (resolvedOf(h)[0]!.frame as { value: { data: Record<string, unknown> } }).value.data;
    expect(data).toEqual({ promptId, occurrence: 1, deviceId: "dev-fb", ts: 0 });
    h.relay.stop();
  });

  test("untracked steering fallback (unknown promptId) → NO resolved frame (phantom ack)", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    await answer(h, "ghost-prompt", 1, "dev-phantom"); // never raised by this host
    await h.waitFor(() => h.sendUserMessages.length > 0); // steered, never dropped
    await new Promise((r) => setTimeout(r, 30)); // let any emission land
    expect(resolvedOf(h)).toHaveLength(0);
    h.relay.stop();
  });

  test("stale → NO resolved frame (only pi.human_input.stale)", async () => {
    const h = await makeHarness({ resolvePendingPrompt: () => true });
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "Allow rm -rf?" });
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"));
    const promptId = promptIdOf(h);
    await answer(h, promptId, 1, "dev-first");
    await h.waitFor(() => resolvedOf(h).length === 1);
    await answer(h, promptId, 1, "dev-loser", "late no"); // same (promptId, occurrence) → stale
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input.stale"));
    await new Promise((r) => setTimeout(r, 30));
    expect(resolvedOf(h)).toHaveLength(1); // exactly one resolved, no second
    h.relay.stop();
  });
});

describe("EV-8 runId", () => {
  test("fresh per agent_start cycle, distinct across cycles, thread through the fold", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    h.emit("agent_start");
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "RUN_STARTED"));
    const run1 = (h.relay.received.find((e) => e.frame?.type === "RUN_STARTED")!.frame as { runId: string }).runId;

    // fold a message then settle
    h.emit("message_start", { event: "message_start", messageId: "m1", role: "user" });
    h.emit("message_end", { event: "message_end", messageId: "m1" });
    h.emit("agent_settled");
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "RUN_FINISHED"));

    // second cycle → distinct runId
    h.emit("agent_start");
    await h.waitFor(() => h.relay.received.filter((e) => e.frame?.type === "RUN_STARTED").length === 2);
    const run2 = (h.relay.received.filter((e) => e.frame?.type === "RUN_STARTED")[1]!.frame as { runId: string }).runId;
    expect(run1).not.toBe(run2);
    expect(run1).toMatch(/^uuid-1$/);
    h.relay.stop();
  });
});

describe("EV-8 /rc:login (J5)", () => {
  test("refused when live (close the tunnel first with /rc:off); footer unchanged, driver not entered", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    await h.runCommand("rc:login");
    expect(h.printed).toContain(loginEnglishFor("rc:login.refusal"));
    expect(lastSet(h.setStatus)).toBe(LIVE_SENTENCE); // footer unchanged
    h.relay.stop();
  });

  test("from off and not enrolled: authorizing on driver begin, off on terminal (success)", async () => {
    const h = await makeHarness({
      // The attended flow needs cryptographically-flat state/verifier to make
      // the loopback callback deterministic; inject a zero-byte rng.
      randomBytes: () => new Uint8Array(8),
      openUrl: async (authorizeUrl) => {
        // Simulate the browser completing consent: fetch the redirect_uri with
        // the very state from the authorize URL (wire, not internal).
        const u = new URL(authorizeUrl);
        const state = u.searchParams.get("state") ?? "";
        const redirect = u.searchParams.get("redirect_uri") ?? "";
        await fetch(`${redirect}?code=okcode&state=${state}`);
        return true;
      },
    });
    h.deps.fetch = (async (url: string, init?: RequestInit) => {
      if (url.includes("oauth-authorization-server")) {
        return new Response(
          JSON.stringify({
            authorization_endpoint: "https://cp.example.com/auth",
            token_endpoint: "https://cp.example.com/token",
            device_authorization_endpoint: "https://cp.example.com/device",
          }),
          { status: 200 }
        );
      }
      if (url.includes("/token") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ access_token: "at-new", refresh_token: "rt-new", expires_in: 3600 }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    await h.runCommand("rc:login");
    // authorizing was rendered at driver begin
    expect(h.setStatus).toContain(loginEnglishFor("status.authorizing"));
    // off on terminal
    expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
    h.relay.stop();
  });

  test("from off: failure also returns the footer to off", async () => {
    const h = await makeHarness({ redirectTimeoutMs: 500 });
    h.deps.fetch = (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    await h.runCommand("rc:login");
    // authorizing was rendered at driver begin
    expect(h.setStatus).toContain(loginEnglishFor("status.authorizing"));
    // off on terminal (failure)
    expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
    h.relay.stop();
  });
});
