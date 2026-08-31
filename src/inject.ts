import type { InboundEnvelope } from "./transport";
import type { TextMessageStartFrame } from "./translate";

// ---------------------------------------------------------------------------
// DeliverAs decision (pure) — spec §1.1, §1.2
// ---------------------------------------------------------------------------

export type DeliverAs = "steer" | "followUp";

const VALID_INTENTS = new Set<string>(["steer", "followUp"]);

/**
 * Pure decision: the deliverAs for an injection, given the SDK's isStreaming
 * read at injection time and the optional wire intent (runtime-validated name).
 * NEVER returns an undefined deliverAs while streaming (never-throw property):
 * streaming + steer|unknown|absent → steer; streaming + followUp → followUp;
 * idle → no deliverAs.
 */
export function pickDeliverAs(isStreaming: boolean, intent?: string): { deliverAs?: DeliverAs } {
  if (!isStreaming) return {};
  if (intent === "followUp") return { deliverAs: "followUp" };
  return { deliverAs: "steer" };
}

/** Validate the wire intent (`name` on TEXT_MESSAGE_START) against exactly {steer, followUp}; absent/unknown → undefined. */
function validateName(name: unknown): DeliverAs | undefined {
  if (typeof name === "string" && VALID_INTENTS.has(name)) return name as DeliverAs;
  return undefined;
}

// ---------------------------------------------------------------------------
// Result + deps + surface — spec §1.1
// ---------------------------------------------------------------------------

export type InjectResult =
  | { kind: "ignored" }
  | { kind: "injected"; deliverAs?: DeliverAs }
  | { kind: "resolved"; promptId: string; direct: true; deviceId?: string }
  | { kind: "steered_fallback"; promptId: string; text: string; direct: false; deviceId?: string; reason: "mode" }
  | { kind: "stale"; promptId: string; deviceId?: string };

export interface InjectDeps {
  /** Inject remote text into the live session, pi-side. */
  sendUserMessage: (content: string, opts?: { deliverAs?: DeliverAs }) => Promise<void>;
  /** SDK run-state at injection time (same synchronous tick as sendUserMessage). */
  isStreaming: () => boolean;
  /**
   * TEST-ONLY SEAM (R3, Side B). In production this returns false, so every
   * approval answer that would need direct resolution falls back to steer.
   * A future post-epic card (only if pi exposes a public resolve API) may
   * wire it live; EV-6 does not.
   */
  resolvePendingPrompt: (promptId: string, result: unknown, deviceId?: string) => boolean | Promise<boolean>;
  /** Emit an outbound CUSTOM control frame back to the remote client. */
  emitCustom: (name: string, value: unknown) => void;
  /** R2 loud-once session flag (optional; defaults to internal instance boolean). */
  hasAnnouncedFallback?: () => boolean;
  markAnnouncedFallback?: () => void;
}

export interface Injector {
  /** Process one inbound envelope frame. NEVER throws. */
  handle(env: InboundEnvelope): Promise<InjectResult>;
  /**
   * Host-side seam, wired by EV-8: register a raised pending human-input
   * prompt and return its per-promptId occurrence number (R1). Called
   * alongside the outbound `pi.human_input` raise.
   */
  registerPrompt(input: { promptId: string; kind: string; prompt: string }): { occurrence: number };
}

export function createInjector(deps: InjectDeps): Injector {
  // Session-bound message-assembly buffer (messageId → assembly).
  const buffer = new Map<string, { role: string; name?: DeliverAs; parts: string[] }>();
  // R1: (promptId → occurrence → pending entry) registry.
  const pending = new Map<string, Map<number, { settled: boolean; winnerDeviceId?: string }>>();
  const promptCounter = new Map<string, number>();
  // R2: loud-once fallback session flag (defaulted to internal instance boolean).
  let announcedFallback = false;
  const hasAnnounced = deps.hasAnnouncedFallback ?? (() => announcedFallback);
  const markAnnounced = deps.markAnnouncedFallback ?? (() => { announcedFallback = true; });

  const FALLBACK_STATEMENT =
    "This reply was surfaced as a steering message instead of being delivered directly: this host cannot resolve the pending prompt directly.";

  /** R2: emit the loud-once notice on the first fallback-to-steer occurrence per session. */
  function announceOnce(promptId: string): void {
    if (hasAnnounced()) return;
    markAnnounced();
    deps.emitCustom("pi.human_input.fallback_to_steer", { promptId, statement: FALLBACK_STATEMENT });
  }

  /** Steering fallback, never dropped: sendUserMessage then the R2 loud-once notice. */
  function fallback(promptId: string, response: string, deviceId: string | undefined): InjectResult {
    const deliverAs = deps.isStreaming() ? "steer" : undefined;
    void deps.sendUserMessage(response, { deliverAs }).catch(() => {});
    announceOnce(promptId);
    return { kind: "steered_fallback", promptId, text: response, direct: false, deviceId, reason: "mode" };
  }

  async function handleApprovalResponse(value: unknown, deviceId: string | undefined): Promise<InjectResult> {
    const valueObj = value as { pi?: string; data?: unknown } | null;
    const data = valueObj?.data;
    if (typeof data !== "object" || data === null) return { kind: "ignored" };
    const d = data as Record<string, unknown>;
    if (typeof d.promptId !== "string" || d.promptId.length === 0) return { kind: "ignored" };
    if (typeof d.occurrence !== "number" || !Number.isFinite(d.occurrence)) return { kind: "ignored" };
    if (!("response" in d)) return { kind: "ignored" };
    const promptId = d.promptId;
    const occurrence = d.occurrence;
    const response = String(d.response);

    const byOccurrence = pending.get(promptId);
    const entry = byOccurrence?.get(occurrence);
    if (!entry) {
      // Unknown (promptId/occurrence) — belongs to another extension or never observed.
      // Steering fallback, never dropped (R3 permanent).
      return fallback(promptId, response, deviceId);
    }
    if (entry.settled) {
      // Stale: a late/losing race answer. Surface it, do NOT re-inject, no R2 notice.
      deps.emitCustom("pi.human_input.stale", { promptId, winnerDeviceId: entry.winnerDeviceId });
      return { kind: "stale", promptId, deviceId };
    }
    // Live: this device wins (first-wins). Consume and record the winner deviceId.
    entry.settled = true;
    entry.winnerDeviceId = deviceId;
    const direct = await deps.resolvePendingPrompt(promptId, response, deviceId);
    if (direct === true) {
      // Only reachable through the fixture seam in tests (R3) — production always falls back.
      return { kind: "resolved", promptId, direct: true, deviceId };
    }
    return fallback(promptId, response, deviceId);
  }

  async function handle(env: InboundEnvelope): Promise<InjectResult> {
    try {
      const frame = env.frame;
      const deviceId = env.deviceId;
      if (frame === null) return { kind: "ignored" };
      if (frame.type === "TEXT_MESSAGE_START") {
        const start = frame as TextMessageStartFrame & { name?: string };
        if (typeof start.messageId !== "string") return { kind: "ignored" };
        if (start.role !== "user") return { kind: "ignored" };
        buffer.set(start.messageId, { role: start.role, name: validateName(start.name), parts: [] });
        return { kind: "ignored" };
      }
      if (frame.type === "TEXT_MESSAGE_CONTENT") {
        const a = buffer.get(frame.messageId);
        if (!a) return { kind: "ignored" };
        a.parts.push(frame.delta);
        return { kind: "ignored" };
      }
      if (frame.type === "TEXT_MESSAGE_END") {
        const a = buffer.get(frame.messageId);
        if (!a) return { kind: "ignored" };
        buffer.delete(frame.messageId);
        if (a.role !== "user") return { kind: "ignored" };
        const text = a.parts.join("");
        const deliverAs = pickDeliverAs(deps.isStreaming(), a.name).deliverAs;
        await deps.sendUserMessage(text, deliverAs === undefined ? undefined : { deliverAs });
        return { kind: "injected", deliverAs };
      }
      if (frame.type === "CUSTOM" && frame.name === "pi.human_input.response") {
        return handleApprovalResponse(frame.value, deviceId);
      }
      return { kind: "ignored" };
    } catch {
      return { kind: "ignored" };
    }
  }

  function registerPrompt(input: { promptId: string; kind: string; prompt: string }): { occurrence: number } {
    const next = (promptCounter.get(input.promptId) ?? 0) + 1;
    promptCounter.set(input.promptId, next);
    let byOccurrence = pending.get(input.promptId);
    if (!byOccurrence) {
      byOccurrence = new Map();
      pending.set(input.promptId, byOccurrence);
    }
    byOccurrence.set(next, { settled: false });
    return { occurrence: next };
  }

  return { handle, registerPrompt };
}
