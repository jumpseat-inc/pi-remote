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
import { createState, translate, type PiEvent, type ToolResultContentBlock, type TranslateState, type UIPromptKind } from "./src/translate";
import { type DepsOnEvent, type PiEventHandler, type PiExtensionContext, type PiSDKOnEvent } from "./src/pi-sdk-on";
import { agentMessageId, messageFrameRole, realAssistantMessageEventOf, roleOfAgentMessage } from "./src/pi-sdk-events"; // FLLWUP-12: real payload derivation (R-TYPE-1 vendored shapes)
import { resolvePiAgentDir, readHostSettings, hostMetadataFromOs } from "./src/pi-host";
import { homedir, platform as osPlatform, arch as osArch } from "node:os";
import { createInjector } from "./src/inject";
import {
  createTunnel,
  deleteTunnel,
  refreshAccessToken,
  isTunnelError,
  TunnelError,
  tunnelReasonCopy,
  englishFor,
  ALREADY_LIVE_COPY,
  type CreateTunnelResult,
  type TunnelReason,
} from "./src/tunnel";
import { renderCopy, setLocale } from "./src/copy";
import { readCredential, saveCredentialAsync, type EnrollmentCredential } from "./src/credential";
import { createLoginCommand, loginEnglishFor } from "./src/login";
import type { LoginMode } from "./src/login";
import { mergeTransport, transportErrorKey, STATUS_KEYS, type FooterState } from "./src/merge";
import { sessionEntriesToJsonl, type SessionEntry } from "./src/replay-adapter";
import { replayActiveBranch, resyncDoneFrame } from "./src/history";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * FLLWUP-11 — the pi-remote entry surface, reconciled with the installed SDK's
 * real ExtensionAPI (dist/core/extensions/types.d.ts ~978, verified 2026-09-24;
 * provenance per R-TYPE-1, re-diff on SDK upgrades). The previous stand-in's
 * twelve non-`on` members have NO counterpart on the real API (the loader's
 * runtime api object in dist/core/extensions/loader.js ~200 confirms it), so
 * `pi.configDir()` at load was a TypeError in a real host. Disposition:
 *
 *  - kept (real members): on, registerCommand, sendUserMessage — typed against
 *    their real signatures.
 *  - re-homed to the real context surface: ctx.ui.setStatus, ctx.ui.input,
 *    ctx.isIdle(), ctx.sessionManager (sessionId, readActiveBranch) — captured
 *    lazily from real SDK callbacks (the factory receives only `pi`).
 *  - re-homed to documented local capabilities (src/pi-host.ts): configDir
 *    (PI_CODING_AGENT_DIR → $HOME/.pi/agent), getSetting (settings.json
 *    `piRemote` key), env (process.env), platform/arch (node:os). `version`
 *    is dropped: hostMetadata is informational (SERVER-SIDE-SPEC) and the SDK
 *    has no version accessor.
 *
 * The only structural vendor pi-remote consumes from the context is typed in
 * src/pi-sdk-on.ts (PiExtensionContext); session entries flow through the
 * adapter vendor in src/replay-adapter.ts (real SessionEntry shape).
 */
export interface ExtensionAPI {
  /** Real: on overloads return an unsubscribe function. */
  on(event: PiSDKOnEvent, handler: PiEventHandler): () => void;
  /** Real: handler is (args: string, ctx) => Promise<void>. */
  registerCommand(name: string, opts: { description?: string; handler: (args: string, ctx: PiExtensionContext) => Promise<void> }): void;
  /** Real: void return; content is string | (TextContent | ImageContent)[]. */
  sendUserMessage(content: string, opts?: { deliverAs?: "steer" | "followUp"; expandPromptTemplates?: boolean }): void;
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
  /** FLLWUP-11: real SDK sendUserMessage returns void; hosts may wrap async. */
  sendUserMessage: (content: string, opts?: { deliverAs?: "steer" | "followUp" }) => void | Promise<void>;
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
  commands: { name: string; handler: (args?: string) => void | Promise<void> }[];
  reducer: (action: FooterAction) => FooterView;
  onShutdown: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Footer rendering (single writer path)
// ---------------------------------------------------------------------------

function errorSentence(source: ErrorSource, serverUrl: string | undefined): string {
  if (source.kind === "transport") {
    const key = transportErrorKey(source.reason as Parameters<typeof transportErrorKey>[0]);
    return key ? loginEnglishFor(key) : loginEnglishFor(STATUS_KEYS.error);
  }
  // Tunnel-side reasons already have closed copy in tunnel.ts (spec §8 note).
  // FLLWUP-4 re-point: resolve through the locale-aware lookup and substitute
  // `<serverUrl>` at print time (ruling OJ5) — the active dial target.
  return renderCopy(englishFor(tunnelReasonCopy[source.reason].userLineKey), { serverUrl });
}

function renderFooter(
  footer: FooterState,
  errorSource: ErrorSource | null,
  serverUrl?: string
): string | undefined {
  if (footer === "error") {
    return errorSource ? errorSentence(errorSource, serverUrl) : loginEnglishFor(STATUS_KEYS.error);
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
  
  // FLLWUP-92: Single-flight refresh — prevents concurrent rearm() calls from
  // presenting the same (now-rotated) refresh token, which triggers the
  // relay's replay detector and revokes the token family.
  let inflightRefresh: Promise<{ accessToken: string; tokenExpiry: number; refreshToken?: string }> | null = null;

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
    deps.setStatus(renderFooter(footer, errorSource, activeHttp?.serverUrl ?? deps.serverUrl));
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
      // FLLWUP-92: Single-flight — if a refresh is already in progress,
      // wait for it instead of starting a concurrent one. This prevents
      // multiple rearm() calls from presenting the same (now-rotated) refresh
      // token, which would trigger the relay's replay detector.
      if (!cred.refreshToken) {
        const err = new TunnelError("unauthenticated", "enrollment_expired", serverUrl);
        handleEnrollmentTerminal(err);
        throw err;
      }
      try {
        let r: { accessToken: string; tokenExpiry: number; refreshToken?: string };
        if (inflightRefresh !== null) {
          // Wait for the in-flight refresh to complete instead of starting a new one
          r = await inflightRefresh;
          // Re-read the credential from disk after the refresh completes, since
          // the first caller saved the updated credential and our `cred` is stale
          const freshCred = readCredential({ configDir: deps.configDir });
          if (freshCred && freshCred.tokenExpiry > cred.tokenExpiry) {
            // Use the freshly-persisted credential
            r = { accessToken: freshCred.accessToken, tokenExpiry: freshCred.tokenExpiry, refreshToken: freshCred.refreshToken };
          }
        } else {
          // Start a new refresh and store the promise so concurrent callers wait
          inflightRefresh = (async () => {
            try {
              const result = await refreshAccessToken(cred.refreshToken!, {
                serverUrl,
                accessToken: cred.accessToken,
                fetch: deps.fetch,
                now,
                discoveryCache,
              });
              const updated: EnrollmentCredential = {
                ...cred,
                accessToken: result.accessToken,
                tokenExpiry: result.expiresAt,
              };
              if (result.refreshToken) updated.refreshToken = result.refreshToken;
              await saveCredentialAsync(updated, { configDir: deps.configDir });
              return { accessToken: result.accessToken, tokenExpiry: result.expiresAt, refreshToken: result.refreshToken };
            } finally {
              // Clear the in-flight promise once complete (success or failure)
              inflightRefresh = null;
            }
          })();
          r = await inflightRefresh;
        }
        accessToken = r.accessToken;
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
      const http = activeHttp;
      try {
        await deleteTunnel(id, { serverUrl: http.serverUrl, accessToken: http.accessToken, fetch: deps.fetch, now, discoveryCache });
      } catch {
        // Surfaced as teardown_failed but footer still lands on off (spec §4.2).
        // FLLWUP-4 re-point: locale-aware resolution + `<serverUrl>` substitution (OJ5).
        deps.print(renderCopy(englishFor(tunnelReasonCopy.teardown_failed.userLineKey), { serverUrl: http.serverUrl }));
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

  async function rcLoginCommand(args?: string): Promise<void> {
    if (footer === "live" || footer === "dialing" || footer === "resyncing" || footer === "authorizing" || footer === "error") {
      deps.print(loginEnglishFor("rc:login.refusal")); // J5 — footer unchanged, driver not entered
      return;
    }
    // BUG-1: parse the mode from argv. `--headless` is the literal token;
    // no flag (or any args without it) → attended (spec §7.2/§8, EV-7).
    const mode: LoginMode = (args ?? "").split(/\s+/).includes("--headless") ? "headless" : "attended";
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
    const outcome = await cmd.run(mode, existing);
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
  // FLLWUP-12 (R-PAYLOAD-1) — narrowing corrected to the REAL SDK payload
  // shapes (dist/core/extensions/types.d.ts; vendored mirrors in
  // src/pi-sdk-events.ts). The real message_* payloads are {type, message:
  // AgentMessage} — no top-level messageId/role/events — so the AG-UI
  // messageId is DERIVED from payload-intrinsic (role, timestamp) — fields
  // the real engine copies verbatim onto every emission of one logical
  // message (agent-loop.js spread-copies event.message per emission;
  // agent-session.js mutates it in place — identity never survives an
  // event, see src/pi-sdk-events.ts header) — and role from message.role.
  // tool_result carries no message id at all: the toolCallId doubles as the
  // messageId (the live twin of the replay path's entry-id-as-messageId
  // decision, src/replay-adapter.ts) — the card's one documentation-only
  // divergence, justified on the card face. Handlers return undefined: the
  // real tool_result is an afterToolCall hook whose return value mutates the
  // tool result (runner.js emitToolResult).
  deps.on("message_start", (ev) => {
    const e = ev as { message?: unknown } | null | undefined;
    const role = roleOfAgentMessage(e?.message);
    const messageId = agentMessageId(e?.message);
    if (!role || messageId === undefined) return;
    forward({ event: "message_start", messageId, role });
  });
  deps.on("message_update", (ev) => {
    const e = ev as { message?: unknown; assistantMessageEvent?: unknown } | null | undefined;
    const messageId = agentMessageId(e?.message);
    const local = realAssistantMessageEventOf(e?.assistantMessageEvent);
    if (messageId === undefined || local === null) return;
    forward({ event: "message_update", messageId, events: [local] });
  });
  deps.on("message_end", (ev) => {
    const e = ev as { message?: unknown } | null | undefined;
    const messageId = agentMessageId(e?.message);
    if (messageId === undefined || roleOfAgentMessage(e?.message) === undefined) return;
    forward({ event: "message_end", messageId });
  });
  deps.on("tool_result", (ev) => {
    const e = ev as { toolCallId?: unknown; content?: unknown } | null | undefined;
    if (!e || typeof e.toolCallId !== "string" || !Array.isArray(e.content)) return;
    const content: ToolResultContentBlock[] = [];
    for (const b of e.content) {
      // Real blocks are (TextContent | ImageContent) — mirror the replay
      // adapter's mapping: text blocks flatten in, image blocks pass as data.
      if (typeof b !== "object" || b === null) continue;
      const blk = b as { type?: unknown; text?: unknown; data?: unknown };
      if (blk.type === "text" && typeof blk.text === "string") {
        content.push({ type: "text", text: blk.text });
      } else if (blk.type === "image" && typeof blk.data === "string") {
        content.push({ type: "image", image: blk.data });
      }
    }
    forward({ event: "tool_result", messageId: e.toolCallId, toolCallId: e.toolCallId, content });
  });
  // FLLWUP-94 — the execution-lane trio. The real payloads are
  // {type, toolCallId, toolName, args?/partialResult?/result?, isError}
  // (dist/core/extensions/types.d.ts:608–628; agent-session.js:528–553
  // forwards them verbatim; vendored mirrors in src/pi-sdk-events.ts).
  // toolCallId/toolName are the string identity fields every variant carries;
  // args/partialResult/result are `any` in the real SDK (bash's onUpdate
  // passes the tool's own ToolResult-shaped object, never a string), so they
  // flow through unvalidated-by-shape and translate.ts's presence-based
  // conditional emission (FLLWUP-3 §4 split) decides the frames. isError is
  // boolean in the real payload; a non-boolean is malformed → drop (S-O2).
  deps.on("tool_execution_start", (ev) => {
    const e = ev as { toolCallId?: unknown; toolName?: unknown } | null | undefined;
    if (!e || typeof e.toolCallId !== "string" || typeof e.toolName !== "string") return;
    forward({ event: "tool_execution_start", toolCallId: e.toolCallId, toolName: e.toolName });
  });
  deps.on("tool_execution_update", (ev) => {
    const e = ev as { toolCallId?: unknown; toolName?: unknown; args?: unknown; partialResult?: unknown } | null | undefined;
    if (!e || typeof e.toolCallId !== "string" || typeof e.toolName !== "string") return;
    forward({ event: "tool_execution_update", toolCallId: e.toolCallId, args: e.args, partialResult: e.partialResult });
  });
  deps.on("tool_execution_end", (ev) => {
    const e = ev as { toolCallId?: unknown; toolName?: unknown; result?: unknown; isError?: unknown } | null | undefined;
    if (!e || typeof e.toolCallId !== "string" || typeof e.toolName !== "string" || typeof e.isError !== "boolean") return;
    forward({ event: "tool_execution_end", toolCallId: e.toolCallId, result: e.result, isError: e.isError });
  });
  deps.on("ui.confirm", (ev) => {
    const e = ev as { promptKind?: unknown; prompt?: unknown } | null | undefined;
    if (!e || typeof e.promptKind !== "string" || typeof e.prompt !== "string") return;
    forward({ event: "ui.confirm", promptKind: e.promptKind, prompt: e.prompt });
  });
  // FLLWUP-12 — real payloads carry kind/title top-level (UIPromptEndEvent); the
  // narrowing below is already honest — kept as-is (recorded on the card face).
  deps.on("ui_prompt_end", (ev) => {
    const e = ev as { kind?: unknown; title?: unknown } | null | undefined;
    if (!e) return;
    forward({
      event: "ui_prompt_end",
      kind: isUIPromptKind(e.kind) ? e.kind : "custom",
      title: typeof e.title === "string" ? e.title : undefined,
    });
  });
  // FLLWUP-12 — real payloads carry kind/title top-level (UIPromptStartEvent);
  // already honest — kept as-is (recorded on the card face).
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
  // FLLWUP-11 — the ExtensionFactory receives only `pi`; ExtensionContext
  // arrives per event/command handler, so ctx-dependent members are captured
  // lazily. requireCtx() fails loud if a ctx-dependent dep is ever touched
  // before any host callback delivered a context.
  let ctxHolder: PiExtensionContext | null = null;
  const requireCtx = (): PiExtensionContext => {
    if (!ctxHolder) throw new Error("pi-remote: no host context yet (no command or event callback has run)");
    return ctxHolder;
  };

  // Documented local capabilities (src/pi-host.ts): config dir, settings.json
  // `piRemote` values, node:os metadata. env reads process.env directly.
  const configDir = resolvePiAgentDir({ env: process.env, homedir: homedir() });
  const settings = readHostSettings({ configDir });
  const settingString = (key: string): string | undefined => {
    const v = settings[key];
    return typeof v === "string" ? v : undefined;
  };
  const serverUrl = process.env.PI_REMOTE_SERVER_URL ?? settingString("serverUrl");

  // FLLWUP-4 (ruling OJ3): locale sourcing follows the entry-point precedence
  // of env over setting; setLocale normalizes anything unrecognized to "en".
  setLocale(process.env.PI_REMOTE_LOCALE ?? settingString("locale"));

  const controller = createRemoteController({
    configDir,
    serverUrl,
    // Real context surface; process.cwd() is only the load-time fallback
    // before the first real ctx arrives.
    sessionName: process.cwd().split("/").pop() ?? "",
    cwd: process.cwd(),
    hostMetadata: hostMetadataFromOs({ platform: osPlatform, arch: osArch }),
    sessionId: () => requireCtx().sessionManager.getSessionId(),
    setStatus: (s) => requireCtx().ui.setStatus("pi-remote", s),
    print: (line) => console.log(line),
    sendUserMessage: (c, o) => pi.sendUserMessage(c, o),
    isStreaming: () => !requireCtx().isIdle(),
    resolvePendingPrompt: () => false,
    readActiveBranch: () => Promise.resolve(requireCtx().sessionManager.getBranch()),
    inputPrompt: (prompt) => requireCtx().ui.input(prompt),
    fetch: globalThis.fetch,
    WebSocket,
    command: (name, handler) =>
      pi.registerCommand(name, {
        description: "pi-remote",
        handler: async (args, cmdCtx) => {
          ctxHolder = cmdCtx;
          await handler(args === undefined ? undefined : args);
        },
      }),
    on: (event, handler) => {
      if (event === "ui.confirm") return; // fixture-only seam — never forwarded to the SDK
      pi.on(event, (ev, ctx) => {
        ctxHolder = ctx as PiExtensionContext;
        return handler(ev, ctx);
      });
    },
  });

  // session_shutdown fires for every reason (quit/reload/new/resume/fork):
  // each routes to the shared idempotent teardown (spec §4.4).
  pi.on("session_shutdown", (_ev, ctx) => {
    ctxHolder = ctx as PiExtensionContext;
    void controller.onShutdown();
  });
}
