---
id: FLLWUP-33
title: "Correct the member-count discrepancy in FLLWUP-11's record"
state: In Review
owner: owner/fllwup-33-record-count (PR #45, head efd1347)
epic: EPIC-5
goal: The card text says "twelve"; the base stand-in had 13 non-`on` members; the run record's "none exist on the real ExtensionAPI" phrasing is inaccurate for the 2 kept members.
---

## Intent

Filed from FLLWUP-11's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.51 < merge threshold 1.00 — Correct the member-count discrepancy in FLLWUP-11's record (active)

FLLWUP-11's verification flagged this as a non-blocking record nit with two
faces:

1. The card text (Intent and Acceptance) repeatedly says "twelve" non-`on`
   members, but the skeptic's member audit counted **13** non-`on` base
   members on the stand-in.
2. The run record states all twelve were verified and "none exist on the
   real `ExtensionAPI`" — inaccurate for the **2 kept members** that do
   exist on the real SDK and were kept typed-to-real (the other 11 were
   re-homed to `ExtensionContext`/local capabilities or dropped).

The record is the durable account of what the run proved; a count and a
"none exist" claim that contradict the audited reality mislead the next
reader of the council record. Correct both in `council/cards/FLLWUP-11.md`
(and the board line only if it repeats the claim — it does not).

## Acceptance

- `council/cards/FLLWUP-11.md` states the member count as 13 non-`on` base
  members, with the audit breakdown (2 kept typed-to-real, 5 ctx re-home,
  5 local capability, 1 dropped) not contradicted anywhere in the record.
- The "none exist on the real `ExtensionAPI`" phrasing is corrected to
  distinguish the kept members (exist on the real SDK, typed against their
  real signatures) from the removed ones.
- No change to the card's `state` (`Done`), owner line, or merged-SHA facts.

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
