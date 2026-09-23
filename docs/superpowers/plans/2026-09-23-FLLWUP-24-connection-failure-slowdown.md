# FLLWUP-24 Implementation Plan — RFC 8628 §3.2 connection-failure slowdown in the device-flow poll loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the headless device-flow driver's token poll fails at the connection level (fetch throws), wait 5 seconds and re-poll — within the device-code window — instead of returning terminal `unreachable`. The window-expiry check stays at the top of the loop, so a window that expires during retries lands `timedOut`.

**Architecture:** One-line-ish behavioral change inside the poll loop's `catch` block in `runHeadlessLogin` (`src/login.ts`, approx L707–720): replace the print + `return { kind: "failure", reason: "unreachable" }` with `await sleep(5_000); continue;`. The `for (;;)` loop's top-of-loop checks (cancelled, `elapsed >= expiresIn * 1000` → `timedOut`) already provide the retry bound; no new reason, no new state. The FLLWUP-22 dispatch table (four RFC 8628 codes on the 400 window) is untouched — the `catch` only fires before a response exists, and no code path that sees a response is affected.

**Tech Stack:** Bun + TypeScript (`bun test`, `bunx tsc --noEmit`).

**Spec:** No design spec (mechanical path). Card FLLWUP-24 `Intent`/`goal`/`Acceptance` are the complete handoff. RFC authority: RFC 8628 §3.2/§3.5 connection-failure slowdown (see [[RFC References]], [[RFC Conformance Posture]]).

## Global Constraints

- No new `LoginReason`; no copy changes (`login.failure.unreachable` stays verbatim — it fires rarer; per [[Stable Keys]] any wording change needs its own product-owner ruling, and none is needed here).
- The four-code dispatch (`authorization_pending`/`slow_down`/`expired_token`/`access_denied`) and the FLLWUP-22 400-window table are unchanged; the FLLWUP-22 suite must stay green untouched.
- The device-authorization POST's connection failure (before the poll loop) still returns terminal `unreachable` — the card scopes the token **poll** only.
- The retry is silent: no print on the connection-failure retry path.
- The cancelled check before the poll fetch and the top-of-loop `ctl.cancelled` check remain — cancellation during the 5s slowdown sleep still lands `cancelled` at the next loop top.
- Do NOT touch `index.ts` or the command surface (BUG-1 owns that).
- Gates in order: (1) `bunx tsc --noEmit` exit 0; (2) `bun test` full suite green (baseline 221 pass / 1 skip / 0 fail; nothing may flip except the intended new tests).
- Conventional Commits (repo AGENTS.md); scope `login`. Test-first with a red commit before the green.

---

### Task 1: Fixtures for the retry path and the expiry boundary (test first — RED)

**Files:**
- Modify: `test/login.test.ts` — new describe block `FLLWUP-24: RFC 8628 §3.2 connection-failure slowdown`, reusing `makeControl` / `makeFetch` / `headlessDeps` / `captureLog`; a throwing fetch wrapper simulates the connection-level failure at the token endpoint.

- [ ] **Fixture A (retry path):** token POST throws once, then succeeds. Assert: outcome `success`; sleep sequence `[2000, 5000]` (interval poll, then the 5s slowdown retry — proves the wait happened on the failure); no `unreachable` copy printed (retry is silent); credential saved.
- [ ] **Fixture B (expiry boundary):** token POST throws on every attempt with a shortened window (`expires_in: 10`). Assert: outcome `timedOut` (the loop-top expiry check, not `unreachable`); sleep sequence `[2000, 5000, 5000]` (two in-window retries, terminal only once elapsed crosses the window); no `unreachable` copy printed.
- [ ] Run `bun test test/login.test.ts` — both new fixtures fail on current code with reason `unreachable` (RED observed). Commit red.

### Task 2: Slowdown retry in the poll catch (GREEN)

**Files:**
- Modify: `src/login.ts` — `runHeadlessLogin` poll loop `catch` block (approx L707–720).

- [ ] Replace the catch body's print + terminal return with `await sleep(5_000); continue;`, commented with the RFC 8628 §3.2/§3.5 basis and FLLWUP-24. Keep everything else in the loop byte-identical.
- [ ] Run `bun test` — full suite green (baseline + 2 new fixtures).

### Task 3: Spec sync ride-along

**Files:**
- Modify: `docs/PI-SPEC.md` §7.2 headless bullet — one clause noting the connection-failure slowdown (§3.2: wait 5 seconds and re-poll within the window; terminal `unreachable` only when the window expires). Client-behavior sync per AGENTS.md ("keep both specs in sync with any change that affects auth"); no wire-format change, no copy change.

- [ ] Run gates: `bun install`, `bunx tsc --noEmit` (exit 0), `bun test` (0 fail). Push branch, open PR against `main`.
