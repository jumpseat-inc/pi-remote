# EV-6 — Remote Input Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development (implement each task test-first). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `src/inject.ts` (pure module: `pickDeliverAs`, `InjectResult`, `InjectDeps`, `Injector`, `createInjector`) that converts inbound AG-UI user-message frames into `pi.sendUserMessage` calls with the correct `deliverAs` mode for idle / mid-stream / queued input, and resolves pending human-input prompts with the sending `deviceId` recorded; additively widen `TextMessageStartFrame` with `name?: string` in `src/translate.ts` (one line, no existing mapping/test change); create `test/inject.test.ts` (+ fixtures if needed); sync `docs/PI-SPEC.md` §5.4 only. No wiring into `src/index.ts` (EV-8). Closing binding rulings: **R1** (promptId, occurrence) registry scoping, **R2** loud-once fallback notice, **R3** (Side B) steering fallback is permanent; `resolvePendingPrompt` is a TEST-ONLY fixture seam.

**Architecture:** inject.ts is a pure, STATELESS-of-globals module with an injected-deps factory (`createInjector(deps)`). Instance state only: a session-bound message-assembly buffer (`messageId → { role, name?, parts[] }`), the (promptId → occurrence) pending registry, and the R2 "announced this session" boolean (default to internal instance flag). Remote user messages assemble across `TEXT_MESSAGE_START → CONTENT* → END` and inject at END with `deliverAs = pickDeliverAs(deps.isStreaming(), validateName(start.name))`. Approval responses arrive as inbound `CUSTOM pi.human_input.response { value.data: { promptId, occurrence, response } }`, matched by (promptId, occurrence) against the registry, `deviceId` read from the envelope; live→resolvePendingPrompt (fixture) or steering fallback, stale→not delivered (emit `pi.human_input.stale`), unknown→steering fallback. Never throws; never register an `input` handler; never return `action:"handled"/"transform"` (replay-correct negative invariant).

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, bundler), Bun (`bun test`, `bunx tsc --noEmit`), git worktree isolation (`.worktrees/ev-6-inject`, branch `ev-6-inject`).

**Spec:** `docs/superpowers/specs/2026-08-31-EV-6-design.md` (binding). Contract: `docs/PI-SPEC.md` §5.4. Commits follow AGENTS.md (Conventional Commits; scopes `inject`/`translate`/`test`/`docs`).

## Global Constraints

- **Typecheck:** `bunx tsc --noEmit` exits 0 (strict) — run before and after every task.
- **Tests:** `bun test` — the existing **62** tests stay green plus new EV-6 tests. No Mongo; in-repo fixtures only.
- **translate.ts additive only (§1 "Files touched"):** widen `TextMessageStartFrame` with `name?: string`; no existing mapping/test change.
- **Determinism:** no `crypto.randomUUID` / `Date.now` / `Math.random` in `inject.ts`; registry and buffer use only wire-carried values.
- **Negative invariant (§3.3):** `src/inject.ts` contains no `pi.on("input")` / `emitInput` / `action: "handled"` / `action: "transform"` (static grep).
- **No scope beyond the spec:** no `src/index.ts` wiring (EV-8); do NOT remove the dead `user_input` PiEvent (FLLWUP-candidate); `resolvePendingPrompt` stays a test-only seam (R3). No merge; push branch + open PR only.

---

### Task 1: Widen `TextMessageStartFrame` with `name?: string` (additive)

**Files:**
- Modify: `src/translate.ts` (one-line additive widening)
- No test change required (existing 62 stay green); widening is exercised by EV-6 tests.

- [ ] **Step 1: Implement the one-line widening**
```ts
export interface TextMessageStartFrame {
  type: "TEXT_MESSAGE_START";
  messageId: string;
  role: "assistant" | "user";
  /** pi-remote extension convention (§5.4): delivery-intent "steer" | "followUp"; absent/unknown = idle-decided (mid-stream default steer). */
  name?: string;
}
```
- [ ] **Step 2: Verify GREEN + no regressions**: `bun test` (all 62 green) and `bunx tsc --noEmit`.
- [ ] **Step 3: Commit**
```bash
git add src/translate.ts
git commit -m "feat(translate): add optional name field to TextMessageStartFrame (EV-6)"
```

---

### Task 2: inject.ts — pure module (TDD)

**Files:**
- Create: `src/inject.ts`
- Test: `test/inject.test.ts`
- Create fixtures if needed (none expected — pure module with injected deps)

**Interfaces:**
- Consumes: `InboundEnvelope` from `../src/transport`, `AgUiFrame` / `TextMessageStartFrame` from `../src/translate`.
- Produces: `DeliverAs`, `pickDeliverAs`, `InjectResult`, `InjectDeps`, `Injector`, `createInjector` (all per spec §1.1).

- [ ] **Step 1: Write the failing tests** (`test/inject.test.ts`) — covering:

*R1 / never-throw / pickDeliverAs truth table (§1.1, §4):*
- idle (isStreaming=false) → `{}` for steer, followUp, undefined.
- streaming + `"followUp"` → `{ deliverAs: "followUp" }`.
- streaming + `"steer"` → `{ deliverAs: "steer" }`; streaming + `undefined` → `{ deliverAs: "steer" }`; streaming + unknown value → `{ deliverAs: "steer" }`.
- never-throw: a fake `sendUserMessage` mirroring the SDK's throw (throw when `isStreaming && deliverAs === undefined`) driven across all streaming cases never throws (a `pickDeliverAs` assertion + an end-to-end `handle` assertion).

*User-message injection (§1.2, §4):*
- idle: START(role user,"m1")/CONTENT/CONTENT/END → exactly one `sendUserMessage("Hello! world")`, `deliverAs === undefined` (options absent/undefined), and no call before END.
- streaming + `name:"steer"` → `sendUserMessage(text, { deliverAs: "steer" })`.
- streaming + `name:"followUp"` → `sendUserMessage(text, { deliverAs: "followUp" })`.
- streaming with absent `name` → `sendUserMessage(text, { deliverAs: "steer" })` (never reach pi undeliverAs'd while streaming).
- non-user role (`role:"assistant"`) → `{ kind: "ignored" }`, zero `sendUserMessage`.
- malformed: `TEXT_MESSAGE_CONTENT`/`END` for an unopened `messageId` → `{ kind: "ignored" }`, zero calls; START with non-string `messageId` → ignored, no throw.
- deviceId is never smuggled into text (assembled text = content only; the envelope deviceId does not appear in the sent string).

*Approval resolution (§1.3, R1, R2, R3, §4):*
- `registerPrompt` R1 scoping: two identical prompts → occurrences 1 and 2; resolving (p1, occurrence:2) does not resolve occurrence:1; each stays independently live/stale.
- live → resolved (fixture only, R3): register p1; `resolvePendingPrompt` returns `true`; inbound response (p1, occurrence:1, "yes") → `{ kind:"resolved", promptId:"p1", direct:true, deviceId }`; zero `sendUserMessage`; no R2 notice (not a fallback).
- live → steering fallback (production default, R3): `resolvePendingPrompt` returns `false`; isStreaming=false → `sendUserMessage("yes")` with `deliverAs === undefined`; isStreaming=true → `{ deliverAs:"steer" }`; result `{ kind:"steered_fallback", promptId, text:"yes", direct:false, deviceId, reason:"mode" }`; never dropped.
- **R2 loud-once:** first fallback emits `emitCustom("pi.human_input.fallback_to_steer", { promptId, statement })` where `statement` is a sentence naming the cause class + "surfaced as a steering message"; second fallback in the same session emits no notice (default internal flag); stale does NOT trigger the notice.
- stale → not delivered: register p1, resolve once (consumed), then a second response for (p1, occurrence:1) → `{ kind:"stale", promptId, deviceId }`, emits `emitCustom("pi.human_input.stale", { promptId, winnerDeviceId })`, zero `sendUserMessage`, no R2 notice.
- unknown promptId → steering fallback (never dropped), reason `"mode"`, R2 notice on first.
- deviceId passthrough: envelope `deviceId:"dev1"` forwarded to `resolvePendingPrompt(promptId, response, "dev1")` and into result.deviceId; absent → undefined, still resolves.
- malformed response values → `{ kind:"ignored" }`: empty/non-string promptId, non-finite/non-number occurrence, missing response; zero sendUserMessage, zero emitCustom, no throw.

- [ ] **Step 2: Run to confirm RED** — `bun test test/inject.test.ts` fails (module `../src/inject` not found).

- [ ] **Step 3: Implement** (`src/inject.ts`)

```ts
import type { InboundEnvelope } from "./transport";
import type { AgUiFrame, TextMessageStartFrame } from "./translate";

export type DeliverAs = "steer" | "followUp";
const VALID_INTENTS = new Set<string>(["steer", "followUp"]);

export function pickDeliverAs(isStreaming: boolean, intent?: string): { deliverAs?: DeliverAs } {
  if (!isStreaming) return {};
  if (intent === "followUp") return { deliverAs: "followUp" };
  return { deliverAs: "steer" };
}

function validateName(name: unknown): DeliverAs | undefined {
  if (typeof name === "string" && VALID_INTENTS.has(name)) return name as DeliverAs;
  return undefined;
}

export type InjectResult =
  | { kind: "ignored" }
  | { kind: "injected"; deliverAs?: DeliverAs }
  | { kind: "resolved"; promptId: string; direct: true; deviceId?: string }
  | { kind: "steered_fallback"; promptId: string; text: string; direct: false; deviceId?: string; reason: "mode" }
  | { kind: "stale"; promptId: string; deviceId?: string };

export interface InjectDeps {
  sendUserMessage: (content: string, opts?: { deliverAs?: DeliverAs }) => Promise<void>;
  isStreaming: () => boolean;
  resolvePendingPrompt: (promptId: string, result: unknown, deviceId?: string) => boolean | Promise<boolean>;
  emitCustom: (name: string, value: unknown) => void;
  hasAnnouncedFallback?: () => boolean;
  markAnnouncedFallback?: () => void;
}

export interface Injector {
  handle(env: InboundEnvelope): Promise<InjectResult>;
  registerPrompt(input: { promptId: string; kind: string; prompt: string }): { occurrence: number };
}

const FALLBACK_STATEMENT =
  "This reply was surfaced as a steering message instead of being delivered directly: this host cannot resolve the pending prompt directly.";

interface PendingEntry { settled: boolean; winnerDeviceId?: string; }
interface Assembly { role: string; name?: string; parts: string[]; }

export function createInjector(deps: InjectDeps): Injector {
  const buffer = new Map<string, Assembly>();
  const pending = new Map<string, Map<number, PendingEntry>>();
  const promptCounter = new Map<string, number>();
  let announcedFallback = false;
  const hasAnnounced = deps.hasAnnouncedFallback ?? (() => announcedFallback);
  const markAnnounced = deps.markAnnouncedFallback ?? (() => { announcedFallback = true; });

  function fallback(promptId: string, response: string, deviceId: string | undefined): InjectResult {
    sendSteer(response);
    announceOnce(promptId);
    return { kind: "steered_fallback", promptId, text: response, direct: false, deviceId, reason: "mode" };
  }

  function sendSteer(content: string): void {
    void sendWithDeliverAs(content, deps.isStreaming() ? "steer" : undefined);
  }

  async function sendWithDeliverAs(content: string, deliverAs: DeliverAs | undefined): Promise<void> {
    await deps.sendUserMessage(content, deliverAs === undefined ? { deliverAs: undefined } : { deliverAs });
  }

  function announceOnce(promptId: string): void {
    if (hasAnnounced()) return;
    markAnnounced();
    deps.emitCustom("pi.human_input.fallback_to_steer", { promptId, statement: FALLBACK_STATEMENT });
  }

  async function handleUserMessage(frame: TextMessageStartFrame & { name?: string }, deviceId: string | undefined): Promise<InjectResult> {
    if (typeof frame.messageId !== "string") return { kind: "ignored" };
    if (frame.role !== "user") return { kind: "ignored" };
    buffer.set(frame.messageId, { role: frame.role, name: validateName(frame.name), parts: [] });
    return { kind: "ignored" };
  }
  // ... (assembly handled across START/CONTENT/END in handle below)

  async function handleResponse(value: unknown, deviceId: string | undefined): Promise<InjectResult> {
    // validate promptId, occurrence, response
    const data = (value as { pi?: string; data?: unknown })?.data;
    if (data === undefined || typeof data !== "object" || data === null) return { kind: "ignored" };
    const d = data as Record<string, unknown>;
    if (typeof d.promptId !== "string" || d.promptId.length === 0) return { kind: "ignored" };
    if (typeof d.occurrence !== "number" || !Number.isFinite(d.occurrence)) return { kind: "ignored" };
    if (!("response" in d)) return { kind: "ignored" };
    const promptId = d.promptId;
    const occurrence = d.occurrence;
    const response = String(d.response);

    const byOccurrence = pending.get(promptId);
    if (!byOccurrence) {
      // unknown promptId → steering fallback, never dropped
      return fallback(promptId, response, deviceId);
    }
    const entry = byOccurrence.get(occurrence);
    if (!entry) {
      // unknown occurrence → not a known pending prompt → fallback
      return fallback(promptId, response, deviceId);
    }
    if (entry.settled) {
      // stale: late/losing race answer — surface, NOT delivered, no R2 notice
      deps.emitCustom("pi.human_input.stale", { promptId, winnerDeviceId: entry.winnerDeviceId });
      return { kind: "stale", promptId, deviceId };
    }
    entry.settled = true;
    entry.winnerDeviceId = deviceId;
    const direct = await deps.resolvePendingPrompt(promptId, response, deviceId);
    if (direct === true) return { kind: "resolved", promptId, direct: true, deviceId };
    // production: resolvePendingPrompt returns false → steering fallback (R3 permanent)
    return fallback(promptId, response, deviceId);
  }

  async function handle(env: InboundEnvelope): Promise<InjectResult> {
    try {
      const deviceId = env.deviceId;
      const frame = env.frame;
      if (frame === null) return { kind: "ignored" };
      if (frame.type === "TEXT_MESSAGE_START") {
        if (typeof frame.messageId !== "string") return { kind: "ignored" };
        if (frame.role !== "user") return { kind: "ignored" };
        buffer.set(frame.messageId, { role: frame.role, name: validateName(frame.name), parts: [] });
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
        return handleResponse(frame.value, deviceId);
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
    if (!byOccurrence) { byOccurrence = new Map(); pending.set(input.promptId, byOccurrence); }
    byOccurrence.set(next, { settled: false });
    return { occurrence: next };
  }

  return { handle, registerPrompt };
}
```

*(Implementation above is the target shape; the owner writes it test-first so details may be adjusted to satisfy the RED tests while preserving the spec invariants.)*

- [ ] **Step 4: Verify GREEN + no regressions**: `bun test` (62 existing + new green) and `bunx tsc --noEmit`.
- [ ] **Step 5: Negative invariant grep** — `grep -nE 'pi\.on\("input"\)|emitInput|action:\s*"(handled|transform)"' src/inject.ts` → no matches. Also confirm no `randomUUID|Date.now|Math.random` in src/inject.ts.
- [ ] **Step 6: Commit**
```bash
git add src/inject.ts test/inject.test.ts
git commit -m "feat(inject): remote input injection with steering fallback (EV-6)"
```

---

### Task 3: PI-SPEC §5.4 sync (only)

**Files:**
- Modify: `docs/PI-SPEC.md` — **§5.4 only**.

- [ ] **Step 1: Add §5.4 wire-contract + permanence notes beneath the table and the `input` event paragraph** (spec §1.5):
  1. **Intent field** (`name` on `TEXT_MESSAGE_START`; absent/unknown idle-decided, mid-stream default `steer`).
  2. **Approval response frame** (`CUSTOM pi.human_input.response`, `value.data: { promptId, occurrence, response }`, matched against the (promptId → occurrence) pending registry; `deviceId` taken from the envelope).
  3. **Permanent steering fallback (R3)** — direct resolution not wired; response surfaced via `sendUserMessage` as a steering message (§5.4 row 4), loud-once `pi.human_input.fallback_to_steer` notice (R2); stale answers surfaced as `pi.human_input.stale`, not delivered. PI-SPEC is the durable record that this is permanent behavior.
- [ ] **Step 2: Verify blast radius** — `git diff docs/PI-SPEC.md | grep -E '^@@'` shows hunks confined to §5.4 only.
- [ ] **Step 3: Commit**
```bash
git add docs/PI-SPEC.md
git commit -m "docs: sync §5.4 with EV-6 inject wire contracts + permanent steering fallback (R2/R3)"
```

---

### Task 4: Full gate sweep + plan commit + push + PR

- [ ] **Step 1: Typecheck** — `bunx tsc --noEmit` (exit 0, no output). Record exit code.
- [ ] **Step 2: Full tests** — `bun test` (exit 0; all 62 existing + new EV-6 green). Record pass/fail counts.
- [ ] **Step 3: Negative invariant** — re-run the static grep from §3.3 (no `pi.on("input")`/`emitInput`/`action:"handled"/"transform"` in `src/inject.ts`); confirm §5.4-only diff.
- [ ] **Step 4: Commit the plan** — `git add docs/superpowers/plans/2026-08-31-EV-6-implementation.md && git commit -m "docs: add EV-6 implementation plan"`.
- [ ] **Step 5: Re-verify committed state** — repeat Steps 1–2 after the plan commit.
- [ ] **Step 6: Push + PR (no merge)** — `git push -u origin ev-6-inject`; `gh pr create --base main --head ev-6-inject --title "feat(inject): remote input injection with steering fallback (EV-6)" --body "<summary, gates evidence>"`. Record PR number + head SHA. Do NOT merge, do NOT poll CI.
