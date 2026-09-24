---
id: FLLWUP-32
title: "Fix the load-smoke test-2 header's overstated compile-time claim"
state: Done
owner: null
epic: EPIC-5
goal: `test/pi-sdk-load.test.ts`'s second test header claims a compile-time guarantee its runtime body does not enforce; correct the comment or make the claim true.
---

## Intent

Filed from FLLWUP-11's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.22 < merge threshold 1.00 — Fix the load-smoke test-2 header's overstated compile-time claim (active)

FLLWUP-11's verification flagged this as a non-blocking doc nit: the second
test in the load-smoke suite carries a header comment overstating what the
test actually enforces (a compile-time guarantee where the body only checks
runtime behavior, or vice versa). A test header that claims more than its
body proves misleads a later reader about what regression the suite guards
([[Fixture-Green Honesty]]: an acceptance claim should state only what is
proven).

The fix is either to correct the comment to match the body or to add the
assertion that makes the claim true — whichever the implementer finds
faithful to the original intent.

## Acceptance

- The second test's header in `test/pi-sdk-load.test.ts` no longer claims
  more than the test enforces (or the test now enforces the claim).
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

## Run record — FLLWUP-32 (EPIC-5)

- Step 8 owner (job-9.1): fix shape = **make the body enforce the claim** —
  compile-time conditional-type const `keyof ExtensionAPI extends
  RealSurfaceKey ? true : never = true` (`RealSurfaceKey =
  (typeof REAL_LOADER_API_KEYS)[number]`; `ExtensionAPI` type-imported from
  `../index.ts`), old 3-key loop retained as a labeled runtime mirror, test
  retitled to name the honest enforcement point (`bunx tsc --noEmit`, not
  `bun test`). Defect injection at the owner: phantom member → TS2322
  true→never; pre-fix body provably enforced nothing. Gates at head `e4fae7c`:
  tsc exit 0; `bun test` 273 pass / 1 skip / 0 fail. PR #44 opened
  (branch `owner/fllwup-32-test-header-honesty`, cut from origin/main
  `ec6c16f`), diff product-only (exactly `test/pi-sdk-load.test.ts`).
- Step 9 skeptic (job-9.2, single Verify dispatch): **NO-BLOCK** at head
  `e4fae7cca07e8ea5ad5a0dd6fc9e961b6c206e95`. Gates re-run independently:
  tsc exit 0; `bun test` 273/1/0 (skip = Windows-gated ACL test, tolerated).
  Non-vacuity reproduced: phantom member on `index.ts`'s `ExtensionAPI` →
  `test/pi-sdk-load.test.ts(109,11): error TS2322: Type 'true' is not
  assignable to type 'never'`, tsc exit 1, reverted clean; same phantom under
  the pre-fix body → tsc exit 0 (the false claim reproduces; card premise
  confirmed). Header honesty: every clause of the new title tested (keyof =
  all declared members; tsc trips; bun test provably blind — 273/1/0 with the
  phantom). Non-weakening: 3-key loop retained verbatim, zero assertions
  deleted/loosened; dropped `probe` verified observation-free (all imports of
  `src/pi-sdk-on.ts` type-only). Diff hygiene: exactly one file, zero
  council/docs paths. Arithmetic: 3 members on `ExtensionAPI`, 3/3 in
  `REAL_LOADER_API_KEYS` — the `true` resolution is a genuine subset fact.
  Non-blocking note: runtime mirror remains a 3-key sanity check (unchanged,
  scope-excluded); first test's docstring claim outside this card's scope.
  No open objections. Verify-cycle count: 1 of 3 (no fix-and-reverify rounds).
- Step 10 judge (job-9.3): **PASS** at head `e4fae7c`. Basis: the retitled
  header accurately states what the test enforces; the conditional-type const
  is a genuine compile-time gate (non-vacuous per the Skeptic's phantom
  injection: tsc TS2322 at the const, bun test provably blind); gates green
  (tsc exit 0; 273/1/0 with the Windows-gated skip the only non-pass); no
  weakening (runtime mirror and its assertions retained verbatim; `probe`
  removal observation-free). Human merge gate (step 11) substituted per
  R-MERGE-1: deterministic merge check executed by this runner (mode Verify,
  criterion 3 scoped to the single Verify skeptic dispatch).
- Step 11/12: all five Verify-mode criteria held — (1) owner gates green in
  full (tsc exit 0; `bun test` 273 pass / 1 skip / 0 fail, re-run
  independently by the Skeptic at the head); (2) `gh pr checks 44 --json
  name,state,workflow` keyed on `workflow=="gates"`: SUCCESS present on PR
  head `e4fae7cca07e8ea5ad5a0dd6fc9e961b6c206e95` (both `gates` and
  `gates-windows` rows); (3) single Verify skeptic NO-BLOCK; (4) judge PASS;
  (5) no Needs Human state, no outstanding ruling. Merged PR #44 as squash
  **3245631560294c4931a36d8d8055988db24eac32** (`--match-head-commit
  e4fae7c…` held; ordinary merge — R-ADMIN-1 unused, `main` unprotected).
  CI green on the merged SHA: `gates` run 36038748894, headSha
  `3245631…`, conclusion success, both jobs (`gates`, `gates-windows`)
  success. Step-12 reconcile: local main merged origin/main (`9c0d67f`),
  validator clean, conflict-marker sweep clean. Card Done on card+board from
  that observed artifact. Step-12 record commit pushed to main under
  R-PUSH-1.
- Step 13 follow-ups: none drafted — the run surfaced no deferred idea,
  out-of-scope objection, or "we should also…". The Skeptic's non-blocking
  notes are scope-excluded observations about unchanged neighboring claims
  (the first test's docstring describes runtime behavior test 1's body does
  enforce; the 3-key runtime mirror is unchanged from pre-fix), not new work
  items. Nothing held; no candidate was surfaced for
  `council_followup_review`.
