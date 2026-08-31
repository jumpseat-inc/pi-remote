---
title: "EV-7 — Design position round 2: terminal-surface convergence"
date: 2026-08-31
seat: designer
epic: EPIC-1
card: EV-7 (Deliberating)
files-grounded:
  - docs/PI-SPEC.md §7.2 (OAuth2 enrollment; control-plane server URL), §8 (command surface; seven footer states)
  - src/tunnel.ts (ReasonCopy shape, englishFor, closed-set discipline, TunnelReason union, ALREADY_LIVE_COPY)
  - test/tunnel.test.ts (ReasonCopy shape assertions, closed set assertion, static-guard shape, 401/403 distinct, no wss:// in copy)
  - docs/superpowers/specs/2026-08-31-EV-1-design.md (seven footer states; tenantId from token; PI_REMOTE_HOST_KEY retired)
  - docs/superpowers/specs/2026-08-31-EV-2-design.md (reason→copy map shape; englishFor key lookup; severity tag)
  - council/raw round-1 positions (owner, principal)
supersedes: vault/raw/2026-08-31-design-ev7-login-terminal-surface.md
wiki-state: empty (vault/wiki/index.md is a stub); grounded in source files and prior card rulings (EV-1, EV-2, EV-3)
---

# EV-7 — round 2: terminal-surface convergence

## Position (short)

The three round-1 positions converge cleanly on **shape** (`loginReasonCopy:
Record<LoginReason, ReasonCopy>` with stable `userLineKey`s resolved by a
`loginEnglishFor` lookup, mirroring `tunnelReasonCopy` exactly), on the
**flow shape** (attended = auto-open AND print URL + waiting line;
unattended = print `verification_uri_complete` + `user_code` once, then
silent polling with three bound progress prints), and on the **failure
invariant** (every failure ends with "no credentials were saved." or "run
`/rc:login`"). The convergence-decision work this round is: (1) merge the
success line so it is one canonical sentence; (2) close the failure list
to one canonical set; (3) keep my idempotent re-run confirmation; (4)
flag the two genuine product-shape calls to product-owner (tenant display,
re-run confirm).

## Gulf closed

Gulf of Evaluation for the host user at three moments:

1. The moment they hit `/rc:login` and need to know whether the browser
   opened (attended) or where to carry the code (unattended).
2. The moment the flow succeeds — they need to know **what was saved**
   and **what to do next**, without scrolling.
3. The moment the flow fails for any reason — they need a closed-vocabulary
   reason line that always names the next action. "Closed" means the user
   can read one line and act; they do not have to remember which of N
   variants of "run /rc:login" they saw last time.

Gulf of Execution closed at the same three moments: the same copy is the
user's instruction (auto-open URL or carry-code instructions) and their
evaluation (what happened + what's next). No second seam invented.

## Principle + evidence (per line that converges vs diverges)

### Settled-by-convergence (all three seats agree)

- **Shape** mirrors `src/tunnel.ts` line 84 onward: `loginReasonCopy:
  Record<LoginReason, ReasonCopy>` with `{footerState, userLineKey,
  userLine, severity}` per row. `loginEnglishFor(key)` is the lookup, a
  sibling of `englishFor` (test/tunnel.test.ts line ~328 mirrors the
  shape). `userLine` is the stable key; the English default is the
  lookup's value. EV-2 ruling Item 2 made this discipline binding.
- **Attended open** prints two lines: a "Opening your browser…" line and
  a "If the browser does not open, visit: `<authorizeUrl>`" line. RFC
  8252 §7.1 names auto-launch as the native-app default; principal's
  `login.attended.fallback` and designer's "If the browser does not
  open" line are the same affordance. The "and" is not redundant — it
  is the recovery from a failed `deps.openUrl` (sandboxed shell, no
  `DISPLAY`, tmux on a remote box, WSL). Owner's copy includes the
  fallback by design.
- **Attended waiting** is one line ("Waiting for browser…") — owner's
  implicit, principal's `login.attended.waiting`, designer's explicit.
  No chatter during the loopback poll.
- **Headless relay** is two adjacent lines carrying
  `verification_uri_complete` and `user_code`, in that order, with the
  bearer value clearly demarcated (RFC 8628 §3.5's
  `verification_uri_complete` is the form designed for relay; the bare
  `verification_uri` requires user-code composition). Owner, principal,
  designer agree on this shape.
- **Headless bound progress** is three prints at fixed boundaries: at
  `expiresIn / 2`, at `expiresIn - 30s`, and (if applicable) at
  `expired_token`. Silent otherwise. Settled.
- **Cancel + timeout** are two distinct terminal states (not merged).
  Both state "no credentials were saved." Settled.
- **Every failure** ends with one of two fixed tail clauses: "No
  credentials were saved." or "Run /rc:login to try again." (or
  "…check your network and try again." for the unreachable row). The
  invariant is enforceable as a regex over the closed set. Settled.
- **`<serverUrl>`** is the control-plane server URL (never the tunnel
  URL, never `wss://`). The tunnel URL is a one-time secret that must
  never appear in any copy (test/tunnel.test.ts line ~308 pins this for
  tunnel.ts; the same discipline binds login.ts).

### Settled by my round-2 voice (decisive on close calls)

- **Success line** — principal's framing wins. "Signed in to
  `<serverUrl>` — enrollment credentials saved for this host. Run /rc
  to start a tunnel." Owner's "Enrolled with `<serverUrl>` — run /rc to
  create a tunnel" is too compact (the user can't tell what was
  actually persisted; "create" vs "start" matters less than "saved").
  Designer's "Enrolled this host with `<serverUrl>` (tenant
  `<tenantId>`) — run /rc to start a tunnel" loses the "credentials
  saved" semantic, which is the Gulf of Evaluation content.
  - **`<tenantId>` is included only when present in the token response**
    (per EV-1 ruling Q3, the control plane may or may not emit a
    tenant-scoped `sub`). When present, append " (tenant `<tenantId>`)"
    *before* the "Run /rc" clause. When absent, the line is exactly
    principal's. This avoids the empty-tenant parenthetical the
    unconditional form produces for single-tenant servers and keeps
    the informational value for multi-tenant ones. Product-owner may
    overturn — see open judgment #1.
  - "Start" not "create" — PI-SPEC §8 says `/rc` "starts translating
    live events"; principal's "start a tunnel" is closer to spec
    register than owner's "create a tunnel." Settled.
- **Failure list — closed to principal's 11-row set, with my invariant
  applied verbatim.** Principal's set is the finest-grained (it
  distinguishes `redirectTimeout` from `redirectMismatch`, `tokenExchangeFailed`
  from `invalidTokenResponse`, `browserOpenFailed` from `unreachable`,
  `noServerUrl` from `discoveryInvalid`). Owner's 9-row set collapses
  several of these (e.g., "expired" rolls up `expiredCode` +
  `redirectTimeout` + flow-internal timeouts). My 10-row set is
  intermediate. The argument for principal's finer-grained list is
  that each row's *recovery* is different — `redirectMismatch` is a
  CSRF/state-binding failure that does NOT recover by retrying
  `/rc:login` (it indicates a malicious or buggy redirect); collapsing
  it with `expiredCode` sends the user into an infinite retry loop on
  a non-recoverable failure. The argument against principal's list is
  size; the argument against is weak because each row is a one-line
  English default and the closed-set discipline (test/tunnel.test.ts
  line ~378) makes the cost a static guard, not a copy-review cost.
- **Re-run while enrolled → confirmation prompt.** Designer-only round 1,
  but the underlying semantic ("re-running replaces the existing
  credential") is settled in EV-1 and EV-2's reasoning about the
  credential seam. The prompt itself is a product-shape call (silent
  replace vs confirm) — see open judgment #2. The settled copy is
  offered as the designer's recommendation; product-owner may ratify
  or replace with "replace silently."
- **Invariant tail clause wording: "No credentials were saved."** over
  principal's "nothing was saved." The "credentials" noun is
  vocabulary-consistent with the user's task (they typed `/rc:login`
  to *save credentials*; "credentials" is the word they will look for
  in the next line). "Nothing" requires the user to infer what was not
  saved.

### Settled against my own round-1 preference

- **No `user_code` re-print during polling chatter.** Even at the
  `expiresIn - 30s` boundary, do not re-print the bearer code. The code
  landing in scrollback or screenshot tools is the security hazard
  this discipline avoids. Settled.
- **Voice rules** carry over from my round 1: sentence case, em-dash
  cadence, second-person imperative, backticks for command and
  user-relayable values, angle brackets for caller-filled placeholders,
  no `wss://`, no `device_code`, no `access_token`, no `refresh_token`,
  no HTTP body, no stack trace in any user-visible string.

## Canonical copy table (final, binding once product-owner signs off open judgments)

`login.ts` exports:

```ts
export const loginReasonCopy: Record<LoginReason, ReasonCopy> = {
  // ...all rows have {footerState: "error", userLineKey, userLine: <key>, severity: "error"}
};
export function loginEnglishFor(key: string): string; // English-default lookup
export const ALREADY_LOGGING_IN_COPY = "…";           // single-in-flight ack
export const REPLACEMENT_PROMPT_COPY = "…";          // idempotent re-run prompt
```

### Progress + terminal lines

| `userLineKey` | English default (renders via `loginEnglishFor`) | When |
|---|---|---|
| `login.attended.opening` | `Opening your browser to enroll this host with \`<serverUrl>\`…` | first line of `/rc:login` attended |
| `login.attended.fallback` | `If the browser does not open, visit: \`<authorizeUrl>\`` | second line, always |
| `login.attended.waiting` | `Waiting for browser…` | during loopback poll |
| `login.attended.success` | `Signed in to \`<serverUrl>\` — enrollment credentials saved for this host. Run /rc to start a tunnel.` | on loopback callback success (append ` (tenant \`<tenantId>\`)` when tenantId is present) |
| `login.headless.instructions` | `On any device with a browser, open:` | first line of `/rc:login --headless` |
| `login.headless.carry` | `  \`<verificationUriComplete>\`` | second line, always |
| `login.headless.code` | `and enter the code:` | third line |
| `login.headless.codeValue` | `  \`<userCode>\`` | fourth line |
| `login.headless.expire` | `The code expires in <expiresIn>s.` | fifth line |
| `login.headless.half` | `<halfExpiresIn>s left — keep waiting, or run /rc:login again to restart.` | first polling print |
| `login.headless.thirty` | `<30sLeft>s left — keep waiting, or run /rc:login again to restart.` | second polling print |
| `login.headless.success` | `Signed in to \`<serverUrl>\` — enrollment credentials saved for this host. Run /rc to start a tunnel.` | on token_endpoint success (append tenant parenthetical as for attended) |
| `login.cancelled` | `Sign-in cancelled — no credentials were saved.` | Ctrl-C at any time during a live flow |
| `login.alreadyRunning` | `Another /rc:login is already in progress — wait for it to finish, then try again.` | second invocation while a flow is in flight |
| `login.replacementPrompt` | `This host is already enrolled with \`<serverUrl>\` (tenant \`<tenantId>\`). Re-running will replace the existing credential. Press Enter to continue, or Ctrl-C to keep the existing credential.` | first line of re-run while enrolled, before any side effect |

### Closed failure set

| `userLineKey` | English default | When |
|---|---|---|
| `login.failure.noServerUrl` | `No control-plane URL is configured. Set \`piRemote.serverUrl\` (or \`PI_REMOTE_SERVER_URL\`) and run /rc:login again.` | invoked with no serverUrl in scope |
| `login.failure.unreachable` | `Cannot reach \`<serverUrl>\` — check your network and try again.` | DNS / TCP / TLS / HTTP timeout on any enrollment endpoint |
| `login.failure.discoveryInvalid` | `\`<serverUrl>\` is not an OAuth2 authorization server (discovery failed). Check the URL with your control-plane admin.` | RFC 8414 metadata missing required field (`authorization_endpoint`, `token_endpoint`, or `device_authorization_endpoint`) |
| `login.failure.browserOpenFailed` | `Could not open a browser — visit the URL printed above manually to continue. No credentials were saved.` | attended: `deps.openUrl` returned false; fall back to manual paste at the printed URL (loopback listener still bound) |
| `login.failure.redirectTimeout` | `The browser did not complete the consent in time. No credentials were saved.` | attended: loopback callback never fired within the timeout window |
| `login.failure.redirectMismatch` | `The browser redirected to an unexpected URL — enrollment was cancelled for safety. No credentials were saved.` | attended: `state` parameter mismatch, wrong host, or unexpected path (CSRF / open-redirect guard) |
| `login.failure.authorizationDenied` | `Authorization denied — run /rc:login to retry. No credentials were saved.` | attended: `/authorize` returned `error=access_denied`; unattended: device-flow `access_denied` |
| `login.failure.tokenExchangeFailed` | `Token exchange failed — run /rc:login to retry. No credentials were saved.` | `POST /token` returned non-2xx (except `authorizationDenied` mapped separately) |
| `login.failure.invalidTokenResponse` | `\`<serverUrl>\` returned an invalid OAuth2 response. No credentials were saved. If it repeats, ask your control-plane admin.` | `POST /token` returned 2xx but body failed runtime validation (missing `access_token`, bad shape) |
| `login.failure.expiredCode` | `The enrollment code expired before you finished — run /rc:login to retry. No credentials were saved.` | unattended: device-flow `expired_token` |
| `login.failure.deviceDenied` | `Device authorization was denied on the other device — run /rc:login to retry. No credentials were saved.` | unattended: explicit "I did not consent" on the other device, distinct from the generic `authorizationDenied` |
| `login.failure.storageFailed` | `Could not persist credentials locally — run /rc:login to retry. No credentials were saved.` | atomic-write failure (chmod 0600, tmp+rename) — the credential was issued but not stored; safe to retry, the server still has the consent |
| `login.failure.timedOut` | `Sign-in timed out — no credentials were saved. Run /rc:login to try again.` | flow-internal deadline exceeded (e.g., 5 min total, separate from `redirectTimeout`/`expiredCode` which are RFC-level) |

Every row ends with one of: `no credentials were saved.` (most rows),
`run /rc:login` (network + retry rows), or `check the URL with your
control-plane admin` (`discoveryInvalid`, when re-running would not
help). This is the enforceable invariant.

### Distinctness assertions (Skeptic gate)

- `login.attended.success` and `login.headless.success` resolve to
  the **same** English string (only the `userLineKey` differs by mode).
  Test: `loginEnglishFor(loginReasonCopy.login.attended.success.userLineKey)
  === loginEnglishFor(loginReasonCopy.login.headless.success.userLineKey)`.
- `login.failure.authorizationDenied` (attended) and
  `login.failure.deviceDenied` (unattended) resolve to **distinct**
  English strings, even though both are denial — the remediation
  copy differs in framing.
- `login.failure.redirectTimeout`, `login.failure.expiredCode`, and
  `login.failure.timedOut` resolve to **three distinct** English
  strings (RFC-level timeout on the loopback vs RFC-level timeout on
  the device grant vs flow-internal total-timeout).
- `login.failure.unreachable` and `login.failure.discoveryInvalid`
  are **distinct** — one names "check your network," the other
  names the admin.

## Flow design (final, binding)

### `/rc:login` (attended, default)

1. Resolve `serverUrl` (env > settings; on absent → `login.failure.noServerUrl`,
   exit). Read existing enrollment credential from settings if any.
2. If existing credential present, print `login.replacementPrompt`. Read
   Enter; on Ctrl-C, exit silently and emit nothing (the existing
   credential is preserved).
3. Render `login.attended.opening`, then `login.attended.fallback` (always,
   regardless of whether `deps.openUrl` succeeds — the fallback is the
   recovery, not a fallback-for-failure).
4. Attempt `deps.openUrl(authorizeUrl)`. If false, do not abort;
   continue to step 5 (the fallback line gives the user the URL).
5. Render `login.attended.waiting`. Bind loopback listener. Wait up to
   `redirectTimeout` for the callback.
6. On callback: state-check, fetch `token_endpoint` from discovery (or
   the in-shared-discovery cache from tunnel.ts via injection).
   Exchange `authorization_code` + `code_verifier`.
7. On 200: parse, persist atomically (`storageFailed` on write fail).
   Render `login.attended.success`. Close listener. Exit 0.
8. On `redirectMismatch`, `redirectTimeout`, `tokenExchangeFailed`,
   `invalidTokenResponse`, `browserOpenFailed` (only if listener never
   bound and URL unreachable), or `authorizationDenied`: close listener,
   render the matching `login.failure.*` line. Exit non-zero.

### `/rc:login --headless`

1. Same step 1 (no replacement prompt in headless mode — the headless
   shape is already interruption-heavy and the user's intent is
   unambiguous; flag this micro-decision in the next round if owner /
   principal push back).
2. Render the four-line relay block (`login.headless.instructions`,
   `login.headless.carry`, `login.headless.code`, `login.headless.codeValue`),
   then `login.headless.expire`.
3. POST `device_authorization_endpoint` to obtain `{device_code,
   user_code, verification_uri, verification_uri_complete, expires_in,
   interval}`. Print `login.headless.carry` using
   `verification_uri_complete` (fallback to `verification_uri` only when
   the complete form is absent — principal's `login.headless.carryCode`
   covers this branch). **Never re-print the code at any polling print.**
4. Poll `token_endpoint` with `grant_type=device_code` honoring `interval`
   and `slow_down` (+5s per spec). Silent between polls.
5. Print `login.headless.half` once, when half of `expires_in` has
   elapsed. Print `login.headless.thirty` once, when `expires_in - 30s`
   remains. Both print the seconds-remaining integer, not the literal
   `halfExpiresIn` / `30sLeft` placeholders.
6. On terminal RFC 8628 errors: `authorizationDenied` →
   `login.failure.authorizationDenied`; `deviceDenied` (rare but distinct)
   → `login.failure.deviceDenied`; `expired_token` →
   `login.failure.expiredCode`. On transport errors: `unreachable` /
   `discoveryInvalid` / `tokenExchangeFailed` / `invalidTokenResponse`
   per the attended path.
7. On 200: persist atomically, render `login.headless.success`. Exit 0.

### Cancellation

- SIGINT (Ctrl-C) during any flow → render `login.cancelled`. No POST
  to `authorization_endpoint` / `token_endpoint` /
  `device_authorization_endpoint` after SIGINT (assertable).
- Flow-internal total timeout (`login.failure.timedOut`) → distinct
  from `login.failure.redirectTimeout` (loopback) and
  `login.failure.expiredCode` (RFC 8628).

## Hand-offs

### Owner (test surface)

The single source of truth for copy is `loginEnglishFor`. Every test
asserts the rendered English default via `loginEnglishFor(key)`. The
copy map follows the `loginReasonCopy` shape exactly; the test file
asserts the closed-set discipline, the invariant tail clauses, and
the distinctness assertions above.

Static guards (modeled on test/tunnel.test.ts line ~393):

- `grep -nE 'wss://|device_code|access_token|refresh_token' src/login.ts`
  → exit 1.
- `grep -nE 'process\.env' src/login.ts` → exit 1 (the env override
  reads `PI_REMOTE_SERVER_URL` upstream in EV-8, not in login.ts).
- `Object.keys(loginReasonCopy).sort()` equals the closed set above.
- Every `loginReasonCopy[k].userLine` is a stable key (string starting
  with `login.`), not an English sentence — the English value lives in
  the lookup.

Testable claims (Skeptic runs):

1. `loginEnglishFor` resolves every key in the closed set, including
   the 12 progress keys + 12 failure keys + 1 already-running key +
   1 replacement-prompt key.
2. Every failure row's English default ends with one of the three
   invariant tails (`no credentials were saved.` / `run /rc:login` /
   `control-plane admin`).
3. `login.attended.success.userLine === login.headless.success.userLine`
   (same key → same English string).
4. Static guard: no `wss://`, `device_code`, `access_token`,
   `refresh_token`, or `process.env` in any string literal exported
   from `src/login.ts`.
5. SIGINT during a live flow renders `login.cancelled` exactly once
   and issues zero `POST` requests to `authorization_endpoint` /
   `token_endpoint` / `device_authorization_endpoint` after SIGINT
   (assertable by sending SIGINT and inspecting the request log).
6. Re-running while enrolled prints `login.replacementPrompt` **before**
   any HTTP request to `authorization_endpoint` /
   `device_authorization_endpoint`. Assertable by pre-seeding the
   settings store with a credential and inspecting the request log.
7. Headless polling emits ≤ 3 prints over a simulated 5-minute poll
   (at `expires_in/2`, `expires_in - 30s`, and — if applicable —
   `expired_token`). Assertable by mocking `now()` and counting
   `console.log` invocations.
8. The unattended block always prints `verification_uri_complete` and
   `user_code` on adjacent lines in that order; the URI-complete form
   is the default, the bare `verification_uri` is a fallback only
   (assertable by mocking the discovery response).

### Skeptic (CDP smoke)

The single comprehension-asserting prediction is **#8 in the table
above**: a first-time user presented with the attended fallback line
must recognize it as "what to do if nothing happens." The semantic
content ("visit this URL") is what the smoke asserts; the unit test
asserts only the literal string. If the smoke fails, the unit test
passes and the copy is wrong — the inverse of the usual finding.

### Product-owner — TWO OPEN JUDGMENTS, list verbatim

1. **Tenant display in success line.**
   - Position: include `(tenant <tenantId>)` only when the token
     response carries a tenant-scoped `sub` claim (per EV-1 ruling Q3).
     When absent, render principal's compact form.
   - Option rejected: unconditional `(tenant <tenantId>)` always present
     (renders ` (tenant )` for single-tenant servers; ugly).
   - Option rejected: never display tenantId (loses the multi-tenant
     disambiguation value, which is the only reason the field exists).
   - Reversibility: trivial — single string edit.
2. **Re-run while enrolled — confirm vs silent replace.**
   - Position: confirm with `login.replacementPrompt` (designer r1).
     The credential overwrite is a consequential side effect; the cost
     of one Enter press is trivial; the cost of silent overwrite on a
     shared host (where another operator's enrollment gets clobbered)
     is real.
   - Option rejected: silent replace (owner's round-1 "replaces the
     existing credential cleanly" reads as silent). Faster, but no
     recovery from a misclick or a script invocation with stale
     credentials.
   - Reversibility: trivial — remove the prompt block, replace the
     first line of the replacement-prompt branch with a no-op.
   - **Micro-decision (not worth escalating): replacement prompt in
     headless mode.** Default: do NOT prompt in headless (the user
     has already committed to a long-running flow; an extra Enter
     press would interrupt the wait). If product-owner overturns,
     the prompt is identical text; the only change is the
     `mode === "headless"` branch.

These two items are the only ones I could not converge with owner and
principal on through copy/structural argument alone. Every other
disagreement in this round was a voice or a granularity call, settled
by the canonical table above.

## Preferences, ranked last

- Sentence-case headings in code comments (style, not argument).
- The "Press Enter to continue" phrasing in `login.replacementPrompt`
  is slightly less explicit than "press Enter within 10 seconds" but
  matches `pi`'s own prompt affordance; would defer to whatever pi
  does natively when this lands.
- The `[!]` sentinel in front of the replacement prompt (taste only;
  not in the canonical copy because visual treatment is EV-8 / theme
  scope, not login.ts scope).
- Two-line vs single-line "what was saved" — current form is
  single-line with em-dash cadence; a two-line form ("Enrolled this
  host with `<serverUrl>`. / Run /rc to start a tunnel.") would also
  work, but loses the at-a-glance "credentials saved" semantic.

## Closing

EV-7 can ship to step 8 (owner implementation) with this canonical copy
table plus the two open-judgment escalations. The two escalations are
**copy-routine** rather than product-shape-changing — neither
overturns a recorded decision, neither opens a new contract surface,
neither forces an architectural change. They are the kind of judgment
product-owner is exactly the seat for.

The round-1 → round-2 delta is small: one canonical success line, one
canonical closed failure set (principal's 11-row list), one canonical
replacement prompt (designer's), and two escalations. Every other
disagreement was voice or granularity, settled by the table.