---
id: FLLWUP-38
title: "Declare or annotate the vendored PiTextContent's omitted optional textSignature field"
state: Done
owner: null
epic: EPIC-5
goal: declare or annotate the omitted optional `textSignature` field on the vendored PiTextContent type (verify against the installed dist types as the first step).
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.36 < merge threshold 1.00 — Declare or annotate the vendored PiTextContent's omitted optional textSignature field (active)

FLLWUP-12's verification flagged that the vendored `PiTextContent` type in
`src/pi-sdk-events.ts` omits the optional `textSignature` field the real
SDK surface carries. First step: verify against the installed dist types
that the field exists and is optional. Then either declare it on the
vendored type (with provenance, per R-TYPE-1's vendoring pattern) or
annotate the omission with why the vendored surface deliberately leaves it
out — so a later reader does not mistake the omission for an audit gap.

## Acceptance

- The vendored `PiTextContent` type either declares `textSignature`
  (verified against the installed dist types, with provenance) or carries an
  annotation stating why it is deliberately omitted.
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

## Run record — /features-deliver EPIC-5 (2026-09-24)

Mechanical/Verify path (steps 7–12). Card pre-verified by the facilitator
against the installed dist types first, per the card's own first step: the
real type is `TextContent` (pi-ai dist/types.d.ts:242–246, field
`textSignature?: string` at :245) — the field **exists and is optional**; no
`PiTextContent` name exists in the installed package. Surface-touching: no.

- Step 8 owner (job-5.1): chose **DECLARE** (Real-Surface Verification
deploys annotation only where the real payload genuinely lacks a field —
this one genuinely has it, so the omission was a vendoring gap). Branch
`owner/fllwup-38-text-signature` cut from origin/main b6e77bf; worktree
`../pi-remote-fllwup-38`; PR **#42**, head `92ef66426faf8e6c55570dce1de848b378175729`;
diff: src/pi-sdk-events.ts only, +7/−2 (`textSignature?: string` declared on
`PiTextContent`, provenance pi-ai dist/types.d.ts:242–246, field at :245);
package.json byte-identical (no SDK dependency). Owner gates: tsc exit 0;
bun test 273 pass / 1 skip / 0 fail (skip = Windows-gated credential-ACL,
expected). Incident: owner's initial push failed on the repo's https-rewrite
(no https credentials) — pushed via per-invocation pushInsteadOf override;
config restored byte-identical; main worktree untouched.
- Step 9 skeptic (job-5.2, the single Verify skeptic dispatch): **NO-BLOCK**,
verify cycle 1 of 3, no fix cycles. Six objections, all closed-green, each by
an actual run: provenance lines reproduced verbatim (awk 242–246);
package.json sha256 match; diff product-only; field declared optional;
no runtime-behavior overclaim (declaration + comment only); gates green at
head (tsc exit 0; 273/1/0). Gate-integrity probes: tsc proven able to fail
(TS1128 on injected syntax break); tsc proven unable to detect
mirror-fidelity defects (injected `text: number` stayed exit 0 — union not
flow-connected), so fidelity is pinned by the provenance read, independently
reproduced; bun test proven able to fail (injected runtime defect → 1 fail
naming the expectation). All injections restored; restore proven by empty
diff + sha256 match + full re-run green.
- Step 10 judge (job-5.3): **PASS.** Basis: declaration present at head with
provenance :245; gates green (tsc 0; 273/1/0); diff minimal and product-only.
- Step 11 deterministic merge check (mode Verify, all five criteria, criterion
3 scoped to job-5.2): (1) owner gates green in full; (2) `gh pr checks 42
--json name,state,workflow` — all four `workflow=="gates"` rows state SUCCESS
at head `92ef664…` (the SHA every other criterion was read against); (3) no
blocking skeptic objection; (4) judge PASS; (5) no Needs Human state or
outstanding ruling. Merged per R-MERGE-1 with
`gh pr merge 42 --squash --match-head-commit 92ef664…` — ordinary merge, no
`--admin` (R-ADMIN-1 unused; main unprotected, mergeStateStatus CLEAN).
Merged as **`7e050cb1fd22d4d789dfbc5847e5a345617af81e`**; CI confirmed green
on the merged SHA (gates: success) before Done was set.
- Step 12: local main reconciled from origin/main via merge commit a4a03a9
successor (no force, main worktree stayed on its branch); validate.py clean;
record commit pushed to main under R-PUSH-1.
- Step 13: one follow-up candidate drafted (sibling signature-field
omissions, `thinkingSignature`/`thoughtSignature` on the vendored
`PiThinkingContent`). Recorded decision (council_followup_review, status ok,
mode active), verbatim: `Mode: File — composite 0.48 < merge threshold 1.00
— Declare or annotate the vendored PiThinkingContent's omitted optional
thinkingSignature/thoughtSignature fields (active)`. The candidate is HELD,
not filed: awaiting the confirming ruling (active mode applies only after
confirmation); resumable by the next runner against this draft title. The
skeptic's tsc-mirror-fidelity observation is not carded: [[Real-Surface
Verification]] already pins vendored-surface fidelity on the provenance read
+ re-diff-on-upgrade, which this card's verification exercised — recorded
here, doctrine-referential.
- Verify-cycle count for this card: 1 of 3. Owner-gate and skeptic gate
results recorded from actual runs, never from seat reports alone.
