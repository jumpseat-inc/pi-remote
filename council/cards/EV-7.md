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

### Round 2 — bounded exchange (convergence)

**Owner** (job-26.4) — Converged. Persistence: confirmed dedicated 0600 credential file at `~/.pi/agent/pi-remote/credential.json` (tmp+fsync+rename, 0600, written only on success, re-run = full replace). **Spec text: IS a divergence from §7.2's "extension settings" and must be amended on the PR** (pi has no settings-write API). Module API: **survivor = principal's `createLoginCommand(deps) → {run(mode), cancel()}` facade** (cancel/single-in-flight are per-command stateful; owner's two functions fold into `run(mode)`), plus keep LoginOutcome/LoginReason/loginReasonCopy/loginEnglishFor + join test. Discovery: confirm extend tunnel.ts with exported `discoverAuthServer` (3 endpoints required, revocation optional); one shared cache; regression = all existing tests green (owner cites 87 — NOTE: actual repo count is 85, see record below). env/URL seam: confirmed EV-8 reads PI_REMOTE_SERVER_URL, resolves env > stored > prompt across both commands; env is server URL only, never credentials. Browser open: agreed best-effort shell-out + print URL (designer's auto-open AND print); owner says confirm-only, no veto. Canonical copy set: single closed table (see item 6). Residual open: auto-open confirm (non-blocking), credential-path + §7.2 spec-amendment wording signoff, tenant-display product-shape. **Factual correction:** repo test count is 85, not 87.

**Principal** (job-26.5) — Converged, one refinement. Confirms persistence `~/.pi/agent/pi-remote/credentials.json` (plural) 0600 atomic; **§7.2 "extension settings" must be amended on the PR** (spec change, not implementation detail). Module API: **blend — both survive**: pure drivers `runAttendedLogin`/`runHeadlessLogin` (testable core) + `createLoginCommand` facade EV-8 consumes (single-in-flight, onState("authorizing"), never ctx); EV-8 imports only the facade. Discovery: **one discovery function, two reason vocabularies** — `discoverAuthServer` shared; `refreshAccessToken` folds both discovery failures into `control_plane_unreachable` (behavior unchanged, TunnelReason stays closed, tunnel.test.ts:223/357-363 stay green); login maps to `control_plane_unreachable` vs `discovery_invalid` in its own LoginError union. env/URL seam settled. Browser open settled (already auto-open AND print). Canonical copy table (12 rows) with invariant. Residual open → product-owner: **user-only readability = POSIX 0600 only; chmod no-op on Windows — accept 0600 + documented Windows caveat, or require ACL work (needs ruling)**. Skeptic residual: T1 regression-risk claim (refresh error semantics unchanged while login gains discovery_invalid).

**Designer** (job-26.6; full record `vault/raw/2026-08-31-design-ev7-login-terminal-surface-r2.md`) — Converged. Success line adopts principal's framing; closed failure set adopts principal's 11-row list with designer's invariant applied; replacement prompt is canonical; auto-open AND print URL settled (RFC 8252 §7.1). Settled copy: voice rules, closed-set shape, <serverUrl> discipline, secret-name prohibition, attended open+fallback+waiting+success shape, headless relay+expire+bounded-progress, cancel vs timeout distinct, invariant tail clause, no user_code re-print in polling, verification_uri_complete default (bare verification_uri fallback only). 9 falsifiable predictions. **Two product-shape items → product-owner (verbatim): (1) tenant display in success line — append ` (tenant <tenantId>)` only when a tenant-scoped `sub` present, else principal's compact form (reject unconditional display "renders ` (tenant )`" and never-display); (2) re-run while enrolled — confirm with `login.replacementPrompt` vs silent replace (cost of one Enter trivial; cost of silent overwrite on shared host real).** Micro-decision (record only): replacement prompt NOT shown in headless mode (user committed to long-running flow).

**Verified facts (facilitator, for the record):** repo test count = **85** (grep of `test(`/`it(`), matching the orchestrator's standing figure. `test/tunnel.test.ts:223` asserts discovery fetch failure → reason `control_plane_unreachable`; `test/tunnel.test.ts:357-363` enumerates the closed `TunnelReason` set and asserts `Object.keys(tunnelReasonCopy).sort()` equals that closed set. Both confirm the principal's discovery-refactor constraint: `TunnelReason` must NOT gain a new member in the refactor or the existing tunnel tests break; login must carry `discovery_invalid` in its own LoginError union.

### Consensus design (post-round-2, converging)
- New `src/login.ts` (pure flow drivers `runAttendedLogin`/`runHeadlessLogin` + `createLoginCommand` facade) and `src/credential.ts` (store: readEnrollment/saveCredential/clearCredential, 0600 atomic tmp+rename, full-replace on re-run) — both ctx-free, deps-injected (fetch, now, randomBytes, sha256, openBrowser/browser shell-out, onState).
- Extend `src/tunnel.ts`: export `discoverAuthServer(deps)` (3 required endpoints validated, revocation optional, per-serverUrl cache, eviction on rejection); refresh keeps `control_plane_unreachable` mapping; login adds `discovery_invalid` in its own union.
- Persistence: dedicated 0600 file serializing `piRemote.*` keys (serverUrl, accessToken, refreshToken?, tokenExpiry, tenantId?) under the pi agent config dir; **§7.2 "extension settings" phrase amended on the PR (evidence-cited: pi exposes no settings-write API)**.
- tenantId = best-effort unverified base64url decode of access_token JWT payload `sub`.
- EV-8 seam: EV-7 exports `createLoginCommand`, `LoginOutcome`/`LoginReason`, `loginReasonCopy`/`loginEnglishFor`, store functions; EV-8 registers commands, resolves serverUrl (env > stored > prompt), emits authorizing footer, renders copy. Join test demonstrates "a following /rc creates a tunnel": `runAttendedLogin → readEnrollment → createTunnel` against a fake control plane, zero env.
- Copy: closed `loginReasonCopy` set key+English-default with invariant (every failure ends "no credentials were saved." or "run /rc:login"); no secrets/wss:///process.env in any line.

### Open-judgment items to route (step 6)
1. **Honest spec divergence** — §7.2 "extension settings" mechanism (and persistence wording) amendment on the PR (owner + principal: must amend; evidence-cited per governance precedent). Confirm scope + exact wording.
2. **Tenant display in success line** (designer + owner, product-shape, open-judgment).
3. **Re-run while enrolled: confirm vs silent replace** (designer + owner, open-judgment).
4. **POSIX-0600-only vs Windows ACL for "user-only readability"** (principal, open-judgment).

### Step 4 — Skeptic attack (job-26.7; real probes run, 85 tests + tsc green)

**Settled/clarified (closed-green or clarified):**
- Discovery-refactor constraint is REAL: refreshAccessToken→tokenEndpointFor maps all discovery-failure modes (network, 404, missing token_endpoint) → `control_plane_unreachable`. The closed-set test at tunnel.test.ts:357-363 is a real gate (injecting `discovery_invalid` → 1 test red). The two-vocabulary plan (TunnelReason closed, login carries `discovery_invalid`) is necessary. **BUT the record's locus claim was imprecise**: tunnel.test.ts:223 is `createTunnel`'s network-failure test, NOT a discovery test; discovery failure currently has NO dedicated test (should be added).
- PKCE: 32 bytes of random → 43 base64url chars = RFC 7636 §4.1 minimum; 31 bytes → 42 chars = violation. Implementer must guarantee ≥43 chars.
- `device_authorization_endpoint` is OPTIONAL per RFC 8414/8628 — design handles by failing headless with `discovery_invalid`; must distinguish "missing optional field" from "discovery unreachable".

**BLOCKING objections (closed-red, internal inconsistency) — must reconcile in the spec before owner implements:**
- **Objection 3: `discoveryCache` type is incompatible with the refactor.** Current `Map<string, Promise<string>>` at src/tunnel.ts:56 cannot hold the multi-field `discoverAuthServer` result. Design must specify the cache type change or a second cache before implementation.
- **Objection 2: copy invariant is three/four-way, not two-way.** The consensus summary's "every failure ends 'no credentials were saved.' or 'run /rc:login'" does not match the designer's canonical table: `unreachable` ends "check your network and try again.", `discoveryInvalid` ends "check the URL with your control-plane admin.", `invalidTokenResponse` ends "ask your control-plane admin." and has "No credentials were saved" mid-sentence; `timedOut` has it mid-sentence too. Consensus summary and canonical table must be reconciled; the invariant test must match the actual table (contains, not ends-with).

**Open-untested (implementation-phase notices):** PKCE ≤43-char guard test; device-endpoint-optional handling; dedicated refreshAccessToken-with-discovery-failure test; invariant regex must be "contains" not "ends-with" for some rows.

**Verdict:** gate integrity fine (bun test catches set expansion; tsc alone does not — a note, not a block). Two blocks to resolve in the spec, then open-untested notices for the owner's implementation.

### Step 5 — Consolidator synthesis (job-26.8; full text in job output)
**Settled (closed by round-2 convergence or green/clarified Skeptic probes):**
- Module layout: src/login.ts (pure drivers runAttendedLogin/runHeadlessLogin + createLoginCommand facade; EV-8 imports only facade; tests exercise drivers), src/credential.ts (readEnrollment/saveCredential/clearCredential, 0600 atomic tmp+fsync+rename, write-on-success, full-replace re-run).
- Persistence: dedicated 0600 file under pi agent config dir, piRemote.* keys.
- Discovery refactor: exported discoverAuthServer (3 required endpoints, revocation optional, per-serverUrl cache, eviction on rejection); TunnelReason stays closed; refresh folds discovery-failure→control_plane_unreachable; login carries discovery_invalid in own LoginError union.
- tenantId best-effort JWT sub decode. EV-8 seam (exports, serverUrl env>stored>prompt across both commands, authorizing footer, render). Env = server URL only, never credentials.
- Copy shape: loginReasonCopy key+English-default + loginEnglishFor; closed set; voice rules; no secrets/wss:///process.env.
- Attended flow: open + fallback-URL + waiting + success; PKCE S256, 32-byte verifier/state, loopback 127.0.0.1:0, state-checked, form-urlencoded exchange, listener closes in finally. Auto-open AND print URL — SETTLED (all three seats, RFC 8252 §7.1), not open judgment.
- Headless: RFC 8628, verification_uri_complete+user_code adjacent, expire line, ≤3 progress prints, silent; slow_down +5s; access_denied/expired_token terminal; never re-print user_code.
- Cancel vs timeout distinct. Success line canonical: "Signed in to <serverUrl> — enrollment credentials saved for this host. Run /rc to start a tunnel."
- Closed failure set (principal's fine-grained set; collapsing unsafe).
- Skeptic closings: discovery-constraint real (closed-green), PKCE 43-char minimum (closed-green), device-endpoint-optional (closed-green), gate-integrity note (not a block), 85 tests + tsc green.
- **§7.2 amendment scope: SETTLED in-scope by EV-4 Q1 / EV-2 O1 governance precedent** (facilitator-authored, evidence-cited, in-scope prose-sync rides the PR; EV-7 depends on correct §7.2 persistence-mechanism prose; pi exposes no settings-write API, cited by owner+principal independently). No ruling needed.

**Open judgment → product-owner (no test settles; both sides at equal weight):**
- J1 Tenant display in success line: A = append ` (tenant <tenantId>)` only when a tenant-scoped `sub` present, else principal's compact form; rejected: unconditional display (renders ` (tenant )`), never display (loses multi-tenant disambiguation). Reversibility trivial.
- J2 Re-run while enrolled: confirm with login.replacementPrompt (designer; overwrite is consequential, one Enter trivial, silent clobber on shared host real) vs silent replace (owner r1; reads "replaces existing credential cleanly" as silent; faster, no recovery from misclick/stale script). Micro-decision recorded: no prompt in headless mode.
- J3 POSIX-0600-only vs Windows ACL for "user-only readability": A = POSIX 0600 + documented Windows caveat (chmod no-op on Windows); B = require Windows ACL work (0600 alone doesn't meet the literal acceptance on Windows). Scope/values.

**Open objections (Skeptic):**
- Closed-red B1: discoveryCache Map<string,Promise<string>> (src/tunnel.ts:56) incompatible with multi-field discoverAuthServer return — spec must pin (a) change cache type to Map<string,Promise<DiscoveryDocument>>, or (b) second cache; pin DiscoveryDocument shape + eviction rule + refresh control_plane_unreachable preserved (tunnel.test.ts:357-363 stays green).
- Closed-red B2: copy invariant is three/four-way not two-way — consensus summary contradicts designer's canonical table; adopt designer's canonical 13-row table as single source of truth; drop "ends-with" two-way phrasing; state invariant as CONTAINS rule; correct row count (13 failure rows); enumerate per-row tail (unreachable→"check your network and try again.", discoveryInvalid→"check the URL with your control-plane admin.", invalidTokenResponse→"ask your control-plane admin." with "No credentials were saved" mid-sentence, timedOut mid-sentence + "Run /rc:login to try again.", remaining→terminal "No credentials were saved.").
- Open-untested (owner implementation-phase tests): PKCE ≥43-char guard; device-endpoint-optional distinction; dedicated refreshAccessToken+discovery-failure test; invariant contains-regex test.
- Filename singular/plural discrepancy (credential.json vs credentials.json) — trivial drafting detail for spec pin. ALREADY_LOGGING_IN_COPY/REPLACEMENT_PROMPT_COPY constants to fold into closed-set pinning.

**Consolidator sequence:** spec draft (clear B1/B2) → product-owner rulings (J1/J2/J3) → owner implementation with four open-untested tests in plan.
