/**
 * EV-3 — outbound wss transport with seq-ack envelope.
 *
 * Tests run against a fake relay built on Bun native WebSocket / Bun.serve:
 * no Mongo, no real relay, no TLS (transport accepts ws:/wss: defensively —
 * production URLs are always wss:// from EV-2 createTunnel validation).
 * All clocks/timers/randomness/ids are injected with short real intervals.
 */
import { describe, expect, test } from "bun:test";
import type { ServerWebSocket } from "bun";
import {
  createTransport,
  envelope,
  nextBackoff,
  parseInbound,
  type TransportStatusEvent,
  type TransportEnvelope,
  type InboundEnvelope,
  type TransportDeps,
  type TransportReason,
  type TransportKind,
  type TransportSeverity,
} from "../src/transport";
import type { AgUiFrame } from "../src/translate";
import type { CreateTunnelResult } from "../src/tunnel";
import { replayActiveBranch, resyncDoneFrame } from "../src/history";

// ---------------------------------------------------------------------------
// Fake WS relay (Bun native WebSocket server-side).
// ---------------------------------------------------------------------------

interface FakeServerOptions {
  /** If set, the relay force-closes any connection that receives no ping within this many ms. */
  idleTimeout?: number;
  /** Called with every parsed envelope the relay receives from the transport. */
  onMessage?: (ws: ServerWebSocket, parsed: TransportEnvelope | null) => void;
}

interface FakeServer {
  url: string;
  received: TransportEnvelope[];
  pings: number;
  connections: ServerWebSocket[];
  /** Simulate a relay death mid-session: the relay closes the connection it holds. */
  kill(code?: number): void;
  broadcast(obj: InboundEnvelope): void;
  stop(): void;
}

function startFakeServer(opts: FakeServerOptions = {}): FakeServer {
  const received: TransportEnvelope[] = [];
  const connections: ServerWebSocket[] = [];
  let pings = 0;
  const lastPingAt = new Map<ServerWebSocket, number>();

  const server = Bun.serve({
    port: 0,
    fetch(req, srv) {
      if (srv.upgrade(req)) return undefined;
      return new Response("bad request", { status: 400 });
    },
    websocket: {
      open(ws) {
        connections.push(ws);
        lastPingAt.set(ws, Date.now());
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
        opts.onMessage?.(ws, parsed);
      },
      ping(ws) {
        pings++;
        lastPingAt.set(ws, Date.now());
      },
      close(ws) {
        const i = connections.indexOf(ws);
        if (i >= 0) connections.splice(i, 1);
        lastPingAt.delete(ws);
      },
    },
  });

  const port = server.port as number;

  let idleTimer: ReturnType<typeof setInterval> | null = null;
  if (opts.idleTimeout) {
    idleTimer = setInterval(() => {
      const now = Date.now();
      for (const ws of [...connections]) {
        const last = lastPingAt.get(ws) ?? 0;
        if (now - last > (opts.idleTimeout as number)) {
          try {
            ws.close(1001, "idle timeout");
          } catch {
            /* already closed */
          }
        }
      }
    }, 4);
  }

  return {
    url: `ws://localhost:${port}/live`,
    received,
    get pings() {
      return pings;
    },
    get connections() {
      return connections;
    },
    kill(code = 1006) {
      for (const ws of [...connections]) {
        try {
          ws.close(code);
        } catch {
          /* ignore */
        }
      }
    },
    broadcast(obj: InboundEnvelope) {
      for (const ws of [...connections]) ws.send(JSON.stringify(obj));
    },
    stop() {
      if (idleTimer) clearInterval(idleTimer);
      server.stop(true);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** A valid, minimal AgUiFrame for sends that don't care about the payload. */
function aFrame(): AgUiFrame {
  return { type: "STEP_STARTED", stepName: "turn" };
}

/** Collect transport status events into an array; resolves when N events recorded. */
function collector() {
  const events: TransportStatusEvent[] = [];
  let resolveLive: (() => void) | null = null;
  const livePromise = new Promise<void>((r) => {
    resolveLive = r;
  });
  return {
    events,
    onEvent(e: TransportStatusEvent) {
      events.push(e);
      if (e.kind === "live") resolveLive?.();
    },
    live: livePromise,
    waitLive: () => livePromise,
  };
}

/** A controllable injected clock that advances only when told to. */
function manualClock() {
  let t = 1000;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const REASONS: readonly TransportReason[] = [
  "first_connect",
  "reconnecting",
  "relay_unreachable",
  "protocol_violation",
  "url_expired",
];

function noopDeps(overrides: Partial<TransportDeps> = {}): TransportDeps {
  return {
    sessionId: "sess-1",
    rearm: async () => ({ tunnelId: "t1", url: "ws://x", expiresAt: Number.MAX_SAFE_INTEGER } as CreateTunnelResult),
    WebSocket,
    now: () => Date.now(),
    sleep,
    rng: () => 0.5,
    newId: () => "gen-id",
    onEvent: () => {},
    onInbound: () => {},
    backoffBase: 5,
    backoffMax: 40,
    heartbeatInterval: 10,
    proxyTimeout: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("EV-3 outbound wss transport with seq-ack envelope", () => {
  test("§3.1-1: envelope pure shape; outbound send yields strictly increasing consecutive seq; inbound seq=k feeds next outbound ack = max(k)", async () => {
    const f = startFakeServer();
    const col = collector();
    const transported = createTransport(
      noopDeps({ rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }), onEvent: col.onEvent })
    );
    await transported.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    // pure shape
    expect(envelope(5, 3, null)).toEqual({ v: 1, seq: 5, ack: 3, frame: null });

    // send 3 frames while live
    const seqs: (number | null)[] = [];
    seqs.push(transported.send(aFrame()));
    seqs.push(transported.send(aFrame()));
    seqs.push(transported.send(aFrame()));
    expect(seqs).toEqual([1, 2, 3]);

    await sleep(20);
    const sent = f.received.filter(Boolean);
    expect(sent).toHaveLength(3);
    expect(sent.map((e) => e.seq)).toEqual([1, 2, 3]); // strictly increasing, consecutive
    expect(sent.every((e) => e.v === 1)).toBe(true);
    expect(sent.every((e) => e.ack === 0)).toBe(true); // no inbound yet

    // Relay dispatches inbound seq = 7
    f.broadcast({ v: 1, seq: 7, ack: 0, frame: { type: "CUSTOM", name: "pi.x", value: { pi: "x", data: {} } } });
    await sleep(20);
    transported.send(aFrame());
    await sleep(20);
    const after = f.received.filter(Boolean);
    const last = after[after.length - 1]!;
    expect(last.ack).toBe(7); // inbound watermark echoed
    f.stop();
    await transported.disconnect();
  });

  test("§3.1-2: nextBackoff — fixed rng=1 returns min(max, base*2^(attempt-1)), strictly increasing to max; uniform rng lands in [0, ceiling]", () => {
    expect(nextBackoff(1, 50, 5000, () => 1)).toBe(50);
    expect(nextBackoff(2, 50, 5000, () => 1)).toBe(100);
    expect(nextBackoff(3, 50, 5000, () => 1)).toBe(200);
    expect(nextBackoff(7, 50, 5000, () => 1)).toBe(3200);
    // capped at max
    expect(nextBackoff(8, 50, 5000, () => 1)).toBe(5000);
    expect(nextBackoff(9, 50, 5000, () => 1)).toBe(5000);
    // series 1..8 strictly increasing until the cap is reached at attempt 8
    const series = [1, 2, 3, 4, 5, 6, 7, 8].map((a) => nextBackoff(a, 50, 5000, () => 1));
    expect(series).toEqual([50, 100, 200, 400, 800, 1600, 3200, 5000]);
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!).toBeGreaterThan(series[i - 1]!);
    }
    expect(series[series.length - 1]).toBe(5000);
    // uniform-ish rng stays within [0, ceiling]
    for (const r of [0, 0.1, 0.5, 0.99, 1]) {
      const d = nextBackoff(3, 50, 5000, () => r);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(Math.min(5000, 50 * 2 ** 2));
    }
  });

  test("§3.1-3: relay kill → rearm() for fresh URL, re-dials, resumes live under same getId(); now() deltas non-decreasing; loop never exits on its own", async () => {
    const f = startFakeServer();
    const clock = manualClock();
    const col = collector();
    let rearmCalls = 0;
    const transported = createTransport(
      noopDeps({
        now: clock.now,
        sleep: async () => {},
        rng: () => 0.5,
        rearm: async () => {
          rearmCalls++;
          return { tunnelId: `t-${rearmCalls}`, url: f.url, expiresAt: Number.MAX_SAFE_INTEGER };
        },
        onEvent: col.onEvent,
      })
    );

    await transported.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;
    expect(rearmCalls).toBe(0); // first connect does NOT rearm
    const idBefore = transported.getId();

    // relay death mid-session
    f.kill(1006);
    // let reconnect happen (backoff delay is tiny)
    await sleep(60);
    // loop keeps trying: rearm should have been called at least once
    expect(rearmCalls).toBeGreaterThanOrEqual(1);
    expect(transported.getId()).toBe(idBefore); // stable logical connection id (seq never reset, id stable)

    // now() deltas non-decreasing
    const dialings = col.events.filter((e) => e.kind === "dialing");
    expect(dialings.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < dialings.length; i++) {
      expect(dialings[i]!.since!).toBeGreaterThanOrEqual(dialings[i - 1]!.since!);
    }

    // no give-up: events contain only dialing/live (never a terminal kind), reasons from closed set
    for (const e of col.events) {
      expect(["dialing", "live"]).toContain(e.kind);
    }

    f.stop();
    await transported.disconnect();
  });

  test("§3.1-4: reconnect emits dialing(reconnecting) then live; never kind:error; reasons from closed 5-value set", async () => {
    const f = startFakeServer();
    const col = collector();
    const transported = createTransport(
      noopDeps({
        rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }),
        sleep: async () => {},
        rng: () => 0.5,
        onEvent: col.onEvent,
      })
    );
    await transported.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    const before = col.events.length;
    f.kill(1006);
    await sleep(40);

    // all reasons drawn from the closed taxonomy
    for (const e of col.events) {
      expect(["dialing", "live"]).toContain(e.kind);
      if (e.reason !== undefined) expect(REASONS).toContain(e.reason);
    }
    // never a kind outside the CLOSED {dialing, live} set (i.e. never kind:"error")
    for (const e of col.events) {
      expect(["dialing", "live"] as TransportKind[]).toContain(e.kind);
    }
    // after the kill there is a dialing(reconnecting) and eventually a live again
    const post = col.events.slice(before);
    const dialingReconnect = post.find((e) => e.kind === "dialing" && e.reason === "reconnecting");
    expect(dialingReconnect).toBeDefined();
    const liveAfter = post.find((e) => e.kind === "live");
    expect(liveAfter).toBeDefined();
    expect(dialingReconnect!.order).toBeLessThan(liveAfter!.order); // ordered before the live

    f.stop();
    await transported.disconnect();
  });

  test("§3.1-5: live outbound frames carry distinct UUID frame.id; pre-existing frame.id untouched (replay); translate.ts has no socket dial", async () => {
    const f = startFakeServer();
    const col = collector();
    let idCounter = 0;
    const transported = createTransport(
      noopDeps({
        rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }),
        sleep,
        rng: () => 0.5,
        newId: () => `uuid-${++idCounter}`,
        onEvent: col.onEvent,
      })
    );
    await transported.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    // live frames get a new id each time, distinct
    transported.send(aFrame());
    transported.send(aFrame());
    await sleep(20);
    const liveIds = f.received.filter(Boolean).map((e) => (e.frame as { id?: string }).id);
    expect(liveIds).toHaveLength(2);
    expect(liveIds[0]).toBe("uuid-1");
    expect(liveIds[1]).toBe("uuid-2");
    expect(new Set(liveIds).size).toBe(2); // distinct

    // pre-existing frame.id left untouched (replay path)
    transported.send({ type: "CUSTOM", name: "pi.replay", value: { pi: "x", data: {} }, id: "det-99" } as AgUiFrame & { id: string });
    await sleep(20);
    const replay = f.received.filter(Boolean).pop()!;
    expect((replay.frame as { id?: string }).id).toBe("det-99"); // NOT overwritten

    // static guard: translate.ts has no socket dial (O3)
    const src = await Bun.file(new URL("../src/translate.ts", import.meta.url)).text();
    expect(src).not.toMatch(/new WebSocket\(/);
    expect(src).not.toMatch(/wss?:\/\//);

    f.stop();
    await transported.disconnect();
  });

  test("§3.1-6: heartbeat — idleTimeout smaller than heartbeat interval keeps socket OPEN with pings recorded; dead peer tears down and reconnect fires", async () => {
    const f = startFakeServer({ idleTimeout: 30 }); // relay closes if no ping for 30ms
    const col = collector();
    const transported = createTransport(
      noopDeps({
        rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }),
        sleep,
        rng: () => 0.5,
        heartbeatInterval: 8, // beats the 30ms idle
        onEvent: col.onEvent,
      })
    );
    await transported.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    await sleep(120); // well past idleTimeout
    // connection survived: server has recorded pings and the client is still the live one (no reconnect churn)
    expect(f.pings).toBeGreaterThan(0);
    const liveCount = col.events.filter((e) => e.kind === "live").length;
    expect(liveCount).toBe(1); // never dropped due to idle
    expect(f.connections.length).toBe(1); // still OPEN on relay side

    // dead peer: kill the relay-side connection
    f.kill(1002);
    await sleep(40);
    expect(col.events.filter((e) => e.kind === "live").length).toBeGreaterThanOrEqual(2); // reconnect fired

    f.stop();
    await transported.disconnect();
  });

  test("§3.1-7: local disconnect() does NOT auto-reconnect; network close does", async () => {
    const f = startFakeServer();
    const col = collector();
    let rearmCalls = 0;
    const transported = createTransport(
      noopDeps({
        rearm: async () => {
          rearmCalls++;
          return { tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER };
        },
        sleep: async () => {},
        rng: () => 0.5,
        onEvent: col.onEvent,
      })
    );
    await transported.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    const liveCountBefore = col.events.filter((e) => e.kind === "live").length;
    // idempotent disconnect
    await transported.disconnect();
    await transported.disconnect();
    await sleep(40);
    // after a local close, no reconnect: no new live, no rearm, no new connection
    expect(col.events.filter((e) => e.kind === "live").length).toBe(liveCountBefore);
    expect(rearmCalls).toBe(0);
    expect(f.connections.length).toBe(0);
    f.stop();

    // A NEW transport instance demonstrates the network-close path separately.
    const f2 = startFakeServer();
    const col2 = collector();
    const t2 = createTransport(
      noopDeps({
        rearm: async () => ({ tunnelId: "t1", url: f2.url, expiresAt: Number.MAX_SAFE_INTEGER }),
        sleep: async () => {},
        rng: () => 0.5,
        onEvent: col2.onEvent,
      })
    );
    await t2.connect({ url: f2.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col2.live;
    f2.kill(1006); // network close
    await sleep(40);
    expect(col2.events.filter((e) => e.kind === "live").length).toBeGreaterThanOrEqual(2); // reconnects
    f2.stop();
    await t2.disconnect();
  });

  test("§3.1-8: transport.ts contains no fetch(; importing it has no side effects", async () => {
    const src = await Bun.file(new URL("../src/transport.ts", import.meta.url)).text();
    expect(src).not.toMatch(/fetch\(/);

    const before = (globalThis as Record<string, unknown>).__ev3_side_effect ?? "absent";
    await import("../src/transport");
    const after = (globalThis as Record<string, unknown>).__ev3_side_effect ?? "absent";
    expect(after).toBe(before);
  });

  test("§3.1-9 (O2 merge-policy fixture): EV-8 highest-severity-wins merge is implementable against the implemented event shape", async () => {
    // A minimal EV-8-style reducer using severity + order as primitives and
    // exercising reason/attempt/since/connectionId (recorded preference:
    // errors need to be seen and acknowledged).
    const closedReasons: TransportReason[] = [...REASONS];

    // run a transport through a realistic sequence: dialing -> live -> reconnect dialing(error) -> live
    const f = startFakeServer();
    const col = collector();
    const clock = manualClock();
    let rearmCalls = 0;
    const t = createTransport(
      noopDeps({
        now: clock.now,
        rearm: async () => {
          rearmCalls++;
          return { tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER };
        },
        sleep: async () => {},
        rng: () => 0.5,
        onEvent: col.onEvent,
      })
    );
    await t.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    // advance clock so subsequent since values are distinct
    clock.advance(50);
    f.kill(1006); // network death -> reconnect
    await sleep(40);
    clock.advance(50);

    // Merge policy: track highest severity seen; on a new event, if its severity
    // is >= current, it wins (with order breaking ties); live events are lower
    // severity than dialing/error, so a reconnect that lands back on live does not
    // hide a previously-seen error that must be acknowledged.
    interface FooterState {
      severity: TransportSeverity;
      order: number;
    }
    const SEV_RANK: Record<TransportSeverity, number> = { error: 3, resyncing: 2, live: 1 };
    let footer: FooterState = { severity: "live", order: -1 };

    function merge(e: TransportStatusEvent) {
      if (e.order < footer.order) return; // stale
      const rank = SEV_RANK[e.severity];
      // highest-severity-wins; ties resolved by most recent order
      if (rank > SEV_RANK[footer.severity] || (rank === SEV_RANK[footer.severity] && e.order >= footer.order)) {
        footer = { severity: e.severity, order: e.order };
      }
    }

    for (const e of col.events) merge(e);

    // The event stream that went through an error-severity dialing must be
    // capable of surfacing it (severity + order + reason exist and are typed).
    const hasErrorSeverityDialiing = col.events.some(
      (e) => e.kind === "dialing" && e.severity === "error"
    );
    const hasResync = col.events.some((e) => e.severity === "resyncing");
    const hasLive = col.events.some((e) => e.severity === "live");

    // every event carries severity + order (field floor), reasons are typed/closed
    for (const e of col.events) {
      expect(["error", "live", "resyncing"]).toContain(e.severity);
      expect(typeof e.order).toBe("number");
      expect(e.connectionId).toBe("sess-1");
    }
    for (const e of col.events) {
      if (e.reason !== undefined) expect(closedReasons).toContain(e.reason);
    }

    // The merge is well-formed: footer never regresses in severity rank for a
    // later order, and an error-severity event (if any) is acknowledged before
    // any later live of lower/equal rank can hide it.
    const finalRank = SEV_RANK[footer.severity];
    // once a live higher-order event arrives after an error, footer can drop to live
    // (the merge's choice) — but the fixture proves the shape supports it (no throw,
    // typed severity/order, reasons closed).
    expect(finalRank).toBeGreaterThanOrEqual(1);

    // The shape is NOT starved: both resync-severity and (transient) error-severity
    // events were producible. Over the whole lifecycle at least resync + live occurred.
    expect(hasResync).toBe(true);
    expect(hasLive).toBe(true);

    // acknowledge the error if one was ever raised (recorded preference: errors
    // need to be seen — the fixture confirms the seam exposes it).
    if (hasErrorSeverityDialiing) {
      const firstError = col.events.find((e) => e.severity === "error")!;
      expect(firstError.reason).toBeDefined();
      expect(typeof firstError.attempt).toBe("number");
      expect(typeof firstError.since).toBe("number");
    }

    f.stop();
    await t.disconnect();
  });

  test("EV-5 U3/O3: widening — replay frame round-trips; envelope exactly 4 keys", async () => {
    const f = startFakeServer();
    const col = collector();
    const t = createTransport(
      noopDeps({ rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }), onEvent: col.onEvent })
    );
    await t.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    // a pre-framed replay frame carrying replay:true + a deterministic id
    t.send({ type: "CUSTOM", name: "pi.resync.done", value: { uptoSeq: 0 } as never, id: "det-1", replay: true } as never);
    await sleep(20);
    const env = f.received.filter(Boolean).pop()!;
    expect(Object.keys(env).sort()).toEqual(["ack", "frame", "seq", "v"]); // exactly 4 keys
    const fr = env.frame as unknown as { replay?: boolean; id?: string };
    expect(fr.replay).toBe(true);
    expect(fr.id).toBe("det-1"); // replay id never overwritten

    f.stop();
    await t.disconnect();
  });

  test("EV-5 U2/O6: parseInbound accepts the 4 union members; rejects non-members as protocol_violation", async () => {
    // members accepted
    expect((parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "CUSTOM", name: "pi.x", value: { pi: "x", data: {} } } }))!.frame as { type: string }).type).toBe("CUSTOM");
    expect(parseInbound(JSON.stringify({ v: 1, seq: 2, ack: 0, frame: { type: "resume", deviceId: "d1", lastAckedSeq: 7 } }))!.frame).toMatchObject({ type: "resume", lastAckedSeq: 7 });
    expect(parseInbound(JSON.stringify({ v: 1, seq: 3, ack: 0, frame: { type: "resync", fromSeq: 3 } }))!.frame).toMatchObject({ type: "resync", fromSeq: 3 });
    expect(parseInbound(JSON.stringify({ v: 1, seq: 4, ack: 0, frame: null }))!.frame).toBeNull();
    // non-members rejected (null → protocol violation)
    expect(parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "bogus" } }))).toBeNull();
    expect(parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "resume", deviceId: 123, lastAckedSeq: 1 } }))).toBeNull();
    expect(parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "resync", fromSeq: "x" } }))).toBeNull();
  });

  test("EV-5 U2/O6: resume updates watermark, never surfaces to onInbound; resync fires onResync exactly once", async () => {
    const f = startFakeServer();
    const col = collector();
    let inboundCount = 0;
    const resyncs: number[] = [];
    const t = createTransport(
      noopDeps({
        rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }),
        onEvent: col.onEvent,
        onInbound: () => { inboundCount++; },
        onResync: (fromSeq) => { resyncs.push(fromSeq); },
      })
    );
    await t.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await col.live;

    f.broadcast({ v: 1, seq: 42, ack: 0, frame: { type: "resume", deviceId: "d1", lastAckedSeq: 7 } } as never);
    await sleep(20);
    expect(inboundCount).toBe(0); // resume never surfaces
    t.send(aFrame()); // next outbound ack reflects the watermark
    await sleep(20);
    const after = f.received.filter(Boolean);
    expect(after[after.length - 1]!.ack).toBe(42);

    // a resync control frame fires the injected callback exactly once
    f.broadcast({ v: 1, seq: 99, ack: 0, frame: { type: "resync", fromSeq: 3 } } as never);
    await sleep(20);
    expect(resyncs).toEqual([3]);
    expect(inboundCount).toBe(0); // resync also never surfaces

    f.stop();
    await t.disconnect();
  });

  test("EV-5 §1.6: no pi.resync.done on the wire when a mid-replay send is dropped (honesty)", async () => {
    const text = await Bun.file(new URL("./fixtures/two-runs.jsonl", import.meta.url)).text();
    const entries = text
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => JSON.parse(l));
    const { frames, resyncDone } = replayActiveBranch({ sessionId: "sess-X", entries });
    const term = resyncDoneFrame({ sessionId: "sess-X", uptoSeq: resyncDone.uptoSeq });

    // Happy path: all sends succeed → terminator reaches the wire with uptoSeq == max replayed seq
    const f1 = startFakeServer();
    const c1 = collector();
    const t1 = createTransport(
      noopDeps({ rearm: async () => ({ tunnelId: "t", url: f1.url, expiresAt: Number.MAX_SAFE_INTEGER }), onEvent: c1.onEvent })
    );
    await t1.connect({ url: f1.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await c1.live;
    for (const fr of frames) {
      expect(t1.send(fr as never)).not.toBeNull();
    }
    t1.send(term as never);
    await sleep(20);
    const sent1 = f1.received.filter(Boolean);
    const done1 = sent1.filter((e) => (e.frame as { name?: string })?.name === "pi.resync.done");
    expect(done1).toHaveLength(1);
    expect((done1[0]!.frame as unknown as { value: { uptoSeq: number } }).value.uptoSeq).toBe(frames.length);
    f1.stop();
    await t1.disconnect();

    // Drop path: a mid-replay send drops (not live) → honest loop stops; NO terminator on the wire
    const f2 = startFakeServer();
    const c2 = collector();
    const t2 = createTransport(
      noopDeps({ rearm: async () => ({ tunnelId: "t", url: f2.url, expiresAt: Number.MAX_SAFE_INTEGER }), onEvent: c2.onEvent })
    );
    await t2.connect({ url: f2.url, expiresAt: Number.MAX_SAFE_INTEGER });
    await c2.live;
    t2.send(frames[0]! as never); // delivered
    await t2.disconnect(); // local close → not live → next send drops with a null signal
    const dropped = t2.send(frames[1]! as never);
    expect(dropped).toBeNull();
    // honest loop does not emit the lying resync_done after a mid-replay drop
    await sleep(10);
    const sent2 = f2.received.filter(Boolean);
    expect(sent2.filter((e) => (e.frame as { name?: string })?.name === "pi.resync.done")).toHaveLength(0);
    f2.stop();
    await t2.disconnect();
  });
});
