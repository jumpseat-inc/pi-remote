---
id: FLLWUP-34
title: "Update AGENTS.md's 'Current state' once FLLWUP-12 lands"
state: Done
owner: owner/fllwup-34-agents-current-state (PR #40, merged 26f52bb)
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

## Run record

- Runner took the card (mechanical path — docs-only correction to one bullet
  in AGENTS.md, unambiguous and single-area; no deliberation). Routing note:
  `council_route` is not available to this container's tool set; the recorded
  mode **Verify** from the dispatch input is applied as authoritative and not
  re-recorded.
- Precondition observed: FLLWUP-12 Done (PR #39, merged 524bc90) and
  FLLWUP-11 Done (PR #38, merged a91a30b), both on the board's Done column —
  the gating pair the stale bullet named has landed.
- Surface-touching bit: **false** (AGENTS.md is an agent-guidance doc, not a
  person-facing product surface; no visible surface, copy, empty state, or
  error state changes). Phase-1 classes per R-CLASS-1: structured `n/a`.
- Step 8 (job-2.1): delivered. Branch `owner/fllwup-34-agents-current-state`
  (base origin/main 94d0550), **PR #40**, head
  `5c19eb004dbcd3f8ba3226c1ca6d20f0247d68d4`. Diff product-only: AGENTS.md
  (+8/−6) + plan file `docs/superpowers/plans/2026-09-24-FLLWUP-34-agents-current-state.md`
  (+146); zero council/vault/.pi paths. The stale bullet ("Not yet loadable
  in a real `pi` host" + its "Do not claim installability until they land"
  instruction) replaced with a "**Loadable in a real `pi` host.**" bullet
  stating the post-FLLWUP-11/12 reality — real load through the installed
  production loader proven green (FLLWUP-11), strict-Proxy load smoke pinning
  the entry to the real loader's member names, handler payload narrowing
  reconciled to real SDK payloads with real-shaped fixtures (FLLWUP-12) —
  event-framed, zero numbers pinned as eternal (FLLWUP-31 discipline),
  ending "Do not claim beyond what is proven above". Owner gates: `bunx tsc
  --noEmit` exit 0; `bun test` 270 pass / 1 Windows-gated skip / 0 fail.
  Owner push anomaly, reported not improvised: origin push failed on the
  repo-local `url.<https>.insteadOf` rewrite (no https credentials); push
  succeeded over the explicit `ssh://git@github.com/…` URL form; no shared
  config changed.
- In Review set from the observed artifact: PR #40 OPEN, head 5c19eb0, base
  main (verified via `gh pr view`).
- Merge-check criterion 2 observed directly by the runner on the PR head:
  `gh pr checks 40 --json name,state,workflow` → workflow `gates` state
  SUCCESS (both jobs) at head 5c19eb0.
- Step 9 skeptic, verify cycle 1 of 3 (job-2.2): **VERIFY-PASS — no open
  objections, zero closed-red** (13 objections filed, all closed-green with
  real output: head/branch/clean-state, product-only diff containment, stale
  bullet gone + new text verbatim, tsc exit 0, bun test 270/1/0 twice, load
  smoke proven non-vacuous by defect injection → red → restored → green,
  both Done-card provenances verified ancestors of origin/main, no eternal
  counts (zero numbers in the new bullet), no claim beyond proven, no stale
  gating instruction surviving in the diff, PR state/head confirmed).
  No fix cycles needed — verify cycle count: 1 of 3.
- Step 10 judge (job-2.3): **PASS.** Basis: stale claim removed and replaced
  correctly (loadability stated, both cards referenced, observe-and-state
  discipline kept); gates green (tsc exit 0; 270 pass / 1 expected skip /
  0 fail); PR #40 open at confirmed head with product-only diff.
- Step 11/12: all five merge criteria held (mode Verify, criterion 3 scoped
  to the single Verify skeptic dispatch): (1) owner gates green in full at
  head 5c19eb0, re-run independently by the skeptic; (2) `gates` workflow
  SUCCESS on the PR head SHA, read directly; (3) no blocking Skeptic
  objection; (4) judge PASS (job-2.3); (5) no Needs Human state, no
  outstanding ruling. Merged PR #40 as squash **26f52bbca6a886ca957425de244328bcee40de70**
  with `--match-head-commit 5c19eb0…` held (ordinary merge; R-ADMIN-1
  unused — main unprotected, 0 rulesets). CI green on the merged SHA
  (gates run on 26f52bb, conclusion success; check-runs gates +
  gates-windows both success at that head_sha). Card Done on card+board
  from that observed artifact. Step-12 record commit pushed to main under
  R-PUSH-1 (run-scoped). Local main fast-forward-unable (diverged by this
  card's own record commits 1c6050e, fa9ada4) → documented union reconcile
  via `git merge origin/main` (disjoint files, conflict-marker sweep clean,
  validate clean).
- Step 13: no follow-up candidates drafted — every surfaced item was folded
  in (provenance card references kept in the replacement bullet), settled by
  a skeptic test, or out-of-scope for this card; nothing remains that the
  run surfaced but did not do. `council_followup_review` not called (no
  candidates).
