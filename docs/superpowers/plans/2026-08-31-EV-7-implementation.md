# EV-7 Implementation Plan — `/rc:login` OAuth2 enrollment command

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure OAuth2 flow modules (`src/login.ts`, `src/credential.ts`) and extend `src/tunnel.ts` with an exported `discoverAuthServer`, so EV-8 can later wire `/rc:login`; ship unit tests and the §7.2 prose amendment.

**Architecture:** Three DI-style, ctx-free modules matching the repo's `createTransport`/`createState` pattern. `credential.ts` owns a dedicated 0600 atomic credential file; `login.ts` exports pure drivers (`runAttendedLogin`/`runHeadlessLogin`) plus a `createLoginCommand` facade; `tunnel.ts` gains a shared, cached `discoverAuthServer` with a widened cache type. No module-level mutable state except the explicit `loginEndpointRequestLog` test seam.

**Tech Stack:** Bun, TypeScript (strict), `bun:test`, plain `node:fs`/`crypto` via injection.

**Spec:** `docs/superpowers/specs/2026-08-31-EV-7-design.md` (binding). The plan argues from the spec; the executor reads both.

## Global Constraints

- Do **not** touch `src/index.ts` or `src/transport.ts` (EV-8 wiring). Only `src/login.ts`, `src/credential.ts`, `src/tunnel.ts`, `test/*`, `docs/PI-SPEC.md` (§7.2 + §8 row), and the new plan file.
- Existing **85 tests stay green**; `TunnelReason` closed set unchanged (`test/tunnel.test.ts:357-363`).
- `tunnel.ts` discovery failure always maps to `control_plane_unreachable`; `discovery_invalid` is login-only.
- Copy voice rules: sentence case, em-dash cadence, backticks for commands/values, angle brackets for placeholders. **No** `wss://`, `device_code`, `access_token`, `refresh_token`, `process.env` in `login.ts`/`credential.ts` (grep-guarded).
- No module-level mutable state (except `loginEndpointRequestLog` test seam); injected `now`/`randomBytes`/`sha256`/`sleep`.
- Gates: `bunx tsc --noEmit` 0; `bun test` all green; static grep negative invariants; PI-SPEC diff confined; four open-untested tests (6–8) written + green.

---

### Task 1: `credential.ts` — dedicated 0600 atomic store

**Files:**
- Create: `src/credential.ts`
- Test: `test/credential.test.ts`

**Interfaces:**
- Consumes: nothing (self-contained).
- Produces: `EnrollmentCredential`, `credentialPath`, `saveCredential`, `saveCredentialAsync`, `readCredential`, `clearCredential`, `WriteResult`.

- [ ] **Step 1: Write `src/credential.ts`** (atomic tmp+fsync+rename, 0600 on POSIX, full-replace, `WriteResult`). On `process.platform === "win32"` chmod is a no-op; write succeeds but returns `{ ok: false, reason: "platform_acl_not_supported" }` so the login driver can surface the J3 notice. `io_error` on any write/rename throw. `readCredential` returns the parsed object or `null` (absent/JSON-parse error).
- [ ] **Step 2: Write `test/credential.test.ts`** covering: path shape; save→read round-trip; mode 0600 POSIX (test 13); atomic full-replace (no merge, exact keys on re-run); failed read returns null; clear removes (test 15).
- [ ] **Step 3: Run** `bun test test/credential.test.ts` — green; then `bunx tsc --noEmit`.
- [ ] **Step 4: Commit** `feat(credential): dedicated 0600 atomic credential store (EV-7)`.

### Task 2: `tunnel.ts` discovery refactor (behavior-preserving)

**Files:**
- Modify: `src/tunnel.ts`
- Test: `test/tunnel.test.ts` (additive)

**Interfaces:**
- Consumes: existing `TunnelHttpDeps`, `TunnelError`, `TunnelReason`.
- Produces: `DiscoveryDocument`, `discoverAuthServer`, widened `discoveryCache` type.
- Consumed by: `login.ts` Task 3, `refreshAccessToken`.

- [ ] **Step 1**: Add `DiscoveryDocument` interface + export `discoverAuthServer(deps)` returning the cached doc (per-`serverUrl`, evict-on-rejection, network/HTTP failure → `TunnelError("unreachable","control_plane_unreachable",…)`). Change `TunnelHttpDeps.discoveryCache` to `Map<string, Promise<DiscoveryDocument>>`. Rewrite `refreshAccessToken`'s discovery: `const doc = await discoverAuthServer(deps); if (!doc.tokenEndpoint) throw …unreachable`.
- [ ] **Step 2**: Add additive tests: `discoverAuthServer` returns full doc; cached-once (O7, test 17); **dedicated refresh+discovery-failure test (test 8)** — a discovery fetch failure makes `refreshAccessToken` throw `TunnelError("unreachable","control_plane_unreachable",…)` and `:357-363` stays green (closed set unchanged).
- [ ] **Step 3**: Run `bun test test/tunnel.test.ts` + `bunx tsc --noEmit`.
- [ ] **Step 4: Commit** `feat(tunnel): export discoverAuthServer + cached DiscoveryDocument (EV-7)`.

### Task 3: `login.ts` — copy vocabulary, flows, facade

**Files:**
- Create: `src/login.ts`
- Test: `test/login.test.ts`

**Interfaces:**
- Consumes: `discoverAuthServer`, `DiscoveryDocument`, `isTunnelError` from `./tunnel`; store fns from `./credential`.
- Produces (EV-8 seam): `createLoginCommand`, `loginEnglishFor`, `loginReasonCopy`, `loginReasonCopy`-backed `LoginReason`, `LoginOutcome`, `LOGIN_SUCCESS_COPY`, `ALREADY_LOGGING_IN_COPY`, `REPLACEMENT_PROMPT_COPY`, `loginEndpointRequestLog`, raw drivers.

- [ ] **Step 1**: Write the copy vocabulary: the 13-row failure set + 15 non-failure lines verbatim from spec §1.2 in an `englishDefaults` map; `loginEnglishFor`; `loginReasonCopy: Record<LoginReason, LoginReasonCopy>`; the three success/constant strings; `loginEndpointRequestLog`.
- [ ] **Step 2**: Write helpers: `base64url` encode/decode, PKCE `randomBytes(32)` ≥43-char guard (test 6), JWT `sub` decode → `tenantId` (J1).
- [ ] **Step 3**: Write `runAttendedLogin`: discovery → `discoveryInvalid`; bind `Bun.serve` on `127.0.0.1:0` **before** building the authorize URL; print opening+fallback (always), `openUrl` best-effort, waiting; state-checked `/callback` (open-redirect guard, test 14); form-urlencoded token exchange; J1 success parenthetical; atomic save; typed failure rows.
- [ ] **Step 4**: Write `runHeadlessLogin`: discovery requires `deviceAuthorizationEndpoint` (test 7); POST device auth; print relay block + expire; bounded poll (≤3 progress prints, test 9), `slow_down` +5s, terminal `expired_token`/`access_denied`; never re-print `user_code`.
- [ ] **Step 5**: Write `createLoginCommand`: `isRunning()`, `cancel()`, single-in-flight; J2 replacement prompt (attended only, before any HTTP — `confirmReplacement` test seam); J3 Windows storage-failed notice; `noServerUrl` guard; prints `login.cancelled` exactly once on cancel.
- [ ] **Step 6: Commit** `feat(login): OAuth2 flow drivers + command facade (EV-7)`.

### Task 4: `login.test.ts` — spec §2 list 1–16

**Files:**
- Test: `test/login.test.ts`

- [ ] **Step 1**: Mock harness: injected `fetch` recording into `loginEndpointRequestLog`, injected `now`/`randomBytes`/`sha256`/`sleep`/`openUrl` (simulating the browser redirect), fake control plane per endpoint.
- [ ] **Step 2**: Write tests 1–5 (vocabulary resolution, closed-set invariant, distinctness, static grep), 6 (PKCE ≥43), 7 (device-endpoint optional attended/headless), 9 (headless ≤3 prints over simulated 5-min), 10 (J2 prompt gate + headless exemption), 11 (J2 Ctrl-C → cancel, zero POSTs after signal), 12 (J1 tenant parenthetical), 14 (loopback/open-redirect guard), 16 (join: `runAttendedLogin → readCredential → createTunnel`, zero env).
- [ ] **Step 3**: Run `bun test test/login.test.ts` + `bunx tsc --noEmit`.
- [ ] **Step 4: Commit** `test(login): EV-7 flow + copy tests`.

### Task 5: `docs/PI-SPEC.md` §7.2 + §8 prose amendment

**Files:**
- Modify: `docs/PI-SPEC.md` (only the §7.2 "Credential storage" paragraph + the §8 `/rc:login` row's "extension settings" phrase)

- [ ] **Step 1**: Rename the §7.2 storage mechanism to the dedicated `<configDir>/pi-remote/credentials.json` (0600) file; add the user-only-readability platform mechanism note + J3 Windows caveat (README-documented, riding FLLWUP-1). Fix the §8 `/rc:login` "Persists the credential in extension settings" → dedicated 0600 file. No other prose changes.
- [ ] **Step 2**: Verify `git diff docs/PI-SPEC.md` touches only those rows.
- [ ] **Step 3: Commit** `docs: sync §7.2 credential-storage + §8 login row to dedicated 0600 file (EV-7)`.

### Task 6: Gates in order + PR

- [ ] **Gate 1** `bunx tsc --noEmit` → exit 0.
- [ ] **Gate 2** `bun test` → 85 existing green + new green.
- [ ] **Gate 3** static grep over `src/login.ts`+`src/credential.ts`: no `wss:\/\/`, `device_code`, `access_token`, `refresh_token`, `process.env`.
- [ ] **Gate 4** `git diff docs/PI-SPEC.md` confined to §7.2/§8 rows.
- [ ] **Gate 5** `test/tunnel.test.ts:357-363` green (closed `TunnelReason`).
- [ ] **Gate 6** tests 6–8 written and green.
- [ ] **Final**: commit `docs(superpowers): EV-7 implementation plan` if needed, push branch, open ONE PR `feat(login): OAuth2 enrollment command (EV-7)`. Do NOT merge.
