---
id: FLLWUP-29
title: "Pin the attended PKCE path's no-error_description boundary in the login suite"
state: Backlog
owner: null
epic: EPIC-2
goal: The login suite pins that the attended (PKCE) token-exchange path emits no `login.failure.detail` line even when the response body carries an `error_description`, so the dispatch boundary the Skeptic proved only by ad-hoc probe is covered by a committed fixture.
---

## Intent

Filed from the FLLWUP-25 run's Skeptic verification. FLLWUP-25 added the
`login.failure.detail` line to the headless device-flow poll's
`tokenExchangeFailed` path only; the attended (PKCE) token-exchange path must
not emit it. The owner's committed fixtures cover the device-flow boundaries
(`deviceDenied`, `expiredCode`, `invalidTokenResponse`) but not the attended
path — the Skeptic proved the attended boundary correct by an ad-hoc probe only.

Behavior is correct today; this card pins it so a future change that widens the
emit site into the shared `tokenExchangeFailed` handling cannot silently start
printing the server's description on the attended path without a red test.

## Acceptance

- A committed fixture in `test/login.test.ts` drives the attended (PKCE)
  token-exchange failure with an `error_description` present on the response
  body and asserts NO `login.failure.detail` line is printed.
- The fixture fails if the attended path starts emitting the detail line
  (red-at-base demonstrated for the mechanism it pins).
- No product behavior or copy changes; `bunx tsc --noEmit` exit 0; `bun test`
  green.