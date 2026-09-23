---
id: FLLWUP-28
title: "Pin cancellation during the device-flow slowdown wait in the login suite"
state: Ready
owner: null
epic: EPIC-3
goal: The headless login test suite pins cancellation arriving during the 5-second connection-failure slowdown sleep, asserting the driver returns cancelled and issues no further token poll, so behavior the Skeptic proved only by ad-hoc probe is covered by a committed fixture.
---

## Intent

Filed from the FLLWUP-24 run's Skeptic verification cycle 2 (non-blocking
coverage note). FLLWUP-24 added an `await sleep(5_000); continue` slowdown in
the headless device-flow poll catch. The Skeptic proved by probe (a cancel
signal set inside the 5000 ms sleep → outcome `cancelled`, no failure copy, no
further polls) that cancellation during that wait is honored, but the committed
fixture set does not cover it — the owner's fixtures cover the retry path and
the two cause-distinguished expiry paths only.

Behavior is correct today; this card pins it so a future refactor of the
slowdown or expiry path cannot silently break cancellation during the slowdown
without a red test.

## Acceptance

- A committed fixture in `test/login.test.ts` cancels while the driver is inside
  the 5-second slowdown sleep and asserts outcome `cancelled`, with no failure
  copy printed and no token poll issued after the cancel signal.
- The fixture fails if the slowdown loop stops honoring the cancel (red-at-base
  demonstrated for the mechanism it pins).
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
  FLLWUP-29. This card runs third.
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