---
id: FLLWUP-37
title: "Watch the duplicated message-family role decoder between translate.ts and pi-sdk-events.ts"
state: Backlog
owner: null
epic: EPIC-5
goal: track and scope removal of the duplicated role decoder (forced by the G-12 no-runtime-imports purity rule; lifting G-12 is steward authority, not this card's).
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.50 < merge threshold 1.00 — Watch the duplicated message-family role decoder between translate.ts and pi-sdk-events.ts (active)

FLLWUP-12 introduced `src/pi-sdk-events.ts` (vendored real payload
interfaces + derivation helpers, per R-TYPE-1) and in doing so duplicated
the message-family role decoder that translate.ts already carries. The
duplication is forced by the G-12 no-runtime-imports purity rule; lifting
G-12 is steward authority and out of this card's scope. This card watches
the duplication: track that both decoders stay in agreement (the static
pairing test pins them today) and scope what removal would look like if
G-12 is ever lifted, so the duplication is a tracked, bounded liability
rather than drift waiting to happen.

## Acceptance

- The duplication is tracked with a stated removal scope (what a G-12 lift
  would delete and what the pairing test pins), and the pairing test still
  holds.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.

## Run rulings — /features-deliver EPIC-5 (2026-09-24)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-PUSH-1 (run-wide)** — Run-scoped authorization: the Phase-1 record
  (`council/phase1-rulings.json`, `council/phase1-authorizations.json`,
  `council/run-strategy.json`) and the step-12 record commit may be committed
  and pushed directly to `main` for this run only. Never extended to any later
  run.
- **R-ADMIN-1 (run-wide)** — Run-scoped authorization:
  `gh pr merge <PR> --squash --admin --match-head-commit <X>` may be used if a
  `main` ruleset blocks an ordinary merge. Unused while `main` is unprotected
  (0 rulesets, branch-protection API 404). Never extended to any later run.
- **R-MERGE-1 (run-wide)** — This run is unattended. The orchestrator (and the
  runner under the deterministic merge check) executes the merge check and the
  merge without pausing for human confirmation, including the first merge of
  the run.
- **R-ORDER-1 (run-wide)** — Build order (steward job-1): FLLWUP-34 →
  FLLWUP-35 → FLLWUP-38 → FLLWUP-37 → FLLWUP-32 → FLLWUP-33 → FLLWUP-36.
  FLLWUP-38 immediately precedes FLLWUP-37 (shared `src/pi-sdk-events.ts`);
  FLLWUP-37 must not attempt to lift G-12.
- **R-CLASS-1 (run-wide)** — Phase-1 class rulings are recorded at
  `council/phase1-rulings.json`: `surface copy`, `state and field naming`,
  `uncertainty display`, and `error and empty-state text` are structured
  `n/a`; `gate user-visibility` is ruled **information only** (the recorded
  mode is read mechanically by the merge check and reported in the run ledger,
  never surfaced as a blocking human prompt).

**Recorded execution mode (orchestrator routing, EV-69):** **Verify** — one
owner, one skeptic, one judge; all five deterministic-merge criteria with
criterion 3 scoped to the single Verify skeptic dispatch. A generator seat in
the runner subtree upgrades the effective mode to Deliberate.
