# EV-1 Step-10 Judge-Object Ruling — product-owner seat

Date: 2026-08-31
Card: EV-1 — Sync PI-SPEC with the /rc:login OAuth2 enrollment design and colon command naming
Epic: EPIC-1
State at ruling: In Review (PR jumpseat-inc/pi-remote#1 OPEN, head `ev-1-oauth2-enrollment` @ c6ac1c87d40f086d6eabdd0b47e33e87b7004ee4, base `main`; Skeptic step-9 PASS with no open objections; gates workflow SUCCESS on PR head SHA; judge step-10 REJECT on the basis that `docs/PI-SPEC.md` on `main` does not meet the goal — i.e., the change is not yet merged)

The wiki is empty (`vault/wiki/index.md` is a stub catalog with no module
pages). Authority for this ruling is the procedure itself — `council.md`
(council/procedures/council.md) and `features-deliver.md`
(council/procedures/features-deliver.md) — plus the seats'
self-definitions (`council/agents/judge.md`, `council/agents/council-runner.md`),
the EV-1 record (`council/cards/EV-1.md`), and the runner's escalation
packet. Phase 1 rulings on this epic covered design content (Q1/Q2/Q3 on
`PI_REMOTE_HOST_KEY`, `resyncing`, and §7.5 row 1 + RFC 8414); none
covered the procedural question this packet raises. No recorded human
decision in `council/board.md` bears on it.

---

## Ruling — the judge's stop condition measures the verified PR head SHA, not current `main`

The judge at step 10 evaluates whether **the implementation on the
PR branch at the SHA the Skeptic verified** meets the card's `goal`.
A REJECT that is grounded on the state of `docs/PI-SPEC.md` on `main`
— i.e., on the pre-merge state of the file, which by construction
cannot contain the unmerged change — is a procedural misapplication
of the stop condition. EV-1's REJECT is vacated on that ground; the
judge must be re-dispatched against the correct object (the PR branch
at `c6ac1c8`). The Skeptic's step-9 verification stands, the step-9
verify-cycle counter is **not** consumed by this re-judging, and the
card stays `In Review` through the re-dispatch — it does **not**
return to `In Progress`, because the basis of the REJECT is not a
defect the owner can fix.

For `features-deliver.md`'s deterministic merge check, criteria 1
(owner gates green — satisfied at the branch), 2 (gates workflow
SUCCESS on PR head SHA — already observed), and 3 (no blocking
Skeptic objection — already observed) hold. Criterion 4 (judge PASS)
becomes decidable once the re-dispatched judge returns against the
correct object. Criterion 5 (no `Needs Human`/outstanding ruling) is
satisfied by this ruling.

## Reasoning

Council.md orders the steps deterministically: implement on a branch
(step 8), verify at the branch (step 9), judge the implementation
(step 10), merge (step 11), set `Done` on the merged SHA (step 12).
Step 10's text is explicit — "`judge.md` frames its own input exactly
this way" — and the judge.md role defines the task as: *"does the
implementation meet the card's stated goal?"* The **implementation**
is the branch, not `main`. The implementation cannot simultaneously
be a branch that has been pushed-and-not-merged and a `main` that has
been merged; the procedure places the merge gate **after** the judge
by design, and step 11 makes the human (or, in autonomous runs, the
deterministic merge check) the one who merges.

`features-deliver.md` reinforces this concretely. Its deterministic
merge check's criterion 2 keys on the **PR head SHA**, not `main`,
with the spell-out in the same paragraph: "assert that the `gates`
workflow appears with `state: SUCCESS`" — keyed on the PR, not on
the post-merge tree. The merge itself is pinned to the SHA the five
criteria were checked against via `--match-head-commit` or an
immediate re-read of `headRefOid`. The whole deterministic check is
constructed around the change as proposed, on its branch. The judge
operating at step 10 against `main` is reading against an object the
procedure has explicitly designated as downstream of judgment.

The judge's own verdict acknowledges this. Its basis for REJECT is
that "`docs/PI-SPEC.md` as it exists in the repo does not meet the
goal," and it concedes in the same report that "the PR #1 at
`c6ac1c8` does implement the goal correctly (Skeptic's core claim is
valid for that commit)." That concession is the correct verdict on
the correct object; the REJECT is a misframing of the same evidence,
not a separate finding. A verdict that evaluates the wrong object
against the right evidence is not a basis for an owner work cycle —
it is a basis for a re-judging.

The packet's deadlock observation is correct and bears on the
disposition. Mechanical compliance with `council.md` step 10's
REJECT branch ("return the card to `In Progress` and hand the
judge's stated basis to the owner") would hand the owner a basis
they cannot address: the owner does not merge, the merge is
downstream of judgment, and the judge would REJECT identically on
the same merge-state grounds the next time it ran against `main`.
That loop cannot close, and burning a verify-cycle counter on a
non-defect would also be wrong — the Skeptic's step-9 verification
is itself a successful pass against the correct object, and the
counter (per `council-runner.md`'s `<step_9_iteration_cap>`)
measures verify-cycles on the branch, not owner work cycles
produced by a judge's misframing.

This ruling is therefore narrow in scope: the judge is to be
re-dispatched against the PR branch at `c6ac1c8`, with the
explicit framing the runner must include in the dispatch input.
No card-level state moves; no follow-up cards are filed; no
Phase 1 ruling is touched.

### General rule for the remainder of this run

Every card reaching step 10 with its change on an unmerged branch
will face the same situation. The rule, applied uniformly:

- The judge's stop condition is the implementation on the **PR
  branch at the SHA the Skeptic verified**, not `main`. The
  implementation is by definition pre-merge at step 10; the
  merge gate is downstream of judgment.
- A REJECT whose stated basis is the pre-merge state of the
  target file on `main` is a procedural misapplication. It is
  vacated; the judge is re-dispatched against the correct
  object. The card does **not** return to `In Progress` on
  this ground; the verify-cycle counter is **not** consumed;
  no owner work cycle is owed.
- The re-dispatch input must explicitly name the PR number, the
  PR head SHA, and the object the judge is to evaluate against
  ("the implementation on the PR branch at `<SHA>`, not `main`").
  This is cheap insurance against the same misframing recurring
  on the next card — judge dispatches are stateless, and the
  same fresh-context judge can mis-frame the same way without
  it.
- A REJECT that survives this re-framing — i.e., a judge who,
  given the correct object, finds the implementation does not
  meet the goal — is a real REJECT and follows `council.md`
  step 10's normal branch: card returns to `In Progress`,
  basis goes to the owner, verify-cycle counter increments on
  the next step-9 cycle.

This general rule applies for the rest of the EPIC-1 run and is
not card-specific. It does not require a separate ruling per
card; the runner cites this ruling in the step-10 dispatch when
needed.

## Sources

- `council/procedures/council.md` steps 8–12 (implement at branch →
  verify → judge → human merge gate → `Done` on merged SHA with
  green CI; judge receives "the card's `goal` and the Skeptic's
  evidence from step 9 — nothing else")
- `council/procedures/features-deliver.md` — deterministic merge
  check criteria 1–5, with criterion 2's PR-head-SHA spell-out and
  the `--match-head-commit` / `headRefOid` SHA-pinning at merge
- `council/agents/judge.md` — role definition: "does the
  implementation meet the card's stated goal?"; yields PASS only
  when "the goal is met and the evidence shows it"; re-runs the
  decisive test before trusting the Skeptic's report
- `council/agents/council-runner.md` `<step_9_iteration_cap>` —
  verify-cycle counter measures verify-cycles on the branch, not
  owner work cycles produced by a judge's misframing
- `council/cards/EV-1.md` — Skeptic step-9 PASS (13/13 objections
  closed-green, 13/13 gates closed-green); judge step-10 REJECT
  on the merge-state basis; judge verbatim concession that the
  PR at `c6ac1c8` implements the goal correctly
- EV-1 Phase 1 rulings (Q1/Q2/Q3) — design content only; none
  cover this procedural question
- Wiki is empty

## Options rejected

- **Sustain the REJECT, return the card to `In Progress`, and
  hand the basis to the owner.** The basis is the run's own
  pre-merge sequencing, which the owner cannot change. The
  card would deadlock: the owner cannot fix it, the judge
  would REJECT identically on the same grounds, the
  verify-cycle counter would burn on a non-defect. Mechanical
  compliance here is not authority; it is a loop.
- **Defer to `steward`.** This is a procedural interpretation
  inside `council.md` and `features-deliver.md`, not a
  portfolio change. The ruling does not decline a card, does
  not permanently accept a residual, does not touch a recorded
  human decision, and does not assert that the card's `goal`
  text is itself the defect. The procedural answer is
  answerable inside the judgment row.
- **Treat the goal text "docs/PI-SPEC.md specifies…" as the
  defect and rewrite it.** The goal is present-tense but
  unambiguous in the procedure's context: it is the goal the
  implementation is judged against, and the implementation is
  the branch. Rewriting it to "the PR-branch spec" would
  normalize the same misframing on every future card. The
  right fix is the judge's input framing, not the card's
  goal text.

## Reversibility

Trivial. Setting aside a misapplied verdict and re-dispatching a
fresh-context judge against the correct object is a paperwork
move. Cost is one judge dispatch (~1 min per the runner's
reported timing); benefit is that the card proceeds to the
deterministic merge check on the correct evidence. A judge
that returns REJECT against the correct object on the second
pass is a real REJECT and proceeds under council.md's normal
REJECT branch — this ruling does not preempt that.