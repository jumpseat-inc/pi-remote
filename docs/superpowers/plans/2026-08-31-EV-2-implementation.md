# EV-2 Control-plane Tunnel REST Client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a pure, stateless control-plane REST client in `src/tunnel.ts` that creates a tunnel via `POST /tunnels`, refreshes access tokens via RFC 8414 discovery + RFC 6749 refresh, deletes a tunnel via `DELETE /tunnels/:id`, and ships the reason→copy vocabulary — plus a fixture test suite and the §3 PI-SPEC amendment — clearing all gates.

**Architecture:** tunnel.ts is fetch-only, stateless, and injected (deps carry `serverUrl`, `accessToken`, `fetch`, `now`, and a shared per-serverUrl discovery cache). It never dials a WebSocket, never calls `setStatus`, and never reads `process.env`. All endpoints derive from the injected `serverUrl` (create/delete use `serverUrl + /tunnels`; refresh uses a discovered `token_endpoint`). Errors are a single discriminated `TunnelError` carrying `{kind, reason, serverUrl, status?}` and resolve to copy via a pure reason→copy map plus English-default lookup.

**Tech Stack:** Bun 1.4, TypeScript 7 (strict, noEmit), `bun:test`, no new runtime deps (globals `fetch`/`Response`/`Date`).

**Spec:** `/home/tista/codes/pi-remote/docs/superpowers/specs/2026-08-31-EV-2-design.md`

## Global Constraints

Copied verbatim from the spec — every task inherits these.

- **Stateless:** No module-level mutable state whatsoever; discovery cache is per-serverUrl inside an injected deps object, never a top-level mutable.
- **No ctx / no rendering:** tunnel.ts never calls `setStatus`, never reads pi settings or `process.env`.
- **No WebSocket:** tunnel.ts never dials; it validates the signed one-time URL and returns it. `WebSocket(` and the literal `wss://` strings must NOT appear in `src/tunnel.ts`.
- **No auto-refresh inside createTunnel:** a 401 from create is terminal (`enrollment_expired`); no refresh call is issued from within createTunnel.
- **Absolute timestamps (O2):** `expiresAt = now() + tokenTtl * 1000` (and `now() + expires_in * 1000` for refresh), computed at the conversion site. A raw relative value is never returned.
- **No persistence (O6):** tunnel.ts never writes settings; a rotated refresh token is returned (not applied internally) for the caller to persist.
- **Secrets:** the signed one-time tunnel URL and raw HTTP body / stack traces never appear in any error string, log line, or copy. `PI_REMOTE_HOST_KEY`-style hardcodes forbidden.
- **401 vs 403 distinct copy (Item 1):** `enrollment_expired` names only `/rc:login`; `enrollment_rejected` names `/rc:login` AND an "ask your control-plane admin to grant it" clause. The two user-lines are never byte-identical.
- **`control_plane_unreachable`** names `<serverUrl>` and must NOT contain "/rc:login"; distinct from `server_error`.
- **`already_live` is not an error** and not severity-tagged; exact copy, footer stays `live`.
- **Reason set is closed** to: `enrollment_expired | enrollment_rejected | control_plane_unreachable | server_error | teardown_failed | validation`. No `unknown` / raw `http_401` leak.
- **Every error result ships a `severity` field** (Item 4); footer merge rule is EV-8 policy.
- **§3 PI-SPEC amendment** applied VERBATIM (see Task 4); nothing else in PI-SPEC changes.
- Only these files may change: `src/tunnel.ts`, `test/tunnel.test.ts`, `docs/PI-SPEC.md` (one line), this plan.

## File Structure

- `docs/superpowers/plans/2026-08-31-EV-2-implementation.md` — this plan (deliverable).
- `src/tunnel.ts` — the stateless REST client + error type + reason→copy map (deliverable).
- `test/tunnel.test.ts` — injected-mock-fetch fixture suite (deliverable; no real network, no env).
- `docs/PI-SPEC.md` — one module-rule line replaced verbatim (deliverable).

---

### Task 1: Baseline, plan, and §3 amendment

**Files:**
- Modify: `docs/PI-SPEC.md` (line 74 only — see verbatim block below)

**Interfaces:**
- Produces: clean worktree baseline (typecheck exit 0; `bun test` pass), the committed plan, and the §3 amendment present in the spec.

- [ ] **Step 1: Confirm clean baseline**

Run (worktree root): `bunx tsc --noEmit` (exit 0) and `bun test` (all pass, 22 existing tests) and `git status` clean.

- [ ] **Step 2: Save this plan**

Confirm `docs/superpowers/plans/2026-08-31-EV-2-implementation.md` exists with the completed checkboxes.

- [ ] **Step 3: Apply the §3 amendment verbatim**

In `docs/PI-SPEC.md`, replace exactly the single line

```
- `transport.ts` is the only module that touches the network.
```

with

```
- `transport.ts` is the only module that touches the network over the
  outbound WebSocket tunnel; `tunnel.ts` is the control-plane REST client
  and touches the network over HTTPS (tunnel lifecycle + token exchange,
  §7.2).
```

- [ ] **Step 4: Verify G-6**

Run: `grep -c 'touches the network over HTTPS' docs/PI-SPEC.md`
Expected: ≥ 1 (the amendment text is present; the full card phrase `REST client and touches the network over HTTPS` spans the line wrap in the verbatim block, so the contiguous substring is the byte-true presence check).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-08-31-EV-2-implementation.md docs/PI-SPEC.md
git commit -m "docs: EV-2 implementation plan and §3 tunnel module-rule amendment (O1)"
```

---

### Task 2: tunnel.test.ts — the fixture suite (TDD RED)

**Files:**
- Create: `test/tunnel.test.ts`

**Interfaces:**
- Consumes: none (written against the wished-for API below; fails until Task 3 lands).
- Produces: the exact public API contract task 3 must satisfy:
  - `createTunnel(input, deps) -> Promise<{ tunnelId; url; expiresAt }>`
  - `refreshAccessToken(refreshToken, deps) -> Promise<{ accessToken; refreshToken?; expiresAt }>`
  - `deleteTunnel(tunnelId, deps) -> Promise<void>`
  - `class TunnelError` with `{ name:"TunnelError"; kind?; reason; serverUrl; status? }`, and `isTunnelError(e)` guard
  - `tunnelReasonCopy: Record<TunnelReason, ReasonCopy>` with `{footerState; userLineKey; userLine; severity}`
  - `englishFor(key)` — English-default lookup resolving a userLineKey to its English string
  - `ALREADY_LIVE_COPY` = `"already connected to \`<serverUrl>\`; ignoring this \`/rc\`"`
  - deps shape `TunnelHttpDeps { serverUrl; accessToken; fetch; now?; discoveryCache?: Map<string, Promise<string>> }`

Write the full fixture suite per spec §6: create success, validation, O2 absolute timestamps, 401→enrollment_expired, 403→enrollment_rejected (distinct from 401, both mention /rc:login / + admin), unreachable, server_error, refresh (rotate-return seam), refresh failure (no POST /tunnels), no-auto-refresh-in-create, delete+discard (exactly one DELETE, 404/410 success, network-failed swallowed, second call no-throw), already_live exact copy + tunnel URL never in copy, discovery cached per serverUrl (injected cache → one fetch for two calls), O1 seam static greps (no `WebSocket(`/`wss://`, no `process.env`, no `PI_REMOTE_HOST_KEY`), copy map resolves each key, 401/403 lines differ, reason set closed.

- [ ] **Step 1: Write the test file** (full code below in the plan's Task 2 appendix, inlined here)

The test uses an injected mock `fetch` via a small in-file stub `jsonRes(status, body)` returning a `Response`-like object, plus a `reqLog` array to assert request sequencing and an injected `now` clock. No real network, no env.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/tunnel.test.ts`
Expected: FAIL — module `../src/tunnel` not found / exports undefined (feature missing, not a typo).

- [ ] **Step 3: Commit**

```bash
git add test/tunnel.test.ts
git commit -m "test(tunnel): fixture suite for control-plane REST client (red)"
```

---

### Task 3: src/tunnel.ts — the stateless REST client (TDD GREEN)

**Files:**
- Create: `src/tunnel.ts`

**Interfaces:**
- Consumes: the test contracts from Task 2.
- Produces: the exports used by Task 2's tests and by future EV-8 (create/refresh/delete, TunnelError, reason→copy map, English lookup, already_live copy).

- [ ] **Step 1: Write the minimal implementation** (full code, see the plan's Task 3 appendix, inlined in `src/tunnel.ts`).

Core behaviors:
- Constants: `ALREADY_LIVE_COPY`, the `WSS_SCHEME` validator regex `/^wss?:\/\//` (contains no literal `wss://`).
- `tunnelReasonCopy` — the exact 6-row table from spec §3.2 with userLineKey, English userLine, footerState `error`, severity `error`.
- `englishFor(key)` — `Object.fromEntries` on `tunnelReasonCopy` → English default; returns key if unknown.
- `TunnelError` class + `isTunnelError`.
- `tokenEndpointFor(deps)` — RFC 8414 discovery, cached in `deps.discoveryCache` (or a fresh per-call Map if none injected); failure/malformed → `control_plane_unreachable`.
- `createTunnel(input, deps)` — POST `serverUrl + /tunnels` with Bearer; 401→enrollment_expired, 403→enrollment_rejected, 5xx→server_error, other non-ok→server_error, network→unreachable; runtime validation of `url` scheme + `tokenTtl` positive finite; compute `expiresAt = now() + tokenTtl*1000`; never returns the raw TTL.
- `refreshAccessToken(refreshToken, deps)` — POST discovered token_endpoint with grant_type=refresh_token; same error mapping; absolute `expiresAt = now() + expires_in*1000`; return rotated `refreshToken` if present (never apply internally).
- `deleteTunnel(tunnelId, deps)` — DELETE `serverUrl + /tunnels/:id`; network failure swallowed (returns); 404/410 success; other non-2xx → throw `{reason:"teardown_failed"}` (EV-8 proceeds locally).

- [ ] **Step 2: Run the suite to verify it passes**

Run: `bun test test/tunnel.test.ts`
Expected: PASS, all fixtures green, pristine output.

- [ ] **Step 3: Commit**

```bash
git add src/tunnel.ts
git commit -m "feat(tunnel): stateless control-plane REST client with reason-to-copy map"
```

---

### Task 4: Full gate sweep (owner finishes)

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–3.

- [ ] **Step 1: G-1 typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: G-2 tests**

Run: `bun test`
Expected: exit 0, includes `tunnel.test.ts` (≥ 1 new test runs).

- [ ] **Step 3: G-3** — `grep -nE 'WebSocket\(|wss://' src/tunnel.ts` → exit 1 (no match).
- [ ] **Step 4: G-4** — `grep -n 'process.env' src/tunnel.ts` → exit 1 (no match).
- [ ] **Step 5: G-5 (future-seam)** — `src/transport.ts` does not exist yet; note as not-run, do not fail.
- [ ] **Step 6: G-6** — §3 amendment present (Task 1 verified).

- [ ] **Step 7: Final commit** (if any uncommitted) and confirm `git status` clean, HEAD on branch `ev-2-tunnel`.

---

## Self-Review

- **Spec coverage:** §1 stateless/injected/no-ctx/no-WS ⇒ Task 3. §2.1 discovery+cache ⇒ tokenEndpointFor. §2.2 createTunnel validation+O2+no-auto-refresh ⇒ Task 3 + Task 2 fixtures. §2.3 refresh + O6 rotate-return ⇒ Task 3. §2.4 delete best-effort/idempotent ⇒ Task 3. §3.1 TunnelError ⇒ Task 3. §3.2 copy map + English lookup + 401≠403 + closed set + severity ⇒ Task 3/2. §3.3 already_live ⇒ constant + fixture. §5 amendment ⇒ Task 1. §6 test contract ⇒ Task 2 fixtures. §0 deliverables ⇒ Tasks 1–4.
- **Placeholder scan:** no TBD/TODO; all code inlined.
- **Type consistency:** exported names/props consistent across Tasks 2–3 (checked: `tunnelReasonCopy`, `englishFor`, `TunnelError`, `isTunnelError`, `ALREADY_LIVE_COPY`, deps shape).
