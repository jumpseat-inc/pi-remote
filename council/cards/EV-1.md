---
id: EV-1
title: "Sync PI-SPEC with the /rc:login OAuth2 enrollment design and colon command naming"
state: Deliberating
owner: null
epic: EPIC-1
goal: docs/PI-SPEC.md specifies the /rc, /rc:login, and /rc:off command surface with OAuth2-based host enrollment replacing env-var-only setup, covering both attended and unattended login.
---

## Intent

The spec is the source of truth (repo AGENTS.md requires keeping it in sync),
and it currently pins `PI_REMOTE_SERVER_URL` + `PI_REMOTE_HOST_KEY` env vars
(§7.2) and the `/rc-off` command name (§8), both of which the feature owner has
overruled. This card rewrites §7.2 and §8 so enrollment is OAuth2-based via
`/rc:login`, with credentials persisted in extension settings, and renames
`/rc-off` to `/rc:off`. It must also pin the currently open design points the
Council settles: which OAuth2 grant serves the attended mode (browser
available) vs the unattended headless mode, what the control plane must expose
for each, where the resulting credential is stored, and how `/rc` behaves when
no credential exists yet (prompt to run `/rc:login` vs inline).

## Acceptance

- §8 command table lists `/rc`, `/rc:login`, and `/rc:off` with no `/rc-off`
  anywhere in the doc.
- §7.2 no longer presents env vars as the primary setup path; settings-based
  OAuth2 enrollment is the documented path and env vars are at most a
  documented override.
- Both attended and unattended login modes have a specified flow with the
  control-plane endpoints they require listed as contract (like §5.3).
- No other section's wire contract (§4–§6 framing, §5.3 handshake, §7.3
  grants) is altered.

## Deliberation record

### Recovery note (runner resumed after anti-stall cancel)

Prior runner instance was cancelled mid-deliberation by the hub anti-stall
monitor after 25 min. Durable state at resume: card state `Deliberating`,
board column moved — nothing else. The step-2 independent positions the prior
instance collected were **never persisted** to this record, and the round-2
dispatch's results died with the container. Per board discipline, the record
is the only truth: the independent first pass is re-run below. The ≤3-round
exchange cap binds across the whole card; rounds are counted from this
restart (rounds 1–3 available).

### Step 1 — path classification

- Full council (not mechanical): spec-ambiguous — the goal's open point
  (which OAuth2 grant serves attended vs unattended login) admits more than
  one reasonable design; design-judgment — a real tradeoff exists between
  browser-available attended enrollment and headless unattended enrollment.
- Surface-touching: yes — the doc change defines user-visible command surface
  and the enrollment UX the user experiences; `designer` is seated as a third
  generator in steps 2–3.
- Locked human decisions carried by the card (not open for relitigation):
  commands `/rc`, `/rc:login`, `/rc:off` (colon namespace, never `/rc-off`);
  OAuth2-based enrollment replaces env-var-only setup; both attended and
  unattended login modes must be supported. Which grant serves each mode is
  the open question.

### Step 2 — independent first pass (round 1, re-run after recovery)

**owner** (job-3.1, verbatim):

---

Position — EV-1 (owner seat, independent first pass)

Grounding used: `docs/PI-SPEC.md` (entire doc; §3, §5.3, §7.1–7.5, §8, §10) and `AGENTS.md`. The repo `vault/wiki/index.md` is an empty catalog — no module pages exist — so the spec itself is the only authoritative map. Key architectural anchors I'm binding to: §3's module rule that `tunnel.ts` is already the "control-plane REST client: tunnel create, token exchange" (the spec already anticipates OAuth tokens there), `transport.ts` = WS-only, no background resources from the factory, §7.1 outbound-only, §7.5's "tenancy by credentials at three contract points."

- **Approach**
  - **(a) Attended** — Authorization Code + **PKCE** (RFC 8252 native-app pattern). Public client `pi-remote`, no secret; `/rc:login` opens the default browser at `{authorization_endpoint}` with `S256` challenge, `scope=pi-remote:host`, loopback redirect `http://127.0.0.1:<ephemeral>/callback` bound to 127.0.0.1 only.
  - **(b) Unattended** — **Device Authorization Grant (RFC 8628)**. `/rc:login --headless` (or `PI_REMOTE_HEADLESS=1`) POSTs `{device_authorization_endpoint}`, prints `user_code` + `verification_uri` for completion on another device, polls `{token_endpoint}` with `grant_type=urn:ietf:params:oauth:grant-type:device_code`.
  - **(c) Endpoints as §5.3-style contract**: RFC 8414 discovery `GET /.well-known/oauth-authorization-server` (extension derives all endpoints from the configured server URL — no hardcoded paths); `POST {token_endpoint}` for `authorization_code`, device-code, and `refresh_token` grants; `POST {device_authorization_endpoint}`; existing `POST /tunnels` (§7.2 payload unchanged) authenticated with `Authorization: Bearer <access_token>` instead of the raw host key.
  - **(d) Storage** — extension settings: `piRemote.serverUrl`, `piRemote.accessToken` (short-TTL, server-configurable), `piRemote.refreshToken` (long-lived, revocable at control plane), `piRemote.expiresAt`, `piRemote.tenantId` (cached from token). Env vars remain **documented override only**: `PI_REMOTE_SERVER_URL`, `PI_REMOTE_HOST_KEY` (pre-issued credential for pre-provisioned hosts); when set, login is skipped. This satisfies the acceptance criterion verbatim.
  - **(e) `/rc` with no credential** — refuse to dial, print "Not enrolled — run `/rc:login` or `/rc:login --headless`", exit non-zero. With a credential but expired access token: silent refresh; on refresh failure, same prompt. `/rc` never runs inline OAuth: enrollment is rare and interactive, tunnel creation is frequent and automated — conflating them breaks `/rc`'s idempotency contract and would make automation hang on a browser prompt.

- **Tradeoffs accepted** — Device flow forces login from a second device; it is the only standard way to authenticate a headless host without passwords or API keys (ROPC rejected: host holds user password; client-credentials: no user/tenant identity; API-key: renames the env-var flow the card overrules). PKCE-vs-device-flow-for-both gives two code paths, but PKCE is the standard interactive pattern and avoids code entry when a browser is present; its loopback listener is command-time only, so §3's no-factory-backgrounds and §7.1 outbound-only hold. A refresh token in flat settings is no worse than the host key §7.2 already stored there — §7.4's "host enrollment key" row becomes "enrollment token" with revocation added. §7.5's first contract point changes from "key belongs to a tenant" to "token `sub` is tenant-scoped"; the other two rows and §7.3 are untouched, satisfying the no-other-section-altered acceptance.

- **Testable claims**
  1. `grep -n "rc-off" docs/PI-SPEC.md` → exit 1 everywhere in the doc; `grep -n "PI_REMOTE_HOST_KEY"` appears only inside an override sentence, never as the primary path (§8/§7.2 rewritten accordingly).
  2. Module-rule claim: token exchange lands in `tunnel.ts`; `grep -n "fetch(" src/transport.ts` stays empty after implementation.
  3. Behavior test once `src/` exists: `/rc` with empty settings returns the login-prompt outcome and never calls `tunnel.create`; with an expired token it calls refresh exactly once and, on failure, returns the prompt without dialing.

---

**principal** (job-3.2, verbatim):

---

Cross-seam reading. The spec is currently lagging its own downstream cards. `docs/PI-SPEC.md` still pins `PI_REMOTE_SERVER_URL` + `PI_REMOTE_HOST_KEY` (§7.2, lines 199–206) and `/rc-off` (§8, line 278), while EV-2, EV-7, and EV-8 are already written against the new design: EV-7 persists an OAuth2 credential in settings, EV-2 treats that credential as opaque to `POST /tunnels`, EV-8 makes `/rc` *fail and point at `/rc:login`* when unenrolled and uses the colon namespace. So EV-1's real job is not to re-derive the design but to write the spec text those cards already assume — and to notice the sections the acceptance doesn't name. §7.4's trust table (line 244: "host enrollment key") and §9.1 (line 289: "long-lived host enrollment key") both contradict the new §7.2 unless updated; they are prose, not wire contract, so updating them doesn't violate the acceptance. `README.md` (lines 74, 92–93) is equally stale but sits outside EV-1's stated scope — flag it, don't scope-creep it in.

Blind spots. The spec-seat sees only §7.2/§8 text and can miss that EV-2's `tunnel.ts` needs the grant decision to know whether the credential is a short-lived Bearer token (needs 401→refresh logic) or a long-lived key presented as-is; if EV-1 leaves "long-lived host enrollment key" language anywhere, EV-2 won't refresh and enrollment will break silently at token expiry. The implementer-seat can't see that the grant choice is what makes EV-8's `/rc:login` terminal copy coherent — loopback URL vs. `verification_uri_complete` are different copy. These are different blind spots, not mirrors.

Reframe. The proposed design is sound; no reframe needed. One scope correction: EV-1 must also touch §7.4 and §9.1, because leaving "host enrollment key" in the trust table while §7.2 says OAuth2 ships a self-contradictory spec — the exact failure mode this card exists to remove.

Recommended design.

- **Attended (browser available):** Authorization Code + PKCE (RFC 7636), public client, loopback redirect `http://127.0.0.1:<port>/callback` (RFC 8252). No client secret.
- **Unattended (headless):** Device Authorization Grant (RFC 8628). Print only `user_code` + `verification_uri_complete`, never `device_code`; poll `token_endpoint` with `grant_type=urn:ietf:params:oauth:grant-type:device_code`, honoring `interval`, `slow_down`, `expired_token`, `access_denied`.
- **Endpoints (contract, like §5.3):** pin discovery `GET /.well-known/oauth-authorization-server` (RFC 8414) returning required fields `authorization_endpoint`, `token_endpoint`, `device_authorization_endpoint`; both modes share `token_endpoint`. Access token is presented as `Authorization: Bearer` to the existing `POST /tunnels`. Optional `revocation_endpoint` (RFC 7009).
- **Storage:** extension settings, user-only readability (EV-7 already pins this): `piRemote.serverUrl`, `piRemote.accessToken`, `piRemote.tokenExpiry`, `piRemote.refreshToken` (only if issued). Env vars are at most `PI_REMOTE_SERVER_URL` override; credentials never via env (shell history/process exposure). Refresh via `grant_type=refresh_token` on 401; no refresh token issued → re-run `/rc:login`. Failed flow writes nothing half-written.
- **`/rc` unenrolled:** fail gracefully, footer returns to `off`, output says run `/rc:login`; no inline prompt. Enrollment is modal (browser tab or device code); inlining it into `/rc` breaks `/rc`'s idempotent no-op semantics that EV-8 depends on.

Threat model. Both grants converge on an access token scoped to tunnel creation only (`tunnels:create`) — preserving §7.4's blast radius (leaked token creates tunnels for sessions the attacker can already see locally, grants no session access, tenant-contained). PKCE binds the code to the verifier; loopback binds to localhost. The refresh token is the new long-lived secret with the old host key's blast radius, so storage permissions and clean replacement on re-run matter. The extension may assume RFC 8414/6749/8252/8628 conformance and a Bearer token accepted by `POST /tunnels`; it may not assume a client secret, refresh-token issuance, or token longevity.

Testable claims. (1) `grep -n '/rc-off\|PI_REMOTE_HOST_KEY' docs/PI-SPEC.md` returns zero matches post-change (env override text must not reuse `PI_REMOTE_HOST_KEY`). (2) The headless section names `device_authorization_endpoint` — an implementation reading only `authorization_endpoint` cannot compile against the contract. (3) §7.4's Host row says access/refresh token, not "host enrollment key" — checkable by grep. (4) Unenrolled `/rc` issues no `POST /tunnels` (EV-8 acceptance already makes this runnable).

---

**designer** (job-3.3, verbatim):

---

<output_format>

Design position. Replace §7.2 host enrollment with an OAuth2-based `/rc:login` flow that uses **Authorization Code with PKCE (loopback redirect)** as the only grant, storing the resulting refresh token in extension settings as the long-lived credential. Delete `/rc-off` and replace it with `/rc:off` everywhere in §8. The `/rc` command becomes: load the stored credential, dial the signed `wss://` URL it authorizes, and on missing credential surface a single non-modal footer affordance that points to `/rc:login` — never an inline multi-step wizard inside `/rc`. The card accepts "both modes" but the spec should commit to one grant, because one grant serves both modes (PKCE loopback) and a second grant is a second implementation surface that earns nothing here.

Gulf closed. Gulf of Evaluation, for the host user, at the moment they type `/rc`. Today the spec is ambiguous about what the user must do after typing: prompt for an env var? prompt for a settings field? The new spec gives the host a discoverable next step (`/rc:login`) and a visible state machine on the footer (`off` → `authorizing` → `dialing` → `live` / `error`) so they always know which of those they're in.

Principle and evidence.

- **Signifier + knowledge in the world (§7.2 currently pins `PI_REMOTE_SERVER_URL` and `PI_REMOTE_HOST_KEY` as the *primary* setup path).** Two env-var names are an enormous knowledge-in-head burden — the user must have been told them, in the right case, before they can act. `/rc:login` is a discoverable command and a known affordance; "what do I do first?" reduces to "type `/rc:login`." The spec should present OAuth2 enrollment as the *only* path, with env vars demoted to a documented override for CI/headless bootstraps, not parallel primary.
- **PKCE loopback serves attended *and* unattended.** RFC 8628 device authorization grant is the canonical "no browser" answer, but it adds a second grant, a second set of endpoints (`/device_authorization`, polling), and a second UX (copy a user code, paste it at a verification URL on another device). PKCE loopback works on the same machine with a browser, *and* — with a local-headless browser driver or a manual paste of the redirect URL — works on a server where the user can complete the consent on a different machine and copy the redirect URL back. The card asks which grant serves each mode; the right answer is *one grant, two launch contexts*: attended = open the OS browser to the authorize URL and capture the redirect on `http://127.0.0.1:<port>/cb`; unattended (CI, remote host) = print the authorize URL and the loopback listener port, the user completes consent elsewhere and the redirect is replayed by a documented manual paste path or by a scriptable headless-driver hook. This collapses the acceptance criterion's "two specified flows" into one spec'd flow with two launch contexts, which is the smallest change that closes the gulf.
- **Mapping / control plane contract (acceptance criterion).** The spec should pin, in a new §7.2 subsection structured like §5.3, the exact endpoints the control plane must expose: `GET /authorize` (parameters: `client_id`, `response_type=code`, `code_challenge`, `code_challenge_method=S256`, `redirect_uri`, `scope`, `state`), `POST /token` (form: `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`), and `POST /refresh` (form: `grant_type=refresh_token`, `refresh_token`, `client_id`). The long-lived credential stored in settings is the `refresh_token` plus the `client_id` and the relay base URL — *not* an opaque host key. The §7.2 token model is replaced: the one-time tunnel URL becomes a `wss://` URL minted by `POST /tunnels` authenticated with a *bearer access token* (short-lived, derived from the refresh token), not a long-lived host key.
- **Conceptual model + forcing function (§8).** `/rc` "Ensure settings exist (prompt once for server URL / enrollment key if missing)" must be rewritten. If no credential is present, `/rc` must *not* prompt for one — that conflates two commands and trains the user that `/rc` does setup. Instead, `/rc` returns a footer status of `not enrolled` and the spec pins the copy: "Run `/rc:login` to connect this host." That is the forcing function: one command, one job, and the next step is visible on screen.
- **Feedback (§8 status footer).** Pin a five-state machine: `off`, `not enrolled` (distinguished from `off`), `authorizing` ("waiting for browser…"), `dialing`, `live`, plus a terminal `error` with the reason. Each transition must be visible — delayed or silent transitions are where users press `/rc` twice and assume it's broken.

Falsifiable predictions. (1) After EV-1 lands, a cold reader of §7.2 + §8 should be able to answer "what does the user type first?" in one phrase: `/rc:login`. Skeptic smoke: read §7.2 + §8 aloud and time the answer. (2) The spec must list exactly three control-plane endpoints for enrollment (`/authorize`, `/token`, `/refresh`) and exactly one grant (`authorization_code` + PKCE), with `/device_authorization` *absent*. (3) Searching the spec for `PI_REMOTE_HOST_KEY` returns only an "Override / CI" subsection, not a primary path. (4) Searching for `rc-off` returns zero hits; `/rc:off` returns hits in the §8 table and the `session_shutdown` handler prose. (5) The footer state set is exactly the six states named above, no more — Skeptic can grep for status string literals in the pinned copy.

Preferences, ranked last. I would prefer the §8 table to keep `session_shutdown` as its own row rather than fold it into `/rc:off`, because they have different triggers and different idempotency partners; but if owner wants the table tighter, the prose can carry it. I would also prefer the `not enrolled` state to render with a distinct visual treatment from `off` — but I cannot ground that here, only hand it to skeptic as a CDP smoke. Taste, not argument.

---

### Step 3 — round 2 (cross-position exchange)

The central open dispute after round 1: **two grants vs one grant**. owner+principal: PKCE loopback for attended, RFC 8628 device flow for unattended. designer: PKCE loopback only, unattended served by a second *launch context* (print authorize URL + loopback port; user completes elsewhere and replays the redirect via manual paste or headless-driver hook), device flow rejected as a second implementation surface. Re-dispatching all three generators with each other's positions.
