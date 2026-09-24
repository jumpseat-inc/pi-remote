---
id: FLLWUP-36
title: "Ground emission-semantics claims in the event-constructing layer, not only the pass-through emitter"
state: In Review
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
