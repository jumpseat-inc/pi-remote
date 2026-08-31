# EV-8 — Command surface and lifecycle wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the root `index.ts` stub into the pi extension that registers `/rc`, `/rc:login`, `/rc:off` and the `session_shutdown` handler, owns the seven-state footer FSM, teardown, rearm, runId, occurrence stamp, and replay adapter — per the settled EV-8 design spec.

**Architecture:** A thin `export default function (pi: ExtensionAPI)` delegates to a pure, framework-agnostic `createRemoteController(deps)` returning `{ commands, reducer, onShutdown }`. All session-scoped mutable state lives in the factory closure. Two new pure leaf helpers (`mergeTransport`, `sessionEntriesToJsonl`) plus ten new copy rows in `login.ts`'s `loginEnglishFor`. `index.ts` imports the leaf modules and never duplicates their vocabularies.

**Tech Stack:** Bun + TypeScript (strict), bun:test, pi extension SDK surface (declared as a local minimal structural type — the pi package is not a repo dependency).

**Spec:** `docs/superpowers/specs/2026-08-31-EV-8-design.md` (authoritative, self-contained). Card `council/cards/EV-8.md` incl. rulings J1–J5. `docs/PI-SPEC.md` §8.

## Global Constraints

- Footer shows **exactly one of seven states**: `off`, `not enrolled`, `authorizing`, `dialing`, `resyncing`, `live`, `error` — lifecycle order (spec §2).
- Every state change is a stated sentence resolved through `loginEnglishFor` — never a glyph, never a raw string, never an unkeyed concatenation. `setStatus("pi-remote", …)` is the single footer writer, called only from `createRemoteController`.
- All session-scoped mutable state lives in `createRemoteController`'s closure — never module-level.
- `mergeTransport` is kind-first, order-guarded (spec §2.1, J1/J4): N=10 default, injectable `ERROR_DIAL_THRESHOLD`, `live` clears a sticky `error`, `resyncing` never produced by the merge.
- Rearm closure preserves rich `TunnelError.reason` end-to-end (transport.ts:359-364 collapse must-satisfy); enrollment-class 401/403 (`unauthenticated`/`forbidden`) stops the dial loop and lands footer `error` with the enrollment remedy, NOT `relay_unreachable`, without waiting for N (J3).
- Shared idempotent epoch-bumped `teardown()`: never calls `clearCredential`.
- `/rc:login` entered only from `off` and not enrolled; else refuse "close the tunnel first with /rc:off" (J5).
- Ten new rows in `loginEnglishFor`: 7 `status.*` + 3 `tunnel.error.relayUnreachable`/`protocolViolation`/`urlExpired`. Tunnel-side reasons reuse `tunnelReasonCopy.userLine` (spec §8 note: "already covered"); no second resolver.
- No server/relay/control-plane impl, no live re-enroll, no localization table, no README sync (all out of scope §12).
- Gates: `bunx tsc --noEmit` clean; `bun test` all 113 existing + new EV-8 tests pass.

---

## File Structure

- Create `src/merge.ts` — pure `mergeTransport` + `FooterState` + transport-error key map.
- Create `src/replay-adapter.ts` — pure `sessionEntriesToJsonl` (isolated boundary for the un-vendored pi `SessionEntry` shape).
- Modify `src/login.ts` — add 10 rows (7 status.* + 3 transport-error) to `loginEnglishFor` + 3 command-output rows.
- Modify `index.ts` — `default` factory + `createRemoteController` (FSM, teardown, rearm, commands, runId, occurrence, replay wiring).
- Modify `docs/PI-SPEC.md` §8 — one-sentence J2 URL-prompt amendment.
- Create `test/merge.test.ts`, `test/replay-adapter.test.ts`, `test/index.test.ts` — in-repo fakes only (no relay/CP/Mongo).

---

### Task 1: Pure `mergeTransport` (src/merge.ts + test)

**Files:** Create `src/merge.ts`, `test/merge.test.ts`

**Interfaces:**
- Consumes: `TransportStatusEvent` from `../src/transport`; `TunnelReason` from `../src/tunnel`.
- Produces: `type FooterState`, `function mergeTransport(footer, lastOrder, e, consec, N): { footer, lastOrder, consec }`, `function transportErrorKey(reason?: TransportReason): string`, `const STATUS_KEYS: Record<FooterState,string>`.

- [ ] **Step 1:** Write failing `test/merge.test.ts` covering J1/J4: N-1 then Nth consecutive error-severity dialing → `dialing` then `error`; subsequent `live` → `live` (recovery clears error); dialing-while-error keeps `error` (sticky); first-connect `resyncing`-severity dialing renders `dialing` (kind-first); order guard drops stale events; N=10 threshold; consec resets on non-error severity.

- [ ] **Step 2:** Run to confirm failures (`bun test test/merge.test.ts`).
- [ ] **Step 3:** Implement `src/merge.ts` per spec §2.1 rules 1–5.
- [ ] **Step 4:** Run to confirm pass.
- [ ] **Step 5:** Commit `feat(merge): kind-first order-guarded footer merge (EV-8)`.

### Task 2: SessionEntry→JsonlEntry adapter (src/replay-adapter.ts + test)

**Files:** Create `src/replay-adapter.ts`, `test/replay-adapter.test.ts`

**Interfaces:**
- Produces: `interface SessionEntry` (local minimal structural type), `function sessionEntriesToJsonl(entries: SessionEntry[]): JsonlEntry[]`.

- [ ] **Step 1:** Write failing `test/replay-adapter.test.ts` (message with text/thought blocks, tool_result, compaction, model_change, bash_execution, custom; unknown type skipped).
- [ ] **Step 2:** Run to confirm fail.
- [ ] **Step 3:** Implement adapter (kind/role/content mapping; skip unrecognized).
- [ ] **Step 4:** Run to confirm pass, add `test` files matching count.
- [ ] **Step 5:** Commit `feat(replay): SessionEntry→JsonlEntry adapter (EV-8)`.

### Task 3: loginEnglishFor copy rows (src/login.ts)

**Files:** Modify `src/login.ts`.

- [ ] **Step 1:** Add 7 `status.*` rows + 3 `tunnel.error.relayUnreachable`/`protocolViolation`/`urlExpired` rows + command-output rows (`rc.unenrolled`, `rc.dialingInProgress`, `rc.offLifecycle`, `rc:login.refusal`, `shutdown.closed`) as an exported `FOOTER_ROWS` merged into `englishDefaults`/`loginEnglishFor`.
- [ ] **Step 2:** Run `bun test test/login.test.ts` to confirm existing 113 stay green and table resolves new keys.
- [ ] **Step 3:** Commit `feat(login): footer + transport-error copy rows (EV-8)`.

### Task 4: `createRemoteController` + default export (index.ts)

**Files:** Modify `index.ts` (root).

**Interfaces:**
- Produces: `default function (pi: ExtensionAPI)`, `createRemoteController(deps): { commands, reducer, onShutdown }`.

- [ ] **Step 1:** Write failing `test/index.test.ts` (fakes for pi/SDK surfaces) covering: /rc enrolled→live+frames+second-/rc ALREADY_LIVE_COPY; /rc no-credential → not enrolled + names /rc:login + zero POST; /rc:off → off + one DELETE + second no-op; one test per shutdown reason (5) w/ tunnel deleted + credential present; merge-integration error; enrollment-terminal 401/403 → error w/ rich reason + retry stopped; teardown/rearm race; occurrence stamp 1 then 2; runId fresh per agent_start; /rc:login authorizing→off (success+failure) + refusal.
- [ ] **Step 2:** Run to confirm fail.
- [ ] **Step 3:** Implement `createRemoteController` (FSM reducer, teardown, rearm closure, all three commands, session_shutdown, runId minting, occurrence stamp, replay wiring) + thin `default`.
- [ ] **Step 4:** Run to confirm pass + existing 113.
- [ ] **Step 5:** Commit `feat(index): command surface and lifecycle wiring (EV-8)`.

### Task 5: PI-SPEC §8 J2 amendment (docs/PI-SPEC.md)

**Files:** Modify `docs/PI-SPEC.md` §8.

- [ ] **Step 1:** Amend the `/rc` row: the URL prompt fires only out-of-band after `/rc:login`, never from a bare `/rc`; no serverUrl-only credential store (cite J2).
- [ ] **Step 2:** Commit `docs(spec): J2 URL-prompt amendment (EV-8)`.

### Task 6: Gates

- [ ] **Step 1:** `bunx tsc --noEmit` — clean.
- [ ] **Step 2:** `bun test` — all 113 + new EV-8 green.
- [ ] **Step 3:** Push branch, open PR titled with "EV-8"; record head SHA + gate output in report.
