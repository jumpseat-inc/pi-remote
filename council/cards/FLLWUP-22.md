---
id: FLLWUP-22
title: "Resolve the §2.3 device-flow poll answer shape against the shipped headless driver (400 vs 2xx error body)"
state: Deliberating
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

## Phase 1 ruling (human, 2026-09-02 — binding for this run)

**Q1 ruled: branch (a) — the client adapts to the spec; obey RFC 8628.** The
driver's poll handling is corrected to recognize `400` + `{"error": …}` bodies
per RFC 8628 (client code + fixtures change); the spec's §2.3 stays as written.
Result: client AND spec are RFC-conformant; the document does not weaken.
Terminal device-flow errors (`access_denied`, `expired_token`) vs retriable
ones (`authorization_pending`, `slow_down`) are distinguished per the RFC —
the deliberation owns the exact driver semantics within that boundary.

## Deliberation record

### Round 1 — independent first pass (owner job-31.1, principal job-31.2)

**owner:** The error-dispatch table at `src/login.ts:724–757` is RFC-correct in every
row; only its reachability is wrong (gated behind `res.ok` at `:716`). Fix is
structural, not semantic: move `res.json()` parse (`:721`) and `error` extraction
(`:723`) above the status check, gate the four-code table on
`res.ok || res.status === 400`. Rows unchanged: `authorization_pending` → continue
unchanged interval; `slow_down` → `interval += 5000`, continue; `expired_token` →
terminal `expiredCode`; `access_denied` → terminal `deviceDenied`; `400` + unknown
or absent error → `tokenExchangeFailed` (retain the `!res.ok` fallthrough after the
table); any other non-2xx (401, 500…) → `tokenExchangeFailed` regardless of body
(a 500 carrying `authorization_pending` is NOT dispatched; §2.7 status-selects-remedy
doctrine); network throw unchanged (`unreachable`); client-clock `timedOut` distinct
from server-sent `expired_token`. No reason vocabulary changes. 2xx-with-error-field
stays accepted as a tolerated legacy shape — tightening would delete working
tolerance beyond the ruling's boundary, zero security consequence (error checked
before `access_token` at `:756`) — but tolerance must be pinned, not accidental: one
new test. Fixtures: flip `:538` and `:633` to 400 (normative shape pins); new: 400
slow_down asserting +5000ms gap via fake sleep seam (`:543` pattern) — interval
adjustment currently untested anywhere; 400 expired_token → `expiredCode`; 400
access_denied → `deviceDenied`; 400 unknown error and 400 absent error →
`tokenExchangeFailed`; 500 → `tokenExchangeFailed` (pins the status gate); 200 +
authorization_pending → still polls (tolerated-legacy pin). Harness already supports
arbitrary statuses, no harness change. Open questions: 5xx-retry (proposes immediate
failure, separate card if wanted); RFC 8628 connection-timeout unilateral-slowdown
rule vs driver treating fetch throw as terminal `unreachable` — real divergence but
out of this card's §2.3 boundary, flag follow-up card; `error_description` ignored —
surfacing it touches verbatim-ruled copy, leave ignored; no cap on slow_down
accumulation (expiresIn loop-top check bounds the flow). Minimal red→green proof:
flip `:538` to 400, test 9 fails on current code, passes with the reorder.

**principal:** Pure layer-implementation defect, not a framing dispute: the four-code
dispatch (`:724–745`) is already correct and in the right order, simply unreachable
on the one status the spec mandates. Reorder, don't redesign. Gate: parse body before
the status gate; first gate becomes `if (!res.ok && res.status !== 400) →
tokenExchangeFailed`. Same four rows as owner. 2xx-with-error stays accepted as
tolerated legacy shape (spec constrains servers; a client rejecting a 2xx error body
is stricter than the contract it consumes; bounded by the expiresIn cap). The one
tightening in the other direction: all other non-2xx (500, 401, 429) →
`tokenExchangeFailed`, body unread — a 500/401 must NOT be trusted to carry
`access_denied`/`expired_token`; surfacing "user denied" on top of a server 500 is a
Copy-Honesty violation. So the four codes are recognized only on 400 and 2xx. 400 +
unknown error → `tokenExchangeFailed` (reuse `:743`, moved above the status
fallback); 400 + absent error or unparseable body → `tokenExchangeFailed` via a
second narrowed `if (!res.ok)` after the dispatch; 401 gets no special remedy (device
flow presents `device_code`, not a §2.7 credential); 200 with no access_token →
`invalidTokenResponse` unchanged. Net diff: narrow `:716` by 14 chars; add a 5-line
`if (!res.ok)` before `:747`; move `:721`/`:723` above `:716`; one comment; one
`res.status` comparison. Fixtures: flip `:538` and `:633` to 400; new per-code
fixtures for slow_down (assert injected sleep receives 2000ms then 7000ms),
expired_token (expiredCode, tail printed once, no credential written), access_denied
(deviceDenied); 400 + unknown error; 400 + `{}`; test.each([500, 401, 429]) →
`tokenExchangeFailed` including the honesty test `500 {"error":"access_denied"} →
tokenExchangeFailed, NOT deviceDenied`; legacy 200-tolerance test. Blind spots
named: pipeline view reads non-2xx-as-failure as a transport rule; render view sees
only outcomes and cannot see that status-gate placement decides which message is
reachable at all; own blind spot flagged — bounded-vs-lenient is an honesty-grounded
design choice, both readings RFC-conformant, settle with the 500+access_denied
fixture. Open questions: the terminal-code trust bound (position: bounded); 200
carrying both error and token — error wins (four codes dispatched first); no new
LoginReason, no copy change — any position proposing a new reason is scope creep.
