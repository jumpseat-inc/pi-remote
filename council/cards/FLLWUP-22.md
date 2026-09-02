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

### Round 2 — bounded exchange (owner job-31.3, principal job-31.4)

**owner:** Accepts the principal's position in full. 5xx-retry question withdrawn —
no retry, immediate `tokenExchangeFailed`, settled; a transient 500 mid-device-flow
is rare and recoverable by rerun. Honesty fixture
(`500 {"error":"access_denied"} → tokenExchangeFailed, NOT deviceDenied`) accepted
as the canonical pin for the status-gate reading — owner corrected itself mid-turn:
it is a regression pin guarding the reorder from overcorrecting into
"parse-then-dispatch-everywhere" (which would flip 500s back to false "user denied"
copy), not a current-code failure; owner wants the plain-500 fixture kept too (plain
500 pins terminality, honesty 500 pins body-unread). Follow-up flags (connection-
timeout slowdown divergence; `error_description` ignored) agreed as separate cards,
orthogonal, neither blocks or shapes this card's diff. Endorses the "error wins over
stray token on 2xx" pin: the invariant already holds at lines 733–750 and the reorder
must not break it; fixture should lock it. No new reason, no copy change. Position
stable — remaining disagreement: none.

**principal:** Accepts (a) connection-timeout and (b) `error_description` as
follow-up cards. Accepts no-cap on `slow_down` with a precision correction: the
`expiresIn` loop-top check is evaluated PRE-sleep, so a large accumulated interval
can emit exactly one doomed poll past expiry before the check exits — bounded and
harmless (terminates via server `expired_token` or client `timedOut`), no cap, no
extra assertion; the +5000ms fake-sleep-seam assertion is the sufficient pin. On the
500 fixtures: the plain `500 {}` is a false-confidence trap — under the agreed
structure it is green with OR without the status gate (the trailing `if (!res.ok)`
catches it either way), so it pins nothing; only
`500 {"error":"access_denied"}` flips outcome when the guard is removed. Position:
drop the plain one, keep the honesty one; and add a third distinct one-liner,
`500 {"error":"authorization_pending"} → tokenExchangeFailed` (not continue),
pinning anti-silent-continue — the access_denied fixture pins anti-false-denial,
neither subsumes the other. Keeps the error-wins pin, reframed as an honesty pin: a
terminal error coexisting with a valid `access_token` never yields a saved
credential. New testable claim: the reorder is safe for 5xx only because
`res.json().catch(() => null)` fails closed — `500` with a non-JSON body →
`tokenExchangeFailed` (not a throw); should be a fixture, not an assumption.
Position stable — remaining disagreement: none on the structural fix; three
low-cost test-surface refinements only.

**Facilitator note:** Positions stabilized at round 2 of ≤3; exchange stopped early.
Converged design: reorder the poll loop (parse body before the status gate; four-code
table dispatched on 2xx-or-400; all other non-2xx → `tokenExchangeFailed`, body
effectively unread; no new reason; no copy change). One small test-inventory delta
forwarded to the consolidator: plain-500 fixture kept (owner) vs dropped as a no-op
guard (principal).

### Step 4 — Skeptic dispatch (FIRST ATTEMPT — stalled; superseded below)

Two consecutive bounded `skeptic` dispatches failed to settle; per dispatch
discipline no third dispatch is permitted and the card pauses mid-step-4.
(Resume note: the orchestrator probed the environment — `bun test` runs the
full suite in under a second locally; the freezes were transient seat-level
failures, not an environment defect. A fresh skeptic dispatch was permitted
on resume.)

- **job-31.5** (first dispatch, 20 min window + 15 min extension): cancelled by
  facilitator after two wait windows showed no progress (turns frozen at 21,
  cost frozen at $0.0246). Its last visible output: "Probe had a shadowing bug
  (helper named `deps` collides with destructured var). Rewriting cleanly:". It
  left an untracked probe file, `test/flluwp22-skeptic-probe.test.ts`, which the
  facilitator removed; the working tree is clean.
- **job-31.6** (re-dispatch, same input, 20 min window + 15 min extension):
  stalled with no activity across both windows (turns frozen at 3, cost frozen
  at $0.0057; last output: "The code under attack is clear. Now let me examine
  the pre-existing untracked probe file, the test harness (makeControl/makeFetch),
  the exact fixture line numbers, and the wiki page — in parallel."). Cancelled
  by facilitator after the second frozen window.

Deliberation state preserved above (rounds 1–2 complete, positions stabilized).
Step 4 (Skeptic attacks and runs tests), step 5 (consolidator), and steps 7–13
have NOT run. A recovering runner re-dispatches the skeptic at this point with
the full deliberation record.

### Step 4 — Skeptic attack (RESUMED RUN, job-32.1; settled)

A fresh bounded `skeptic` dispatch (20-min window, one extension on visible
progress) settled cleanly: 20 turns, probe files removed, working tree
restored green (`bun test` → 207 pass / 1 skip / 0 fail; `bunx tsc --noEmit`
exit 0). Both gates proven capable of failing by injection (deliberately
false assertion → red; type error → red) before being restored. Full record:

- **O1 — motivating claim: closed-green.** Drove the real `runHeadlessLogin`
  with `{status:400, body:{error:"authorization_pending"}}` →
  `tokenExchangeFailed`, no credential. A §2.3-conformant server genuinely
  breaks the shipped flow today; the card's premise is grounded.
- **O2 — reorder safety: closed-green.** Real-code probe over every edge
  (204, non-JSON 2xx, 3xx, `res.ok` semantics) plus a model diff over
  16 statuses × 9 bodies: **only status 400 changes outcome, and only
  toward the four documented rows.** Everything else byte-identical.
- **O3 — RFC 8628 §3.5 conformance: closed-green.** RFC-editor text fetched:
  `slow_down` → interval "MUST be increased by 5 seconds"; any other error →
  stop polling. Real-code probe: `200+slow_down` sleeps `[1000, 6000]` =
  exactly +5000ms. Design row = RFC row = §2.3 row.
- **O4 — error-wins honesty pin: closed-green.** Real code,
  `200 + {access_denied, access_token}` → `deviceDenied`, credential null;
  model confirms it also holds in the new 400 window.
- **O5 — anti-false-denial: closed-green with reclassification.** Real code
  already returns `tokenExchangeFailed` for `500 {"error":"access_denied"}`
  (the `!res.ok` gate fires before the body is read). The planned honesty
  fixture is a **regression guard against the reorder's
  parse-then-dispatch-everywhere overcorrection**, not a current failure —
  matching what round 2 already recorded.
- **O6 — plain-500 fixture dispute (owner keep vs principal drop): SETTLED
  BY TEST OUTPUT, toward the principal.** `500 {}` produces the same outcome
  with or without the status-gate wrapper (both `tokenExchangeFailed`), and
  even a forgot-trailing-gate bug flips all three 500 fixtures alike — the
  plain-500 fixture pins nothing distinct. Dropping is defensible; keeping
  is functionally harmless. Not blocking.
- **O7 — non-JSON bodies fail closed: closed-green.** The
  `res.json().catch(() => null)` catch is live at every status post-reorder;
  planned non-JSON 500 fixture exercises it.
- **O8 — no existing test can flip: closed-green.** Baseline 207 pass /
  1 skip / 0 fail; every token fixture in the suite uses `status: 200`; the
  reorder only changes 400 behavior. Test 9 (:538), test 11 (:633), and the
  headless test stay green. The attended gate at `src/login.ts:547` is
  outside the diff.
- **Informational notes for step 7/8:** (a) flipping `:633` (the Ctrl-C test,
  which never issues a token POST) to 400 is cosmetic — the normative pin is
  `:538` plus the new per-code fixtures; (b) an optional non-JSON **400**
  fixture would pin the same `.catch` line on the now-live 400 parse path.
- **Deferred items re-confirmed out of scope:** connection-timeout slowdown
  divergence (RFC real, correctly deferred), `error_description` ignored,
  no 5xx retry.

**Step-4 verdict: no open objections.** Nothing red, nothing ill-falsifiable;
design cleared for step 5. Probe-boundary honesty note: gate-level deltas were
tested via a faithful model (validated against real outcomes at every shared
branch) because the design attack could not modify `src/`; all motivating and
preservation claims were driven against the real `runHeadlessLogin`.

### Step 5 — Consolidator synthesis (job-32.2; settled)

**Agreed design:** reorder the poll loop (parse + error extraction before the
status gate; four-code RFC 8628 table on `res.ok || res.status === 400`; all
other non-2xx → `tokenExchangeFailed`; no new `LoginReason`; no copy change;
§2.3 untouched; 2xx-with-error kept as a pinned tolerated-legacy shape).

**Settled (S1–S14):** branch (a) per the Phase 1 ruling (S1); table rows and
semantics (S2); 2xx-with-error legacy tolerance (S3); no new reason / no copy
change (S4); 5xx → immediate `tokenExchangeFailed`, no retry (S5); skeptic
O1–O8 closed-green by actual test output (S6–S13); the `:633` flip is cosmetic
— the normative pin is `:538` plus the new per-code fixtures (S14).

**Open objections: none.**

**Open-judgment items (J1–J3) — routed per the consolidator's own synthesis:**

- **J1 (plain-500 fixture keep vs drop): CLOSED by skeptic test output
  (S11/O6)** — `500 {}` produces the identical outcome with or without the
  status-gate wrapper, so it pins nothing distinct; resolution toward the
  principal's position (drop from the required inventory), with the owner's
  alternative recorded as functionally harmless. No ruling seat needed — a
  test settled it (council.md step 4: a dispute a test settled is closed by
  that result).
- **J2 (`500 {"error":"authorization_pending"}` → `tokenExchangeFailed`,
  anti-silent-continue pin): not a dispute** — proposed by the principal in
  R2, owner silent (not opposed), skeptic probe confirmed the outcome flips
  under an ungated table. Carried into the spec as part of the fixture
  inventory.
- **J3 (optional non-JSON 400 fixture pinning the now-live `.catch` path):
  not a dispute** — the skeptic's own informational note, no opposing
  position. Carried into the spec as a recommended fixture.

No open-judgment item requires `product-owner`; no open objection blocks.
Steps 7 onward proceed.
