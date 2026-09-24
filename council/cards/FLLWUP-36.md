---
id: FLLWUP-36
title: "Ground emission-semantics claims in the event-constructing layer, not only the pass-through emitter"
state: Done
owner: owner/fllwup-36-construction-grounding (PR #46, head fd41cc3)
epic: EPIC-5
goal: make construction-layer grounding of emission-semantics claims a systematic check, not per-clause prose.
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.42 < merge threshold 1.00 — Ground emission-semantics claims in the event-constructing layer, not only the pass-through emitter (active)

FLLWUP-12's verification grounded its emission-semantics claims by reading
the installed engine's event-constructing layer (agent-loop.js,
anthropic-messages.js, assistant-message-frame.js), not only the
pass-through emitter — and that grounding is what caught the object-identity
premise the pass-through view alone would have blessed. Today that grounding
happens as per-clause prose in a card record; this card makes it
systematic: a documented check (or scripted probe) that any claim about what
the engine emits is verified against the layer that constructs the event,
so future cards cannot rely on emitter-shape reasoning alone.

## Acceptance

- Construction-layer grounding is a systematic, repeatable check for
  emission-semantics claims (documented procedure or scripted probe), not
  per-clause prose.
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

## Run record — FLLWUP-36 (EPIC-5)

- Routing (step 1): `council_route` is not available to this container's tool
  set (recorded EPIC-4/EPIC-5 precedent, FLLWUP-11/FLLWUP-33 faces); the
  recorded mode **Verify** from the dispatch input is applied as authoritative
  and not re-recorded. Full-vs-mechanical judged by the facilitator per the
  dispatch input: **mechanical** — not cross-seam, and the card sanctions both
  designs with a stated selection rule (scripted probe preferred where
  genuinely repeatable, documented procedure acceptable), so the `goal` does
  not admit two reasonable designs; mechanical path skips steps 2–6, no spec
  file, the card itself was the owner's handoff. Effective mode stays **Verify**
  (no generator seat dispatched — owner, skeptic, judge only).
- Surface-touching bit: **false** (test probe + doc; R-CLASS-1 rules `surface
  copy` n/a for this epic — no person-facing surface).
- Step 8 owner (job-11.1): worktree `/home/tista/codes/pi-remote-fllwup-36`,
  branch `owner/fllwup-36-construction-grounding` cut from origin/main
  `4b49967`, **PR #46**, head `fd41cc3547c927d39bf6004aac0ece1ad1674e0d`,
  single commit. Diff = 4 files (+457/−3), product-only: new
  `test/construction-grounding.test.ts` (scripted probe: locates installed SDK
  via 3 non-brittle anchors — `PI_REMOTE_TEST_SDK_ROOT` override → realpath of
  `pi` on PATH walked to package.json → global node_modules layout — imports
  the real `runAgentLoop` + real `AssistantMessageEventStream`, drives the
  construction layer with a synthetic provider feed, asserts A1 fresh-copy
  start/update emissions, A2 `message_end` carries the accumulated final
  object itself, A3 `(role,timestamp)` partitions emissions, A4 the repo's
  `agentMessageId` stable-within/distinct-across streams, A5 content anchors
  in the three construct-layer files; skips loudly where the SDK is absent,
  e.g. CI ubuntu), new `docs/construction-grounding.md` (probe + 5-step
  documented procedure with three-part citation format for claims the probe
  cannot mechanize, boundaries, non-vacuity record),
  `vault/wiki/Emission-Semantics Fidelity.md` + `vault/wiki/index.md`
  (systematization recorded on the page the FLLWUP-12 doctrine already cites;
  content verified against the probe by the Skeptic). `src/pi-sdk-events.ts`
  untouched (FLLWUP-38's edit preserved). Owner gates at head: tsc exit 0;
  `bun test` 279 pass / 1 skip / 0 fail (six probe tests executed green
  against installed SDK 0.87.1).
- Step 9 skeptic (job-11.2, single Verify dispatch): **NO-BLOCK** at pinned
  head `fd41cc3`. Four falsifiable objections, all **closed-green**, each
  settled by a run test: (1) injected identity-keyed `agentMessageId` → A4 RED
  (`identity:0` vs `assistant:…`), restored byte-identical — the probe catches
  the FLLWUP-12 defect class; (2) A1 counterfactual RED (1 distinct identity
  of 3 shared-object emissions); (3) SDK hidden → 0 pass / 6 skip / 0 fail
  with printed skip reason — skip is loud, never a silent pass; (4) TS2322
  injection → tsc RED exit 1, restored clean (gate integrity). Non-blocking:
  CI ubuntu shows the probe as 6 skip / exit 0, disclosed verbatim in doc +
  wiki; "object identity never survives" is loose as a universal (tool-family
  start/end share identity at agent-loop.js:53-54/117-118/635-636) but precise
  for the assistant family — the probe's enforced scope and the doc's declared
  Boundary; pre-existing phrasing, not from this PR. Head gates re-run
  independently (tsc exit 0; 279/1/0, six probe tests green), base comparison
  at origin/main `4b49967`: 273/1/0, 14 files — head − base = exactly +6 tests
  +1 file. Verify-cycle count: **1 of 3** (no fix-and-reverify rounds).
- Step 10 judge (job-11.3): **PASS** at head `fd41cc3`. Basis: goal met (probe
  + documented procedure = systematic, repeatable check, not per-clause prose)
  and gates pass (tsc exit 0; 279/1/0; probe 6/0; diff exactly the 4
  deliverable files).
- Step 11/12 (human merge gate substituted per R-MERGE-1): deterministic merge
  check executed by this runner, mode **Verify**, all five criteria held — (1)
  owner gates green in full; (2) `gh pr checks 46 --json name,state,workflow`
  keyed on `workflow=="gates"`: `gates` + `gates-windows` both SUCCESS on PR
  head `fd41cc3547c927d39bf6004aac0ece1ad1674e0d` (re-read immediately before
  merge, SHA matched); (3) single Verify skeptic NO-BLOCK (criterion 3 scoped
  per Verify); (4) judge PASS; (5) no Needs Human state, no outstanding
  ruling. Merged PR #46 as squash
  **c758dd4c593b178dfb7636c69be49c2ddbe61094** (`--match-head-commit fd41cc3…`
  held; ordinary merge — R-ADMIN-1 unused, `main` unprotected). CI green on
  the merged SHA: `gates` and `gates-windows` check-runs on `c758dd4…`,
  conclusion success, both completed; `gates` run success. Step-12 reconcile:
  local main union-merged origin/main (324208a), validator clean,
  conflict-marker sweep clean; card Done on card+board from the observed
  merged-with-green-CI artifact. Card is EPIC-5's last (R-ORDER-1) — no
  follow-up cards filed; step 13 none drafted.
