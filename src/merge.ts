/**
 * EV-8 — pure footer-merge for the seven-state status surface.
 *
 * The single pure function that folds a transport status event into the
 * footer state, KIND-FIRST and order-guarded (spec §2.1, rulings J1/J4). It
 * is framework-agnostic and has no side effects; the loader/controller owns
 * the `setStatus` side effect and the closure state it is folded from.
 *
 * Rules (spec §2.1):
 *   1. Order guard — events with `e.order <= lastOrder` are stale; ignored.
 *   2. `kind:"live"` → live (clears a sticky error — verified recovery, J1),
 *      consec reset to 0.
 *   3. `kind:"dialing"`:
 *        - severity "error": consec+1; at >= N → error; else dialing unless
 *          the footer is already error (sticky).
 *        - severity "resyncing" (first_connect / reconnecting): consec=0;
 *          keep error if already error, else dialing (kind-first).
 *   4. "resyncing" is NEVER produced here — it is a replay-overlay state
 *      owned by the replay path (spec §2.1.4, §5.3).
 *   5. Most-recent-wins across the live family; only `error` is sticky.
 *
 * N defaults to 10, injectable as ERROR_DIAL_THRESHOLD (J4).
 */
import type { TransportReason, TransportStatusEvent } from "./transport";

/** The exact seven footer states, in lifecycle order (spec §8). */
export type FooterState =
  | "off"
  | "not enrolled"
  | "authorizing"
  | "dialing"
  | "resyncing"
  | "live"
  | "error";

/** loginEnglishFor key for each footer state (the seven status.* rows). */
export const STATUS_KEYS: Record<FooterState, string> = {
  off: "status.off",
  "not enrolled": "status.notEnrolled",
  authorizing: "status.authorizing",
  dialing: "status.dialing",
  resyncing: "status.resyncing",
  live: "status.live",
  error: "status.error",
};

/** The three transport-side error reasons with no row anywhere today (spec §8). */
const TRANSPORT_ERROR_KEYS: Record<
  "relay_unreachable" | "protocol_violation" | "url_expired",
  string
> = {
  relay_unreachable: "tunnel.error.relayUnreachable",
  protocol_violation: "tunnel.error.protocolViolation",
  url_expired: "tunnel.error.urlExpired",
};

/**
 * Map a transport reason to its loginEnglishFor copy key for the error
 * footer. Returns null for any reason outside the three transport-error rows
 * (e.g. first_connect / reconnecting, which are not error conditions).
 */
export function transportErrorKey(reason: TransportReason | undefined): string | null {
  if (
    reason === "relay_unreachable" ||
    reason === "protocol_violation" ||
    reason === "url_expired"
  ) {
    return TRANSPORT_ERROR_KEYS[reason];
  }
  return null;
}

export interface MergeResult {
  footer: FooterState;
  lastOrder: number;
  consec: number;
}

/**
 * Fold one transport event into the footer. Pure; the caller supplies the
 * current footer, last order ordinal, and the consecutive-error counter.
 */
export function mergeTransport(
  footer: FooterState,
  lastOrder: number,
  e: TransportStatusEvent,
  consec: number,
  N: number
): MergeResult {
  // Rule 1 — order guard: stale / out-of-order events are ignored unchanged.
  if (e.order <= lastOrder) {
    return { footer, lastOrder, consec };
  }
  const order = e.order;

  // Rule 2 — a verified live open clears a sticky error (recovery, J1).
  if (e.kind === "live") {
    return { footer: "live", lastOrder: order, consec: 0 };
  }

  // kind === "dialing".
  if (e.severity === "error") {
    // Rule 3a — consecutive error-severity dialing → threshold N → error.
    const next = consec + 1;
    if (next >= N) {
      return { footer: "error", lastOrder: order, consec: next };
    }
    // Below threshold: dialing, unless the footer is already error (sticky).
    return {
      footer: footer === "error" ? "error" : "dialing",
      lastOrder: order,
      consec: next,
    };
  }

  // Rule 3b — severity "resyncing" (first_connect / reconnecting) is
  // non-error; kind-first renders `dialing`, never `resyncing`. Keeps an
  // existing error sticky. Resets the counter (a healthy dial).
  return {
    footer: footer === "error" ? "error" : "dialing",
    lastOrder: order,
    consec: 0,
  };
}
