---
id: FLLWUP-35
title: "Add a fold-bookkeeping probe that catches a dropped message_start masked by the message_update fallback"
state: Done
owner: null
epic: EPIC-5
goal: add a regression probe ensuring a dropped `message_start` cannot be silently masked by the `message_update` fallback path (translate.ts's mid-join role back-derivation).
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.31 < merge threshold 1.00 — Add a fold-bookkeeping probe that catches a dropped message_start masked by the message_update fallback (active)

FLLWUP-12's verification found that translate.ts's mid-join role
back-derivation — the `message_update` fallback that infers a role when the
original `message_start` was never seen — can silently mask a dropped
`message_start`: the fold continues on the fallback path and the loss is
never observable in the emitted frames. A fold-bookkeeping probe makes that
masking detectable: when a `message_update` arrives with no matching
`message_start` bookkeeping entry, the probe records it, so a dropped start
shows up as a test failure instead of a silent role substitution.

## Acceptance

- A regression probe exists that fails when a `message_start` is dropped and
  its absence is masked by the `message_update` fallback path in
  translate.ts.
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

## Run record — delivery (2026-09-24, Verify path)

Delivered on PR [#41](https://github.com/jumpseat-inc/pi-remote/pull/41)
(`owner/fllwup-35-fold-probe`, head `fcfcafd395341c4d7e5e20307ddc40f0e4548079`,
cut from origin/main 9393151). Mechanical/Verify path: one owner (job-4.1),
one skeptic (job-4.2), one judge (job-4.3); no deliberation, no spec file.

- **Shape chosen: red-at-base probe + minimal instrumentation.** The fold's
  emitted frames for a dropped start are byte-identical to a legitimate
  mid-join, so a shape-only probe cannot fail — the card's stated
  insufficiency. Probe pins `midJoin: true` bookkeeping on the fallback path
  (`OpenMessageState` gains the marker; 3 construction sites;
  `messageFrameRoleLocal` untouched, frame-neutrality byte-identical across 4
  sequences).
- **Red-at-base evidence** (skeptic-reproduced, mechanism-absent reds): probe
  tests transplanted onto base 9393151 → `bun test test/translate.test.ts` 51
  pass / 2 fail, exit 1 (`Expected: true / Received: undefined` at 792;
  `Expected: false / Received: undefined` at 805; both name `book?.midJoin`).
  At head the same command is 53 pass / 0 fail. Frame-only probe 3 passed at
  base — demonstrating shape-only assertion insufficient.
- **Defect injection at head** (message_start bookkeeping neutered): probe 2
  red `Expected: false / Received: true` + the EV-4 user-role framing test
  red, while the frame-only probe stayed green — the marker, not frame shape,
  exposes the mask.
- **Owner gates (skeptic-re-run, closed-green):** `bunx tsc --noEmit` exit 0;
  `bun test` 273 pass / 1 skip / 0 fail (the skip is the Windows-gated
  credential-ACL test on non-Windows). Verify cycle 1 of ≤3; no fix cycles
  used.
- **Judge: PASS** (basis on all three acceptance points; PR-head subject,
  pre-merge frame).
- **Deterministic merge check (mode Verify, criteria 1–5):** owner gates
  green in full; `gh pr checks 41` keyed on `workflow=="gates"` →
  `state: SUCCESS` on head `fcfcafd` (absent-check rule observed — the row
  was present); no blocking skeptic objection; judge PASS; no Needs Human
  state or outstanding ruling. Merged
  `gh pr merge 41 --squash --match-head-commit fcfcafd395341c4d7e5e20307ddc40f0e4548079`
  → squash commit `a283f9acb1dd10ce28dd035ab9c2e1e5e5f6d435` on main; ordinary
  merge (main unprotected; R-ADMIN-1 unused). CI green on the merged SHA
  (gates completed success, observed directly). Local main reconciled with
  origin/main via union-keep merge `a4a03a9` — no conflict markers; validate
  clean. R-PUSH-1 authorizes this record push.
- **Non-blocking residual (open-untested):** the owner's exact injection
  fail-count ("3 fail") was not reproducible as stated; the skeptic's own
  injection produced 2 fail with the mechanism proven. Not a gate claim;
  recorded for honesty, not blocking. Cited under R-CLASS-1 for the
  surface-touching determination (no person-facing surface).
