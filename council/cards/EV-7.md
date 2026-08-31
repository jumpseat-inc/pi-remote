---
id: EV-7
title: "/rc:login OAuth2 enrollment command"
state: Deliberating
owner: null
epic: EPIC-1
goal: Running /rc:login provisions working enrollment credentials for the configured control plane without env vars, in both an attended mode with a browser present and an unattended headless mode, and /rc thereafter creates tunnels with no further setup.
---

## Intent

The feature owner's headline ask — setup must not require hand-editing env
vars. `/rc:login` runs an OAuth2 flow against the control plane and persists
the resulting credential in extension settings, replacing the
`PI_REMOTE_SERVER_URL` + `PI_REMOTE_HOST_KEY` setup path (spec update in
EV-1). Attended mode has a browser available (open or launched); unattended
mode must work on a headless host where the user can relay one short value
between the host terminal and another device. The grant choice per mode is an
open design point the Council settles (device authorization grant and refresh
token persistence are the obvious candidates), constrained by §7.2's trust
model — the host holds only its own enrollment credential, never a signing
key. User-visible surface — the `/rc:login` command output on the host
terminal — step-by-step copy, the code or URL to complete the flow, an
explicit success line, and a failure line that names what to do next.

## Acceptance

- On a machine with a browser, `/rc:login` completes with at most the command
  invocation plus browser interaction, and a following `/rc` creates a tunnel
  with no env vars set.
- On a headless host, `/rc:login` completes by relaying a single short value
  (code or URL) through another device, with the terminal copy stating
  exactly what to carry where.
- The provisioned credential survives a pi restart; `/rc` uses it without
  prompting again.
- A failed or cancelled flow leaves no half-written credential and the
  command output says so.
- Credentials are stored with user-only readability, and `/rc:login` re-run
  replaces the previous credential cleanly.

---

## Deliberation record

### Classification (step 1)
Full council + surface-touching (user-visible `/rc:login` terminal copy; open design point on grant-per-mode and the EV-7/EV-8 command seam; cross-seam: tunnel.ts reuse + persistence + command surface). Seats: owner, principal, designer.

### Round 1 — independent first pass

**Owner** (job-26.1) — three modules, all ctx-free/deps-injected:
- `src/credentials.ts` (persistence owner, `piRemote.*` keys, load/save/clear, `EnrollmentCredential{serverUrl,accessToken,refreshToken?,tokenExpiry,tenantId?}`), `src/login.ts` (flow driver: `runAttendedLogin`, `runHeadlessLogin`, `LoginOutcome`/`LoginError` union, `loginReasonCopy`), and one behavior-preserving refactor of `tunnel.ts`: export `discoverAuthServer(deps)` returning full RFC 8414 doc (all three endpoints required, `revocation_endpoint` optional) so refresh + login share one function and cache. EV-8 owns command registration + `PI_REMOTE_SERVER_URL` read + `authorizing` footer + rendering; EV-7 exports functions only.
- **Persistence decision:** pi exposes no generic extension-settings write API and no chmod-0600 guarantee on its settings.json → a dedicated `~/.pi/agent/pi-remote/credentials.json` (0600), atomic via tmp+fsync+rename, only written on success. Flagged as a divergence from §7.2's literal "extension settings" wording that all four acceptance criteria + security intent justify.
- **Attended:** PKCE S256, CSPRNG `code_verifier`/`state`, `Bun.serve` loopback bound 127.0.0.1 ephemeral port 0, `deps.openUrl` (shell out best-effort, swallowed; print URL fallback), state-checked callback, exchange `grant_type=authorization_code`+`code_verifier` at token_endpoint, timeout closes listener.
- **Headless:** RFC 8628 — POST device_authorization_endpoint, interval polling, slow_down (+5s), authorization_pending continue, expired_token/access_denied terminal (typed), non-terminal 4xx → `device_flow_failed`.
- **tenantId:** unverified base64url decode of JWT payload `sub` (best-effort cache, never an auth authority).
- Copy: `loginReasonCopy` key+English-default (attended open, success, headless relay, access_denied, expired, timed_out, network, cancelled, invalid_server).
- Tests: attended E2E over real loopback, PKCE/state, timeout atomicity, headless happy/slow_down/terminal, discovery reuse (O7), **join test** (`runAttendedLogin → loadCredential → createTunnel` against fake plane, zero env), persistence (0600, atomic, clean replace), tenantId, static guards, full-suite regression.
- Testable claims C1–C6 (discovery refactor regression-safe; state mismatch never persisted; slow_down increases interval; 0600+atomic; join test green; copy closed set).

**Principal** (job-26.2) — cross-seam; two new modules + tunnel.ts extension:
- Grounding: `tokenEndpointFor` is private + token_endpoint-only; "extension settings" has **no pi platform API behind it** (`appendEntry` session-scoped, `SettingsManager.Settings` closed shape, no arbitrary-key setter) → EV-7 must ship its own credential store serializing `piRemote.*` (keys are the contract EV-8 consumes; backing file is EV-7's choice).
- **`src/login.ts` = a transducer** `createLoginCommand(deps) → { run(mode), cancel() }`, single-in-flight guard (`already_running`), emits `onState("authorizing")` but **never calls `ctx.ui`**. `src/credential.ts` store EV-8 reads through: `writeEnrollment` tmp+rename+chmod 0600, `readEnrollment`, `clearEnrollment`; clean re-run = full key replacement, never merge. `serverUrl` injected; EV-8 resolves (env override > stored > prompt) across **both** `/rc` and `/rc:login` (closes the first-run URL gap where each card could assume the other prompts).
- Protocol: RFC 7636 S256 (32-byte verifier, base64url), state 32-byte, bind listener before building URL, token exchange **form-urlencoded** no client secret; loopback serves only `GET /callback` (open-redirect guard), closes in `finally`. RFC 8628 exact honor incl. `error` field only (description redacted).
- Copy: closed set with `loginEnglishFor`, success line + `LOGIN_SUCCESS_COPY`; every failure names next step + "nothing was saved".
- EV-8 seam: exports `createLoginCommand`, `LoginOutcome`, `LoginReason`, `loginReasonCopy`, `loginEnglishFor`, store functions; demonstrates acceptance via `readEnrollment → createTunnel` join in tests.
- 10 testable claims (S256 self-consistency, state/CSRF binding, loopback-only+path guard, single in-flight, cancel/atomicity, headless interval semantics, copy fidelity, no token leakage static grep, re-run replacement, discovery seam incl. `discovery_invalid`).

**Designer** (job-26.3; full record `vault/raw/2026-08-31-design-ev7-login-terminal-surface.md`) — terminal-surface vocabulary:
- Attended prints open line + `If the browser does not open, visit: <authorizeUrl>` (recovery affordance, RFC 8252 §7.1 recommends both) + `Waiting for browser…`; success line `Enrolled this host with <serverUrl> (tenant <tenantId>) — run /rc to start a tunnel.`
- Headless prints `verification_uri_complete` + `user_code` on adjacent lines, `The code expires in <expiresIn>s.`, then ≤3 bound progress prints (silent otherwise); access_denied/expired_token terminal copy + `No credentials were saved.`
- Ctrl-C `/rc:login cancelled — no credentials were saved.`; timeout similar.
- Closed failure set (10 rows) with invariant: every failure ends `no credentials were saved.` or `run /rc:login`.
- Idempotent re-run confirmation prompt before any side effect.
- Voice rules; never emits `wss://`, `device_code`, `access_token`, `refresh_token`, HTTP body.
- 8 falsifiable predictions (copy/structural, one CDP comprehension smoke). Flagged one product-shape decision for product-owner: "auto-open browser AND print URL" (one line over RFC 8252's "or").
