# EV-3 — Outbound wss Transport with seq-ack Envelope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development (implement each task test-first). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `src/transport.ts` — the single WS network module that dials the relay over `wss://` (accepting `ws://` for the in-repo fake), wraps every AG-UI event in a `{v, seq, ack, frame}` envelope with a monotonic extension-owned `seq`, echoes the highest processed inbound `seq` as `ack`, heartbeats via native WS control-frame `ping`, and reconnects with capped exponential backoff + full jitter under a stable session-scoped connection id — landing `test/transport.test.ts` against a Bun-native fake WS server (no Mongo, no real relay).

**Architecture:** `createTransport(deps)` returns a lifecycle `TransportHandle` (`connect/disconnect/send/getId`). Envelope construction is a pure `envelope(seq, ack, frame)`; backoff is a pure `nextBackoff(attempt, base, max, rng)`. All network/clock/randomness/ids are injected (`WebSocket, now, sleep, rng, newId, rearm`). The transport is a pure-ish state machine with a self-perpetuating `dialLoop` that never gives up (retry-forever at capped backoff), emits a typed status-event stream `{kind: "dialing"|"live", connectionId, severity, order, reason?, attempt?, since?}` (CLOSED `reason` 5-value taxonomy, no `kind:"error"`), and never calls `setStatus`/`fetch`. A deliberate `disconnect()` is a local close (no auto-reconnect); a relay/network death is a network close (reconnect, after calling injected `rearm()` per dial attempt ≥ 2).

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `bundler` resolution), Bun (`bun test`, `bunx tsc --noEmit`), Bun native `WebSocket`/`Bun.serve` for the fake relay.

**Spec:** `docs/superpowers/specs/2026-08-31-EV-3-design.md` — the ONLY authoritative handoff. The plan argues from that spec's §1.1–§1.6, §2 public surface, and §3.1/§3.2 test list.

## Global Constraints

- **Envelope (§1.3):** `{v: 1, seq, ack, frame}`; `seq` = extension-owned monotonic `outboundSeq`, assigned at write time inside `send` (a dropped frame never consumes a seq → no gaps); `ack` = `inboundSeq` watermark (highest inbound seq dispatched to the consumer). Invariant: "consecutive over emitted frames".
- **Typed state-event seam (§1.1):** `kind` is CLOSED to `"dialing" | "live"` — there is NO `kind:"error"` event. `reason` is CLOSED to the five values `first_connect | reconnecting | relay_unreachable | protocol_violation | url_expired`. `severity` (`"error"|"live"|"resyncing"`, EV-2 convention) and `order` (monotonic gap-free ordinal) are ALWAYS present. Transport NEVER calls `setStatus`, NEVER writes the footer, NEVER calls `fetch`.
- **Retry-forever (§1.2):** the backoff loop never gives up for the life of the instance (no give-up-after-N). `delay(attempt) = min(backoffMax, backoffBase * 2^(attempt-1))` as ceiling with full jitter `rng`; backoff resets on a successful open. `disconnect()` is a local close and MUST NOT auto-reconnect; a network close MUST reconnect.
- **Re-arm seam (§1.4):** transport calls injected `rearm(): Promise<CreateTunnelResult>` once per dial attempt ≥ 2, inside the backoff loop (after the backoff sleep). First connect does NOT call `rearm` (EV-8 hands the initial `{url, expiresAt}`). Transport re-checks the URL is a WS scheme (defensive; accepts `ws:`/`wss:` — tests use `ws://` against Bun.serve) and refuses to dial past `expiresAt`. `getId()` returns the session id; transport never imports `tunnel.ts` (only the `CreateTunnelResult` type).
- **Heartbeat (§1.5):** native WS control-frame `ping`, below the framing layer. Bun client has a callable `.ping()` and NO `pong` event — dead-peer detection rides `close`/`error` + next failed `send`.
- **Injection & purity (§1.6):** all network/clock/randomness injected; no module-level mutable state; importing `transport.ts` has no side effects; no `fetch(` anywhere in `src/transport.ts`. Live frames get a UUID `frame.id` via injected `newId`; `send` leaves a pre-existing `frame.id` untouched (replay dedupe).
- **Touch list (exhaustive):** `src/transport.ts` (new), `test/transport.test.ts` (new), `docs/superpowers/plans/2026-08-31-EV-3-implementation.md` (this plan). Nothing else. Do NOT edit `docs/PI-SPEC.md` (R3 deferred to FLLWUP-2). Do NOT touch `translate.ts`/`tunnel.ts`.
- **Worktree:** `.worktrees/ev-3-transport` on branch `ev-3-transport`, created from `main` (118a9da). Never commit on `main`.
- **Gates (this card; override generic owner gates — no Mongo, no import smoke, no boot):**
  1. `bunx tsc --noEmit` — MUST be clean (exit 0).
  2. `bun test` — the 40 existing tests stay green PLUS the new `test/transport.test.ts` (exit 0). Fake the WS server in-repo via Bun native `WebSocket`/`Bun.serve`.
  Run `bun` (not npm). Every `bash` call carries an explicit `timeout`. Never start a foreground server.

---

### Task 1: Write the failing transport test suite (RED)

**Files:**
- Create: `test/transport.test.ts`

**Interfaces:**
- Consumes: the module API from the spec §1/§2 / §3.1 — `createTransport`, `envelope`, `nextBackoff`, types `TransportStatusEvent`, `TransportEnvelope`, `InboundEnvelope`, `TransportHandle`, `TransportDeps`, `TransportReason`, `TransportKind`, `TransportSeverity`. Nothing real imported yet — the file will fail to compile/resolve (RED).
- Produces: the full fixture suite Task 3 must make green. This IS the §3.1 acceptance in executable form.

- [ ] **Step 1: Build the fake-WS harness**

Write `test/transport.test.ts` starting with a `startFakeServer(options)` helper built on `Bun.serve` that: tracks connections, records inbound messages, counts pings, and can simulate relay death (`closeAll(code)`) and idle-timeout closure. See the reference content in Task 3 for the exact harness code.

- [ ] **Step 2: Write the nine fixture groups (§3.1 tests 1–9)**

1. `envelope` pure shape + strictly-increasing consecutive outbound seq via `send` + inbound `ack` watermark feeding the next outbound `ack`.
2. `nextBackoff` with fixed `rng = 1` returns `min(max, base*2^(attempt-1))` strictly increasing to `max`; uniform rng lands in `[0, ceiling]`; resets after a successful open (observed through a live cycle).
3. Relay kill (server closes the socket) → `rearm()` called for a fresh URL, re-dials, resumes `live` under the same `getId()`; measured `now()` deltas non-decreasing; loop never exits on its own (rearm keeps being called; no give-up).
4. Reconnect event sequence: `{"kind":"dialing", reason:"reconnecting"}` then `{"kind":"live"}`; NEVER a `kind:"error"` event; every `reason` drawn from the closed 5-value set.
5. Live outbound frames carry a UUID `frame.id` (regex, distinct); a pre-existing `frame.id` is left untouched; static guard: `translate.ts` has no `new WebSocket(` / `wss?://` dial.
6. Heartbeat: server with `idleTimeout` < heartbeat interval → after idle the socket is still OPEN with pings recorded server-side; a dead peer (socket closed / failed send) tears down and reconnect fires.
7. Local `disconnect()` does NOT auto-reconnect; network close DOES (two-close-types distinction).
8. `transport.ts` contains no `fetch(`; importing it has no side effects.
9. The O2 merge-policy fixture: an EV-8-style "highest-severity-wins, errors seen & acknowledged" merge runs against the implemented event shape using `severity` + `order` as primitives and exercising `reason`/`attempt`/`since`/`connectionId`.

- [ ] **Step 3: Confirm RED**

Run: `bun test test/transport.test.ts` — Expected: fails to resolve/compile `../src/transport`. Record the actual error.

---

### Task 2: Implement `src/transport.ts` (GREEN)

**Files:**
- Create: `src/transport.ts`

**Interfaces:**
- Consumes: `type AgUiFrame` from `./translate`, `type CreateTunnelResult` from `./tunnel`.
- Produces: the exports in §2 — `TransportDeps`, `TransportHandle`, `createTransport`, plus the type surface (§1.1/§1.3) and the pure helpers `envelope`, `nextBackoff`.

- [ ] **Step 1: Write the failing minimal type surface test**

```ts
import { createTransport, envelope, nextBackoff } from "../src/transport";
test("createTransport exists and returns a handle", () => {
  const t = createTransport({ sessionId: "s", rearm: async () => ({tunnelId:"t",url:"ws://x",expiresAt:0}), WebSocket, onEvent: () => {}, onInbound: () => {} });
  expect(typeof t.connect).toBe("function");
  expect(typeof t.disconnect).toBe("function");
  expect(typeof t.send).toBe("function");
  expect(t.getId()).toBe("s");
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test` — Expected: module-not-found / types missing (RED).

- [ ] **Step 3: Implement the module**

Write the full `src/transport.ts` per the spec §1.1–§1.6/§2. The reference implementation (types, pure `envelope`, pure `nextBackoff`, `severityFor`, `parseInbound`, `createTransport` with the `dialLoop` / `send` / `disconnect` / `connect` mechanics) is given verbatim in Task 3's reference block. Defensive URL check accepts `ws:` and `wss:` schemes (tests dial `ws://` against Bun.serve; production URLs are always `wss://` from EV-2 `createTunnel` validation).

- [ ] **Step 4: Verify GREEN for the slice**

Run: `bun test test/transport.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/transport.ts test/transport.test.ts
git commit -m "feat(transport): outbound wss transport with seq-ack envelope (EV-3)"
```

---

### Task 3: Full gate sweep — hard stop

**Files:** none modified.

- [ ] **Step 1: Typecheck (gate 1)**

```bash
bunx tsc --noEmit; echo "tsc exit: $?"
```
Expected: exit 0, no output.

- [ ] **Step 2: Full test suite (gate 2)**

```bash
bun test; echo "bun-test exit: $?"
```
Expected: exit 0; the 40 existing tests stay green and `test/transport.test.ts` passes.

- [ ] **Step 3: Static guards**

```bash
grep -n 'fetch(' src/transport.ts   # exit 1 (transport has no fetch)
grep -nE 'WebSocket\(|wss?://' src/translate.ts   # exit 1 (O3 no-socket gate)
```
Record every stdout + exit code. A failing grep is a hard stop: fix, re-run.

- [ ] **Step 4: Confirm touch list**

```bash
git status --short
git diff --stat
```
Expected: only `src/transport.ts`, `test/transport.test.ts`, this plan.

---

### Task 4: Commit the plan, push, open PR (no merge)

- [ ] **Step 1: Commit the plan**

```bash
git add docs/superpowers/plans/2026-08-31-EV-3-implementation.md
git commit -m "docs: add EV-3 implementation plan"
```

- [ ] **Step 2: Final full verification pass**

Re-run the Task-3 gate sweep AFTER all commits so the committed state is verified.

- [ ] **Step 3: Push**

```bash
git push -u origin ev-3-transport
```
Do NOT push `main`.

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --head ev-3-transport \
  --title "feat(transport): outbound wss transport with seq-ack envelope (EV-3)" \
  --body "Carries src/transport.ts (typed status-event seam dialing|live, closed 5-value reason taxonomy, three-numbers seq/ack contract, write-time seq assignment, injected newId UUID stamping, native WS control-frame-ping heartbeat, retry-forever capped exponential backoff + jitter, re-arm seam via injected rearm, never calls setStatus/fetch) and test/transport.test.ts (fake WS server via Bun.serve). Gates: bunx tsc --noEmit clean; bun test green (existing 40 + new suite). R3 (§8 note) deferred to FLLWUP-2 — no PI-SPEC edit."
```

Record the PR number/URL. Do NOT merge. Do not poll CI.

- [ ] **Step 5: Report**

Report: worktree path, branch name, PR number/URL, PR head commit SHA, full `bunx tsc --noEmit` result, full `bun test` summary (total pass/fail), and a 2–4 sentence summary of what was implemented and any deviation (there should be none beyond the spec — note the `ws://` acceptance required by the in-repo fake relay, which is not a production behavior change since EV-2 validates `wss://`).
