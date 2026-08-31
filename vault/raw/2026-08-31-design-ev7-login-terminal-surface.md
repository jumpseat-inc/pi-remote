# EV-7 design position — `/rc:login` terminal surface

> Source of the position: pi-remote Council round-1 design output for card
> EV-7 ("/rc:login OAuth2 enrollment command", EPIC-1, Deliberating).
>
> This document supersedes nothing; it is the durable record of the position
> given to `owner` for round 2.

## Binding context (sourced)

- `docs/PI-SPEC.md` §7.2 (host enrollment, two grants), §8 (command surface,
  seven-state footer including `authorizing`).
- `council/cards/EV-1.md` round-3 convergence (grants per mode), `vault/raw/
  2026-08-31-po-ev1-ruling.md` Q1 ruling (retire `PI_REMOTE_HOST_KEY`).
- `src/tunnel.ts` lines 102–162 (copy vocabulary: closed `TunnelReason`
  set, `userLineKey`, English default, `<serverUrl>` placeholder,
  `englishFor` lookup).
- `test/tunnel.test.ts` lines 102–110 (`ALREADY_LIVE_COPY`), 172–230 (copy
  asserts: 401 vs 403 distinct, 401 names `/rc:login`, unreachable does not
  name `/rc:login`, no `wss://` literal in copy), 336–346 (closed reason
  set), 390–400 (static guards).
- Localization is a future card (FLLWUP-4); the established copy pattern
  is **stable message key + English default lookup** — no new mechanism.

## Position summary

A small, fully-pinned vocabulary of one-line terminal states. Each state
has a stable `userLineKey`, an English default, and an explicit next action.
Secrets never appear in any line. Failure rows are a closed set in the same
shape as `TunnelReason`. Attended mode opens the browser **and** prints the
authorize URL (recovery affordance). Unattended mode prints
`verification_uri_complete` + `user_code` together, then polls silently
with three bound progress prints. Re-running `/rc:login` while enrolled is
explicit and confirmed, not silent. Ctrl-C and timeout both leave settings
untouched and say so.

## Gulf closed

- Execution for the host user at the moment they type `/rc:login` — they
  know exactly where to look (browser tab / phone browser) and exactly what
  to carry (a code, a URL).
- Evaluation for the host user during the wait — silence or one named line,
  never a flood.
- Evaluation on every failure — the failure line always names the next
  action.

## Principle and evidence

- **Signifier + knowledge in the world.** Every line is a stable
  `userLineKey` that resolves through `englishFor` like `tunnelReasonCopy`.
  The user never has to remember the flow because each line names the next
  step.
- **Feedback.** Attended: one "Waiting for browser…" line. Unattended:
  silence by default; three named progress moments. Bounded chatter is
  honest about progress; unbounded chatter reads as broken.
- **Conceptual model.** `/rc:login` either succeeds once or names the one
  next action. Two affordances in attended (auto-open + print URL) is not
  redundancy; it is recovery from a failed auto-launch. RFC 8252 §7.1
  recommends both for native apps.
- **Forcing function.** "No credentials were saved." is appended to every
  failure row unless the row already states it. Re-running while enrolled
  is a confirmation prompt before any side effect.
- **Mapping.** Each `userLineKey` line carries at most one piece of
  dynamic content, bracketed in angle brackets (the `<serverUrl>`
  convention). The angles mean "filled in at render time," which is the
  convention every existing test already understands.
- **Reuse, not invention.** `englishFor(key)` lookup is unchanged. New
  failure rows are additive.

## Voice rules

- Sentence case, em-dash cadence, second-person imperative.
- Backticks wrap the command and any user-relayable value (`user_code`,
  `verification_uri_complete`, `<authorizeUrl>`).
- Angle-brackets wrap placeholders the caller fills at render time
  (`<serverUrl>`, `<tenantId>`, `<expiresIn>`, `<halfExpiresIn>`,
  `<30sLeft>`, `<verificationUriComplete>`, `<userCode>`, `<authorizeUrl>`).
- Never emits `wss://`, `device_code`, `access_token`, `refresh_token`, or
  any HTTP body or status text.

## Proposed exact strings

### Attended — `/rc:login`

```
Opening your browser to enroll this host with `<serverUrl>`…
If the browser does not open, visit:
  `<authorizeUrl>`
Waiting for browser…
```

On loopback success, replace the trailing `Waiting for browser…` line with:

```
Enrolled this host with `<serverUrl>` (tenant `<tenantId>`) — run /rc to start a tunnel.
```

### Unattended — `/rc:login --headless`

```
To enroll this host, on any device with a browser visit:
  `<verificationUriComplete>`
and enter the code:
  `<userCode>`

The code expires in <expiresIn>s.
```

Three bound progress prints while polling (silent otherwise):

```
<halfExpiresIn>s left — keep waiting, or run /rc:login again to restart.
<30sLeft>s left — keep waiting, or run /rc:login again to restart.
```

On `access_denied`:

```
The enrollment was denied on the device — run /rc:login --headless to try again.
No credentials were saved.
```

On `expired_token`:

```
The enrollment code expired before you finished — run /rc:login --headless to try again.
No credentials were saved.
```

On success:

```
Enrolled this host with `<serverUrl>` (tenant `<tenantId>`) — run /rc to start a tunnel.
```

### Cancellation and timeout

Ctrl-C:

```
/rc:login cancelled — no credentials were saved.
```

Flow timeout:

```
/rc:login timed out — no credentials were saved.
Run /rc:login to try again.
```

### Closed failure set

| `userLineKey`                              | English default |
|---|---|
| `login.failure.unreachable`                | `Cannot reach `<serverUrl>` — check your network and run /rc:login to try again.` |
| `login.failure.serverError`                | `<serverUrl>` returned a server error during enrollment — run /rc:login to try again.` |
| `login.failure.discoveryFailed`            | `<serverUrl>` is not an OAuth2 authorization server (discovery failed) — check the URL with your control-plane admin.` |
| `login.failure.denied`                     | `The enrollment was denied on the device — run /rc:login --headless to try again.` |
| `login.failure.codeExpired`                | `The enrollment code expired before you finished — run /rc:login --headless to try again.` |
| `login.failure.loopbackTimeout`            | `The browser did not complete the consent in time — run /rc:login to try again.` |
| `login.failure.brokerLaunchFailed`         | `Could not open a browser — visit the URL printed above manually, then run /rc:login if it does not complete.` |
| `login.failure.cancelled`                  | `/rc:login cancelled — no credentials were saved.` |
| `login.failure.timedOut`                   | `/rc:login timed out — no credentials were saved. Run /rc:login to try again.` |
| `login.failure.invalidResponse`            | `<serverUrl>` returned an invalid OAuth2 response — run /rc:login to try again; if it repeats, ask your control-plane admin.` |

Every failure row ends with either `no credentials were saved.` or
`run /rc:login` — this is the enforceable invariant that makes the
acceptance clause "no half-written credential" visible.

### Idempotent re-run

When `piRemote.refreshToken` already exists:

```
This host is already enrolled with `<serverUrl>` (tenant `<tenantId>`).
Re-running will replace the existing credential.
Press Enter to continue, or Ctrl-C to keep the existing credential.
```

## Falsifiable predictions (skeptic-ready)

1. The attended flow prints `If the browser does not open, visit:` exactly
   once before the loopback listener is bound — assertable via render-log
   fixture or grep-equivalent on the rendered attended flow.
2. Static guard on `src/login.ts`: zero occurrences of `device_code`,
   `access_token`, `refresh_token` in any string literal exported from the
   module. The grep shape mirrors `test/tunnel.test.ts` line ~393.
3. `Object.keys(loginReasonCopy).sort()` equals the closed failure set,
   assertable in the shape of `test/tunnel.test.ts` line ~378.
4. Every failure `userLine` ends with `no credentials were saved.` or
   `run /rc:login`. Assertable as a regex over the closed set.
5. Unattended polling emits ≤ 3 printed lines over a simulated 5-minute
   poll (at `expires_in/2`, `expires_in - 30`, and — if applicable —
   `expired_token`). Assertable by mocking `now()` and counting
   `console.log` invocations.
6. When settings already contain a credential, the literal
   `Re-running will replace the existing credential.` is printed **before**
   any HTTP request to `authorization_endpoint`. Assertable by pre-seeding
   the settings store and inspecting the request log.
7. The unattended block always prints `verification_uri_complete` and
   `user_code` on adjacent lines in that order; asserting
   `verification_uri_complete` without `verification_uri` is a separate
   shape (the URI-complete form, not the bare URI + code pair). The
   comprehension-asserting half of this prediction routes through a CDP
   smoke, not a unit test.
8. On SIGINT during a live flow, the literal
   `/rc:login cancelled — no credentials were saved.` is printed exactly
   once, and zero `POST` requests are issued to `authorization_endpoint` or
   `token_endpoint` after the SIGINT. Assertable by sending SIGINT and
   inspecting the request log.

## Preferences, ranked last

- Already-enrolled prompt with a `[!]` sentinel: taste, not argument.
- "Enrolled this host with…" over "Enrolled…": slight preference for the
  redundant form because forwarded terminal output is a real reading
  context.
- Re-print `verification_uri_complete` during unattended polling chatter:
  argued **against** my own preference — re-printing increases the chance
  the URL lands in scrollback or screenshot tools. Security call.
- Human-friendly `expiresIn` rounding (`30m` vs `1800s`): argued against;
  the wire contract is raw seconds and pre-localization rounding risks
  confusing a user reading both the terminal and an RFC 8628 client.

## Hand-offs

- **Owner**: the `loginReasonCopy` table is the test surface; every gate
  reduces to `englishFor(loginReasonCopy[k].userLineKey)`. The only safe
  dynamic prints are the `verification_uri_complete` URL and the
  `user_code`.
- **Skeptic**: every prediction above is a copy or structural assertion;
  the only comprehension-asserting prediction (#7) routes through a CDP
  smoke.
- **Product-owner**: the only product-shape decision is "auto-open browser
  **and** print URL" (one extra line over RFC 8252's "or"). The argument
  is that auto-launch failure is common on developer hosts (sandboxed
  shells, no DISPLAY, tmux on a remote box, WSL) and the cost is one line
  of copy. The fallback path (`brokerLaunchFailed`) already exists if
  product-owner prefers the smaller surface.
