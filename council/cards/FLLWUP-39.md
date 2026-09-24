---
id: FLLWUP-39
title: "Declare or annotate the vendored PiThinkingContent's omitted optional thinkingSignature/thoughtSignature fields"
state: In Progress
owner: null
epic: EPIC-6
goal: declare or annotate the omitted optional `thinkingSignature`/`thoughtSignature` fields on the vendored PiThinkingContent type (verify against the installed dist types as the first step).
---

## Intent

Filed from FLLWUP-38's step 13 (EPIC-5), held in-container, then confirmed
`File` by a `product-owner` ruling (job-6). Recorded disposition, verbatim:

> Mode: File — composite 0.48 < merge threshold 1.00 — Declare or annotate the vendored PiThinkingContent's omitted optional thinkingSignature/thoughtSignature fields (active)

FLLWUP-38's first-step verification established that the vendored
`PiTextContent` omitted a real optional field (`textSignature`) and closed
the gap by declaring it with provenance against the installed dist types.
The exact sibling case is open: the vendored `PiThinkingContent` in
`src/pi-sdk-events.ts` carries only `{ type: "thinking"; thinking: string }`
— no signature field and no annotation — so the omission is
indistinguishable from an audit gap. First step: verify against the
installed dist types whether the real thinking-content type carries optional
`thinkingSignature`/`thoughtSignature` fields. Then either declare them on
the vendored type (with provenance, per the R-TYPE-1 vendoring pattern,
mirroring FLLWUP-38's DECLARE path) or annotate the omission with why the
vendored surface deliberately leaves it out. `product-owner` observed that
grouping this new card under EPIC-5 (whose Acceptance names only
FLLWUP-32..38) is a separate grouping call, so it is filed ungrouped
(`epic: null`).

## Acceptance

- The vendored `PiThinkingContent` type either declares
  `thinkingSignature`/`thoughtSignature` as the installed dist types carry
  them (verified against those types, with provenance) or carries an
  annotation stating why they are deliberately omitted.
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
