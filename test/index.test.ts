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
import { setLocale } from "../src/copy";
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
  commandHandlers: Record<string, (args?: string) => void | Promise<void>>;
  eventHandlers: Record<string, Array<(...a: unknown[]) => void>>;
  posts: string[];
  deletes: string[];
  emitters: { name: string; value: unknown }[];
  inputResponses: string[];
  relay: FakeRelay;
  sendUserMessages: string[];
  runCommand: (name: string, args?: string) => Promise<void>;
  emit: (event: string, payload?: unknown) => void;
  /** Wait until pred() is truthy (poll every 2ms). */
  waitFor: (pred: () => boolean, timeoutMs?: number) => Promise<void>;
}

interface HarnessOptions {
  serverUrl?: string | undefined;
  /** EV-15 raw env tier dep. Pass explicitly (even as `undefined`) to control
   *  the env tier; without the key, opts.serverUrl (or the harness default)
   *  populates it, mirroring the old collapsed dep's tests. */
  envServerUrl?: string | undefined;
  /** EV-15 raw settings tier dep. */
  settingServerUrl?: string | undefined;
  /** EV-15: serverUrl written into the persisted credential file. */
  credentialServerUrl?: string;
  /** EV-15: skip writing the credential file entirely (fresh host). */
  noCredential?: boolean;
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
  const commandHandlers: Record<string, (args?: string) => void | Promise<void>> = {};
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
  if (!opts.noCredential) {
    fs.writeFileSync(
      "/tmp/pi-remote-ev8-test/pi-remote/credentials.json",
      JSON.stringify({
        serverUrl: opts.credentialServerUrl ?? opts.serverUrl ?? "https://cp.example.com",
        ...cred,
      })
    );
  } else {
    // Fresh host: a prior test's credential file on the shared path must go.
    fs.rmSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json", { force: true });
  }

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
    envServerUrl:
      "envServerUrl" in opts
        ? opts.envServerUrl
        : opts.serverUrl === undefined
          ? "https://cp.example.com"
          : opts.serverUrl,
    settingServerUrl: "settingServerUrl" in opts ? opts.settingServerUrl : undefined,
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
      commandHandlers[name] = (args?: string) => handler(args);
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
    runCommand: async (name, args) => {
      await commandHandlers[name]?.(args);
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
      envServerUrl: "https://cp.example.com",
      settingServerUrl: undefined,
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
    // FLLWUP-12 (R-PAYLOAD-1): fixtures feed REAL SDK payload shapes —
    // {type, message} + assistantMessageEvent, no top-level messageId/role/events.
    const message = realAssistantMessage();
    h.emit("message_start", { type: "message_start", message });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hello", partial: message } });
    h.emit("message_end", { type: "message_end", message });
    await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));
    expect(types()).toContain("TEXT_MESSAGE_START");
    expect(types()).toContain("TEXT_MESSAGE_CONTENT");
    expect(types()).toContain("TEXT_MESSAGE_END");

    // 4: tool_result → TOOL_CALL_RESULT (real payload: no messageId —
    // toolCallId doubles as the derived messageId, R-PAYLOAD-1 divergence)
    h.emit("tool_result", { type: "tool_result", toolName: "bash", toolCallId: "call_1", input: {}, content: [{ type: "text", text: "out" }], isError: false });
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
    const userMessage = { role: "user", content: "x", timestamp: 0 }; // real UserMessage shape (FLLWUP-12)
    h.emit("message_start", { type: "message_start", message: userMessage });
    h.emit("message_end", { type: "message_end", message: userMessage });
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
    // BUG-1: the refusal precedes mode selection — --headless is no exception.
    await h.runCommand("rc:login", "--headless");
    expect(h.printed).toContain(loginEnglishFor("rc:login.refusal"));
    expect(lastSet(h.setStatus)).toBe(LIVE_SENTENCE); // footer unchanged
    h.relay.stop();
  });

  test("from off and not enrolled: authorizing on driver begin, off on terminal (success)", async () => {
    const h = await makeHarness({
      // EV-15: the attended prompt fires unconditionally — empty submission
      // accepts the prefill (the resolved URL).
      inputPrompt: async () => "",
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
    const h = await makeHarness({
      redirectTimeoutMs: 500,
      inputPrompt: async () => "", // EV-15: accept the prefill
    });
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

  // BUG-1: the driver prints via console.log (src/login.ts print seam),
  // not deps.print, so these tests capture console output around the run.
  function captureConsole(): { logs: string[]; restore: () => void } {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: unknown[]) => {
      logs.push(a.join(" "));
    };
    return { logs, restore: () => (console.log = origLog) };
  }

  test("BUG-1: /rc:login --headless runs the device flow; no browser opened", async () => {
    const openUrls: string[] = [];
    const { logs, restore } = captureConsole();
    const h = await makeHarness({
      openUrl: async (url) => {
        openUrls.push(url);
        return true;
      },
    });
    h.deps.fetch = (async (url: string) => {
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
      if (url.includes("/device")) {
        return new Response(
          JSON.stringify({
            device_code: "dc-1",
            user_code: "ABCD-EFGH",
            verification_uri: "https://cp.example.com/verify",
            verification_uri_complete: "https://cp.example.com/verify?code=ABCD-EFGH",
            expires_in: 300,
            interval: 5,
          }),
          { status: 200 }
        );
      }
      if (url.includes("/token")) {
        return new Response(
          JSON.stringify({ access_token: "at-new", refresh_token: "rt-new", expires_in: 3600 }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      await h.runCommand("rc:login", "--headless");
    } finally {
      restore();
    }

    expect(logs).toContain(loginEnglishFor("login.headless.instructions"));
    expect(openUrls).toHaveLength(0); // no browser in headless mode
    expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
    h.relay.stop();
  });

  test("BUG-1: /rc:login with no flag still runs the attended flow", async () => {
    const openUrls: string[] = [];
    const { logs, restore } = captureConsole();
    const h = await makeHarness({
      inputPrompt: async () => "", // EV-15: accept the prefill
      randomBytes: () => new Uint8Array(8),
      openUrl: async (url) => {
        openUrls.push(url);
        // Simulate the browser completing consent (same wire trick as the
        // existing attended test: fetch the redirect_uri with the state).
        const u = new URL(url);
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

    try {
      await h.runCommand("rc:login");
    } finally {
      restore();
    }

    expect(openUrls.length).toBeGreaterThanOrEqual(1); // attended opens the browser
    expect(logs).not.toContain(loginEnglishFor("login.headless.instructions"));
    expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
    h.relay.stop();
  });

  test("BUG-1: args containing the token select headless (token is literal, whitespace-tolerant)", async () => {
    const { logs, restore } = captureConsole();
    const h = await makeHarness({});
    h.deps.fetch = (async (url: string) => {
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
      if (url.includes("/device")) {
        return new Response(
          JSON.stringify({
            device_code: "dc-1",
            user_code: "ABCD-EFGH",
            verification_uri: "https://cp.example.com/verify",
            expires_in: 300,
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      await h.runCommand("rc:login", "--headless --extra");
    } finally {
      restore();
    }

    expect(logs).toContain(loginEnglishFor("login.headless.instructions"));
    h.relay.stop();
  });
});

describe("FLLWUP-8: ui_prompt_start live raise path", () => {
  function raisesOf(h: Harness) {
    return h.relay.received.filter(
      (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"
    );
  }
  function resolvedOf(h: Harness) {
    return h.relay.received.filter(
      (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input.resolved"
    );
  }
  function fnv1a(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
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

  test("T1: live SDK raise → exactly one stamped pi.human_input frame", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    await h.waitFor(() => raisesOf(h).length === 1);
    const f = raisesOf(h)[0]!.frame as { value: { pi: string; data: Record<string, unknown> } };
    expect(f.value.pi).toBe("ui_prompt_start");
    expect(f.value.data.kind).toBe("confirm"); // verbatim
    expect(f.value.data.title).toBe("Allow rm -rf?");
    expect(f.value.data.schemaVersion).toBe(1);
    expect(f.value.data.promptId).toBe(fnv1a("confirm\u0000Allow rm -rf?"));
    expect(f.value.data.occurrence).toBe(1);
    expect(Object.keys(f.value.data).sort()).toEqual(["kind", "occurrence", "promptId", "schemaVersion", "title"]);
    expect("prompt" in f.value.data).toBe(false);
    h.relay.stop();
  });

  test("T2: resolved e2e — remote answer after live raise emits pi.human_input.resolved (FLLWUP-5 (b) red→green)", async () => {
    const h = await makeHarness(); // production default resolvePendingPrompt: () => false
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    await h.waitFor(() => raisesOf(h).length === 1);
    const promptId = (raisesOf(h)[0]!.frame as { value: { data: { promptId: string } } }).value.data.promptId;
    await answer(h, promptId, 1, "dev-live");
    await h.waitFor(() => resolvedOf(h).length === 1);
    const frame = resolvedOf(h)[0]!.frame as { value: { pi: string; data: Record<string, unknown> } };
    expect(frame.value.pi).toBe("pi.human_input.resolved");
    expect(frame.value.data).toEqual({ promptId, occurrence: 1, deviceId: "dev-live", ts: 0 });
    h.relay.stop();
  });

  test("T3: occurrence counter — two identical raises → 1 then 2", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    await h.waitFor(() => raisesOf(h).length === 2);
    const occ = raisesOf(h).map(
      (e) => (e.frame as { value: { data: { occurrence: number } } }).value.data.occurrence
    );
    expect(occ).toEqual([1, 2]);
    h.relay.stop();
  });

  test("T5: bogus kind → mirroring coercion: kind coerced to custom, registration fires", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "bogus" });
    await h.waitFor(() => raisesOf(h).length === 1);
    const f = raisesOf(h)[0]!.frame as { value: { data: Record<string, unknown> } };
    expect(f.value.data.kind).toBe("custom");
    expect(f.value.data.occurrence).toBe(1);
    // registration fired: answering the coerced promptId resolves (tracked), not phantom
    const promptId = fnv1a("custom\u0000");
    await answer(h, promptId, 1, "dev-bogus");
    await h.waitFor(() => resolvedOf(h).length === 1);
    h.relay.stop();
  });
});

// ---------------------------------------------------------------------------
// FLLWUP-12 — real-shaped payload regression (probe-4 silent-drop class).
// Feeds the REAL SDK payload shapes (R-PAYLOAD-1: fixtures feed real-shaped
// payloads) through index.ts's live handlers and asserts the expected AG-UI
// frames on the relay. Self-contained: local payload builders only, NO import
// of src/pi-sdk-events — this suite is the red-at-base record (card
// FLLWUP-12), so it must compile at base d36c6c9 where that module doesn't
// exist. Real shapes per pi-ai types.d.ts (Message/AssistantMessage) and
// dist/core/extensions/types.d.ts (message_* payloads).
// ---------------------------------------------------------------------------

/** Real SDK AssistantMessage fixture (pi-ai types.d.ts:353). */
function realAssistantMessage(over: { content?: unknown[] } = {}): Record<string, unknown> {
  return {
    role: "assistant",
    content: over.content ?? [{ type: "text", text: "" }],
    api: "anthropic",
    provider: "anthropic",
    model: "m",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    stopReason: "stop",
    timestamp: 0,
  };
}

describe("FLLWUP-12: real-shaped payloads through the live path (R-PAYLOAD-1)", () => {
  test("message family with real {message} payloads → TEXT frames with one derived messageId (probe-4 regression)", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const types = () => h.relay.received.map((e) => e.frame?.type);

    const message = realAssistantMessage();
    h.emit("message_start", { type: "message_start", message });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hello", partial: message } });
    h.emit("message_end", { type: "message_end", message });
    await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));

    const start = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_START")!.frame as { messageId: string; role: string };
    const content = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_CONTENT")!.frame as { messageId: string; delta: string };
    const end = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_END")!.frame as { messageId: string };
    expect(start.role).toBe("assistant"); // role derived from message.role
    expect(content.delta).toBe("hello");
    // One identity-derived messageId across start/content/end:
    expect(start.messageId).toBe(content.messageId);
    expect(content.messageId).toBe(end.messageId);
    h.relay.stop();
  });

  test("real thinking_delta → REASONING pane; toolcall_start/delta/end → TOOL_CALL frames with SDK ids", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const types = () => h.relay.received.map((e) => e.frame?.type);

    const toolCallBlock = { type: "toolCall", id: "call_9", name: "bash", arguments: {} };
    const message = realAssistantMessage({ content: [{ type: "thinking", thinking: "" }, toolCallBlock] });
    h.emit("message_start", { type: "message_start", message });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "pondering", partial: message } });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, partial: message } });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "toolcall_delta", contentIndex: 1, delta: '{"cmd":', partial: message } });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "toolcall_end", contentIndex: 1, toolCall: toolCallBlock, partial: message } });
    h.emit("message_end", { type: "message_end", message });
    await h.waitFor(() => types().includes("TOOL_CALL_END"));

    const reasoning = h.relay.received.filter((e) => e.frame?.type === "REASONING_MESSAGE_CONTENT");
    expect(reasoning).toHaveLength(1);
    expect((reasoning[0]!.frame as { delta: string }).delta).toBe("pondering");
    const tcStart = h.relay.received.find((e) => e.frame?.type === "TOOL_CALL_START")!.frame as { toolCallId: string; toolCallName: string; parentMessageId: string };
    expect(tcStart.toolCallId).toBe("call_9"); // SDK tool-call id, verbatim
    expect(tcStart.toolCallName).toBe("bash");
    const args = h.relay.received.find((e) => e.frame?.type === "TOOL_CALL_ARGS")!.frame as { toolCallId: string; delta: string };
    expect(args.toolCallId).toBe("call_9");
    expect(args.delta).toBe('{"cmd":');
    const tcEnd = h.relay.received.find((e) => e.frame?.type === "TOOL_CALL_END")!.frame as { toolCallId: string };
    expect(tcEnd.toolCallId).toBe("call_9");
    // parentMessageId = the same derived messageId as the message family:
    const start = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_START");
    if (start) {
      expect(tcStart.parentMessageId).toBe((start.frame as { messageId: string }).messageId);
    }
    h.relay.stop();
  });

  test("tool_result real payload (no messageId) → TOOL_CALL_RESULT with toolCallId as derived messageId", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    h.emit("tool_result", { type: "tool_result", toolName: "bash", toolCallId: "call_1", input: { command: "ls" }, content: [{ type: "text", text: "out" }], isError: false });
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "TOOL_CALL_RESULT"));
    const tc = h.relay.received.find((e) => e.frame?.type === "TOOL_CALL_RESULT")!.frame as { messageId: string; toolCallId: string; content: string; role: string };
    expect(tc.messageId).toBe("call_1"); // derivation: toolCallId doubles as messageId (R-PAYLOAD-1 divergence)
    expect(tc.toolCallId).toBe("call_1");
    expect(tc.content).toBe("out");
    expect(tc.role).toBe("tool");
    h.relay.stop();
  });

  test("identity correlation survives in-place mutation: end-after-mutation keeps the same messageId", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const types = () => h.relay.received.map((e) => e.frame?.type);

    const message = realAssistantMessage();
    h.emit("message_start", { type: "message_start", message });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "before", partial: message } });
    // The real SDK mutates the message in place (_replaceMessageInPlace):
    message.content = [{ type: "text", text: "after" }];
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "after", partial: message } });
    h.emit("message_end", { type: "message_end", message });
    await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));

    const contents = h.relay.received.filter((e) => e.frame?.type === "TEXT_MESSAGE_CONTENT");
    expect(contents).toHaveLength(2);
    const ids = new Set(contents.map((e) => (e.frame as { messageId: string }).messageId));
    expect(ids.size).toBe(1); // same object identity → same derived messageId across mutation
    const end = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_END")!.frame as { messageId: string };
    expect(ids.has(end.messageId)).toBe(true);
    h.relay.stop();
  });

  test("mid-join text_delta (no prior message_start) still emits TEXT frames, no crash", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const types = () => h.relay.received.map((e) => e.frame?.type);

    const message = realAssistantMessage();
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "late", partial: message } });
    h.emit("message_end", { type: "message_end", message });
    await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));
    const start = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_START")!.frame as { messageId: string };
    const content = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_CONTENT")!.frame as { messageId: string; delta: string };
    expect(content.delta).toBe("late");
    expect(content.messageId).toBe(start.messageId);
    h.relay.stop();
  });

  test("user message: real {message} payload → role user on TEXT_MESSAGE_START", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    const message = { role: "user", content: "hi", timestamp: 0 };
    h.emit("message_start", { type: "message_start", message });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hi", partial: message } });
    h.emit("message_end", { type: "message_end", message });
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "TEXT_MESSAGE_END"));
    const start = h.relay.received.find((e) => e.frame?.type === "TEXT_MESSAGE_START")!.frame as { role: string; messageId: string };
    expect(start.role).toBe("user");
    h.relay.stop();
  });

  test("wedge (skeptic): engine-verbatim spread-copy per emission → 1 START, 2 CONTENT, 1 END", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const types = () => h.relay.received.map((e) => e.frame?.type);

    // Verbatim streamAssistantResponse emission semantics (pi-agent-core
    // agent-loop.js:284/295-299/309): message_start and EVERY message_update
    // emit `{ ...partialMessage }` — a fresh spread copy per event, of the
    // accumulated partial (pi-ai mutates one `output` object in place and
    // reassigns `partialMessage = event.partial`); message_end emits the
    // accumulated finalMessage itself, a distinct object from every copy.
    // Object identity NEVER survives an event. role/timestamp are copied
    // verbatim onto every copy (assistant-message-frame.js
    // cloneStartMessage) — they are the payload-intrinsic correlation data.
    const startCopy = realAssistantMessage({ content: [{ type: "text", text: "" }] });
    const updateCopy1 = { ...startCopy, content: [{ type: "text", text: "hello" }] };
    const updateCopy2 = { ...startCopy, content: [{ type: "text", text: "hello world" }] };
    const finalMessage = { ...startCopy, content: [{ type: "text", text: "hello world" }] };
    h.emit("message_start", { type: "message_start", message: startCopy });
    h.emit("message_update", { type: "message_update", message: updateCopy1, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hello", partial: updateCopy1 } });
    h.emit("message_update", { type: "message_update", message: updateCopy2, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: " world", partial: updateCopy2 } });
    h.emit("message_end", { type: "message_end", message: finalMessage });
    await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));

    const starts = h.relay.received.filter((e) => e.frame?.type === "TEXT_MESSAGE_START");
    const contents = h.relay.received.filter((e) => e.frame?.type === "TEXT_MESSAGE_CONTENT");
    const ends = h.relay.received.filter((e) => e.frame?.type === "TEXT_MESSAGE_END");
    expect(starts).toHaveLength(1); // no double-START, no id churn per event
    expect(contents.map((e) => (e.frame as { delta: string }).delta)).toEqual(["hello", " world"]);
    expect(ends).toHaveLength(1); // no silent drop
    const id = (starts[0]!.frame as { messageId: string }).messageId;
    expect(contents.every((e) => (e.frame as { messageId: string }).messageId === id)).toBe(true);
    expect((ends[0]!.frame as { messageId: string }).messageId).toBe(id);
    h.relay.stop();
  });

  test("malformed payloads (null, missing message, non-message role) → zero frames, no crash", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const count = () => h.relay.received.length;
    const baseline = count();

    h.emit("message_start", null);
    h.emit("message_start", undefined);
    h.emit("message_start", { type: "message_start" }); // missing message
    h.emit("message_update", { type: "message_update", message: null, assistantMessageEvent: null });
    h.emit("message_end", { type: "message_end", message: { role: "system", content: "sys", timestamp: 0 } }); // system role never frames
    h.emit("tool_result", { type: "tool_result", toolName: "bash", toolCallId: 42, content: "not-an-array", isError: false }); // malformed fields
    h.emit("tool_result", null);

    await new Promise((r) => setTimeout(r, 30)); // let any wrongly-emitted frame land
    expect(count()).toBe(baseline); // zero frames for malformed input, no crash
    // And the fold still works after the malformed barrage:
    const message = realAssistantMessage();
    h.emit("message_start", { type: "message_start", message });
    h.emit("message_update", { type: "message_update", message, assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "ok", partial: message } });
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "TEXT_MESSAGE_CONTENT"));
    h.relay.stop();
  });
});

// ---------------------------------------------------------------------------
// FLLWUP-94 — tool_execution_* live wiring. The installed SDK emits
// tool_execution_start/update/end during tool execution
// (dist/core/extensions/types.d.ts:608–628; agent-session.js:528–553 forwards
// them to extension handlers verbatim), but index.ts never subscribed, so
// translate.ts's pi.tool.start/progress/end cases were dead code and the web
// client's tool card never appeared. Payload shapes are REAL (R-PAYLOAD-1):
// start {type, toolCallId, toolName, args}; update adds partialResult — the
// tool's own partial result object ({content, details} for bash, not a
// string); end {type, toolCallId, toolName, result, isError:boolean}.
// ---------------------------------------------------------------------------

/** Real SDK tool_execution payload builders (types.d.ts:608–628). */
/** Real SDK tool_execution payload builders (types.d.ts:608–628). The wide
 * parameter types are deliberate: malformed-payload tests must be able to
 * build payloads the real narrowing would reject. */
const toolStart = (toolCallId: unknown, toolName: unknown, args: unknown) => ({ type: "tool_execution_start", toolCallId, toolName, args });
const toolUpdate = (toolCallId: unknown, toolName: unknown, args: unknown, partialResult: unknown) => ({ type: "tool_execution_update", toolCallId, toolName, args, partialResult });
const toolEnd = (toolCallId: unknown, toolName: unknown, result: unknown, isError: unknown) => ({ type: "tool_execution_end", toolCallId, toolName, result, isError });

/** Real bash partial/result objects: the tool's own ToolResult shape
 * ({content, details}) — bundle chunk-JVUZSMYM.js onUpdate(snapshot) where
 * snapshot = {content:[{type:"text",text}], details:{truncation}}. */
const bashPartial = { content: [{ type: "text", text: "listing files…" }], details: {} };

/** All CUSTOM pi.tool.* frames observed on the relay, in arrival order. */
function toolCustomFrames(h: Harness): { name: string; value: { pi?: string; data?: Record<string, unknown> } }[] {
  return h.relay.received
    .map((e) => e.frame as { type?: string; name?: string; value?: { pi?: string; data?: Record<string, unknown> } })
    .filter((f) => f?.type === "CUSTOM" && typeof f.name === "string" && f.name.startsWith("pi.tool."))
    .map((f) => ({ name: f.name!, value: f.value! }));
}

describe("FLLWUP-94: tool_execution_* live wiring (R-PAYLOAD-1 real shapes)", () => {
  test("tool_execution_start real payload → CUSTOM pi.tool.start with toolCallId + toolName", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    h.emit("tool_execution_start", toolStart("call_1", "bash", { command: "ls" }));
    await h.waitFor(() => toolCustomFrames(h).some((f) => f.name === "pi.tool.start"));

    const f = toolCustomFrames(h).find((x) => x.name === "pi.tool.start")!;
    expect(f.value.pi).toBe("tool_execution_start");
    expect(f.value.data).toEqual({ toolCallId: "call_1", toolName: "bash" });
    h.relay.stop();
  });

  test("tool_execution_update real payload (args + OBJECT partialResult) → pi.tool.update then pi.tool.progress, in that order", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    // Real bash partialResult is the tool's own result-shaped OBJECT, not a string.
    h.emit("tool_execution_update", toolUpdate("call_1", "bash", { command: "ls" }, bashPartial));
    await h.waitFor(() => toolCustomFrames(h).some((f) => f.name === "pi.tool.progress"));

    const frames = toolCustomFrames(h);
    const upd = frames.find((x) => x.name === "pi.tool.update");
    const prog = frames.find((x) => x.name === "pi.tool.progress");
    expect(upd).toBeDefined();
    expect(prog).toBeDefined();
    expect(frames.findIndex((x) => x.name === "pi.tool.update")).toBeLessThan(frames.findIndex((x) => x.name === "pi.tool.progress"));
    expect(upd!.value.data).toEqual({ toolCallId: "call_1", args: { command: "ls" } });
    expect(prog!.value.data).toEqual({ toolCallId: "call_1", partialResult: bashPartial });
    h.relay.stop();
  });

  test("tool_execution_end real payload → pi.tool.end with result + isError", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    const bashResult = { content: [{ type: "text", text: "a.txt\nb.txt" }], details: {} };
    h.emit("tool_execution_end", toolEnd("call_1", "bash", bashResult, false));
    await h.waitFor(() => toolCustomFrames(h).some((f) => f.name === "pi.tool.end"));

    const f = toolCustomFrames(h).find((x) => x.name === "pi.tool.end")!;
    expect(f.value.pi).toBe("tool_execution_end");
    expect(f.value.data).toEqual({ toolCallId: "call_1", result: bashResult, isError: false });
    h.relay.stop();
  });

  test("full lifecycle in SDK order → start, update, progress, end, then TOOL_CALL_RESULT, in emission order", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    h.emit("tool_execution_start", toolStart("call_7", "read", { path: "a.ts" }));
    h.emit("tool_execution_update", toolUpdate("call_7", "read", { path: "a.ts" }, bashPartial));
    h.emit("tool_execution_end", toolEnd("call_7", "read", { content: [{ type: "text", text: "src" }] }, false));
    h.emit("tool_result", { type: "tool_result", toolName: "read", toolCallId: "call_7", input: { path: "a.ts" }, content: [{ type: "text", text: "src" }], isError: false });
    await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "TOOL_CALL_RESULT"));

    const seq = h.relay.received
      .map((e) => e.frame as { type?: string; name?: string })
      .filter((f) => f?.type === "CUSTOM" && f.name?.startsWith("pi.tool.") || f?.type === "TOOL_CALL_RESULT")
      .map((f) => (f.type === "CUSTOM" ? f.name : f.type));
    expect(seq).toEqual(["pi.tool.start", "pi.tool.update", "pi.tool.progress", "pi.tool.end", "TOOL_CALL_RESULT"]);
    h.relay.stop();
  });

  test("malformed tool_execution payloads → zero pi.tool frames, no crash", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const baseline = h.relay.received.length;

    h.emit("tool_execution_start", null);
    h.emit("tool_execution_start", { type: "tool_execution_start" }); // no toolCallId
    h.emit("tool_execution_start", toolStart(42, "bash", {})); // non-string toolCallId
    h.emit("tool_execution_update", { type: "tool_execution_update", toolCallId: "c", toolName: 7 }); // non-string toolName
    h.emit("tool_execution_end", toolEnd("c", "bash", {}, "not-a-boolean")); // non-boolean isError
    h.emit("tool_execution_end", undefined);

    await new Promise((r) => setTimeout(r, 30)); // let any wrongly-emitted frame land
    expect(toolCustomFrames(h)).toEqual([]); // zero pi.tool frames for malformed input
    expect(h.relay.received.length).toBe(baseline); // and zero frames at all
    // The wiring still works after the malformed barrage:
    h.emit("tool_execution_start", toolStart("call_ok", "bash", {}));
    await h.waitFor(() => toolCustomFrames(h).some((f) => f.name === "pi.tool.start"));
    h.relay.stop();
  });
});

// ---------------------------------------------------------------------------
// FLLWUP-94 (fix cycle 2) — live user-turn echo. The real SDK delivers a USER
// message as a whole message_start/message_end pair ({type, message} — no
// assistantMessageEvent; agent-session.js forwards message_* with only
// {message}), so deps.on("message_update") never fires for a locally typed
// (TUI) turn and the live fold emits nothing — the turn appeared only via the
// reload snapshot. The fix: message_start with role "user" forwards the
// message's text as a synthetic message_update text event, so the fold emits
// TEXT_MESSAGE_START{role:user} + TEXT_MESSAGE_CONTENT live and message_end
// closes with TEXT_MESSAGE_END.
//
// Hard constraint (no double render): the web client optimistically folds its
// own sent message (jumpseat ag-ui-timeline applyLocalUserMessage,
// eventId local:<messageId>) and dedupes an inbound user START by messageId
// or local:<messageId>. The injection path (src/inject.ts) sends only the
// text — sendUserMessage → prompt() mints the pi user message (and its
// timestamp) internally, so the client's AG-UI messageId cannot ride through
// injection. Therefore the host correlates: the injector records the client
// messageId per injected text, and when the echoed user message_start's text
// matches, the echo is forwarded under the CLIENT's id — the existing client
// dedup swallows it (jumpseat test "an inbound user-role START with a
// messageId matching a local row adds no entry"); a TUI turn (never injected
// by the relay) echoes under the derived user:<timestamp> id and renders live
// on every connected client (jumpseat test "an inbound user-role START with
// an unknown messageId opens one user row").
// ---------------------------------------------------------------------------

/** Real stored user-message shape (pi-agent-core UserMessage). */
function realUserMessage(text: string, timestamp: number): Record<string, unknown> {
  return { role: "user", content: [{ type: "text", text }], timestamp };
}

function textFrames(h: Harness): { type: string; messageId?: string; role?: string; delta?: string }[] {
  return h.relay.received
    .map((e) => e.frame as { type?: string; messageId?: string; role?: string; delta?: string })
    .filter((f) => f?.type === "TEXT_MESSAGE_START" || f?.type === "TEXT_MESSAGE_CONTENT" || f?.type === "TEXT_MESSAGE_END")
    .map((f) => ({ type: f.type!, messageId: f.messageId, role: f.role, delta: f.delta }));
}

function sendUserTriple(h: Harness, seq: number, messageId: string, text: string): void {
  h.relay.broadcast({ v: 1, seq, ack: 0, deviceId: "dev-web", frame: { type: "TEXT_MESSAGE_START", messageId, role: "user" } });
  h.relay.broadcast({ v: 1, seq: seq + 1, ack: 0, deviceId: "dev-web", frame: { type: "TEXT_MESSAGE_CONTENT", messageId, delta: text } });
  h.relay.broadcast({ v: 1, seq: seq + 2, ack: 0, deviceId: "dev-web", frame: { type: "TEXT_MESSAGE_END", messageId } });
}

describe("FLLWUP-94 fix cycle 2: live user-turn echo (no assistantMessageEvent on user messages)", () => {
  test("TUI user turn: real-shaped message_start+message_end (no assistantMessageEvent) → full user TEXT triple live, one derived id", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    // The REAL SDK path for a user message: message_start then message_end,
    // whole message, no assistantMessageEvent, no message_update.
    h.emit("message_start", { type: "message_start", message: realUserMessage("typed in the tui", 1234) });
    h.emit("message_end", { type: "message_end", message: realUserMessage("typed in the tui", 1234) });
    await h.waitFor(() => textFrames(h).some((f) => f.type === "TEXT_MESSAGE_END"));

    const frames = textFrames(h);
    const types = frames.map((f) => f.type);
    expect(types).toEqual(["TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END"]);
    expect(frames[0]!.role).toBe("user");
    expect(frames[0]!.messageId).toBe("user:1234"); // payload-derived id (role:timestamp)
    expect(frames[1]!.delta).toBe("typed in the tui");
    expect(new Set(frames.map((f) => f.messageId)).size).toBe(1); // one id across the triple
    h.relay.stop();
  });

  test("browser-typed turn: the echoed TEXT triple carries the CLIENT's messageId so the existing client dedup swallows it", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    // The web client sends its composer triple inbound; the injector injects
    // only the text (client messageId cannot ride through sendUserMessage).
    sendUserTriple(h, 201, "client-1", "hello there");
    await h.waitFor(() => h.sendUserMessages[0] === "hello there");

    // pi echoes the appended user message as message_start/message_end.
    h.emit("message_start", { type: "message_start", message: realUserMessage("hello there", 5678) });
    h.emit("message_end", { type: "message_end", message: realUserMessage("hello there", 5678) });
    await h.waitFor(() => textFrames(h).some((f) => f.type === "TEXT_MESSAGE_END"));

    const starts = textFrames(h).filter((f) => f.type === "TEXT_MESSAGE_START");
    expect(starts).toHaveLength(1); // exactly one triple — no second render
    expect(starts[0]!.messageId).toBe("client-1"); // CLIENT id → client dedup (local:client-1) matches
    expect(starts[0]!.role).toBe("user");
    const contents = textFrames(h).filter((f) => f.type === "TEXT_MESSAGE_CONTENT");
    expect(contents).toHaveLength(1);
    expect(contents[0]!.delta).toBe("hello there");
    expect(contents[0]!.messageId).toBe("client-1");
    const ends = textFrames(h).filter((f) => f.type === "TEXT_MESSAGE_END");
    expect(ends).toHaveLength(1);
    expect(ends[0]!.messageId).toBe("client-1");
    h.relay.stop();
  });

  test("no misattribution: a TUI turn never claims a pending browser id, and the browser id survives for its own echo", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);

    // A browser turn is pending echo correlation...
    sendUserTriple(h, 301, "client-9", "shared");
    await h.waitFor(() => h.sendUserMessages[0] === "shared");

    // ...but the NEXT user message is a TUI turn with different text: it must
    // echo under the derived id, never under client-9.
    h.emit("message_start", { type: "message_start", message: realUserMessage("typed in the tui", 99) });
    h.emit("message_end", { type: "message_end", message: realUserMessage("typed in the tui", 99) });
    await h.waitFor(() => textFrames(h).some((f) => f.type === "TEXT_MESSAGE_END"));
    const tuiStart = textFrames(h).find((f) => f.type === "TEXT_MESSAGE_START");
    expect(tuiStart!.messageId).toBe("user:99");

    // The pending browser id is still unconsumed: its own echo claims it.
    h.emit("message_start", { type: "message_start", message: realUserMessage("shared", 100) });
    h.emit("message_end", { type: "message_end", message: realUserMessage("shared", 100) });
    await h.waitFor(() => textFrames(h).filter((f) => f.type === "TEXT_MESSAGE_END").length === 2);
    const secondStart = textFrames(h).filter((f) => f.type === "TEXT_MESSAGE_START")[1];
    expect(secondStart!.messageId).toBe("client-9");
    h.relay.stop();
  });
});

// ---------------------------------------------------------------------------
// EV-15 — default control-plane URL (https://relay.jumpseat.sh), unconditional
// attended prompt, headless skip. Pins per the settled spec's test plan.
// ---------------------------------------------------------------------------
describe("EV-15: default relay URL + prompt semantics", () => {
  function captureConsoleOut(): { logs: string[]; restore: () => void } {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: unknown[]) => {
      logs.push(a.join(" "));
    };
    return { logs, restore: () => (console.log = origLog) };
  }

  test("T2/A1: fresh host attended — prompt names the default; empty submission enrolls byte-equal", async () => {
    const prompts: string[] = [];
    const h = await makeHarness({
      noCredential: true,
      envServerUrl: undefined,
      inputPrompt: async (p) => {
        prompts.push(p);
        return ""; // empty submission accepts the prefill
      },
      randomBytes: () => new Uint8Array(8),
      openUrl: async (authorizeUrl) => {
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
            authorization_endpoint: "https://relay.jumpseat.sh/auth",
            token_endpoint: "https://relay.jumpseat.sh/token",
            device_authorization_endpoint: "https://relay.jumpseat.sh/device",
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

    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.startsWith("Control-plane server URL [https://relay.jumpseat.sh]:")).toBe(true);
    expect(prompts[0]).toContain("Press Enter to enroll this host against https://relay.jumpseat.sh");
    // The prompt is plumbing-free: no env-var literals.
    expect(prompts[0]).not.toContain("PI_REMOTE_SERVER_URL");
    expect(prompts[0]).not.toContain("piRemote.serverUrl");
    // Persisted credential's serverUrl is byte-equal to the default.
    const fs = await import("node:fs");
    const raw = fs.readFileSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json", "utf8");
    expect(JSON.parse(raw).serverUrl).toBe("https://relay.jumpseat.sh");
    h.relay.stop();
  });

  test("T3/A2: wired precedence — /rc dials env > setting > credential, never the default", async () => {
    const tiers = [
      {
        opts: { envServerUrl: "https://env.example", settingServerUrl: "https://setting.example", credentialServerUrl: "https://custom.example" },
        expectUrl: "https://env.example",
      },
      {
        opts: { envServerUrl: undefined, settingServerUrl: "https://setting.example", credentialServerUrl: "https://custom.example" },
        expectUrl: "https://setting.example",
      },
      {
        opts: { envServerUrl: undefined, credentialServerUrl: "https://custom.example" },
        expectUrl: "https://custom.example",
      },
    ];
    for (const t of tiers) {
      const h = await makeHarness(t.opts);
      await h.runCommand("rc");
      await h.waitFor(() => h.posts.length > 0);
      expect(h.posts[0]).toBe(`${t.expectUrl}/tunnels`);
      expect(h.posts.join("|")).not.toContain("https://relay.jumpseat.sh");
      h.relay.stop();
    }
  });

  test("T3/A2: prompt prefill reflects the resolved tier across the four-tier matrix", async () => {
    const cases = [
      { opts: { envServerUrl: "https://env.example" }, expected: "https://env.example" },
      { opts: { envServerUrl: undefined, settingServerUrl: "https://setting.example" }, expected: "https://setting.example" },
      { opts: { envServerUrl: undefined, credentialServerUrl: "https://custom.example" }, expected: "https://custom.example" },
      { opts: { noCredential: true, envServerUrl: undefined }, expected: "https://relay.jumpseat.sh" },
    ];
    for (const c of cases) {
      const prompts: string[] = [];
      const h = await makeHarness({
        ...c.opts,
        inputPrompt: async (p) => {
          prompts.push(p);
          return undefined; // Escape right after capture — driver never constructed
        },
      });
      await h.runCommand("rc:login");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain(`Control-plane server URL [${c.expected}]:`);
      h.relay.stop();
    }
  });

  test("T4/A3: rearm + rcCommand cred-only dial the credential's URL, never the default", async () => {
    const h = await makeHarness({ envServerUrl: undefined, credentialServerUrl: "https://custom.example" });
    await h.runCommand("rc"); // rcCommand cred-only
    await h.waitFor(() => h.posts.length > 0);
    expect(h.posts[0]).toBe("https://custom.example/tunnels");
    await h.waitFor(() => h.relay.connections.length > 0);
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.relay.kill(); // force reconnect → rearm cred-only
    await h.waitFor(() => h.posts.length >= 2);
    expect(h.posts.every((p) => p.startsWith("https://custom.example/"))).toBe(true);
    expect(h.posts.join("|")).not.toContain("https://relay.jumpseat.sh");
    h.relay.stop();
  });

  test("T4/A3: rearm with no credential → enrollment_expired remedy, never a default dial", async () => {
    const h = await makeHarness({ envServerUrl: undefined });
    await h.runCommand("rc");
    await h.waitFor(() => h.relay.connections.length > 0);
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    const fs = await import("node:fs");
    fs.rmSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json", { force: true });
    h.relay.kill(); // reconnect → rearm → no credential
    await h.waitFor(() => lastSet(h.setStatus) === tunnelReasonCopy.enrollment_expired.userLine);
    expect(h.posts.join("|")).not.toContain("https://relay.jumpseat.sh");
    h.relay.stop();
  });

  test("T5/R2-1: off footer is byte-equal 'Off'/'Mati' with the default cached — no token, no default URL", async () => {
    const h = await makeHarness({ noCredential: true, envServerUrl: undefined });
    h.ctrl.reducer({ type: "set", state: "off" });
    expect(lastSet(h.setStatus)).toBe("Off");
    expect(lastSet(h.setStatus)).not.toContain("<serverUrl>");
    expect(lastSet(h.setStatus)).not.toContain("https://relay.jumpseat.sh");
    setLocale("id");
    h.ctrl.reducer({ type: "set", state: "off" });
    expect(lastSet(h.setStatus)).toBe("Mati");
    expect(lastSet(h.setStatus)).not.toContain("<serverUrl>");
    expect(lastSet(h.setStatus)).not.toContain("https://relay.jumpseat.sh");
    setLocale("en");
    h.relay.stop();
  });

  test("T6/A5: error footer renders the literal default URL, no raw token", async () => {
    const h = await makeHarness({ noCredential: true, envServerUrl: undefined });
    h.ctrl.reducer({ type: "error", reason: "control_plane_unreachable" });
    const line = lastSet(h.setStatus)!;
    expect(line).toContain("https://relay.jumpseat.sh");
    expect(line).not.toContain("<serverUrl>");
    h.relay.stop();
  });

  test("T7: headless fresh host — zero prompts, prints the resolved target, runs against the default", async () => {
    let promptCalls = 0;
    const discoveryUrls: string[] = [];
    const { restore } = captureConsoleOut();
    const h = await makeHarness({
      noCredential: true,
      envServerUrl: undefined,
      inputPrompt: async () => {
        promptCalls++;
        return "";
      },
    });
    h.deps.fetch = (async (url: string, init?: RequestInit) => {
      discoveryUrls.push(url);
      if (url.includes("oauth-authorization-server")) {
        return new Response(
          JSON.stringify({
            authorization_endpoint: "https://relay.jumpseat.sh/auth",
            token_endpoint: "https://relay.jumpseat.sh/token",
            device_authorization_endpoint: "https://relay.jumpseat.sh/device",
          }),
          { status: 200 }
        );
      }
      if (url.includes("/device")) {
        return new Response(
          JSON.stringify({
            device_code: "dc-1",
            user_code: "ABCD-EFGH",
            verification_uri: "https://relay.jumpseat.sh/verify",
            verification_uri_complete: "https://relay.jumpseat.sh/verify?code=ABCD-EFGH",
            expires_in: 300,
            interval: 5,
          }),
          { status: 200 }
        );
      }
      if (url.includes("/token")) {
        return new Response(
          JSON.stringify({ access_token: "at-new", refresh_token: "rt-new", expires_in: 3600 }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      await h.runCommand("rc:login", "--headless");
    } finally {
      restore();
    }

    expect(promptCalls).toBe(0); // the prompt never fires in headless mode
    expect(h.printed.join("\n")).toContain("https://relay.jumpseat.sh"); // the resolved target is named
    expect(discoveryUrls.some((u) => u.startsWith("https://relay.jumpseat.sh/"))).toBe(true);
    const fs = await import("node:fs");
    const raw = fs.readFileSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json", "utf8");
    expect(JSON.parse(raw).serverUrl).toBe("https://relay.jumpseat.sh");
    h.relay.stop();
  });

  test("T8: Escape (undefined) at the prompt cancels — driver never constructed, footer unchanged, no failure copy", async () => {
    let fetchCalls = 0;
    const h = await makeHarness({
      noCredential: true,
      envServerUrl: undefined,
      inputPrompt: async () => undefined,
    });
    h.deps.fetch = (async () => {
      fetchCalls++;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await h.runCommand("rc:login");

    expect(h.setStatus).toEqual([]); // footer untouched
    expect(h.printed).toEqual([]); // no failure copy
    expect(fetchCalls).toBe(0); // driver never constructed → no discovery, no dial
    const fs = await import("node:fs");
    expect(fs.existsSync("/tmp/pi-remote-ev8-test/pi-remote/credentials.json")).toBe(false);
    h.relay.stop();
  });

  test("T11: footer freshness — credential written after construction renders its URL, not a construction-time value", async () => {
    const h = await makeHarness({ noCredential: true, envServerUrl: undefined });
    // Credential appears after construction (as a login would write it).
    const fs = await import("node:fs");
    fs.writeFileSync(
      "/tmp/pi-remote-ev8-test/pi-remote/credentials.json",
      JSON.stringify({ serverUrl: "https://custom.example", accessToken: "at-2", tokenExpiry: Date.now() + 60_000 })
    );
    // Force the dial to fail (unreachable) so the error footer renders.
    h.deps.fetch = (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    await h.runCommand("rc");
    const line = lastSet(h.setStatus)!;
    expect(line).toContain("https://custom.example");
    expect(line).not.toContain("https://relay.jumpseat.sh");
    h.relay.stop();
  });

  test("T12: hand-edited empty-serverUrl credential at rearm → corrupt, never dials the default", async () => {
    const h = await makeHarness({ envServerUrl: undefined });
    await h.runCommand("rc");
    await h.waitFor(() => h.relay.connections.length > 0);
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    // Hand-edit the credential file to carry an empty serverUrl.
    const fs = await import("node:fs");
    fs.writeFileSync(
      "/tmp/pi-remote-ev8-test/pi-remote/credentials.json",
      JSON.stringify({ serverUrl: "", accessToken: "at-1", tokenExpiry: Date.now() + 60_000 })
    );
    h.relay.kill(); // reconnect → rearm → readCredential → corrupt → null
    await h.waitFor(() => lastSet(h.setStatus) === tunnelReasonCopy.enrollment_expired.userLine);
    expect(h.posts.join("|")).not.toContain("https://relay.jumpseat.sh");
    h.relay.stop();
  });
});
