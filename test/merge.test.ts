/**
 * EV-8 — pure footer merge unit tests (spec §2.1, J1/J4).
 */
import { describe, expect, test } from "bun:test";
import {
  mergeTransport,
  transportErrorKey,
  type FooterState,
} from "../src/merge";
import type {
  TransportStatusEvent,
  TransportReason,
} from "../src/transport";

function ev(
  order: number,
  kind: "dialing" | "live",
  severity: "error" | "live" | "resyncing",
  reason?: TransportReason
): TransportStatusEvent {
  return { kind, connectionId: "sess", severity, order, reason } as TransportStatusEvent;
}

describe("mergeTransport", () => {
  test("N-1 then Nth consecutive error-severity dialing → dialing then error (J4)", () => {
    const N = 10;
    let r = mergeTransport("off", 0, ev(1, "dialing", "error", "relay_unreachable"), 0, N);
    expect(r.footer).toBe("dialing");
    expect(r.consec).toBe(1);
    // 2..9 more error events → still dialing, consec climbing
    for (let i = 2; i <= 9; i++) {
      r = mergeTransport(r.footer, r.lastOrder, ev(i, "dialing", "error", "relay_unreachable"), r.consec, N);
      expect(r.footer).toBe("dialing");
      expect(r.consec).toBe(i);
    }
    // Nth consecutive error event → error
    const nth = mergeTransport(r.footer, r.lastOrder, ev(10, "dialing", "error", "relay_unreachable"), r.consec, N);
    expect(nth.footer).toBe("error");
    expect(nth.consec).toBe(10);
  });

  test("a subsequent live event clears a sticky error (recovery, J1)", () => {
    const N = 3;
    let r = mergeTransport("off", 0, ev(1, "dialing", "error", "relay_unreachable"), 0, N);
    r = mergeTransport(r.footer, r.lastOrder, ev(2, "dialing", "error", "relay_unreachable"), r.consec, N);
    r = mergeTransport(r.footer, r.lastOrder, ev(3, "dialing", "error", "relay_unreachable"), r.consec, N);
    expect(r.footer).toBe("error");
    // verified live open → live, consec reset
    const live = mergeTransport(r.footer, r.lastOrder, ev(4, "live", "live"), r.consec, N);
    expect(live.footer).toBe("live");
    expect(live.consec).toBe(0);
    expect(live.lastOrder).toBe(4);
  });

  test("dialing-while-error keeps error (sticky) below threshold", () => {
    // Already error from N past events; a below-threshold error dialing keeps error
    const N = 5;
    // reach error
    let r = mergeTransport("off", 0, ev(1, "dialing", "error", "relay_unreachable"), 0, N);
    r = mergeTransport(r.footer, r.lastOrder, ev(2, "dialing", "error", "relay_unreachable"), r.consec, N);
    r = mergeTransport(r.footer, r.lastOrder, ev(3, "dialing", "error", "relay_unreachable"), r.consec, N);
    r = mergeTransport(r.footer, r.lastOrder, ev(4, "dialing", "error", "relay_unreachable"), r.consec, N);
    r = mergeTransport(r.footer, r.lastOrder, ev(5, "dialing", "error", "relay_unreachable"), r.consec, N);
    expect(r.footer).toBe("error");
    // Now footer is error; a reconnecting (resyncing-severity) dialing keeps error
    const keep = mergeTransport(r.footer, r.lastOrder, ev(6, "dialing", "resyncing", "reconnecting"), r.consec, N);
    expect(keep.footer).toBe("error");
    // a below-threshold error dialing keeps error too (sticky, not cleared by dialing)
    const keep2 = mergeTransport(r.footer, r.lastOrder, ev(7, "dialing", "error", "relay_unreachable"), keep.consec, N);
    expect(keep2.footer).toBe("error");
  });

  test("first-connect resyncing-severity dialing renders dialing (kind-first)", () => {
    const N = 10;
    const r = mergeTransport("off", 0, ev(1, "dialing", "resyncing", "first_connect"), 0, N);
    expect(r.footer).toBe("dialing"); // never "resyncing"
    expect(r.consec).toBe(0); // non-error severity resets counter
  });

  test("reconnecting resyncing-severity dialing renders dialing and resets consec", () => {
    const N = 10;
    let r = mergeTransport("off", 0, ev(1, "dialing", "error", "relay_unreachable"), 0, N);
    r = mergeTransport(r.footer, r.lastOrder, ev(2, "dialing", "error", "relay_unreachable"), r.consec, N);
    expect(r.consec).toBe(2);
    // reconnecting resets the error counter
    const rec = mergeTransport(r.footer, r.lastOrder, ev(3, "dialing", "resyncing", "reconnecting"), r.consec, N);
    expect(rec.footer).toBe("dialing");
    expect(rec.consec).toBe(0);
  });

  test("order guard drops stale / out-of-order events (J1)", () => {
    const N = 3;
    let r = mergeTransport("off", 0, ev(5, "dialing", "error", "relay_unreachable"), 0, N);
    expect(r.lastOrder).toBe(5);
    // stale event (order <= 5) ignored unchanged
    const stale = mergeTransport(r.footer, r.lastOrder, ev(3, "live", "live"), r.consec, N);
    expect(stale).toEqual({ footer: r.footer, lastOrder: r.lastOrder, consec: r.consec });
  });

  test("a live event advances lastOrder (most-recent-wins)", () => {
    const N = 10;
    const live = mergeTransport("dialing", 2, ev(7, "live", "live"), 0, N);
    expect(live.footer).toBe("live");
    expect(live.lastOrder).toBe(7);
  });

  test("mergeTransport never produces resyncing", () => {
    const N = 4;
    const reasons: TransportReason[] = ["first_connect", "reconnecting", "relay_unreachable", "protocol_violation", "url_expired"];
    for (const reason of reasons) {
      const r = mergeTransport("off", 0, ev(1, "dialing", reason === "relay_unreachable" || reason === "protocol_violation" || reason === "url_expired" ? "error" : "resyncing", reason), 0, N);
      expect(r.footer).not.toBe("resyncing");
    }
  });
});

describe("transportErrorKey", () => {
  test("maps the three transport-error reasons to loginEnglishFor keys", () => {
    expect(transportErrorKey("relay_unreachable")).toBe("tunnel.error.relayUnreachable");
    expect(transportErrorKey("protocol_violation")).toBe("tunnel.error.protocolViolation");
    expect(transportErrorKey("url_expired")).toBe("tunnel.error.urlExpired");
  });
  test("returns null for non-error reasons", () => {
    expect(transportErrorKey("first_connect")).toBeNull();
    expect(transportErrorKey("reconnecting")).toBeNull();
    expect(transportErrorKey(undefined)).toBeNull();
  });
});
