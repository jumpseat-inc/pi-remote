# FLLWUP-22 design — §2.3 device-flow poll answer shape (400 vs 2xx error body)

Card: `council/cards/FLLWUP-22.md` (epic EPIC-2). Status: deliberation
complete (2 of ≤3 rounds, full convergence), Skeptic attack settled with no
open objections (job-32.1), consolidator synthesis recorded (job-32.2).

## Governing ruling

**Phase 1 ruling (human, 2026-09-02, binding): branch (a) — the client adapts
to the spec; obey RFC 8628.** `src/login.ts`'s poll handling is corrected to
recognize `400` + `{"error": …}` bodies per RFC 8628 §3.5 (client code +
fixtures change). `docs/SERVER-SIDE-SPEC.md` §2.3 stays **AS WRITTEN**. Do
not touch §2.3 or any other part of the spec document. Terminal device-flow
errors (`access_denied`, `expired_token`) vs retriable ones
(`authorization_pending`, `slow_down`) are distinguished per the RFC.

## The defect

The shipped headless driver's poll loop (`src/login.ts` ~:716–757) reads
`res.ok` first: any non-2xx aborts polling with `tokenExchangeFailed`, and
the `error` field is only recognized on a 2xx body. A server conformant to
§2.3 (which mandates `400` + `{"error": …}` for pending/slow_down polls,
matching RFC 8628 §3.5) therefore breaks the shipped headless flow. The
Skeptic drove the real `runHeadlessLogin` with
`{status: 400, body: {error: "authorization_pending"}}` and observed
`tokenExchangeFailed`, no credential — the premise is verified real.

The fix is structural, not semantic: the four-code dispatch table is already
RFC-correct in every row; only its reachability is wrong (gated behind
`res.ok`).

## The change (src/login.ts poll loop)

Reorder, do not redesign:

1. **Parse before the status gate.** Move the `res.json()` parse (currently
   ~:721) and the `error` extraction (~:723) above the `res.ok` status check
   (~:716). The parse already fails closed via
   `res.json().catch(() => null)` — keep that; post-reorder the catch is
   live at every status (a non-JSON 400 or 500 body → `tokenExchangeFailed`,
   never a throw).
2. **Gate the four-code table on `res.ok || res.status === 400`.** Rows are
   unchanged in semantics:
   - `authorization_pending` → continue polling at the unchanged interval;
   - `slow_down` → `interval += 5000`, continue (RFC 8628 §3.5: interval
     "MUST be increased by 5 seconds"; verified against the real sleep seam:
     `[1000, 6000]`);
   - `expired_token` → terminal `expiredCode`;
   - `access_denied` → terminal `deviceDenied`.
   - `400` + unknown error code, absent error field, or unparseable body →
     `tokenExchangeFailed` (retain the `!res.ok` fallthrough after the
     table, moved above the status fallback).
3. **All other non-2xx (401, 429, 500…) → `tokenExchangeFailed`, body
   effectively unread.** A 500 carrying `{"error":"access_denied"}` must NOT
   surface `deviceDenied` (honesty: no false "user denied" copy on top of a
   server failure); a 500 carrying `{"error":"authorization_pending"}` must
   NOT silently continue polling. The four codes are recognized only on 400
   and 2xx.
4. **No new `LoginReason`, no copy change.** Client-clock `timedOut` stays
   distinct from server-sent `expired_token`; network throw → `unreachable`
   unchanged; `200` with no `access_token` → `invalidTokenResponse`
   unchanged. Both branches sit outside the reorder span — do not touch
   them.
5. **2xx-with-error-field stays accepted as a pinned tolerated legacy
   shape.** The invariant "error checked before `access_token`" means a 2xx
   carrying both a terminal error and a valid token never saves a
   credential; tolerance is intentional, pinned by fixture.
6. **5xx policy: immediate `tokenExchangeFailed`, no retry** (settled in
   round 2; the owner withdrew its retry proposal).

**Reorder safety (Skeptic-verified):** a 16-status × 9-body model diff plus
real-code probes at every edge (204, non-JSON 2xx, 3xx, `res.ok` semantics)
confirmed the only status whose outcome changes is 400, and only toward the
four documented rows. 1xx/2xx/3xx/401/403/404/429/5xx are byte-identical
before/after. No existing test sends a 400, so no existing test can flip.

## Fixture inventory (test/login.test.ts)

Harness already supports arbitrary statuses (`resp(status: …)`); no harness
change needed.

Flips:
- `:538` (normative pending poll pin): `200` + error body → `400` + error
  body. This is THE normative §2.3/RFC pin.
- `:633` (Ctrl-C test): flip to 400 for consistency — note this flip is
  cosmetic (the test never issues a token POST); the normative pin is `:538`
  plus the new fixtures below.

New fixtures (per-code, on 400):
- `slow_down` → continue, asserting the injected sleep seam receives 2000ms
  then 7000ms (the +5000ms increment is currently untested anywhere);
- `expired_token` → `expiredCode` (tail printed once, no credential written);
- `access_denied` → `deviceDenied`;
- unknown error code → `tokenExchangeFailed`;
- `{}` (absent error) → `tokenExchangeFailed`.

New fixtures (status-gate / honesty pins, all currently green on shipped
code — they are regression guards against the reorder overcorrecting into
"parse-then-dispatch-everywhere"):
- `500 {"error":"access_denied"}` → `tokenExchangeFailed`, NOT
  `deviceDenied` (anti-false-denial);
- `500 {"error":"authorization_pending"}` → `tokenExchangeFailed`, NOT
  continue (anti-silent-continue);
- `500` with a non-JSON body → `tokenExchangeFailed` (not a throw);
- `400` with a non-JSON body → `tokenExchangeFailed` (pins the same
  `.catch` on the now-live 400 parse path);
- `200 + {"error":"authorization_pending"}` → still polls (tolerated-legacy
  pin);
- `200 + {error: "access_denied", access_token: <valid>}` → `deviceDenied`,
  credential never saved (error-wins honesty pin).

**Dropped from the inventory (settled by Skeptic test output, O6/S11):** the
plain `500 {}` fixture. It produces the identical outcome with or without
the status-gate wrapper and flips no differently under a forgot-trailing-
gate bug — it pins nothing distinct. Do not add it.

Out of scope (deferred, do NOT touch): RFC 8628 connection-timeout
unilateral-slowdown divergence vs the driver's terminal `unreachable` on
fetch throw; `error_description` ignored (touching it would change
verbatim-ruled copy); 5xx retry policy.

## Gates

1. `bunx tsc --noEmit` → exit 0.
2. `bun test` → full suite green (baseline 207 pass / 1 skip / 0 fail; the
   updated suite pins all fixtures above).
