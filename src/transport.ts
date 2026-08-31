/**
 * EV-3 — outbound wss transport with seq-ack envelope.
 *
 * The single WS network module. It dials the relay over a signed one-time
 * URL, wraps every AG-UI event in a `{v, seq, ack, frame}` envelope with a
 * monotonic extension-owned `seq`, echoes the highest processed inbound
 * `seq` as `ack`, heartbeats via native WS control-frame `ping`, and
 * reconnects with capped exponential backoff + full jitter under a stable
 * session-scoped connection id.
 *
 * It is a **transducer, not a renderer**: it emits a strictly-ordered,
 * severity-tagged stream of typed transport-status events. It never calls
 * `setStatus`, never writes the footer, and never calls `fetch` (tunnel.ts
 * owns `fetch`). It is a pure-ish state machine with injected seams — all
 * network, clock, and randomness are injected; importing this module has no
 * side effects.
 *
 * See docs/PI-SPEC.md §6 and the EV-3 design spec §1–§3.
 */
import type { AgUiFrame } from "./translate";
import type { CreateTunnelResult } from "./tunnel";

// ---------------------------------------------------------------------------
// Typed state-event seam (§1.1) — CLOSED vocabularies.
// ---------------------------------------------------------------------------

/** The only two transport event kinds — there is NO kind:"error" event. */
export type TransportKind = "dialing" | "live";
/** Closed 5-value reason taxonomy (Sub-question 3 ruling). */
export type TransportReason =
  | "first_connect"
  | "reconnecting"
  | "relay_unreachable"
  | "protocol_violation"
  | "url_expired";
/** EV-2 tag convention. */
export type TransportSeverity = "error" | "live" | "resyncing";

export interface TransportStatusEvent {
  kind: TransportKind; // dialing | live — the only two kinds
  connectionId: string; // = session id (stable logical connection id)
  severity: TransportSeverity; // always present (EV-2 convention)
  order: number; // monotonic gap-free ordinal
  reason?: TransportReason; // always present on dialing
  attempt?: number; // dial attempt ordinal (1 = first connect)
  since?: number; // wall-clock (injected now()) when the state began
}

// ---------------------------------------------------------------------------
// Envelope (§1.3 / §1.1).
// ---------------------------------------------------------------------------

export interface TransportEnvelope {
  v: 1;
  seq: number; // outboundSeq, monotonic extension-owned
  ack: number; // inboundSeq watermark (highest processed inbound seq)
  frame: AgUiFrame | null;
}

/** Inbound envelope handed to the consumer; may carry the sending deviceId (§7.3). */
export interface InboundEnvelope {
  v: 1;
  seq: number;
  ack: number;
  deviceId?: string;
  frame: AgUiFrame | null;
}

/**
 * The AG-UI frame shape as declared in translate.ts, extended with an optional
 * `id` field. Live frames get a UUID `id` stamped by the transport (via the
 * injected `newId`); replay frames carry EV-5's deterministic ids and are left
 * untouched.
 */
export type AgUiFrameLike = AgUiFrame & { id?: string; replay?: boolean };

// ---------------------------------------------------------------------------
// Injection seams (§1.6) / public surface (§2).
// ---------------------------------------------------------------------------

export interface TransportDeps {
  sessionId: string;
  /** EV-8-authored closure (DELETE → refresh? → createTunnel); called once per dial attempt ≥ 2. */
  rearm: () => Promise<CreateTunnelResult>;
  WebSocket: typeof WebSocket;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  rng?: () => number; // [0,1) for jitter
  newId?: () => string; // UUID gen for live-frame ids
  onEvent: (e: TransportStatusEvent) => void;
  onInbound: (frame: InboundEnvelope) => void;
  /** EV-5 seam: fired exactly once per inbound `resync` control frame (§5.3). */
  onResync?: (fromSeq: number) => void;
  // backoff / heartbeat params (defaults in the module)
  backoffBase?: number;
  backoffMax?: number;
  heartbeatInterval?: number;
  proxyTimeout?: number;
}

export interface TransportHandle {
  connect(initial: { url: string; expiresAt: number }): Promise<void>; // first connect; does NOT call rearm
  disconnect(): Promise<void>; // LOCAL close → MUST NOT auto-reconnect (idempotent)
  send(frame: AgUiFrameLike): number | null; // assigned seq, or null on drop-with-signal while not live
  getId(): string; // session id (stable logical connection id)
}

const DEFAULT_BACKOFF_BASE = 50;
const DEFAULT_BACKOFF_MAX = 5000;
const DEFAULT_HEARTBEAT_INTERVAL = 10_000;
const DEFAULT_PROXY_TIMEOUT = 30_000;

const WS_URL_RE = /^wss?:\/\//;

// ---------------------------------------------------------------------------
// Pure helpers (exported for direct testing, §3.1 tests 1–2).
// ---------------------------------------------------------------------------

/** Pure envelope constructor — returns exactly `{v:1, seq, ack, frame}`. */
export function envelope(seq: number, ack: number, frame: AgUiFrame | null): TransportEnvelope {
  return { v: 1, seq, ack, frame };
}

/**
 * Capped exponential backoff with full jitter:
 * `delay = rng() * min(max, base * 2^(attempt-1))`, floored.
 */
export function nextBackoff(
  attempt: number,
  base: number,
  max: number,
  rng: () => number
): number {
  const ceiling = Math.min(max, base * Math.pow(2, attempt - 1));
  return Math.floor(rng() * ceiling);
}

/** Severity is a derived tag (EV-2 convention), not a terminality signal. */
function severityFor(kind: TransportKind, reason?: TransportReason): TransportSeverity {
  if (kind === "live") return "live";
  if (
    reason === "relay_unreachable" ||
    reason === "protocol_violation" ||
    reason === "url_expired"
  ) {
    return "error";
  }
  return "resyncing"; // first_connect / reconnecting
}

/** Defensive WS URL check. Accepts ws:/wss: (production URLs are always wss:// from EV-2). */
function isWsUrl(u: string): boolean {
  return WS_URL_RE.test(u);
}

/**
 * Inbound discriminated union on the frame slot (EV-5, ruling B2/O6): an AG-UI
 * event, a resume control frame, a resync control frame, or an ack-only
 * heartbeat (frame === null). Everything else is rejected as protocol_violation.
 */
export type InboundFrame =
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: AgUiFrame }
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: { type: "resume"; deviceId: string; lastAckedSeq: number } }
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: { type: "resync"; fromSeq: number } }
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: null };

/** The AG-UI event types this extension can emit (translate.ts + MESSAGES_SNAPSHOT). */
const AG_UI_TYPES = new Set<string>([
  "RUN_STARTED",
  "RUN_FINISHED",
  "STEP_STARTED",
  "STEP_FINISHED",
  "TEXT_MESSAGE_START",
  "TEXT_MESSAGE_CONTENT",
  "TEXT_MESSAGE_END",
  "REASONING_MESSAGE_START",
  "REASONING_MESSAGE_CONTENT",
  "REASONING_MESSAGE_END",
  "TOOL_CALL_START",
  "TOOL_CALL_ARGS",
  "TOOL_CALL_END",
  "TOOL_CALL_RESULT",
  "CUSTOM",
  "MESSAGES_SNAPSHOT",
]);

/**
 * Parse + runtime-validate an inbound envelope against the discriminated union.
 * Returns null for any malformed shape (bad JSON / bad shape / non-numeric seq or
 * ack / frame that matches none of the four members). The caller surfaces a
 * `protocol_violation` for a null result.
 */
export function parseInbound(data: string): InboundFrame | null {
  let obj: unknown;
  try {
    obj = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.seq !== "number" || !Number.isFinite(o.seq)) return null;
  if (typeof o.ack !== "number" || !Number.isFinite(o.ack)) return null;
  const frame = o.frame;
  const deviceId = typeof o.deviceId === "string" ? o.deviceId : undefined;
  if (frame === null) {
    return { v: 1, seq: o.seq, ack: o.ack, deviceId, frame: null };
  }
  if (typeof frame !== "object" || frame === null) return null;
  const f = frame as Record<string, unknown>;
  if (typeof f.type !== "string") return null;
  if (f.type === "resume") {
    if (typeof f.deviceId !== "string") return null;
    if (typeof f.lastAckedSeq !== "number" || !Number.isFinite(f.lastAckedSeq)) return null;
    return { v: 1, seq: o.seq, ack: o.ack, deviceId: f.deviceId, frame: f as unknown as { type: "resume"; deviceId: string; lastAckedSeq: number } };
  }
  if (f.type === "resync") {
    if (typeof f.fromSeq !== "number" || !Number.isFinite(f.fromSeq)) return null;
    return { v: 1, seq: o.seq, ack: o.ack, deviceId, frame: f as unknown as { type: "resync"; fromSeq: number } };
  }
  if (!AG_UI_TYPES.has(f.type)) return null;
  return { v: 1, seq: o.seq, ack: o.ack, deviceId, frame: f as unknown as AgUiFrame };
}

// ---------------------------------------------------------------------------
// createTransport
// ---------------------------------------------------------------------------

export function createTransport(deps: TransportDeps): TransportHandle {
  const now = deps.now ?? Date.now;
  const sleepImpl =
    deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rng = deps.rng ?? Math.random;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const backoffBase = deps.backoffBase ?? DEFAULT_BACKOFF_BASE;
  const backoffMax = deps.backoffMax ?? DEFAULT_BACKOFF_MAX;
  const heartbeatInterval = deps.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
  const WS = deps.WebSocket;

  const connectionId = deps.sessionId;

  // State (per-instance; dies with the session epoch — never module-level).
  let stopped = true; // not running until connect()
  let disconnecting = false; // a deliberate local close
  let outboundSeq = 0; // monotonic, never reset within the instance (even across reconnects)
  let inboundSeq = 0; // highest inbound seq dispatched to the consumer (our outbound ack)
  let highestDeviceAck = 0; // highest inbound-envelope ack (device's ack of our stream)
  let order = 0; // status-event ordinal
  let attempt = 1; // dial attempt ordinal; resets to 1 on a successful open
  let currentUrl = "";
  let expiresAt = 0;
  let socket: WebSocket | null = null;
  let live = false;
  let pendingReason: TransportReason | null = null; // reason for the NEXT dialing
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let dialToken = 0; // invalidates stale loops after connect()/disconnect() churn
  let firstDial = true; // the initial connect() dial neither sleeps nor re-arms

  function emit(kind: TransportKind, reason?: TransportReason, since?: number): void {
    deps.onEvent({
      kind,
      connectionId,
      severity: severityFor(kind, reason),
      order: order++,
      reason,
      attempt: kind === "dialing" ? attempt : undefined,
      since,
    });
  }

  function clearHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /** Detach + drop the current socket and heartbeat. Nobody calls this for a local close. */
  function dropSocket(): void {
    clearHeartbeat();
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket = null;
    }
    live = false;
  }

  function startHeartbeat(ws: WebSocket): void {
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      try {
        ws.ping();
      } catch {
        /* dead peer — the close/data path owns teardown */
      }
    }, heartbeatInterval);
  }

  function scheduleNext(): void {
    if (stopped || disconnecting) return;
    void dialLoop(dialToken);
  }

  /** A protocol violation against the current socket: close it, reason on the next dialing. */
  function protocolViolation(): void {
    pendingReason = "protocol_violation";
    const s = socket;
    dropSocket();
    if (s) {
      try {
        s.close(3400, "protocol violation");
      } catch {
        /* already closed */
      }
    }
    scheduleNext();
  }

  /** One full dial cycle: dialing → (backoff/rearm/validate) → open → live → park. */
  async function dialLoop(token: number): Promise<void> {
    if (stopped || disconnecting || token !== dialToken) return;

    // Determine why we are dialing (CLOSED 5-value taxonomy).
    let reason: TransportReason;
    if (pendingReason !== null) {
      reason = pendingReason;
      pendingReason = null;
    } else {
      reason = attempt === 1 ? "first_connect" : "reconnecting";
    }
    const since = now();
    emit("dialing", reason, since);

    const isFirstDial = firstDial;
    firstDial = false;

    // Only the very first connect dial uses EV-8's handed initial URL with no
    // backoff. Every subsequent dial — including the first reconnect after a live
    // drop, when attempt resets to 1 — sleeps backoff and re-arms the consumed
    // single-use URL.
    if (!isFirstDial) {
      const delay = nextBackoff(attempt, backoffBase, backoffMax, rng);
      await sleepImpl(delay);
      if (stopped || disconnecting || token !== dialToken) return;

      // Re-arm the consumed single-use URL.
      let t: CreateTunnelResult;
      try {
        t = await deps.rearm();
      } catch {
        attempt++;
        pendingReason = "relay_unreachable";
        scheduleNext();
        return;
      }
      currentUrl = t.url;
      expiresAt = t.expiresAt;

      if (!isWsUrl(currentUrl)) {
        attempt++;
        pendingReason = "protocol_violation";
        scheduleNext();
        return;
      }
      if (now() > expiresAt) {
        attempt++;
        pendingReason = "url_expired";
        scheduleNext();
        return;
      }
    }

    const ws = new WS(currentUrl);
    socket = ws;
    live = false;

    const opened = await new Promise<boolean>((resolve) => {
      ws.onopen = () => resolve(true);
      ws.onerror = () => resolve(false);
    });
    if (stopped || disconnecting || token !== dialToken) {
      try {
        ws.close(1000, "closed");
      } catch {
        /* ignore */
      }
      dropSocket();
      return;
    }

    if (!opened) {
      attempt++;
      pendingReason = "relay_unreachable";
      try {
        ws.close(1000, "dial failed");
      } catch {
        /* ignore */
      }
      dropSocket();
      scheduleNext();
      return;
    }

    // Open → LIVE. Backoff resets on a successful open.
    live = true;
    attempt = 1;
    emit("live");
    startHeartbeat(ws);

    ws.onmessage = (ev) => {
      if (token !== dialToken) return;
      const data = typeof ev.data === "string" ? ev.data : null;
      if (data === null) {
        protocolViolation();
        return;
      }
      const inbound = parseInbound(data);
      if (!inbound) {
        protocolViolation();
        return;
      }
      // ack inversion (a regression in the peer's ack of our stream) is a violation.
      if (inbound.ack < highestDeviceAck) {
        protocolViolation();
        return;
      }
      highestDeviceAck = Math.max(highestDeviceAck, inbound.ack);
      inboundSeq = Math.max(inboundSeq, inbound.seq);
      if (inbound.frame === null) {
        // heartbeat / ack-only
        deps.onInbound({ v: 1, seq: inbound.seq, ack: inbound.ack, deviceId: inbound.deviceId, frame: null });
        return;
      }
      if (inbound.frame.type === "resume") {
        // control: watermark updated above; never surfaces to onInbound
        return;
      }
      if (inbound.frame.type === "resync") {
        // control: fires the injected seam exactly once; never surfaces to onInbound
        deps.onResync?.(inbound.frame.fromSeq);
        return;
      }
      deps.onInbound({ v: 1, seq: inbound.seq, ack: inbound.ack, deviceId: inbound.deviceId, frame: inbound.frame });
    };
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = () => {
      const wasLive = live;
      dropSocket();
      if (stopped || disconnecting || token !== dialToken) return;
      if (pendingReason === null) {
        pendingReason = wasLive ? "reconnecting" : "relay_unreachable";
      }
      scheduleNext();
    };
  }

  // -------------------------------------------------------------------------
  // Public handle
  // -------------------------------------------------------------------------

  async function connect(initial: { url: string; expiresAt: number }): Promise<void> {
    stopped = false;
    disconnecting = false;
    currentUrl = initial.url;
    expiresAt = initial.expiresAt;
    attempt = 1;
    pendingReason = null;
    inboundSeq = 0;
    highestDeviceAck = 0;
    firstDial = true;
    const token = ++dialToken;
    void dialLoop(token);
  }

  async function disconnect(): Promise<void> {
    if (disconnecting) return; // idempotent
    disconnecting = true;
    stopped = true;
    pendingReason = null;
    const s = socket;
    dropSocket(); // detaches handlers so no onclose fires → no reconnect
    if (s) {
      try {
        s.close(1000, "local close");
      } catch {
        /* already closed */
      }
    }
  }

  function send(frame: AgUiFrameLike): number | null {
    const ws = socket;
    if (!live || !ws || ws.readyState !== 1) {
      // Drop with a signal while not live — never consumes a seq, so emitted
      // frames are consecutive. EV-8/EV-5 render the drop.
      return null;
    }
    const withId: AgUiFrameLike = frame.id == null ? { ...frame, id: newId() } : frame;
    const seq = ++outboundSeq;
    const env = envelope(seq, inboundSeq, withId as AgUiFrame);
    try {
      ws.send(JSON.stringify(env));
    } catch {
      // Dead peer: tear down so the reconnect loop fires.
      const s = socket;
      dropSocket();
      if (s) {
        try {
          s.close(1000, "dead peer");
        } catch {
          /* already closed */
        }
      }
      if (!stopped && !disconnecting) {
        pendingReason = pendingReason ?? "relay_unreachable";
        scheduleNext();
      }
      return null;
    }
    return seq;
  }

  function getId(): string {
    return connectionId;
  }

  return { connect, disconnect, send, getId };
}
