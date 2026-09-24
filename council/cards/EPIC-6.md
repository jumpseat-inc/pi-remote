---
id: EPIC-6
title: "SDK vendoring residuals — FLLWUP-39/40 delivered in one council run"
state: Ready
owner: null
epic: null
goal: Observed as met when FLLWUP-39 and FLLWUP-40 are both Done from a single council run in which one owner implementation (one branch and one PR) covers both changes, one Skeptic verification covers both, and one judge PASS covers both, with bunx tsc --noEmit exit 0 and bun test green.
---

## Intent

Filed to give the two ungrouped residuals from the EPIC-5 run a home, the
way EPIC-5 grouped the EPIC-4 residuals. They are:

- **FLLWUP-39** — "Declare or annotate the vendored `PiThinkingContent`'s
  omitted optional `thinkingSignature`/`thoughtSignature` fields" (filed from
  FLLWUP-38's step 13, confirmed `File` by product-owner job-6).
- **FLLWUP-40** — "Correct the FLLWUP-12 pairing test's source comment, which
  overstates what the test pins" (filed from FLLWUP-37's step 13, confirmed
  `File` by product-owner job-8).

Both are small, non-overlapping residuals from the same seam — the vendored
SDK type surface in `src/pi-sdk-events.ts` and the adjacent pairing
test/comment in `test/translate.test.ts` — and both share the same honesty
axis (a vendored surface that must state only what is proven).

Unlike EPIC-5, which tracked a set and was not actionable on its own, **this
epic is delivered as a single unit**: one Council run, in which a single
`owner` implements both changes on one branch and one PR, a single `skeptic`
verifies both, and a single `judge` evaluates both. The rationale is cost
proportionality — the two changes are tiny and touch the same seam, so one
implementation pass and one verification pass serve both without the
per-card overhead of a runner each. This is the delivery model the epic's
`goal` encodes and the judge reads.

**Grouping reassigns FLLWUP-39 and FLLWUP-40 from `epic: null` to
`epic: EPIC-6`.** This card tracks the pair and carries the one-run delivery
constraint; it is not intended to be run as a per-card tracking epic.

## Acceptance

Observed as met when FLLWUP-39 and FLLWUP-40 are both `Done`:

- FLLWUP-39: the vendored `PiThinkingContent` type either declares
  `thinkingSignature`/`thoughtSignature` as the installed dist types carry
  them (verified against those types, with provenance) or carries an
  annotation stating why they are deliberately omitted.
- FLLWUP-40: the FLLWUP-12 pairing test's source comment in
  `test/translate.test.ts` accurately describes what the test pins,
  consistent with `docs/ROLE-DECODER-DUPLICATION.md`, with no assertion or
  behavior change.
- Both changes landed from **one council run** — exactly one owner
  implementation dispatch (one branch and PR) covering both, one Skeptic
  verification covering both, and one judge `PASS` covering both.
- `bunx tsc --noEmit` exits 0 and `bun test` is green throughout.
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
