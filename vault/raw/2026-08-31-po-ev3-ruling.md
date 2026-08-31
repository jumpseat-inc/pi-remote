# EV-3 Open-Judgment Rulings — product-owner seat

Date: 2026-08-31
Card: EV-3 — Outbound wss transport with seq-ack envelope
Epic: EPIC-1
State at ruling: Deliberating (architecture settled; O1 BLOCKING open-judgment + R3 non-blocking companion escalated from the council-runner's step-6 escalation)

The wiki is empty (`vault/wiki/index.md` is a stub catalog with no module
pages). Authority is the spec itself (`docs/PI-SPEC.md`), `AGENTS.md`
(which names the spec as source of truth), the EV-3 deliberation record
(`council/cards/EV-3.md`), and the EV-1/EV-2/EV-4 ruling precedents on
the seven-state footer set, the footer-merge policy preference, and the
spec-correction governance mechanism. No recorded human decision in
`council/board.md` bears on these questions.

The operative pair for this ruling is mechanism and user value. The
mechanism question is hard and binary: when a relay is permanently down,
does the transport ever stop, and if so what does it emit? The user-value
question is what the host user actually sees on the footer during an
extended outage, and what they can do about it. The two lenses converge
on the same answer for sub-question 1; they diverge for sub-questions
2–4, where the cheapest-to-reverse principle decides.

---

## Sub-question 1 — Does transport ever stop retrying?

### Ruling

**Retry forever at capped exponential backoff + jitter. The transport
never gives up.** §6 of the spec names "reconnect with exponential
backoff + jitter" with no give-up boundary, and §8 names `error` as a
*terminal failure state with the reason shown* — but §8's terminality
attaches to the **rendering** of a failure to the user, not to the
**act of retrying** by the transport. Those are two different
terminals, and conflating them is exactly the seam the converged
architecture (typed state-event seam; transport emits events, EV-8
renders) exists to prevent. The transport is a transducer, not a
judge of hopelessness.

Concretely: the backoff loop runs until the session ends. A
permanently-down relay leaves the transport stuck in the backoff
loop forever, capped at whatever the §6 spec language implies (the
"capped" is principal's qualifier; the cap value is implementation-
defined and lives in EV-3's acceptance tests, not in this ruling).
There is no `relay_unreachable`-after-N counter inside the transport
that can transition it into a permanent failure mode. The transport
emits, and EV-8 decides.

### Reasoning

Three facts decide it. (1) **§6 sets no give-up.** Reading the spec
honestly: "reconnect with exponential backoff + jitter; heartbeat
pings; stable logical connection id" — no N, no max-attempts, no
"and then stop." A transport that decides to stop on its own
invents a policy the spec did not write. (2) **§8's `error` is a
rendering state, not a transport state.** §8 names `error` as a
footer state the *user sees*; the converged architecture has
transport emitting typed events with `kind`/`severity`/`reason`
metadata and EV-8 alone calling `setStatus`. Reading §8's
"terminal" as binding on the transport collapses the seam — EV-8
loses the ability to merge "transport is still trying" with
"user should see a reason." (3) **Retry-forever matches §6 and
matches the user value.** A coding session that lasts hours (this
is a `pi` session — long, interactive, often idle) cannot
realistically declare a relay dead after N attempts. A flaky coffee-
shop network, a relay restart, a 5-minute control-plane outage — all
are routine. If the transport gives up, the user must `/rc` again
manually; if it doesn't, the user gets to come back to a live
tunnel when the relay comes back. Retry-forever is the cheaper-
to-reverse choice *and* the more durable choice — both lenses agree.

The seat's mechanism test passes: the spec says what the spec says,
and retry-forever reads it correctly. The user-value test passes:
a `pi` user with an idle session does not lose the tunnel because
the coffee shop's relay had a 30-second outage. The reversibility
test passes: switching to give-up-after-N later is a single
backoff-loop edit plus a counter field; the rest of the system is
unaffected.

### Sources

- `docs/PI-SPEC.md` §6 (transport contract: "Reconnect with
  exponential backoff + jitter; heartbeat pings; stable logical
  connection id"; no give-up boundary named).
- `docs/PI-SPEC.md` §8 (footer states; `error` defined as
  "terminal failure state with the reason shown"; the terminality
  attaches to the *state* the user sees, not to the transport
  mechanism).
- `council/cards/EV-3.md` step-2 principal position: dial
  failures are transient; §6 sets no give-up; backoff continues.
- `council/cards/EV-3.md` step-2 owner position: reconnect is an
  exponential-with-full-jitter loop owned by transport; no
  give-up.
- `council/cards/EV-3.md` step-3 convergence #2 (the 10-point
  architecture): "Error is a footer state owned by EV-8, not a
  transport emission into the footer."
- EV-1 Q2 ruling (the seven-state footer set; transport may
  claim only `dialing` and `live` per the converged architecture).

### Options rejected

- **Give-up-after-N (designer's position):** the backoff loop
  cannot honestly know what N is. Too small (a 60-second coffee-
  shop outage kills the tunnel); too large (it never triggers).
  Spec §6 sets no boundary and §8's terminality is on the
  *rendering*, not the *retrying*. Switching to retry-forever
  later is one edit; switching the other way later means
  deciding N retrospectively, with no spec anchor.
- **Retry-forever without a cap (no `max`):** the cap is in
  §6's "exponential backoff" by convention — a pure exponential
  without a cap is a foot-gun for the implementation. The cap
  belongs to EV-3's acceptance; this ruling does not bind its
  value.

### Reversibility

Trivial. Switching to give-up-after-N is a counter field plus a
backoff-loop edit. Switching the cap value is a constant edit.
No seam with EV-8 changes; no footer rendering changes; no
wire contract changes.

---

## Sub-question 2 — If give-up, the value of N and the closed reason set

### Ruling

**Not applicable.** Sub-question 1 rules out give-up; sub-question 2
is moot on its own terms. The closed reason set is, however,
decided for *transport-internal use* (sub-question 3 below), and
that decision is recorded there.

---

## Sub-question 3 — Does transport emit a terminal `kind:"error"` event, or only `reason` metadata on `dialing`?

### Ruling

**Only `reason` metadata on `dialing`, never a terminal `kind:"error"`
event from the transport.** The transport's typed event stream
emits two `kind` values for connection state: `dialing` (with
optional payload sub-fields identifying first-connect vs
reconnecting, plus a closed `reason` taxonomy for *why* a dial
failed, recorded below) and `live` (the successful upgrade). The
transport does **not** emit a `kind:"error"` event into its typed
stream, because the transport does not have terminality to report.
The `error` footer state is owned by EV-8's merge policy, fed by
reason metadata from the transport (and from tunnel.ts, per EV-2),
and only when EV-8's policy decides the user should see one.

The closed `reason` taxonomy the transport ships (transport-internal
vocabulary, *not* a transport-emitted terminal state):

| Reason | Meaning | When emitted |
|---|---|---|
| `first_connect` | Initial `/rc` dial | payload sub-field on `dialing` |
| `reconnecting` | Re-arm per dial attempt after attempt 1 | payload sub-field on `dialing` |
| `relay_unreachable` | A dial failed (TCP / TLS / WS handshake) | `reason` on the *next* `dialing` event |
| `protocol_violation` | An inbound frame was malformed (envelope shape, ack inversion) | `reason` on the *next* `dialing` event, after closing the offender |
| `url_expired` | The re-armed URL's `expiresAt` passed before the upgrade completed | `reason` on the *next* `dialing` event |

The taxonomy is **closed** — these five are the only `reason`
values the transport emits. New reasons require a spec amendment,
not an implementation choice. (This is the same closed-vocabulary
discipline EV-1's Q2 ruling applied to footer states.)

### Reasoning

Three facts decide it. (1) **The converged architecture already
chose this.** Step-3 convergence #1: "Typed state-event seam.
Transport emits typed events `{kind, severity, order, connectionId,
reason?, since?}`; EV-8 alone renders `setStatus`." The kind union
in that record is `dialing | live`, ± `error` as the residual. The
runner packet's step-5 consolidator explicitly classifies this as
"designer retreated from `error belongs to this card` as a footer
emission, but keeps `error` in the reasoning around an
unrecoverable relay death (see residual)." The seam does not let
transport emit `error`; that is the architecturally-correct
reading. (2) **EV-2's `severity` tag is already shaped for this.**
The EV-2 Item 4 ruling recorded the merge-policy preference:
"highest-severity-wins for the live/error/dialing transitions
(an error must not be silently overwritten by a follow-on live
from a reconnect that has not yet succeeded — errors need to be
seen and acknowledged)." If transport emits `kind:"error"`, EV-8
must consume *and* merge it; if transport emits only `reason`
metadata on `dialing`, EV-8 can derive `error` from a stable
mapping (transport-retry-forever → transport-still-trying →
*user-visible* `error` belongs to EV-8's policy, not transport's
mechanism). The cleaner shape is reason-metadata + EV-8 merge,
which is what this ruling picks. (3) **The user value is on the
rendering side, not the mechanism side.** The user wants to see
"the relay is down" on the footer. *How* the transport surfaces
that to the rendering layer is an internal detail; what matters
is that the rendering layer can show the reason and that the
reason vocabulary is closed so the rendering can never leak a
stack trace or a tunnel URL. The reason taxonomy above is the
seam: transport owns the closed set, EV-8 owns the rendering.

Mechanism check: the transport's typed stream has two `kind`
values; the rest is `reason` payload. EV-8's merge function gets
exactly the data it needs. No `kind:"error"` event exists; no
terminality in the transport.

User-value check: the user sees a footer copy that names the
reason (e.g., "relay unreachable — retrying") and is allowed by
EV-8's merge policy to be elevated to the `error` footer state if
EV-8 decides the right policy is "after N consecutive `dialing`
events with `reason:relay_unreachable`, surface as `error`." That
is a policy choice, not a transport mechanism choice — and
EV-8 owns it.

### Sources

- `docs/PI-SPEC.md` §8 (`error` is a footer state; transport may
  emit only `dialing` and `live` per the converged architecture
  + EV-1 Q2 ruling).
- `council/cards/EV-3.md` step-3 convergence #1 (typed state-event
  seam; `kind` union is `dialing | live`, ± `error` residual).
- `council/cards/EV-3.md` step-3 convergence #2 (`reconnecting` is
  a *payload sub-state* of `dialing`, not an 8th §8 state).
- `council/cards/EV-3.md` step-3 convergence #10 (error footer
  state owned by EV-8 merge policy).
- EV-2 Item 4 ruling (recorded merge-policy preference; severity
  tag shipped; "errors need to be seen and acknowledged" anchors
  why a `kind:"error"` from transport would be the *wrong* seam
  — transport retrying-forever cannot honestly emit terminal).
- EV-1 Q2 ruling (closed vocabulary discipline: footer states
  enumerated exactly; same discipline applies to transport
  `reason` values).

### Options rejected

- **Transport emits `kind:"error"` once per failed cycle
  (designer's position):** the transport cannot honestly emit
  terminal when sub-question 1 has decided it never stops
  retrying. A `kind:"error"` event from a non-terminal mechanism
  is a lie in the event stream — EV-8 would have to either
  trust the lie (and lose the ability to distinguish "transport
  is dead" from "transport gave up") or treat it as advisory
  (and lose the value of the type system). The seam should
  not lie. Reason metadata is the honest signal.
- **Transport emits `kind:"error"` only on `protocol_violation`
  or `url_expired` (a hybrid):** still lies about terminality
  for `protocol_violation` (a malformed envelope is recoverable
  on reconnect — §5.3 resync semantics make this true) and
  for `url_expired` (the next re-arm hands a fresh URL — same
  cycle). Neither is terminal; neither warrants breaking the
  type system.

### Reversibility

Trivial. If a future card decides transport should emit
`kind:"error"` after all, the union grows by one and EV-8's
merge function gains one branch. The reason taxonomy stays the
same; the wire contract stays the same; nothing else moves.

---

## Sub-question 4 — The boundary between a transport-internal failure signal and an EV-8 footer-`error` landing

### Ruling

**The transport never lands on `error`. The footer-`error` landing
is EV-8's policy decision, derived from transport reason metadata
plus tunnel.ts's HTTP-class errors.** Concretely:

| Source | What it emits | Footer landing decision |
|---|---|---|
| `transport.ts` | Typed events `{kind: "dialing", reason: …}` / `{kind: "live"}` with `severity` (per EV-2's tag convention) and an ordered `order` ordinal | EV-8's merge function decides |
| `tunnel.ts` | Reason rows from its closed vocabulary (`unauthenticated`, `forbidden`, `unreachable`, `server_error`, `already_live`) tagged with `severity` (per EV-2 Item 4) | EV-8's merge function decides |
| `index.ts` (EV-8) | `setStatus("pi-remote", footerState, reasonKey)` | The footer call lives here, period |

The boundary is mechanical: anything transport emits with `kind`
not in `{dialing, live}` does not exist. Anything with `kind` in
that set is renderable as `dialing` or `live` (with reason
metadata surfaced as the `dialing` payload's reason field, per
the converged architecture's `reconnecting` sub-state). The
`error` footer state is reached only when EV-8's merge function
decides to surface it — for example, "after N consecutive
`dialing` events with `reason:relay_unreachable`, land on
`error` with the same reason key."

The N for that EV-8 policy is **not this ruling's N** (sub-
question 2 ruled N moot). The cap on transport backoff (sub-
question 1) and the threshold for EV-8 to land on `error` are
two different numbers; conflating them is the seam violation
that produced O1.

### Reasoning

Three facts decide it. (1) **The seam is already drawn.** §3
names `transport.ts` and `tunnel.ts` as the two network modules;
the EV-3 step-3 converged architecture names EV-8 as the sole
owner of the `setStatus` call. This ruling is the formal
corollary: the transport has no path to a footer write, by
construction. (2) **The merge policy is EV-8's, recorded as
such.** EV-2 Item 4 explicitly deferred the merge rule to EV-8
with a recorded preference ("highest-severity-wins for the
live/error/dialing transitions … errors need to be seen and
acknowledged"). That ruling also named why transport should
not emit `kind:"error"`: an error must not be silently
overwritten by a follow-on live from a reconnect that has not
yet succeeded. If transport emits `kind:"error"`, EV-8's merge
function must arbitrate it against a later `kind:"live"` from
the same retry cycle; if transport emits only reason metadata,
EV-8's merge function arbitrates against reason-derived
severity, which is what the EV-2 tag convention already
supports. The cleaner shape is the reason-derived shape. (3)
**The "give-up-after-N" intuition is preserved, just relocated.**
A user who wants "the transport should give up after N and
land on `error`" is asking for a *policy* — under what
conditions should the user see `error`. That policy lives in
EV-8, with `N` as a parameter. The transport's retry-forever
mechanism is unchanged; the user's experience of seeing `error`
after some threshold is unchanged; the seam is clean.

Mechanism check: transport emits typed events; EV-8 consumes
them; the seam is one direction; `error` is reachable only from
EV-8's merge.

User-value check: the user sees whatever EV-8's policy decides.
A reasonable default — "after, say, 10 consecutive `dialing`
events with `reason:relay_unreachable`, land on `error`" —
matches the designer's original intent (the user wants to see
that something is wrong) without breaking the seam. The default
is EV-8's; the seat does not bind it here.

### Sources

- `docs/PI-SPEC.md` §8 (footer states; EV-8 owns the surface).
- `docs/PI-SPEC.md` §3 (transport.ts is the WS-only module;
  EV-8 is the entry point that registers commands and renders).
- `council/cards/EV-3.md` step-3 convergence #10 ("Error is a
  footer state owned by EV-8, not a transport emission into the
  footer").
- `council/cards/EV-3.md` step-3 convergence #1 (typed state-
  event seam; transport emits, EV-8 renders).
- EV-2 Item 4 ruling (severity tag; merge-policy preference
  deferred to EV-8; "errors need to be seen and acknowledged").
- EV-1 Q2 ruling (seven-state footer set, closed vocabulary).

### Options rejected

- **Transport lands on `error` directly after N failed dials:**
  seam violation. EV-8 cannot merge a footer write from another
  writer without coupling to its merge policy; the converged
  architecture chose transport-emits / EV-8-renders precisely to
  avoid this coupling.
- **Transport does not surface failure reasons at all (just
  `dialing`/`live`):** the user loses the Gulf of Evaluation.
  A `dialing` footer that does not say *why* it is dialing is a
  silent failure mode; the reason metadata is what makes the
  footer legible.
- **Both transport and tunnel.ts can land on `error`:** same
  seam violation, twice. The `severity` tag is the seam-
  respecting way for tunnel.ts to participate.

### Reversibility

Trivial. Moving the `error` write back into transport (if a
future card prefers that) is a one-method change in transport.ts
plus an EV-8 merge-function simplification. The reason taxonomy
stays the same; the wire contract stays the same.

---

## Companion — R3 — Should §8 carry a one-line note about first-connect vs reconnecting?

### Ruling

**Defer to FLLWUP-2.** FLLWUP-2 already reconciles EV-8's card
text with the seven-state footer set; a §8 prose note about
payload-field distinction between first-connect and reconnecting
is a sub-bullet of that reconciliation. Adding it on the EV-3 PR
would touch §8 prose that FLLWUP-2 owns; the cleaner path is to
let FLLWUP-2 decide the §8 prose shape as a whole and have EV-3
inherit whatever FLLWUP-2 lands.

The seat records its non-binding preference for FLLWUP-2's
runner, since FLLWUP-2 will not start from zero: **Reading (a) —
leave §8 prose unchanged.** The converged architecture already
pins `reconnecting` as a *payload sub-state* of `dialing`, not an
8th state; the spec text's silence on the distinction is a
*correct* reflection of the seven-state set. Adding a one-line
note that the host-visible copy may distinguish the two via a
payload field reads as a footnote to a design choice that
belongs to EV-8's rendering, not to §8's prose — and §8 prose
should name states, not rendering choices. If FLLWUP-2's runner
disagrees and adopts Reading (b), the note rides the FLLWUP-2
PR per the EV-1 Q3 + EV-4 Q1 precedent (prose-sync inside the
card's mandate); the seat's preference is non-binding.

### Reasoning

Two facts decide it. (1) **The mechanism is settled; only the
prose is open.** The converged architecture (#2 in the 10-point
list) named `reconnecting` a payload sub-state of `dialing`,
not an 8th §8 state. The card text's intent — "§8 should carry
a one-line note that the host-visible copy may distinguish
first-connect from reconnecting via a payload field" — is about
*the prose*, not the architecture. The architecture is done;
the prose is a follow-up. (2) **The follow-up card exists.**
FLLWUP-2 — "Reconcile EV-8 card text with the seven-state
footer set" — is the canonical home for §8 prose edits tied to
the EV-3 settlement. Routing the note there is the cheaper-
to-reverse choice (FLLWUP-2 owns the reconciliation, so the note
gets the right surrounding context) and the more durable
choice (the note survives any EV-3 implementation churn,
because the §8 prose shape is FLLWUP-2's responsibility).

The seat's mechanism test passes: prose-sync is governed by
EV-1 Q3 + EV-4 Q1 precedent (in-scope prose-sync rides the
originating card's PR, no separate ruling). The user-value
test passes: the user does not see §8 prose; they see the
footer. The footer shape is settled.

### Sources

- `docs/PI-SPEC.md` §8 (the seven-state footer prose; the seat
  reads it as currently silent on first-connect vs reconnecting,
  which matches the converged architecture's payload-sub-state
  choice).
- `council/cards/EV-3.md` step-3 convergence #2 (`reconnecting`
  is a payload sub-state of `dialing`).
- `council/cards/FLLWUP-2.md` (the existing card that reconciles
  EV-8's text with the seven-state set).
- EV-1 Q3 ruling (spec-correction governance mechanism).
- EV-4 Q1 ruling precedent (in-scope prose-sync rides the
  originating card's PR).

### Options rejected

- **Reading (b) on the EV-3 PR:** touches §8 prose that
  FLLWUP-2 owns. Two writers on one § is the cheaper-to-reverse
  problem; FLLWUP-2 is the right home.
- **No deferral, no PR change, Reading (a) silent:** Reading (a)
  is the preference, but the explicit deferral to FLLWUP-2 is
  the binding move so the runner has a record.

### Reversibility

Trivial. Reading (b) can ride the FLLWUP-2 PR at any time; this
ruling is non-binding on FLLWUP-2.

---

## General rule for the transport failure signal — for EV-5, EV-6, EV-7, EV-8

**The transport's typed event stream is `{kind: "dialing" | "live",
…, reason?, severity, order, …}`. There is no `kind:"error"` event.
The `reason` field on a `dialing` event is one of the five closed
values in the sub-question 3 table. `severity` follows the EV-2
tag convention (`"error" | "live" | "resyncing"` plus the
`reason` vocabulary's own severity, surfaced as a payload field,
not a `kind`). `order` is a monotonic gap-free ordinal so EV-8's
merge function can implement either merge rule.**

For each downstream card:

- **EV-5 (JSONL history replay and resync):** The replay path
  pushes frames through `transport.send()` (per the EV-3
  converged architecture #6: write-time seq assignment; replay
  frames carry EV-5's deterministic ids and must not be
  overwritten by transport's UUID stamper). When the socket is
  not live, EV-5's `send` is a drop with a signal — the
  transport does **not** queue, by design. If EV-5 needs to
  surface a "could not replay because transport is down" copy
  to the user, that copy is a render via EV-8, not a transport
  emission. The transport's reason metadata (`relay_unreachable`,
  `protocol_violation`) is the only honest signal EV-5 has about
  *why* a `send` dropped.
- **EV-6 (Remote input injection):** Injection writes to
  `pi.sendUserMessage()` locally; the wire-side effect goes
  through the live event path (§5.4). EV-6 does not directly
  emit transport events. If an injection fails because the
  transport is down (the injection happens locally, but the
  remote observer never sees the echo), that is a rendering
  concern for EV-8, not a transport signal.
- **EV-7 (`/rc:login` OAuth2 enrollment command):** EV-7 is
  orthogonal to the transport failure signal — it runs before
  the transport exists. The "Not enrolled — run `/rc:login`"
  copy (EV-1 / EV-2 round-2 convergence) is a tunnel.ts reason
  row (`not_enrolled`), not a transport signal. EV-7 does not
  need to read this ruling.
- **EV-8 (Command surface and lifecycle wiring):** EV-8 owns
  the `setStatus` call and the merge function. EV-8 reads the
  transport's typed event stream and decides:
  - When a `dialing` event with a `reason` value of
    `relay_unreachable`, `protocol_violation`, or `url_expired`
    should land the footer on `error` (the seat records no
    preference on the policy threshold; that is EV-8's call).
  - When a `dialing` event with `reason` of `first_connect` vs
    `reconnecting` should be rendered differently (the host-
    visible copy distinction is EV-8's per §8 + FLLWUP-2's
    reconciliation).
  - How to merge a transport event with a tunnel.ts reason row
    that arrives close in time (e.g., transport `dialing`
    `relay_unreachable` vs tunnel.ts `unreachable` on the
    next re-arm attempt). The merge function is the only
    place these two streams meet, and it is the only place
    that can produce a footer `error` landing.

The seat's principle for downstream cards: **the transport
failure signal is honest metadata, never terminal.** Any
`error` you see on the footer is EV-8's call, derived from
the metadata EV-8 receives. If you need to surface failure to
the user, route through EV-8's merge function; do not invent
a side-channel.

---

## Closing note for the runner

EV-3 may proceed to step 7 with these four sub-question rulings
and the companion ruling recorded:

- **Sub-question 1:** retry forever at capped exponential backoff
  + jitter; no give-up. The transport never stops.
- **Sub-question 2:** moot (sub-question 1 rules out give-up).
- **Sub-question 3:** transport emits only `kind: "dialing" | "live"`
  with a closed `reason` taxonomy of five values (`first_connect`,
  `reconnecting`, `relay_unreachable`, `protocol_violation`,
  `url_expired`). No `kind: "error"` event from transport.
- **Sub-question 4:** `error` footer landing is EV-8's policy
  decision, derived from transport reason metadata + tunnel.ts
  reason rows, via EV-8's merge function. Transport has no path
  to a footer write.
- **Companion R3:** deferred to FLLWUP-2; seat's non-binding
  preference is Reading (a) — leave §8 prose unchanged, because
  the architecture already pins `reconnecting` as a payload
  sub-state of `dialing`.

**Post-change gates (step 9) — restated:**

- **O1 closed:** transport retry-forever at capped backoff; no
  give-up; no `kind: "error"` event; `error` is reached only via
  EV-8's merge. Step 9 verifies: backoff loop never exits on its
  own; typed event stream has only `kind: "dialing" | "live"`;
  reason taxonomy is the closed five-value set from sub-question
  3; EV-8 consumes metadata, transport never calls `setStatus`.
- **O2 closure-by-test (unchanged):** typed event field set
  against the EV-2 Item 4 merge-policy preference. `severity`
  floor applies; `order` or timestamp primitive applies;
  residual fields (`since?`, `attempt?`, `connectionId`,
  `reason?`) settled by Skeptic fixture at step 9.
- **O3 deferred-by-design (unchanged):** no-socket gate on
  translate.ts now; history/inject assertions inherit from
  EV-5/EV-6.
- **R3 deferred to FLLWUP-2** (no EV-3 step-9 gate).

O1 is no longer open. EV-3 routes to step 8 with the four
sub-question rulings, the companion deferral, and the ten-point
converged architecture as the binding contract.
