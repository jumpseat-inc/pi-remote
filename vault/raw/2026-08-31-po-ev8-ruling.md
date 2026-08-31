# EV-8 product-owner ruling — J1, J2, J3, J4, J5

> Source: pi-remote Council EV-8 step-6 escalation. Binding, final unless
> explicitly deferred to steward. Items J1/J2/J3/J4/J5 each disposed in one
> paragraph; reversibility named per item.

## J1 — Footer merge policy: amend EV-2 Item 4; adopt kind-first, live-clears-error on verified WS open

**Ruling.** I amend my own EV-2 Item 4 recorded preference and adopt the
deliberation's kind-first `mergeTransport` with `kind:"live"` clearing a
sticky `error`. What remains binding from EV-2 Item 4 is unchanged: tunnel.ts
ships the severity tag (closed-green O2 in EV-3's step-9 fixture), and EV-8
owns the final merge rule. What I overturn is the non-binding recorded
preference that an error must not be silently overwritten by a follow-on
live from a reconnect that has not yet succeeded. The Skeptic verified at
step-4 that a `kind:"live"` event from `createTransport` is emitted only after
a successful WS onopen (the one-time token is validated during that
handshake), so the failure mode my EV-2 guard was designed to defend
against is structurally impossible under the settled seam. The owner's
round-0 "sticky-until-user" position is rejected on the same evidence: it
would render a footer that lies about the network at the exact moment a
recovered tunnel is honestly live with frames flowing. The desginer's
Option-A prediction 13 — error → dialing → live — is the only one of the
two candidates that keeps the footer honest.

**Operational shape.** order-guard (ignore events with `order <= lastOrder`);
`live → { live, consec: 0 }` (clears sticky error); `dialing` /
`resyncing` follow most-recent-wins against the live family; `error` is
reached only by EV-8's threshold-N decision on consecutive error-severity
dialing events, with the rich `reason` preserved through the
rearm-collapse must-satisfy; `resyncing` is NEVER produced by the merge —
it is the replay overlay only, owned by the onResync path; mid-replay
dialing aborts replay and moves footer to dialing. The mergeTransport is a
pure function; the consecutive-error counter is EV-8's own, independent of
transport backoff.

**Reversibility.** Cheap. The merge rule is a single function; the closed
set of footer states is unchanged; both rounds of the EV-8 deliberation
were a test-bed apart. Adopting this preference over my own EV-2 preference
amends a recorded product-owner preference, not a settled binding
constraint — it is not a portfolio change.

## J2 — /rc URL-prompt moment: amend §8 sentence to defer prompt to /rc:login; the amendment rides EV-8's PR

**Ruling.** Adopt Side B: the URL prompt fires only out-of-band after
`/rc:login`, never from a bare `/rc`. Rationale: a bare prompted URL with
no tokens is transient by design — `readCredential` returns null unless
`serverUrl + accessToken + tokenExpiry` are all present, so a URL-only
prompt has nowhere durable to land; storing a serverUrl-only credential
contradicts the EV-7 settled boundary (credential = full shape or absent)
and would create an enrollment surface with two incompatible shapes. Tying
the URL prompt to `/rc:login` keeps the enrollment surface coherent: the
URL arrives with the rest of the enrollment state on the driver's first
HTTP round-trip, the prompt and the credential share one lifecycle, and
`/rc` on an enrolled host with a missing URL is a misconfiguration that
points at `/rc:login` exactly the same way it already does for missing
tokens.

**Reconciliation with §8 literal.** §8 says "/rc prompts once for a
control-plane URL if unset." This ruling amends that sentence. The
amendment rides EV-8's PR per the EV-4 Q1 governance precedent —
facilitator-authored, evidence-cited, in-scope prose-sync — because EV-8
is the implementing card that owns the URL-prompt surface; the prose
correction preserves the security model (no URL-only credential store is
introduced) and the user-visible intent (a user without a URL is told to
run `/rc:login`, which is the remedy they need anyway); the seven-state
set is unchanged. FLLWUP-1's README-sync follow-up carries the user-visible
reflection. I explicitly acknowledge that this amendment travels with
EV-8, not on a separate PR.

**Reversibility.** Cheap. The prompt site moves by one function call; the
seven-state set is unchanged; the credential store boundary is unchanged;
no security property is relaxed.

## J3 — Enrollment-class 401/403 during reconnect rearm: STOP the retry loop; remedy is /rc:login

**Ruling.** Adopt Side A — when a rearm hits an enrollment-terminal
`TunnelError` (401 unauthorized or 403 forbidden), the connect/reconnect
loop stops. The footer lands on `error` carrying the rich enrollment
reason (`enrollment_expired` or `enrollment_rejected`), not
`relay_unreachable`. The remedy is `/rc:login`. This is **distinct from**
transient transport failures (relay_unreachable, protocol_violation,
url_expired), which keep retrying forever at capped backoff per EV-3.

**Reconciliation with EV-3 retry-forever ruling.** EV-3's retry-forever
ruling covered the WS dial seam: the transport never gives up because
dial failures are transient and §6 sets no give-up boundary. That ruling
explicitly said §8's "terminal" attaches to rendering failure to the
user, not to the act of retrying. What EV-3 did not — and could not —
cover is credential terminality at the control plane: `createTunnel` is
401-terminal by design (EV-2 settled, no auto-refresh on a 401 from
`POST /tunnels`), and re-dialing the same dead credential is futile in a
way re-dialing the same relay after a blip is not. Transport terminality
(dial forever) and credential terminality (stop on dead credential) are
two different seams; collapsing them into one retry policy would silently
hide the case where `/rc:login` is the only thing that can unstick the
host. The footer for a credential-terminal state lands on `error` with
the enrollment reason's user line, not a transport reason; the merge
function uses the same error-threshold-N machinery it already has, only
the source of the trigger is the rearm closure rather than the transport
event stream.

**Interaction with the must-satisfy.** The rearm-collapse must-satisfy
(transport.ts:359-364) is binding for this ruling. The rearm closure
MUST preserve the rich `TunnelError.reason` from tunnel.ts (e.g.
`enrollment_expired`, `enrollment_rejected`) and not collapse to
`relay_unreachable`. The principal's T-N (now T9 / T14 in the merged
test plan) nails this: a 401 from `createTunnel` thrown inside reconnect
rearm lands the footer at `error` with the enrollment remedy, not a
transport reason. Without the must-satisfy this ruling is
under-determined; with it, the seam closes.

**Reversibility.** Cheap. The rearm closure's stop condition is a single
discriminated-union match on `TunnelError.kind`; the error path is the
same machinery the transport-error footer path already uses; the
credential-still-present property is unchanged (teardown never clears
credential, per EV-2's settled boundary).

## J4 — Exact N for the error-footer consecutive threshold: N = 10

**Ruling.** Pin `N = 10` consecutive error-severity dialing events to land
the footer on `error`. Both sides of the deliberation converged on ~10;
the hard constraints are met (N ≥ 2, injectable as `ERROR_DIAL_THRESHOLD`,
deterministic). The 10-event threshold is the EV-2 Item 4 recorded owner's
first-pass value and is sufficient to suppress transient blips while
remaining short enough that a genuine control-plane outage reads as
`error` within a window the user can act on. The counter is reset on any
non-error-severity event (including a successful live) — a single
verified WS open is the system's signal that the dial loop recovered, so
the counter starts fresh on the next fault cycle. The counter lives in
EV-8's FSM, independent of the transport's backoff counter — those are
two different numbers (transport backoff grows during the fault window;
the footer-error counter caps the visible error transition at N).

**Reversibility.** Trivial. One injectable constant; the test plan's
T9 (`N-1 → dialing`, `Nth → error`) pins the deterministic boundary.

## J5 — /rc:login while tunnel is live: REFUSE with a stated sentence, footer unchanged, driver not entered

**Ruling.** Adopt Side A — `/rc:login` while the tunnel is live is
refused with a single stated sentence naming the remedy ("close the
tunnel first with `/rc:off`"); the footer does not transition; the
login driver is not entered. This is the only resolution compatible with
the EV-7 general rule 4 (the login driver emits `authorizing` on begin
and `off` on terminal — an `authorizing → off` clobber over a live
footer is a composition bug the principal flagged in EV-8 step-2 blind
spots; that bug does not survive a refusal). The same refusal rule
applies to all non-terminal live-adjacent states (`dialing`, `resyncing`,
`authorizing`, `error`); the only states where `/rc:login` proceeds are
`off` and `not enrolled`.

**Reconciliation with EV-7 rule 4.** EV-7's rule 4 assumes an idle host
(`off` or `not enrolled`); Side B's "allow live re-enroll for credential
rotation" reads rule 4 as a transition property rather than an
idle-host precondition, but the implementation cost of allowing it is
not the surface-level rotation it appears to be. A live re-enroll would
need to: (a) tear down the live tunnel before driving login; (b) NOT
clear the credential mid-flow (EV-2 boundary); (c) not collide with the
in-flight rearm closure's tunnelId. Each of these is a real seam, and
the user's actual rotation cost is one `/rc:off` keystroke. Refusal
until idle is the cheapest-to-reverse option and the only one that
preserves rule 4 verbatim. If a future product call wants live
re-enroll, it is a follow-up card that explicitly works rule 4 — not a
silent extension of it.

**Reversibility.** Cheap. The refusal is a single guard in the `/rc:login`
entry; the FSM and copy-vocabulary work is unchanged. A future reversal
folds into the same guard with an additional `live` branch.

## Items deferred to steward

None. All five items are within this row's authority: each is a card-scoped
design judgment that does not change the portfolio (no card declined, no
recorded human decision overturned, no settled `goal` revised, no permanent
acceptance shift). J2's §8 amendment rides EV-8's PR per the EV-4 Q1
governance precedent and is in-scope prose-sync; J3 is a stop-condition on a
seam EV-3 deliberately did not cover; J1 amends my own recorded preference,
not a binding constraint.

## What remains binding after this ruling (carry-forward to EV-8 step 7+)

1. kind-first `mergeTransport` with order-guard; `live` clears sticky `error`;
   `resyncing` is replay-overlay only; error threshold N = 10; counter resets
   on any non-error event; counter is EV-8's, independent of transport backoff.
2. URL prompt fires only out-of-band after `/rc:login`; §8 sentence amended on
   EV-8's PR (facilitator-authored, evidence-cited) per EV-4 Q1 precedent.
3. Rearm closure preserves `TunnelError.reason` end-to-end (must-satisfy from
   Skeptic; closes transport.ts:359-364 collapse); enrollment-terminal
   TunnelError stops the dial loop with footer `error` carrying the
   enrollment reason's user line; transport-terminal failures keep
   retrying forever per EV-3.
4. `/rc:login` while live/dialing/resyncing/authorizing/error is refused
   with a single stated sentence naming the remedy; only `off` and
   `not enrolled` allow the driver to enter.
5. EV-2 Item 4 binding parts (tunnel.ts ships severity tags) remain
   binding; the non-binding preference is amended.
