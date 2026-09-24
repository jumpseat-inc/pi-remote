---
id: FLLWUP-32
title: "Fix the load-smoke test-2 header's overstated compile-time claim"
state: Backlog
owner: null
epic: EPIC-5
goal: `test/pi-sdk-load.test.ts`'s second test header claims a compile-time guarantee its runtime body does not enforce; correct the comment or make the claim true.
---

## Intent

Filed from FLLWUP-11's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.22 < merge threshold 1.00 — Fix the load-smoke test-2 header's overstated compile-time claim (active)

FLLWUP-11's verification flagged this as a non-blocking doc nit: the second
test in the load-smoke suite carries a header comment overstating what the
test actually enforces (a compile-time guarantee where the body only checks
runtime behavior, or vice versa). A test header that claims more than its
body proves misleads a later reader about what regression the suite guards
([[Fixture-Green Honesty]]: an acceptance claim should state only what is
proven).

The fix is either to correct the comment to match the body or to add the
assertion that makes the claim true — whichever the implementer finds
faithful to the original intent.

## Acceptance

- The second test's header in `test/pi-sdk-load.test.ts` no longer claims
  more than the test enforces (or the test now enforces the claim).
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.
