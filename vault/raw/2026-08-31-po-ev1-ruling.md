# EV-1 Open-Judgment Rulings — product-owner seat

Date: 2026-08-31
Card: EV-1 — Sync PI-SPEC with the /rc:login OAuth2 enrollment design and colon command naming
Epic: EPIC-1
State at ruling: Deliberating (cap reached on 3 rounds; consolidation routed to product-owner/steward)

The wiki is empty (`vault/wiki/index.md` is a stub catalog with no module
pages). Authority is the spec itself (`docs/PI-SPEC.md`), `AGENTS.md` (which
names the spec as source of truth), the EV-1 deliberation record
(`council/cards/EV-1.md`), and `council/cards/EV-8.md` (downstream, its
acceptance is binding for the surface it names). No recorded human decision
in `council/board.md` bears on these three questions.

The operative pair for this ruling is mechanism and user value, adapted to
this codebase: does the wire/contract hold, and does a host user or CI
operator get served by the choice? (PETA SPKLU grounding does not apply to
pi-remote — a different product — and reaching for engagement/retention
lenses would be the wrong instrument here.)

---

## Q1 — `PI_REMOTE_HOST_KEY` env override: retire vs. document

### Ruling
**Retire `PI_REMOTE_HOST_KEY` entirely.** Only `PI_REMOTE_SERVER_URL`
survives as a documented env override. Credentials are never carried in env
vars, even as a documented override. EV-1's §7.2 must not mention
`PI_REMOTE_HOST_KEY` at all. O-2's post-change gate runs with
`grep -n 'PI_REMOTE_HOST_KEY' docs/PI-SPEC.md` → 0.

### Reasoning
EV-1's acceptance line — "env vars are at most a documented override" —
permits both "one documented override" and "zero documented overrides."
Acceptance does not break the tie, so I rule on the merits.

Two pieces of evidence decide it:

1. **The runner packet's own round-3 logic applies symmetrically.** Owner
   in round 3 argued for documenting `PI_REMOTE_HOST_KEY` as "a pre-issued
   long-lived enrollment credential, consumed via the standard
   `token_endpoint` refresh grant." That is a second credential type the
   relay must accept at the token endpoint in addition to the
   authorization-code and device-code flows. §2's dumb-relay mandate and
   §10's "only the contract surfaces in §5.3, §7.2–7.3 are fixed here" do
   not permit minting new server contracts in EV-1 (a docs-only card);
   EV-2 and EV-7 are not written against a second credential type. The
   runner packet correctly used this same logic to reject designer's
   round-2 boot-time exchange endpoint; the logic binds equally against
   owner's round-3 position.

2. **Reversibility.** Retiring is cheapest to undo. Re-introducing a
   documented override later requires only appending a subsection.
   Introducing one now and discovering a leak vector in a future
   incident-response forces breaking every CI consumer that adopted it.

The blast radius is settled-by-convergence and preserved in either
position: leaked token ≈ old host-key blast radius, tenant-contained, no
session access, with revocation now possible at the control plane. So the
retire-entirely choice costs nothing in safety and gains the simplicity of
one credential type end to end. Zero-touch CI without any human approver
is a follow-up card if it ever becomes a real product need (designer r3
already named it; I do not preempt that card).

### Sources
- `docs/PI-SPEC.md` §2 (dumb-relay mandate), §10 (server out of scope;
  contract surfaces fixed here are §5.3, §7.2, §7.3 only)
- EV-1 acceptance: "env vars are at most a documented override"
- EV-1 round-3 convergence: 2v1 (principal + designer retire, owner
  document once) — both sides crossed during deliberation, neither side
  is captured by sunk-cost voting
- EV-2 and EV-7 are not written against a second credential type at
  `token_endpoint`

### Options rejected
- **Document `PI_REMOTE_HOST_KEY` once, consumed via refresh grant at
  `token_endpoint` (owner r3):** adds a second credential type without
  EV-2/EV-7 being written against it; refresh token already carries the
  host key's blast radius, so the operational benefit is small and the
  env-var leak vector (process tables, CI logs) is real.
- **Any other override shape:** no new evidence distinguishes it from the
  rejected position.

### Reversibility
Trivial to undo (append a §7.2 override subsection). If wrong, the cost
is a security migration in CI consumers that adopted the override — that
cost is bounded by the number of CI consumers that exist, which is small
enough today that the migration is acceptable.

---

## Q2 — `resyncing` in the authoritative §8 footer state set

### Ruling
**Yes. `resyncing` is a seventh state in the authoritative §8 state set.**
The full set, in the order they appear in lifecycle: `off`, `not enrolled`,
`authorizing`, `dialing`, `resyncing`, `live`, `error`. EV-1's §8 must
enumerate exactly these seven states. O-7's post-change gate runs with
`grep -nE 'off|not enrolled|authorizing|dialing|resyncing|live|error'
docs/PI-SPEC.md` and confirms each state appears in §8.

### Reasoning
The deliberation converged on six states; `resyncing` was never discussed.
That is a real gap in the convergence, but the spec's current §8 already
lists `resyncing`, and `council/cards/EV-8.md` (Ready) explicitly commits
in its acceptance: *"Footer status transitions through `dialing` and
shows `resyncing` during a replay (EV-5) — a remote observer can
correlate status with behavior."*

EV-8's acceptance is a recorded decision on a downstream card. Dropping
`resyncing` here would overturn that recorded decision, which is a
steward call, not a product-owner call. Merging it into `error+` is
semantically wrong: replay is a healthy, expected phase distinct from
both `dialing` (no fresh connection) and `live` (no new frames, only
replay), and operators reading the footer would be misled into thinking
something went wrong.

That leaves "7th state" as the only viable in-seat ruling. The mechanism
question is clean: replay can take meaningful time on large JSONLs and
is observable. The user-value question is clean: EV-8's acceptance
commits us to remote-observable status correlation, and `resyncing` is
what makes that correlation possible during replay. The runner packet's
three options collapse to one once "drop" is ruled out as out-of-seat.

### Sources
- `docs/PI-SPEC.md` §8 (current text pins `off` / `dialing` / `live` /
  `resyncing`)
- `council/cards/EV-8.md` acceptance: footer "shows `resyncing` during a
  replay (EV-5)"
- EV-1 deliberation record: six states converged-undisputed, `resyncing`
  never raised — gap is a missing-seat omission, not an intentional
  exclusion
- Wiki is empty

### Options rejected
- **Drop `resyncing` entirely:** overturns EV-8's recorded acceptance.
  That is a portfolio-level change to what EV-8 ships, not a §8 wording
  call, and is a steward escalation.
- **Merge `resyncing` into `error+`:** semantically wrong. Replay is a
  healthy phase; an operator watching the footer would interpret it as a
  failure. Misleads the user, violates the Gulf of Evaluation the
  designer's six-state set exists to close.

### Reversibility
Trivial. Renaming a status string in §8 and propagating to EV-8.

---

## Q3 — §7.5 row-1 tenancy + RFC 8414 discovery: ratification or prose-sync

### Ruling
**No ratification required.** The §7.4/§9.1 prose sync, the §7.5 row-1
tenancy update, and the RFC 8414 discovery dependency are all prose-sync
within EV-1's mandate. EV-1 may rewrite these sections without escalating
to steward. The blast radius — the only thing worth preserving — is
documented in §7.4 and unchanged by the rewrite.

### Reasoning
EV-1's acceptance protects §4–§6, §5.3, and §7.3 from alteration. §7.5 is
**not** in that list, so §7.5 is in scope for EV-1's prose changes. §10
already fixes §7.2 as one of the contract surfaces that EV-1 pins; the
RFC 8414 discovery dependency is the mechanism by which §7.2 names
control-plane endpoints as a contract rather than baking paths into the
extension (which the runner packet correctly notes was designer's
round-1 mistake).

The §7.5 row-1 tenancy change — from "key belongs to a tenant" to "`sub`
claim is tenant-scoped" — is the mechanical consequence of moving from
an opaque host key to an OAuth2 access/refresh token. OAuth2 carries
identity in token claims; that is not a design choice, it is the
protocol. The blast radius is preserved (settled-by-convergence, all
three seats): leaked token ≈ old host-key blast radius, tenant-contained,
no session access, revocation now possible. So this is not a security
model change; it is a faithful translation of an existing security
model into a different credential type.

No portfolio change here. No recorded human decision is touched. The
runner packet's principal and designer both said prose-sync within
mandate; owner endorsed the prose content but flagged the deltas as
worth flagging. I am flagging them in this ruling, finding no
ratification is needed, and letting EV-1 land.

### Sources
- EV-1 acceptance: protects §4–§6, §5.3, §7.3; §7.5 not in the list
- `docs/PI-SPEC.md` §10 (contract surfaces fixed here are §5.3, §7.2–7.3
  — §7.2 is the section being rewritten, so its endpoints including
  discovery are in scope)
- EV-1 round-3 convergence on blast radius (settled-by-convergence, all
  three seats)
- Wiki is empty

### Options rejected
- **Escalate to steward for ratification:** no portfolio change to
  ratify. The blast radius is settled and preserved. The tenancy move
  is mechanical. RFC 8414 is a standard discovery mechanism, not a
  server-implementation contract.
- **Block the prose sync until EV-2/EV-7 land:** would freeze the spec,
  which is exactly the staleness EV-1 exists to remove.

### Reversibility
Trivial. Any future card can rewrite §7.5 or change the discovery
mechanism. The blast radius is documented and preserved in §7.4.

---

## Closing note for the runner

EV-1 may proceed to step 7 with these three rulings recorded. The
post-change gates O-1, O-2 (with the form set by Q1), O-3, O-6, O-7
(with the form set by Q2), O-8, O-9, O-10, and O-11 become runnable
against the rewritten spec. O-4, O-5, O-12, O-13 are already settled or
out-of-scope as recorded.

The follow-ups named in the runner packet remain valid:
- README.md:93 stale `PI_REMOTE_HOST_KEY` — doc-sync follow-up
- EV-8 footer-state sync — once EV-1's §8 lands with the seven-state
  set, EV-8 reconciles
- Zero-touch CI without any human approver — separate card if the need
  ever materializes
