# FLLWUP-28: Pin cancellation during the device-flow slowdown wait — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one committed fixture to `test/login.test.ts` that cancels the headless device-flow driver while it is inside the 5-second §3.5 slowdown sleep and asserts outcome `cancelled`, no failure copy, and no token poll after the cancel signal.

**Architecture:** Pure test addition — no product change. The fixture drives `runHeadlessLogin(deps, ctl)` with a directly-owned `ctl` object and sets `ctl.cancelled = true` from the injected `sleep` seam the first time `ms === 5000` (the slowdown sleep). The poll `catch` in `src/login.ts` (~749–757) awaits that sleep; the loop-top `if (ctl.cancelled) return { kind: "cancelled" }` (~710) honors the signal on the next iteration, before any further poll.

**Tech Stack:** Bun + `bun:test`, existing `test/login.test.ts` harness (`makeControl`, `makeFetch`, `fakeJwt`, `captureLog`, `tempConfigDir`, `loginEndpointRequestLog`).

**Spec:** Council card FLLWUP-28 (Intent/goal quoted in the dispatch; no design spec — Direct EV-70 owner-only lane). Mechanism source: `src/login.ts:710–757`; doctrine: vault wiki `[[login.ts]]`, `[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]`.

## Global Constraints

- No product behavior or copy changes; diff touches `test/login.test.ts` + this plan doc only.
- Gates (repo has no database/import/boot gate): `bun install`, `bunx tsc --noEmit` (exit 0), `bun test` (green).
- Main worktree `/home/tista/codes/pi-remote` is immutable (R-CONV-1); all work in `/home/tista/codes/pi-remote-fllwup-28`, cut from `origin/main` (fb4a39f).
- Red-at-base per `<red_base_convention>`: base `b784540bb6d613e353aeab8195dc7c2665b2afb0` (first parent of FLLWUP-24 merge `d63e942`), self-contained transplanted describe block, detached worktree removed after the run, no red test lands.
- Conventional Commits; scope `login` (`test(login): ...`).

## Review Focus

- A refactor that removes the loop-top `ctl.cancelled` check after the slowdown `continue` — the fixture must go red (outcome would flip to a poll-driven outcome), not silently stay green.
- A refactor that moves the slowdown sleep after a subsequent poll — the fixture's "no token poll after cancel" count assertion must go red.
- Failure copy leaking on the slowdown/cancel path (e.g. `Cannot reach` unreachable or `Sign-in timed out` printed before the cancel is honored) — the logs assertions must go red.
- Transplant purity at base: the transplanted block must reference only helpers that exist at `b784540` (no `sanitizeErrorDescription`, no `fetchWithThrow`) or the base run is a copy-set red, not a mechanism red.

---

### Task 1: Write the fixture (head worktree)

**Files:**
- Modify: `test/login.test.ts` (append a new `describe` block after the FLLWUP-24 block)

**Interfaces:**
- Consumes: `runHeadlessLogin(deps, ctl)` second parameter `ctl: { cancelled: boolean }` (src/login.ts:636–638); `Control` fields `simNow`, `onToken`, `tokenEndpoint`, `deviceEndpoint`; harness helpers listed above.
- Produces: `describe("FLLWUP-28: cancellation during the §3.5 slowdown sleep is honored")` with one test.

- [ ] **Step 1: Write the test** — one test:
  - `makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 })`; `fetchWithThrow`-equivalent inline (local helper inside the block, so the transplant is self-contained) throwing on token-endpoint POST.
  - `const ctl = { cancelled: false }`; `sleep` seam: record `ms`, advance `c.simNow += ms`, and when `ms === 5000` set `ctl.cancelled = true` (cancel fires *during* the slowdown sleep).
  - Assert: `o.kind === "cancelled"`; `sleeps` is `[2000, 5000]` (interval, then slowdown — no trailing interval sleep, proving no further poll round started); token-endpoint POST count in `loginEndpointRequestLog` is exactly 1 (the one throw; no poll after the cancel); `logs.some(l => l.includes("Cannot reach"))` false; `logs.some(l => l.includes("Sign-in timed out"))` false; no credential saved.

- [ ] **Step 2: Run `bun test test/login.test.ts` — expect green** (behavior is correct today; this is a pinning card, the red half is proven at base per the card's red-at-base record).

- [ ] **Step 3: Gates:** `bun install`, `bunx tsc --noEmit` (exit 0), `bun test` (green, record exact counts).

### Task 2: Red-at-base record (detached base worktree, removed after)

- [ ] **Step 1:** `git worktree add --detach /tmp/fllwup-28-base b784540bb6d613e353aeab8195dc7c2665b2afb0`
- [ ] **Step 2:** `bun install` in the base worktree.
- [ ] **Step 3:** Append the *same* describe block (transplant; references only base-existing helpers) to the base tree's `test/login.test.ts`. Record transplant identity (files not existing at base: none — the block lives inside an existing file; the only foreign content is the appended block itself).
- [ ] **Step 4:** `bun test test/login.test.ts` — expect red on mechanism-absent artifacts (outcome `failure`/`unreachable` + failure copy, not `cancelled`). Capture verbatim runner counts and per-failure lines.
- [ ] **Step 5:** Remove the base worktree.

### Task 3: Land

- [ ] **Step 1:** Commit `test(login): pin cancellation during device-flow slowdown wait` (Conventional Commits) with the fixture + plan doc.
- [ ] **Step 2:** Push `owner/fllwup-28-slowdown-cancel`; `gh pr create` to `main`.
- [ ] **Step 3:** Report: red-at-base record (7 fields), gate outputs, branch, head SHA, PR number.
