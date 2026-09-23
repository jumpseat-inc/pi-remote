# FLLWUP-24 Implementation Plan — RFC 8628 §3.5 connection-failure slowdown in the device-flow poll loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Errata (PO ruling 2026-09-02, vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md), applied post-review on this PR:** the connection-failure slowdown directive is RFC 8628 **§3.5** ("clients MUST unilaterally reduce their polling frequency before retrying"); §3.2 supplies the 5-second default minimum poll *interval*. The originally predicted sleep sequences (`[2000,5000]`, `[2000,5000,5000]`) were wrong versus reality (`[2000,5000,2000]`, `[2000,5000,2000,5000]`), and expiry is cause-distinguished via a loop-scoped `sawResponse` flag: an all-connection-failure window lands `unreachable`, a window with ≥1 received response lands `timedOut`. The sections below are corrected to match shipped reality; the card's title/goal stand as written with the card-face errata note.

**Goal:** When the headless device-flow driver's token poll fails at the connection level (fetch throws), wait 5 seconds and re-poll — within the device-code window — instead of returning terminal `unreachable` immediately. The window-expiry check stays at the top of the loop; at expiry the outcome is cause-distinguished (PO ruling 1): no poll in the window ever received an HTTP response → `unreachable` (existing verbatim copy); at least one poll received a response → `timedOut` (existing verbatim copy).

**Architecture:** Behavioral change inside the poll loop's `catch` block in `runHeadlessLogin` (`src/login.ts`): replace the print + `return { kind: "failure", reason: "unreachable" }` with `await sleep(5_000); continue;`, plus a loop-scoped `sawResponse` flag set after any received HTTP response; the loop-top expiry path dispatches on it. The `for (;;)` loop's top-of-loop checks (cancelled, `elapsed >= expiresIn * 1000`) provide the retry bound; no new reason, no new state beyond the flag. The FLLWUP-22 dispatch table (four RFC 8628 codes on the 400 window) is untouched — the `catch` only fires before a response exists, and no code path that sees a response is affected.

**Tech Stack:** Bun + TypeScript (`bun test`, `bunx tsc --noEmit`).

**Spec:** No design spec (mechanical path). Card FLLWUP-24 `Intent`/`goal`/`Acceptance` are the complete handoff. RFC authority: RFC 8628 §3.5 connection-failure slowdown; §3.2 default minimum poll interval (see [[RFC References]], [[RFC Conformance Posture]]).

## Global Constraints

- No new `LoginReason`; no copy changes — both `login.failure.unreachable` and `login.failure.timedOut` stay verbatim; expiry dispatches between the two existing rows per PO ruling 1 (per [[Stable Keys]] any wording change needs its own product-owner ruling, and none is needed here).
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

- [x] **Fixture A (retry path):** token POST throws once, then succeeds. Assert: outcome `success`; observed sleep sequence `[2000, 5000, 2000]` (interval poll, then the 5s slowdown retry — proves the wait happened on the failure — then the successful interval poll); no `unreachable` copy printed (retry is silent); credential saved.
- [x] **Fixture B (all-connection-failure window):** token POST throws on every attempt with a shortened window (`expires_in: 10`). Assert (per PO ruling 1): outcome `unreachable` (no poll ever received an HTTP response); observed sleep sequence `[2000, 5000, 2000, 5000]` (two in-window retry rounds at interval+5s gaps, then the loop-top expiry fires before any third poll); retries silent — the `unreachable` copy prints exactly once, at expiry.
- [x] Run `bun test test/login.test.ts` — fixtures failed on current code as written (RED observed, commit `365f41e`); Fixture B's outcome expectation was later corrected to `unreachable` by PO ruling 1.

### Task 2: Slowdown retry in the poll catch (GREEN)

**Files:**
- Modify: `src/login.ts` — `runHeadlessLogin` poll loop `catch` block (approx L707–720).

- [x] Replace the catch body's print + terminal return with `await sleep(5_000); continue;`, commented with the RFC 8628 §3.5 basis and FLLWUP-24, and add the loop-scoped `sawResponse` flag dispatched on at the loop-top expiry path (PO ruling 1). Keep everything else in the loop byte-identical.
- [x] Run `bun test` — full suite green.

### Task 3: Spec sync ride-along

**Files:**
- Modify: `docs/PI-SPEC.md` §7.2 headless bullet — the connection-failure slowdown clause (PO ruling 2 text: per RFC 8628 §3.5's requirement that a client encountering connection problems unilaterally reduce its polling frequency before retrying; the 5-second figure is §3.2's default minimum poll interval, adopted as the client's fixed slowdown step) plus the cause-distinguished expiry. Client-behavior sync per AGENTS.md ("keep both specs in sync with any change that affects auth"); no wire-format change, no copy change.

- [x] Run gates: `bun install`, `bunx tsc --noEmit` (exit 0), `bun test` (0 fail). Push branch, update PR against `main`.
