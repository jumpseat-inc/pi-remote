---
id: FLLWUP-31
title: "Correct AGENTS.md's stale 'Current state' claims (suite count and --headless routing)"
state: Done
owner: null
epic: null
goal: Correct both stale claims in `AGENTS.md`'s "Current state" section — replace the outdated 218-pass suite figure with the observed result stated without pinning it as eternal (or a count-free wording), and replace the false sentence that `/rc:login --headless` is "not routed by the command surface" with the shipped reality that `index.ts` selects the device flow on the `--headless` token (BUG-1, PR #30) — with no other content change.
---

## Intent

Filed from the FLLWUP-30 run (EPIC-3) at step 13, confirmed `File` by a
`product-owner` ruling in the same run. The runner's dedup pass found no
existing board card or sibling candidate naming the count.

This repository's `AGENTS.md` "Current state" section claims the unit suite is
"`bun test` 218 pass / 1 Windows-gated skip". Three independent observations in
this run disagree: the FLLWUP-30 owner and runner and the FLLWUP-27 owner at
base `cb02823` all observed **234 pass / 1 skip / 0 fail** across 11 files. The
218 figure is demonstrably stale, and a stale gate number in the file every
agent in this repo reads first can mislead a later run's preflight into
suspecting a regression that did not happen ([[Fixture-Green Honesty]]: an
acceptance claim should state only what is proven).

The product-owner ruling binds the scope: state the count **without pinning it
as eternal** (observe-and-state, or a count-free wording such as "typecheck
clean, `bun test` all-pass"), so the line does not rot into a new false claim
on the next test addition. The ruling is on the *what* (the stale number must
not survive this card), not the *how*.

**Scope widened at promotion (human ruling, 2026-09-23).** The same "Current
state" section carries a second stale claim: it says the `/rc:login --headless`
device flow is "not routed by the command surface — `index.ts` always runs the
attended flow". BUG-1 (PR #30, merged `d790716`) routed it — `index.ts` parses
the `--headless` token and selects the driver — but that PR did not touch
`AGENTS.md`, so the sentence is now false. The human promoted this card to
`Ready` and widened its goal to correct both claims in the section.

## Acceptance

- `AGENTS.md`'s "Current state" no longer asserts the stale `218 pass` figure.
- The replacement either states the observed result (`bun test` 234 pass / 1
  Windows-gated skip) or is count-free; it does not hard-code a "must always be
  234" claim.
- No other `AGENTS.md` content changes; `bunx tsc --noEmit` exit 0 and
  `bun test` green.
- The `/rc:login --headless` "not routed" sentence is replaced with the shipped
  reality (`index.ts` selects the device flow on the `--headless` token;
  BUG-1, PR #30) or removed; it is no longer false.

## Promotion and scope — /council run (2026-09-23)

The human promoted this card `Backlog → Ready` and widened its goal to cover
both stale claims in `AGENTS.md`'s "Current state" section: the suite count and
the `--headless` routing sentence. Recorded as the human's ruling; binding on
the run.

## Run record — /council FLLWUP-31 (2026-09-23/24)

- **Step 1 — route/gate.** `council_route op:route` → fallback (no recorded
decision for the widened packed state), so step-1 judgment: **mechanical, not
surface-touching** (agent-facing repo docs). Mechanical path; no deliberation,
no `designer`; owner + skeptic + judge run.
- **Step 7 — handoff.** Mechanical path: the card itself is the spec; no spec
file. Card set `In Progress`, `validate.py` clean.
- **Step 8 — owner (job-7, 3.0m).** Worktree `/home/tista/codes/pi-remote-fllwup-31`
cut from `origin/main` `681f01b`; main worktree HEAD untouched. Branch
`owner/fllwup-31-agents-current-state`, PR **#37**, head
`143a6b08e1644ba8df68a5ada1329fe26f23decc`, diff `AGENTS.md` only (+6/−4). Post-edit
`bunx tsc --noEmit` exit 0; `bun test` 237 pass / 1 skip / 0 fail. Card set
`In Review` from the observed open PR.
- **Step 9 — skeptic (job-8, 5.0m).** `council_route op:recheck` → not applicable
(fallback, not a reduced recorded mode). Skeptic **NO-BLOCK**: 6 objections all
`closed-green`; re-ran both gates at head and proved each **can fail** by
failure-injection (tsc type error named the file; a failing test) before
trusting green; diff confirmed confined to the two `## Current state` hunks.
- **Step 10 — judge (job-9, 0.3m).** **PASS** — goal met; diff scope exact; gates
green.
- **Step 11 — human merge gate.** Human approved. Merged SHA-pinned: `gh pr merge 37
--squash --match-head-commit 143a6b0…` (head re-read equal immediately before;
ordinary merge — `main` unprotected). **Merged `d8a91998791bfa18cd3a976a159026c4599a0f52`**
2026-09-24T04:12:47Z; `gates` + `gates-windows` **SUCCESS** on the merged SHA
(observed).
- **Step 12 — sync/reconcile.** Record rebased onto `origin/main`, `validate.py`
clean, pushed directly to `main`.

**Final `AGENTS.md` text (the two claims):** suite line → "`bunx tsc --noEmit`
clean, `bun test` all-pass (the only expected non-pass is the Windows-gated
credential-ACL skip on non-Windows runners)"; routing line → "…routed by the
command surface: `index.ts` parses the `--headless` token from the command args
and selects the device-flow driver; without it the attended flow runs (BUG-1, PR
#30)."

**Out-of-scope note (skeptic sweep, no objection):** the remaining `## Current
state` sentences (FLLWUP-11/12 not-loadable, one-suite-per-module, `src/login.ts`
implementation) remain accurate.

**Step 13 — follow-ups.** One candidate drafted: "Make council/validate.py fail
on duplicate board headings" (surfaced when the step-8 board edit left a second
`## In Review` heading and `validate.py` still reported clean — it enforces card
membership under the matching column, not heading uniqueness). Recorded decision
via `council_followup_gate` (active): `Mode: File — composite 0.23 < merge
threshold 1.00`; dedup pass found no existing card or sibling. Presented with
its rendered line; the **human dropped it at the confirm gate** — no card filed,
no board change.