---
id: FLLWUP-34
title: "Update AGENTS.md's 'Current state' once FLLWUP-12 lands"
state: In Progress
owner: null
epic: EPIC-5
goal: AGENTS.md's stale "not yet loadable" claim is half-overtaken by FLLWUP-11's landing; full update waits for FLLWUP-12.
---

## Intent

Filed from FLLWUP-11's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.70 < merge threshold 1.00 — Update AGENTS.md's 'Current state' once FLLWUP-12 lands (active)

FLLWUP-11 landed (PR #38, merged `a91a30b`): the ExtensionAPI stand-in now
reconciles with the real SDK surface and a real load through the installed
production loader was proven green. That half-overtakes `AGENTS.md`'s
"Current state" claim that the extension is "**Not yet loadable in a real
`pi` host**".

The other half of the claim — handler payload narrowing — is FLLWUP-12's
work, still open. The ruling's timing is explicit: the full "Current state"
rewrite waits for FLLWUP-12 to land, so this card is **blocked on
FLLWUP-12** and must not land first (it would trade one stale claim for
another). When it runs: rewrite the "Current state" bullet to state the
loadability reality as of both cards' landing — loadable against the real
SDK surface, with whatever qualification FLLWUP-12's outcome warrants —
without pinning counts as eternal (same discipline as FLLWUP-31's ruling).

## Acceptance

- This card is not promoted to `Ready` before FLLWUP-12 is `Done`.
- `AGENTS.md`'s "Current state" no longer carries the stale "not yet
  loadable" claim; the replacement states the post-FLLWUP-12 reality and
  follows FLLWUP-31's observe-and-state discipline for any counts.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass (docs-only change, gates
  run as hygiene).

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
