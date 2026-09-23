---
id: FLLWUP-29
title: "Pin the attended PKCE path's no-error_description boundary in the login suite"
state: Ready
owner: null
epic: EPIC-3
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

## Run rulings — /features-deliver EPIC-3 (2026-09-23)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-CONV-1 (FLLWUP-27, FLLWUP-30)** — The run-hygiene conventions are written
  in this repository's `AGENTS.md`. This card is unaffected; recorded here for
  run completeness.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-27 → FLLWUP-30 → FLLWUP-28 →
  FLLWUP-29. This card runs fourth.
- **R-PUSH-1 (run-wide)** — Run-scoped authorization: the step-12 record
  commit may be committed and pushed directly to `main` for this run only.
  Never extended to any later run.
- **R-ADMIN-1 (run-wide)** — Run-scoped authorization:
  `gh pr merge <PR> --squash --admin --match-head-commit <X>` may be used if a
  `main` ruleset blocks an ordinary merge. Unused while `main` is unprotected.
  Never extended to any later run.
- **R-MERGE-1 (run-wide)** — This run is unattended. The orchestrator executes
  the deterministic merge check and the merge without pausing for human
  confirmation, including the first merge of the run.