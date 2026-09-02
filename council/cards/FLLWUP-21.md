---
id: FLLWUP-21
title: "Align §1.2's control/data-plane decision sentence with §5.6's device-upgrade admission checks"
state: Done
owner: owner
epic: EPIC-2
goal: docs/SERVER-SIDE-SPEC.md §1.2's sentence placing security decisions on the control plane is amended so it cannot read as a universal cap against §5.6's device-upgrade admission check, which folds the revoked-device status check into the existing 401 invalid_token branch with three REQUIRED lookup states.
---

## Intent

Filed from EV-13's step 13, per the product-owner Q2 ruling's own routing note.
The Q2 ruling chose the owner's branch: a device connection token naming a
revoked device gets `401 invalid_token` at upgrade (§2.7's binding
classification — revoked = does-not-authenticate), which makes the device
upgrade's REQUIRED lookup states three (consumed-jti set, live-tunnel
existence, device registry row) while the host handshake keeps two. §1.2's
"the data plane is where no authentication decisions happen" sentence, read as
a universal cap, contradicts that — but the contradiction is pre-existing prose
drift (§3.4's host handshake already verifies signatures, checks expiry,
consumes jti, and checks tunnel existence, so the sentence was never literal at
admission). Per the routing rule (corrections to the surface a card writes ride
its PR; pre-existing drift files as its own card), this did not ride EV-13's
PR. Docs-only, one sentence scoped.

## Acceptance

- §1.2's sentence is amended to scope the no-authentication-decisions rule to
  per-frame relay (where it was always true), explicitly admitting the
  handshake-time admission checks that §3.4 and §5.6 specify.
- No other §1.2 change; the invariant list INV-1..INV-6 is untouched.
- bunx tsc --noEmit exit 0; bun test exit 0 (docs-only; suite untouched).

## Verify log

- Cycle 1 (skeptic @ 62b159a): BLOCKED — one closed-red: PR #28 carries the council state-flip commit 675cf79 (board.md + card file) because the owner branched from local main ahead of origin/main; owner's "docs-only" claim false. All acceptance criteria otherwise closed-green (gates reproduced with failure-injection, diff scope §1.2-only, INV/§3.4/§5.6 untouched, EV-12 pass, §5.6 cross-ref coherent, head SHA unchanged). Non-blocking residuals noted for follow-up: §5.6's §1.2 citation breadth; §5.7/§4.6 per-delivery grant enforcement at the edge of the rewritten sentence.
- Fix cycle 1 (owner): branch rebased --onto origin/main 675cf79, force-pushed with lease; PR #28 now spec-only (files: docs/SERVER-SIDE-SPEC.md only), new head 775f329b0b9e0f2edfe5934cb65dce57d916e3f8, spec content byte-identical to the verified version. Gates re-run: tsc exit 0; bun test 218 pass/1 skip/0 fail. State → In Review for verify cycle 2.
- Verify cycle 2 (skeptic @ 775f329): PASS — all four fix claims closed-green (PR spec-only, blob-ID byte-identity 12c7d386 for the spec file across 62b159a→775f329, gates re-run green with failure-injection at the head, 675cf79 provably out of branch ancestry). Cycle-1 closed-green doc results carry over via byte identity. State → In Review already recorded; proceeding to step 10.
- Step 10 (judge @ 775f329): PASS — §1.2 amended correctly and only at §1.2 (per-frame-relay scoping, admission families named, zero hunks in INV/§3.4/§5.6); both gates independently verified green at the head. Per the binding step-10 general rule the judge evaluated the PR branch at the Skeptic-verified SHA, not pre-merge main.
- Deterministic merge check (re-homes the human merge gate): (1) owner gates green in full — skeptic-verified with failure-injection; (2) `gates` workflow state SUCCESS on PR head 775f329 (read keyed on the workflow field; gates-windows also SUCCESS); (3) no blocking Skeptic objection; (4) judge PASS; (5) no Needs Human state or outstanding ruling. Merged with `gh pr merge 28 --squash --match-head-commit 775f329…` → merge commit 99ca726. CI green on merged SHA: gates completed success at 99ca726.
- Reconcile note: local main diverged (five council state commits vs the squash merge). The judge seat had left HEAD detached at 775f329 in the shared checkout, so an intermediate judge-PASS commit landed on the wrong lineage and a first rebase dropped the board/card state; recovered by rebasing the correct main lineage (b619fa7) onto origin/main — file sets provably disjoint (council files vs spec), spec blob byte-identical (12c7d386) after reconcile, merge intact. Step-10 record re-appended.
- Follow-ups filed: FLLWUP-26 (the Skeptic's two non-blocking residuals — §5.6's §1.2 citation breadth and §5.7/§4.6 per-delivery grant enforcement at the edge of the rewritten sentence — one scoping exercise).
