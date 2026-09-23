---
id: FLLWUP-24
title: "Honor RFC 8628 §3.2's connection-failure slowdown: retry the device-flow token poll after 5s instead of failing terminal unreachable"
state: In Progress
owner: null
epic: EPIC-2
goal: The headless device-flow driver retries the token poll after 5 seconds when the request fails at the connection level (fetch throw), per RFC 8628 §3.2, instead of failing terminal unreachable.
---

## Intent

Filed from FLLWUP-22's deferred items (the §2.3 poll-shape fix, PR #26, left
this deliberately out of its boundary). RFC 8628 instructs clients that hit a
connection failure during polling to wait 5 seconds and retry; the shipped
driver treats any fetch throw as terminal `unreachable`. Real divergence,
client-side fix — a transient network blip during a 5-300s device-flow window
should not kill a login that would have succeeded. User-visible surface — the
`/rc:login --headless` failure copy: `unreachable` becomes rarer and the retry
is silent unless the window expires.

## Acceptance

- On a connection-level failure (fetch throw), the driver waits 5 seconds and
  re-polls, within the device-code window. At device-code-window expiry the
  terminal outcome is cause-distinguished: if no token poll in the window ever
  received an HTTP response, the outcome is `unreachable` with its existing
  verbatim copy; if at least one poll received a response, the outcome is
  `timedOut` with its existing copy. No copy string changes.
- The four RFC 8628 error codes' dispatch (FLLWUP-22's 400-window table) is
  unchanged; `authorization_pending`/`slow_down` semantics unchanged.
- Fixtures cover the retry path (connection failure → 5s → success) and the
  expiry boundary; bunx tsc --noEmit exit 0; bun test full suite green.
- No copy change without the product-owner's ruling (user-visible lines are
  verbatim-ruled or keyed — see [[Stable Keys]]).

## Errata

- **RFC citation (product-owner 2026-09-02).** The title and goal cite RFC 8628
  §3.2 for the connection-failure slowdown; the directive is **§3.5** and the 5s
  figure is §3.2's default minimum poll interval. The goal's normative content is
  unaffected. See `vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md`.
- **Cause-distinguished expiry (product-owner 2026-09-02).** Acceptance clause 1
  was amended by the product-owner: at device-code-window expiry the terminal
  outcome is `unreachable` if the token endpoint was never reached in the window,
  else `timedOut`. No copy strings change. Same ruling file.
