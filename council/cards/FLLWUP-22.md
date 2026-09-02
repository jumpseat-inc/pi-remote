---
id: FLLWUP-22
title: "Resolve the §2.3 device-flow poll answer shape against the shipped headless driver (400 vs 2xx error body)"
state: Backlog
owner: null
epic: EPIC-2
goal: docs/SERVER-SIDE-SPEC.md §2.3's mandate that token-endpoint polls are answered `400` + `{"error":…}` is reconciled with the shipped headless driver's actual behavior — the client only recognizes the `error` field on a 2xx body and aborts polling on any non-2xx with `tokenExchangeFailed` — by correcting whichever side the ruling selects, so a server conformant to the document does not break the shipped headless flow.
---

## Intent

Filed from EV-14's council-side conformance audit (recorded on
council/cards/EV-14.md, never on the page), per the orchestrator's standing
instruction to file audit failures rather than fix them silently on the
assembly PR, and the EV-12 routing rule (pre-existing prose owned by an
earlier card's section files as its own follow-up).

The contradiction, pinned by the Skeptic at PR #25 head `998fa3f`:

- §2.3 (document line 400, pre-existing on main) mandates the token endpoint
  answers a pending/slow_down poll with `400` and an application/json body
  `{"error": …}`.
- The shipped headless driver (src/login.ts:719–724) reads `res.ok` first:
  any non-2xx aborts polling with `tokenExchangeFailed`; the `error` field is
  only recognized on a 2xx body. Fixtures pin this at
  test/login.test.ts:538 and :633 — both assert the client continues polling
  on `{status: 200, body: {error: "authorization_pending"}}`.
- A server conformant to §2.3 as written therefore breaks the shipped headless
  flow. The owner's stated starting point for the fix: flip the fixture to
  `{status: 400, body: {error: "authorization_pending"}}` (the §2.3-specified
  shape) and watch the headless poll test fail on current code.

Which side moves is a judgment this card's deliberation makes: the driver's
poll handling, the fixtures, or the document's §2.3 wording. Note RFC 8628
§3.5 answers polls with 400 + `{"error": "authorization_pending"}`, so the
document side currently matches the RFC and the client side diverges from it.

## Acceptance

- One side is corrected by ruling-backed decision: either §2.3's poll-answer
  shape is restated to match the shipped 2xx error-field convention (with the
  RFC 8628 divergence documented in the document's own words), or
  src/login.ts's poll handling + fixtures are changed to accept the RFC/§2.3
  `400 + {"error": …}` shape (both 2xx and 400 error bodies, or 400 only).
- The other side is untouched; no drive-by edits elsewhere in §2.3 or login.ts.
- bunx tsc --noEmit exit 0; bun test exit 0 with the updated fixtures.
