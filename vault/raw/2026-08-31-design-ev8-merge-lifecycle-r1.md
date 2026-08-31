# EV-8 round-1 design position — merge policy + copy-asymmetry

> Source of the position: pi-remote Council round-1 design output for card
> EV-8 ("Command surface and lifecycle wiring"), refining round 0 in
> response to owner + principal positions. Does NOT settle policy; flags
> what each option reads like at the host-user moment, and hands the
> Council + Skeptic test-distinguishable falsifiable predictions.
> Escalates the merge policy to `product-owner` separately.

## Round-1 design position

EV-8 round-1 reads the owner/principal convergence on **kind-first**
mergeTransport with order-guard as correct and the seven-state discipline
as compatible with both camps; the remaining disagreement is narrower
than the round-0 framing suggests. It is one question: **does a
successful transport `live` event clear a sticky `error`?** Owner says no
(error persists until the user acts); principal says yes (live from a
genuinely-completed WS open is the system's signal that the dial
succeeded — letting it silently overwrite the error is exactly what the
discipline exists to prevent against *unverified* reconnect events, but
a `live` is by-construction verified: `send()` only returns a non-null
seq after the socket is in OPEN and the WS open handler fired).
Both proposals agree on the six-state order guard, on healthy
most-recent-wins for {dialing, resyncing, live} as an interaction of
`mergeTransport` with `kind:"live"` (principal) or just on event order
(owner), and on `resyncing` being a replay overlay that the merge
function never produces.

The seat has no user research, no smoke harness of its own, and no
way to observe a running extension. It reasons from the activity
("the host is at a screen, the relay has had a transient blip, the
WS reopens, frames begin flowing again") and from the
seven-state copy vocabulary already shipped in `src/tunnel.ts` and
`src/login.ts`. It does not pretend to settle which option is
"correct" in a system sense; that is product-owner's scope.

### Gulf closed under each option (user-comprehension only)

**Option A — "live clears error" (principal's revised kind-first)**.
The host user sees, on a transient relay blip that resolves on its
own:

- footer: error → dialing → live (with no error-tagged state
  re-printed during the blip because the merge keeps `error` sticky
  while the reconnect is dialing, then the verified live overwrites
  it)
- stdout: one `lifecycle.dialing` line at blip start, one
  `lifecycle.live` line at blip end (NOT the `tunnel.error.*` line,
  because the dial that raised the error did not produce a NEW error
  reason during recovery — the merge cleared the error on the live
  event, but `mergeTransport` does not emit copy)
- Gulf of Evaluation at the recovery moment: closes cleanly. The
  user sees a dial-then-live pair, knows the system recovered, and
  can continue. There is no "the footer lied about the network"
  moment because the WS genuinely is open and frames genuinely
  flow — the system is honestly live.

**Option B — "error sticky until user acts" (owner's strict)**.
The host user sees:

- footer: error → (unchanged through successful reconnect, because
  no transport event overwrites error) → live ONLY when the user
  types `/rc`, which restarts the dial
- stdout: `lifecycle.dialing` (the recovery dial begins), no
  `lifecycle.live` line (because the merge doesn't emit
  copy even though frames are flowing), and crucially **the user
  has no stdout signal that the tunnel is healthy again** — they
  must glance at the footer, which still says `error`, which the
  design discipline exists to make sticky
- Gulf of Evaluation at the recovery moment: **widened**. The user
  sees `error` in the footer while frames are actually flowing. To
  test this empirically: a host who checks the footer 30s after the
  blip is told the tunnel is broken; the actual system is healthy.
  This is the "the footer lied about the network" failure case
  Option B is designed to prevent against *unverified* reconnect
  events — but by-construction a `kind:"live"` event from
  `createTransport` IS the verified-open signal (the WS open handler
  fired, `live=true`, `outboundSeq` would tick on the next send),
  so the "sticky = truthful" invariant only holds for the
  error-to-error and dialing-to-error transitions, not for the
  error-to-live transition.

Both options **agree** on: the sticky behavior of `error` against
other error events (an N+1-th error-severity dialing does not
change the footer because the footer is already error); the most-
recent-wins behavior of healthy states (a healthy resyncing that
ends in live returns to live); the resyncing-is-overlay invariant
(mergeTransport never produces resyncing; it comes from the replay
path only).

### Falsifiable prediction for the Skeptic — the FOOTER test

The Skeptic needs a footer-visible test, not a unit-internals test.
This is the test the two options differ on, phrased as a single
end-to-end scenario the runner can execute against a fake relay
(`bun test test/transport.test.ts` already shows the fake-relay
fixture pattern):

1. Create a transport against a fake relay.
2. Drive it to live (one connect, await the live event).
3. **Force 10 consecutive error-severity dialing events** by
   killing the relay and stubbing `deps.rearm` to throw, ten
   times. After the 10th error-severity event, the merge
   transitions to `error`. (Both options agree here.)
4. **Restore the relay** and let `rearm` succeed normally. Wait
   for the next successful WS open (the dial loop will attempt
   the next backoff, open, and emit `kind:"live"`, `severity:"live"`).
5. **Observe the footer recorder.** The two options predict:

   - Option A: footer transitions `error → dialing → live` (the
     dialing is the recovery dial, the live is the verified
     re-open). Frames flow on the wire.
   - Option B: footer stays `error` indefinitely. Frames flow on
     the wire (the transport's `send()` returns non-null seq
     values; the relay receives them), but the footer lies. Only
     a user `/rc` (which re-creates the transport) returns the
     footer to live.

The Skeptic runs step 5 by adding a setStatus recorder to the
factory deps and asserting the SEQUENCE of footer values emitted
during the recovery window. The prediction is recorded as
"footer sequence under recovery after N consecutive errors" and
the assertion either matches Option A's prediction (live wins) or
Option B's prediction (error sticks). A third option — error
persists *until the verified live clears it* (kind-first with the
verified-live override) — reduces to Option A's behavior with
principal's stated intent.

The same test, repeated with `N=1` (a single
`relay_unreachable` from the start) is a separate falsifiable
prediction: under both options, a single error-severity event
does NOT enter the error state, because the threshold is
N=10. Skeptic runs this too.

### /rc:off-was-not-live stated-refusal phrasing vs /rc ALREADY_LIVE_COPY asymmetry

Round 0 stated that a `/rc:off` while not live prints **the SAME**
`lifecycle.off` line as `/rc:off` while live — a stated refusal
("Remote tunnel closed.") with no "no-op" qualifier. The
asymmetry with `/rc`'s `ALREADY_LIVE_COPY` ("already connected to
`<serverUrl>`; ignoring this `/rc`") is real and worth naming.

The asymmetry is **not a comprehension hazard** because the two
refusals describe different states and the asymmetry is the
information the user needs in each case:

- `/rc` while live: the user asked to connect; the system is
  already in the target state; the stated refusal MUST name
  `<serverUrl>` (so the user knows which connection the system
  is referring to) and MUST include "ignoring this `/rc`" (so
  the user knows nothing happened and they can keep typing).
  Removing either element re-introduces a comprehension gap:
  no `<serverUrl>` = "which server?"; no "ignoring" = "did it
  maybe re-dial?"

- `/rc:off` while not live: the user asked to close a tunnel;
  there is no tunnel; the system is already in the target state.
  The stated refusal is the SAME sentence a successful
  `/rc:off` prints (`"Remote tunnel closed."`), which doubles as
  the idempotent acknowledgment. From the user's view, this
  reads as: the tunnel is closed, regardless of whether there was
  one to close. The lesson is correct (the tunnel is closed),
  the action is correct (nothing happened), and the system did
  what was asked. There is no "ignoring this `/rc:off`" because
  the user did not ask to *change* the state — they asked to
  *ensure* the state, and the system is honestly reporting the
  state.

The hazard this seat does flag: **`lifecycle.off` while
already-off should NOT be visually distinguishable from
`lifecycle.off` after a real teardown by the line itself** — the
distinguishing information (whether there was a real DELETE on
the wire) lives in the journal/seam between stdout and the
network, not in the user-facing sentence. If `owner`'s acceptance
test pins a DELETE call for a `/rc:off` while already-off (it
should not — the second `/rc:off` is a clean no-op, per owner's
T5), the test would be wrong and the seat would flag it.

### Refinements to round-0 falsifiable predictions

Keep the round-0 prediction 9 (resyncing line contains none of
error/failed/unreachable/expired) as a falsifiable gate — owner +
principal agree resyncing is replay-only overlay, so the merge
never produces a `resyncing` footer sentence and the replay path
can only render the live resyncing line from the EV-8 row set in
the generic englishFor resolver (per owner O1). New round-1
predictions:

13. **The recovery-from-N-errors test described above**
    distinguishes Option A from Option B on the FOOTER sequence
    during the post-error-to-live transition. The two options
    produce visibly different footer recorder output (Option A:
    `error → dialing → live`; Option B: `error → error → …
    → error → error` until the user acts).
14. The `/rc:off`-while-already-off line byte-equals the
    `/rc:off`-after-live line. Both are the `lifecycle.off`
    sentence; neither contains "no-op" or "already" or "ignoring".
    Skeptic asserts string-equality on the two outputs against
    the same stdout recorder. (This guards against a future
    drift where `/rc:off` while off becomes its own sentence
    that subtly diverges.)
15. The `/rc:off` while already-off path produces **zero**
    `deleteTunnel` calls (the second `/rc:off` is the clean
    no-op owner's T5 already pins — keep T5; restate it as a
    falsifiable prediction because it is the most-tested
    proxy for "the second invocation shares the same in-flight
    promise" from principal's teardown-hazard design).
16. The error-persists-while-recovered case under Option B
    produces a footer that disagrees with the transport's
    `send()` return value: a host who reads the footer (`error`)
    and then checks `send()` (non-null seq, frame on the wire)
    observes the system is healthy while the footer says it
    isn't. This is the falsifiable signature of the option; the
    Skeptic can write a test that runs `transport.send(frame)`
    on a recovered transport after N consecutive errors and
    asserts the seq is non-null, then asserts the footer
    recorder still reads `error` (under Option B) or has
    transitioned to `live` (under Option A).

### Preferences, ranked last

- Whether the recovery footer sequence is printed as `error →
  dialing → live` (Option A) or held at `error` until `/rc`
  (Option B) is a question of product shape, not visual taste.
  Both are legible if the copy vocabulary is honest; both have
  real comprehension consequences I have named above. This seat
  does not have a preference between A and B; the seat flags
  the consequence and escalates.
- Sentence-case for `/rc:off`-while-already-off (`"Remote tunnel
  closed."`) is consistent with the rest of the vocabulary.
- The footer recorder as the falsifiable surface (rather than
  the `mergeTransport` internal state) is the right level for
  a Skeptic test because it tests what the user actually sees.

### Escalations

- **E3 (NEW).** Owner/principal now disagree specifically on
  whether a `kind:"live"` event clears a sticky `error` (Option
  A: yes; Option B: no). This is now an EV-8 policy choice
  that depends on a product judgment: does the design discipline
  treat the verified-WS-open signal as the recovery moment, or
  does it require the user to acknowledge the error? The seat
  flags this to `product-owner` as the legitimate scope. The
  recorded preference from `vault/raw/2026-08-31-po-ev2-ruling.md`
  Item 4 was "highest-severity-wins" (error > live > resyncing)
  with a non-binding recorded preference; that ruling deferred
  to EV-8. The runner packet's owner + principal positions are
  EV-8's first substantive look at the question; a product-owner
  ruling here closes the loop.

## Sources

- `vault/raw/2026-08-31-po-ev2-ruling.md` Item 4 (deferred to
  EV-8 with recorded non-binding preference for highest-severity-
  wins; the live/error/dialing boundary is exactly where the
  product-owner handed off).
- `src/transport.ts` lines 110-120 (closed kind vocabulary:
  `dialing | live`; severity is a derived tag), lines 240-280
  (the dial loop where `live` is emitted after the WS open
  handler resolves true; `send()` only returns non-null after
  `live=true`).
- `src/tunnel.ts` lines 109-112 (`ALREADY_LIVE_COPY`), 122-140
  (closed reason copy vocabulary with English default lookup).
- `src/login.ts` (single-source copy vocabulary; the
  `loginEnglishFor`/`englishFor` pattern that the new EV-8 row
  set must extend).
- `test/transport.test.ts` (fake-relay pattern the Skeptic
  needs to construct the round-1 footer-sequence test).
- `council/cards/EV-8.md` (round-0 owner + principal
  positions; round-0 design position archived alongside this).
