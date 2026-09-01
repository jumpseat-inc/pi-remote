/**
 * EV-8 — command surface and lifecycle wiring (the pi extension entry point).
 *
 * The package entry (`package.json` `"module": "index.ts"`) is this root
 * `index.ts`. It is a thin `export default function (pi: ExtensionAPI)` that
 * resolves deps from the live pi context and delegates to a pure,
 * framework-agnostic `createRemoteController(deps)` returning
 * `{ commands, reducer, onShutdown }`.
 *
 * All session-scoped mutable state lives in `createRemoteController`'s
 * factory closure — NEVER module-level (a module-level tunnel would leak
 * across a session switch on new/resume/fork/reload). `index.ts` is the only
 * module allowed to hold that state. It does NOT duplicate leaf-module
 * vocabularies (copy, framing, seq/ack/backoff, inbound arbitration, tunnel
 * REST) — it imports them.
 *
 * See docs/superpowers/specs/2026-08-31-EV-8-design.md and docs/PI-SPEC.md §8.
 */
import { createTransport, type TransportHandle, type TransportStatusEvent, type InboundEnvelope, type AgUiFrameLike } from "./src/transport";
import { createState, translate, type AssistantMessageEvent, type PiEvent, type ToolResultContentBlock, type TranslateState, type UIPromptKind } from "./src/translate";
import { type DepsOnEvent, type PiEventHandler, type PiSDKOnEvent } from "./src/pi-sdk-on";
import { createInjector } from "./src/inject";
import {
  createTunnel,
  deleteTunnel,
  refreshAccessToken,
  isTunnelError,
  TunnelError,
  tunnelReasonCopy,
  ALREADY_LIVE_COPY,
  type CreateTunnelResult,
  type TunnelReason,
} from "./src/tunnel";
import { readCredential, saveCredentialAsync, type EnrollmentCredential } from "./src/credential";
import { createLoginCommand, loginEnglishFor } from "./src/login";
import { mergeTransport, transportErrorKey, STATUS_KEYS, type FooterState } from "./src/merge";
import { sessionEntriesToJsonl, type SessionEntry } from "./src/replay-adapter";
import { replayActiveBranch, resyncDoneFrame } from "./src/history";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal structural stand-in for the pi ExtensionAPI (not vendored here). */
export interface ExtensionAPI {
  registerCommand(name: string, opts: { description: string; handler: (args: string | undefined) => void | Promise<void> }): void;
  on(event: PiSDKOnEvent, handler: PiEventHandler): void;
  sendUserMessage(content: string, opts?: { deliverAs?: "steer" | "followUp" }): Promise<void>;
  /** Resolve a setting (e.g. `piRemote.serverUrl`) or return undefined. */
  getSetting(name: string): unknown;
  /** Resolve an environment variable. */
  env(name: string): string | undefined;
  setStatus(scope: string, text: string | undefined): void;
  /** Request a one-line input from the user (ctx.ui.input). */
  input(prompt: string): Promise<string | undefined>;
  sessionId(): string;
  readActiveBranch(): SessionEntry[] | Promise<SessionEntry[]>;
  isIdle(): boolean;
  configDir(): string;
  version(): string;
  platform(): string;
  arch(): string;
}

export type ErrorSource =
  | { kind: "transport"; reason: string }
  | { kind: "tunnel"; reason: TunnelReason };

export interface RemoteControllerDeps {
  configDir: string;
  /** Resolved control-plane server URL: env > stored credential. May be undefined (J2). */
  serverUrl: string | undefined;
  sessionName: string;
  cwd: string;
  hostMetadata: Record<string, string>;
  sessionId: () => string;
  setStatus: (sentence: string | undefined) => void;
  print: (line: string) => void;
  sendUserMessage: (content: string, opts?: { deliverAs?: "steer" | "followUp" }) => Promise<void>;
  isStreaming: () => boolean;
  resolvePendingPrompt: (promptId: string, result: unknown, deviceId?: string) => boolean | Promise<boolean>;
  readActiveBranch: () => SessionEntry[] | Promise<SessionEntry[]>;
  inputPrompt: (prompt: string) => Promise<string | undefined>;
  fetch: typeof fetch;
  WebSocket: typeof WebSocket;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  rng?: () => number;
  newId?: () => string;
  randomBytes?: (n: number) => Uint8Array;
  sha256?: (input: Uint8Array) => Promise<Uint8Array>;
  openUrl?: (url: string) => Promise<boolean>;
  confirmReplacement?: () => Promise<boolean>;
  redirectTimeoutMs?: number;
  /** N consecutive error-severity dialing events before footer → error (J4, default 10). */
  ERROR_DIAL_THRESHOLD?: number;
  command: (name: string, handler: (args: string | undefined) => void | Promise<void>) => void;
  on: (event: DepsOnEvent, handler: PiEventHandler) => void;
}

export interface FooterView {
  footer: FooterState;
  lastOrder: number;
  consec: number;
  errorSource: ErrorSource | null;
}

export type FooterAction =
  | { type: "transport"; event: TransportStatusEvent }
  | { type: "set"; state: FooterState }
  | { type: "error"; reason: TunnelReason };

export interface RemoteController {
  commands: { name: string; handler: () => void | Promise<void> }[];
  reducer: (action: FooterAction) => FooterView;
  onShutdown: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Footer rendering (single writer path)
// ---------------------------------------------------------------------------

function errorSentence(source: ErrorSource): string {
  if (source.kind === "transport") {
    const key = transportErrorKey(source.reason as Parameters<typeof transportErrorKey>[0]);
    return key ? loginEnglishFor(key) : loginEnglishFor(STATUS_KEYS.error);
  }
  // Tunnel-side reasons already have closed copy in tunnel.ts (spec §8 note).
  return tunnelReasonCopy[source.reason].userLine;
}

function renderFooter(footer: FooterState, errorSource: ErrorSource | null): string | undefined {
  if (footer === "error") {
    return errorSource ? errorSentence(errorSource) : loginEnglishFor(STATUS_KEYS.error);
  }
  return loginEnglishFor(STATUS_KEYS[footer]);
}

// ---------------------------------------------------------------------------
// createRemoteController
// ---------------------------------------------------------------------------

export function createRemoteController(deps: RemoteControllerDeps): RemoteController {
  const now = deps.now ?? Date.now;
  const uuid = deps.newId ?? (() => crypto.randomUUID());
  const N = deps.ERROR_DIAL_THRESHOLD ?? 10;
  const discoveryCache = new Map<string, Promise<import("./src/tunnel").DiscoveryDocument>>();

  // ---- FSM closure state (all session-scoped; never module-level) ----
  let footer: FooterState = "off";
  let lastOrder = 0;
  let consec = 0;
  let errorSource: ErrorSource | null = null;
  let lastRearmReason: TunnelReason | null = null;
  let currentTunnelId: string | null = null;
  let activeHttp: { serverUrl: string; accessToken: string } | null = null;
  let liveState: TranslateState | null = null;
  let epoch = 0;
  let teardownPromise: Promise<void> | null = null;
  const transportRef: { handle: TransportHandle | null } = { handle: null };

  const injector = createInjector({
    sendUserMessage: deps.sendUserMessage,
    isStreaming: deps.isStreaming,
    resolvePendingPrompt: deps.resolvePendingPrompt,
    emitCustom: (name, value) => {
      transportRef.handle?.send({ type: "CUSTOM", name, value: { pi: name, data: value } });
    },
  });

  function applyFooter(next: FooterState, source?: ErrorSource): void {
    footer = next;
    if (next === "error") {
      if (source) errorSource = source;
    } else {
      errorSource = null;
    }
    deps.setStatus(renderFooter(footer, errorSource));
  }

  function view(): FooterView {
    return { footer, lastOrder, consec, errorSource };
  }

  // ---- Transport event → FSM ----
  function onTransportEvent(e: TransportStatusEvent): void {
    const m = mergeTransport(footer, lastOrder, e, consec, N);
    lastOrder = m.lastOrder;
    consec = m.consec;

    if (m.footer === "error") {
      // Resolve the error source: prefer the recorded rearm reason (the
      // transport collapses all rearm failures to relay_unreachable, so the
      // rich reason must win — spec §3), else the transport reason.
      let source: ErrorSource | null = null;
      if (lastRearmReason) {
        source = { kind: "tunnel", reason: lastRearmReason };
      } else if (e.kind === "dialing" && e.reason) {
        source = { kind: "transport", reason: e.reason };
      }
      applyFooter("error", source ?? undefined);
    } else if (m.footer === "live") {
      lastRearmReason = null;
      applyFooter("live");
    } else {
      applyFooter(m.footer);
    }
  }

  // ---- Enrollment-terminal rearm error (J3): stop the loop, error w/ rich reason ----
  function handleEnrollmentTerminal(err: TunnelError): void {
    lastRearmReason = err.reason;
    applyFooter("error", { kind: "tunnel", reason: err.reason });
    void transportRef.handle?.disconnect().catch(() => {});
  }

  function isEnrollmentTerminal(e: unknown): e is TunnelError {
    return (
      (e instanceof TunnelError || isTunnelError(e)) &&
      (e.kind === "unauthenticated" || e.kind === "forbidden")
    );
  }

  // ---- Rearm closure (EV-8-authored): DELETE-old → optional one-silent-refresh → createTunnel ----
  async function rearm(): Promise<CreateTunnelResult> {
    const epochAtStart = epoch;
    const cred = readCredential({ configDir: deps.configDir });
    const serverUrl = deps.serverUrl ?? cred?.serverUrl;
    if (!cred || !serverUrl) {
      const err = new TunnelError("unauthenticated", "enrollment_expired", serverUrl ?? "");
      handleEnrollmentTerminal(err);
      throw err;
    }
    if (epoch !== epochAtStart) {
      throw new TunnelError("unreachable", "control_plane_unreachable", serverUrl);
    }

    // DELETE-old (best-effort; preserves the credential).
    if (currentTunnelId) {
      try {
        await deleteTunnel(currentTunnelId, { serverUrl, accessToken: cred.accessToken, fetch: deps.fetch, now, discoveryCache });
      } catch {
        /* best-effort */
      }
    }
    if (epoch !== epochAtStart) {
      throw new TunnelError("unreachable", "control_plane_unreachable", serverUrl);
    }

    let accessToken = cred.accessToken;
    if (now() >= cred.tokenExpiry) {
      // ONE silent refresh when a refresh token exists (spec §4.1).
      if (!cred.refreshToken) {
        const err = new TunnelError("unauthenticated", "enrollment_expired", serverUrl);
        handleEnrollmentTerminal(err);
        throw err;
      }
      try {
        const r = await refreshAccessToken(cred.refreshToken, {
          serverUrl,
          accessToken: cred.accessToken,
          fetch: deps.fetch,
          now,
          discoveryCache,
        });
        const updated: EnrollmentCredential = { ...cred, accessToken: r.accessToken, tokenExpiry: r.expiresAt };
        if (r.refreshToken) updated.refreshToken = r.refreshToken;
        await saveCredentialAsync(updated, { configDir: deps.configDir });
        accessToken = updated.accessToken;
      } catch (e) {
        if (isEnrollmentTerminal(e)) {
          handleEnrollmentTerminal(e);
        } else {
          lastRearmReason = isTunnelError(e) ? e.reason : "control_plane_unreachable";
        }
        throw e;
      }
    }
    if (epoch !== epochAtStart) {
      throw new TunnelError("unreachable", "control_plane_unreachable", serverUrl);
    }

    try {
      const result = await createTunnel(
        { sessionId: deps.sessionId(), sessionName: deps.sessionName, cwd: deps.cwd, hostMetadata: deps.hostMetadata },
        { serverUrl, accessToken, fetch: deps.fetch, now, discoveryCache }
      );
      // Update the tunnelId synchronously in the closure so teardown (or a
      // concurrent epoch bump) deletes the RIGHT tunnel (spec §6).
      currentTunnelId = result.tunnelId;
      lastRearmReason = null;
      if (epoch !== epochAtStart) {
        // Epoch moved (teardown happened while we dialed) — delete the fresh
        // tunnel and bail; do NOT dial.
        try {
          await deleteTunnel(result.tunnelId, { serverUrl, accessToken, fetch: deps.fetch, now, discoveryCache });
        } catch {
          /* best-effort */
        }
        throw new TunnelError("unreachable", "control_plane_unreachable", serverUrl);
      }
      return result;
    } catch (e) {
      if (isTunnelError(e) || e instanceof TunnelError) {
        lastRearmReason = e.reason;
        if (isEnrollmentTerminal(e)) {
          handleEnrollmentTerminal(e);
        }
      }
      throw e;
    }
  }

  /** FLLWUP-5 contract (b): host-side completion frame for a tracked prompt resolution.
   *  deviceId comes from the InjectResult (envelope-derived, never free text);
   *  ts from the injected lifecycle clock (deps.now), not the fold. */
  function emitResolved(promptId: string, occurrence: number, deviceId: string | undefined): void {
    transportRef.handle?.send({
      type: "CUSTOM",
      name: "pi.human_input.resolved",
      value: { pi: "pi.human_input.resolved", data: { promptId, occurrence, deviceId, ts: now() } },
    });
  }

  /** Start a fresh transport + dial (one createTransport per /rc, spec §1). */
  function startDial(initial: CreateTunnelResult): void {
    const transport = createTransport({
      sessionId: deps.sessionId(),
      rearm,
      WebSocket: deps.WebSocket,
      now,
      sleep: deps.sleep,
      rng: deps.rng,
      newId: deps.newId,
      onEvent: onTransportEvent,
      onInbound: (env: InboundEnvelope) => {
        void injector.handle(env).then((result) => {
          if (result.kind === "resolved") {
            emitResolved(result.promptId, result.occurrence, result.deviceId);
          } else if (result.kind === "steered_fallback" && result.tracked) {
            emitResolved(result.promptId, result.occurrence, result.deviceId);
          }
          // ignored / injected / stale / steered_fallback-with-tracked:false → no resolved
        });
      },
      onResync: (fromSeq) => void runReplay(fromSeq),
    });
    transportRef.handle = transport;
    void transport.connect({ url: initial.url, expiresAt: initial.expiresAt });
  }

  /** First-dial createTunnel error handling (spec §4.1). */
  function handleFirstCreateError(e: unknown): void {
    if (isEnrollmentTerminal(e)) {
      handleEnrollmentTerminal(e);
      return;
    }
    if (isTunnelError(e)) {
      lastRearmReason = e.reason;
      applyFooter("error", { kind: "tunnel", reason: e.reason });
      return;
    }
    lastRearmReason = "control_plane_unreachable";
    applyFooter("error", { kind: "tunnel", reason: "control_plane_unreachable" });
  }

  // ---- Replay / resync (footer overlay, spec §5.3) ----
  async function runReplay(fromSeq: number): Promise<void> {
    applyFooter("resyncing");
    try {
      const sessionEntries = await deps.readActiveBranch();
      const entries = sessionEntriesToJsonl(sessionEntries);
      const { frames, resyncDone } = replayActiveBranch({ sessionId: deps.sessionId(), entries });
      const handle = transportRef.handle;
      for (const f of frames) {
        if (footer === "dialing") break; // mid-replay dialing aborts (replay frames would drop)
        handle?.send(f as unknown as AgUiFrameLike);
      }
      handle?.send(resyncDoneFrame({ sessionId: deps.sessionId(), uptoSeq: resyncDone.uptoSeq }) as unknown as AgUiFrameLike);
    } finally {
      // Back to live after the resyncDone terminator; stay on the abort state if any.
      if (footer === "resyncing") applyFooter("live");
    }
  }

  // ---- Live path (spec §5.1) ----
  function ensureLiveState(): void {
    if (!liveState) {
      liveState = createState({ sessionId: deps.sessionId(), runId: uuid() });
    }
  }

  const UI_PROMPT_KINDS = new Set<string>(["select", "confirm", "input", "editor", "custom"]);
  function isUIPromptKind(k: unknown): k is UIPromptKind {
    return typeof k === "string" && UI_PROMPT_KINDS.has(k);
  }

  function forward(input: PiEvent): void {
    if (!transportRef.handle) return;
    ensureLiveState();
    const { frames, state } = translate(input, liveState!);
    liveState = state;
    for (const f of frames) {
      if (f.type === "CUSTOM" && f.name === "pi.human_input") {
        const data = (f.value.data ?? {}) as {
          promptId?: unknown;
          kind?: unknown;
          promptKind?: unknown;
          title?: unknown;
          prompt?: unknown;
        };
        const promptId = data.promptId;
        if (typeof promptId === "string") {
          // FLLWUP-8: one raise path, one (promptId, occurrence) stamping site, one registerPrompt call site.
          // The promptKind/prompt fallback reads exist solely so the 5 synthetic ui.confirm fixtures keep
          // flowing through this same stamp (their frames carry promptKind/prompt; live frames carry kind/title).
          const { occurrence } = injector.registerPrompt({
            promptId,
            kind: typeof data.kind === "string" ? data.kind : typeof data.promptKind === "string" ? data.promptKind : "",
            prompt: typeof data.title === "string" ? data.title : typeof data.prompt === "string" ? data.prompt : "",
          });
          f.value.data = { ...data, occurrence };
        }
      }
      transportRef.handle.send(f as unknown as AgUiFrameLike);
    }
  }

  // ---- Teardown (shared, idempotent, epoch-bumped; never clears the credential) ----
  async function doTeardown(): Promise<void> {
    epoch++; // 1. bump epoch (any in-flight connect/rearm sees itself stale)
    applyFooter("off"); // 2. FSM stopped (footer drives it)
    // 3. disconnect (idempotent; also halts enrollment-retry per J3)
    await transportRef.handle?.disconnect().catch(() => {});
    // 4. best-effort DELETE of the tunnel we know about
    const id = currentTunnelId;
    currentTunnelId = null;
    if (id && activeHttp) {
      try {
        await deleteTunnel(id, { serverUrl: activeHttp.serverUrl, accessToken: activeHttp.accessToken, fetch: deps.fetch, now, discoveryCache });
      } catch {
        // Surfaced as teardown_failed but footer still lands on off (spec §4.2).
        deps.print(tunnelReasonCopy.teardown_failed.userLine);
      }
    }
    transportRef.handle = null;
    liveState = null;
    applyFooter("off"); // 5. footer → off
  }

  function teardown(): Promise<void> {
    if (teardownPromise) return teardownPromise; // concurrent callers share the in-flight promise
    teardownPromise = doTeardown().finally(() => {
      teardownPromise = null;
    });
    return teardownPromise;
  }

  // ---- Commands ----
  async function rcCommand(): Promise<void> {
    if (footer === "live") {
      deps.print(ALREADY_LIVE_COPY); // verbatim, footer unchanged, no second dial (spec §4.1)
      return;
    }
    if (footer === "authorizing" || footer === "dialing" || footer === "resyncing") {
      deps.print(loginEnglishFor("rc.dialingInProgress"));
      return;
    }

    const cred = readCredential({ configDir: deps.configDir });
    if (!cred) {
      applyFooter("not enrolled");
      deps.print(loginEnglishFor("rc.unenrolled")); // names /rc:login; zero POST /tunnels
      return;
    }

    const serverUrl = deps.serverUrl ?? cred.serverUrl;
    if (!serverUrl) {
      applyFooter("not enrolled");
      deps.print(loginEnglishFor("rc.serverUrlRequired"));
      return;
    }

    // Access token expired → ONE silent refresh (spec §4.1).
    let accessToken = cred.accessToken;
    if (now() >= cred.tokenExpiry) {
      if (!cred.refreshToken) {
        applyFooter("not enrolled");
        deps.print(loginEnglishFor("rc.unenrolled"));
        return;
      }
      try {
        const r = await refreshAccessToken(cred.refreshToken, { serverUrl, accessToken: cred.accessToken, fetch: deps.fetch, now, discoveryCache });
        const updated: EnrollmentCredential = { ...cred, accessToken: r.accessToken, tokenExpiry: r.expiresAt };
        if (r.refreshToken) updated.refreshToken = r.refreshToken;
        await saveCredentialAsync(updated, { configDir: deps.configDir });
        accessToken = updated.accessToken;
      } catch {
        applyFooter("not enrolled");
        deps.print(loginEnglishFor("rc.unenrolled"));
        return;
      }
    }

    if (footer !== "off" && footer !== "error") return; // already handled above; safety
    if (transportRef.handle) {
      // not live but had a prior transport — let teardown reclaim it first
      await teardown();
    }

    activeHttp = { serverUrl, accessToken };
    lastOrder = 0; // reset merge bookkeeping on a fresh dial (§2.1 non-transport writer)
    consec = 0;
    applyFooter("dialing"); // optimistic
    try {
      const initial = await createTunnel(
        { sessionId: deps.sessionId(), sessionName: deps.sessionName, cwd: deps.cwd, hostMetadata: deps.hostMetadata },
        { serverUrl, accessToken, fetch: deps.fetch, now, discoveryCache }
      );
      currentTunnelId = initial.tunnelId;
      startDial(initial);
    } catch (e) {
      activeHttp = null;
      handleFirstCreateError(e);
    }
  }

  async function rcOffCommand(): Promise<void> {
    await teardown();
    applyFooter("off");
    deps.print(loginEnglishFor("rc.offLifecycle")); // same line whether live or not (no-op wording banned)
  }

  async function rcLoginCommand(): Promise<void> {
    if (footer === "live" || footer === "dialing" || footer === "resyncing" || footer === "authorizing" || footer === "error") {
      deps.print(loginEnglishFor("rc:login.refusal")); // J5 — footer unchanged, driver not entered
      return;
    }
    let serverUrl = deps.serverUrl;
    if (!serverUrl) {
      // J2 — the URL prompt fires only out-of-band after /rc:login, never a bare /rc.
      serverUrl = await deps.inputPrompt("Control-plane server URL (or leave blank for PI_REMOTE_SERVER_URL / piRemote.serverUrl):");
    }
    if (!serverUrl) {
      deps.print(loginEnglishFor("login.failure.noServerUrl"));
      applyFooter("off");
      return;
    }
    const existing = readCredential({ configDir: deps.configDir });
    const cmd = createLoginCommand({
      serverUrl,
      configDir: deps.configDir,
      fetch: deps.fetch,
      now,
      randomBytes: deps.randomBytes,
      sha256: deps.sha256,
      openUrl: deps.openUrl,
      sleep: deps.sleep,
      confirmReplacement: deps.confirmReplacement,
      redirectTimeoutMs: deps.redirectTimeoutMs,
      discoveryCache,
      onState: (s) => {
        if (s === "authorizing") applyFooter("authorizing");
      },
    });
    const outcome = await cmd.run("attended", existing);
    void outcome;
    applyFooter("off"); // success AND failure both return to off (J5/EV-7)
  }

  async function onShutdown(): Promise<void> {
    await teardown();
    applyFooter("off");
    deps.print(loginEnglishFor("shutdown.closed"));
  }

  // ---- Wiring ----
  deps.command("rc", rcCommand);
  deps.command("rc:off", rcOffCommand);
  deps.command("rc:login", rcLoginCommand);

  deps.on("agent_start", () => {
    if (!transportRef.handle) return;
    // Fresh runId per agent_start (spec §5.2); then RUN_STARTED with the new runId.
    liveState = createState({ sessionId: deps.sessionId(), runId: uuid() });
    forward({ event: "agent_start" });
  });
  deps.on("agent_settled", () => forward({ event: "agent_settled" }));
  deps.on("turn_start", () => forward({ event: "turn_start" }));
  deps.on("turn_end", () => forward({ event: "turn_end" }));
  deps.on("message_start", (ev) => {
    const e = ev as { messageId?: unknown; role?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || (e.role !== "assistant" && e.role !== "user")) return;
    forward({ event: "message_start", messageId: e.messageId, role: e.role });
  });
  deps.on("message_update", (ev) => {
    const e = ev as { messageId?: unknown; events?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || !Array.isArray(e.events)) return;
    forward({ event: "message_update", messageId: e.messageId, events: e.events as AssistantMessageEvent[] });
  });
  deps.on("message_end", (ev) => {
    const e = ev as { messageId?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string") return;
    forward({ event: "message_end", messageId: e.messageId });
  });
  deps.on("tool_result", (ev) => {
    const e = ev as { messageId?: unknown; toolCallId?: unknown; content?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || typeof e.toolCallId !== "string" || !Array.isArray(e.content)) return;
    forward({ event: "tool_result", messageId: e.messageId, toolCallId: e.toolCallId, content: e.content as ToolResultContentBlock[] });
  });
  deps.on("ui.confirm", (ev) => {
    const e = ev as { promptKind?: unknown; prompt?: unknown } | null | undefined;
    if (!e || typeof e.promptKind !== "string" || typeof e.prompt !== "string") return;
    forward({ event: "ui.confirm", promptKind: e.promptKind, prompt: e.prompt });
  });
  deps.on("ui_prompt_end", (ev) => {
    const e = ev as { kind?: unknown; title?: unknown } | null | undefined;
    if (!e) return;
    forward({
      event: "ui_prompt_end",
      kind: isUIPromptKind(e.kind) ? e.kind : "custom",
      title: typeof e.title === "string" ? e.title : undefined,
    });
  });
  deps.on("ui_prompt_start", (ev) => {
    const e = ev as { kind?: unknown; title?: unknown } | null | undefined;
    if (!e) return;
    forward({
      event: "ui_prompt_start",
      kind: isUIPromptKind(e.kind) ? e.kind : "custom",
      title: typeof e.title === "string" ? e.title : undefined,
    });
  });

  function reducer(action: FooterAction): FooterView {
    if (action.type === "transport") {
      onTransportEvent(action.event);
    } else if (action.type === "set") {
      applyFooter(action.state);
    } else {
      lastRearmReason = action.reason;
      applyFooter("error", { kind: "tunnel", reason: action.reason });
    }
    return view();
  }

  return { commands: [{ name: "rc", handler: rcCommand }, { name: "rc:off", handler: rcOffCommand }, { name: "rc:login", handler: rcLoginCommand }], reducer, onShutdown };
}

// ---------------------------------------------------------------------------
// The thin pi entry point (spec §1). Wires only the pi SDK surface; all logic
// lives in createRemoteController above.
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI): void {
  const configDir = pi.configDir();
  const setting = pi.getSetting("piRemote.serverUrl");
  const serverUrl = (pi.env("PI_REMOTE_SERVER_URL") ?? (typeof setting === "string" ? setting : undefined)) as string | undefined;

  const controller = createRemoteController({
    configDir,
    serverUrl,
    sessionName: process.cwd().split("/").pop() ?? "",
    cwd: process.cwd(),
    hostMetadata: { piVersion: String(pi.version()), platform: pi.platform(), arch: pi.arch() },
    sessionId: () => pi.sessionId(),
    setStatus: (s) => pi.setStatus("pi-remote", s),
    print: (line) => console.log(line),
    sendUserMessage: (c, o) => pi.sendUserMessage(c, o),
    isStreaming: () => !pi.isIdle(),
    resolvePendingPrompt: () => false,
    readActiveBranch: () => pi.readActiveBranch(),
    inputPrompt: (prompt) => pi.input(prompt),
    fetch: globalThis.fetch,
    WebSocket,
    command: (name, handler) => pi.registerCommand(name, { description: "pi-remote", handler: (args) => handler(args) }),
    on: (event, handler) => {
      if (event === "ui.confirm") return; // fixture-only seam — never forwarded to the SDK
      pi.on(event, handler);
    },
  });

  // session_shutdown fires for every reason (quit/reload/new/resume/fork):
  // each routes to the shared idempotent teardown (spec §4.4).
  pi.on("session_shutdown", () => {
    void controller.onShutdown();
  });
}
