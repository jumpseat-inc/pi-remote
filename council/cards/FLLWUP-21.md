---
id: FLLWUP-21
title: "Align §1.2's control/data-plane decision sentence with §5.6's device-upgrade admission checks"
state: In Progress
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
