---
id: FLLWUP-40
title: "Correct the FLLWUP-12 pairing test's source comment, which overstates what the test pins"
state: Ready
owner: null
epic: EPIC-6
goal: correct the FLLWUP-12 static pairing test's source comment in test/translate.test.ts (~:431-434) so it matches what the test actually pins (wording to match the merged docs/ROLE-DECODER-DUPLICATION.md).
---

## Intent

Filed from FLLWUP-37's step 13 (EPIC-5), held in-container, then confirmed
`File` by a `product-owner` ruling (job-8). Recorded disposition, verbatim:

> Mode: File — composite 0.37 < merge threshold 1.00 — Correct the FLLWUP-12 pairing test's source comment, which overstates what the test pins (active)

FLLWUP-37's cycle-1 Skeptic finding (`closed-red`) demonstrated that the
static pairing test's source comment in `test/translate.test.ts` claims a
coupling the assertions below it do not enforce: dropping `"user"` from the
decode comparison leaves the suite green (273 pass / 1 skip / 0 fail), and
the 400-char signature window matches the return-type annotation rather than
the decode comparison. The merged `docs/ROLE-DECODER-DUPLICATION.md`
(squash `3660df5`) already states the true scope — the test pins
derivation-text presence and role vocabulary in the signature windows, and
does **not** pin the value-level decode comparison. The FLLWUP-37 fix was
doc-only and did not reopen the test file, so this comment-only correction
becomes its own card. No assertion changes, no behavior change, no G-12
touch.

## Acceptance

- The pairing test's source comment in `test/translate.test.ts` (~:431–434)
  accurately describes what the test pins, consistent with
  `docs/ROLE-DECODER-DUPLICATION.md`.
- No assertion or behavior change; the pairing test still passes.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.
## Run rulings — /features-deliver EPIC-6 (2026-09-24)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-ONE-RUN-1 (run-wide)** — This epic is delivered by a **single**
  `council-runner` covering both children in one council run: exactly one
  `owner` implementation dispatch (one branch, one PR) implements FLLWUP-39
  and FLLWUP-40 together first, then exactly one `skeptic` verification and
  one `judge` evaluation cover both. No per-card runner duplication.
- **R-PUSH-1 (run-wide)** — Run-scoped authorization: the Phase-1 record
  (`council/phase1-rulings.json`, `council/phase1-authorizations.json`,
  `council/run-strategy.json`) and the step-12 record commit may be committed
  and pushed directly to `main` for this run only. Never extended to any later
  run.
- **R-ADMIN-1 (run-wide)** — Run-scoped authorization:
  `gh pr merge <PR> --squash --admin --match-head-commit <X>` may be used if a
  `main` ruleset blocks an ordinary merge. Unused while `main` is unprotected.
  Never extended to any later run.
- **R-MERGE-1 (run-wide)** — This run is unattended. The orchestrator (and the
  runner under the deterministic merge check) executes the merge check and the
  merge without pausing for human confirmation, including the first merge of
  the run.
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
