# PO Ruling — FLLWUP-24: terminal outcome at device-code-window expiry, and the §3.2/§3.5 citation errata

Ruling seat: product-owner. Date: 2026-09-02 (latest date evidenced in the run's records).
Trigger: Skeptic O1 (blocking) and O2 (non-blocking) on `fix/fllwup-24-slowdown-retry` @ `1013bc2` (PR #31).

## Ruling 1 — Cause-distinguished expiry (neither (a) nor (b) as posed)

The terminal outcome at device-code-window expiry is **distinguished by whether the
token endpoint was ever reached during the window**:

- If **no token poll in the window ever received an HTTP response** (every attempt
  failed at the connection level), the terminal outcome is **`unreachable`**, rendered
  with the existing verbatim row: `"Cannot reach `<serverUrl>` — check your network
  and try again."`
- If **at least one poll received an HTTP response** (any status, including
  `authorization_pending`/`slow_down`/4xx/5xx), the terminal outcome remains
  **`timedOut`**, rendered with the existing verbatim row: `"Sign-in timed out — no
  credentials were saved. Run /rc:login to try again."`

Both strings and both keys (`login.failure.unreachable`, `login.failure.timedOut`)
are unchanged. No new vocabulary, no new keys, no localization edits. Mechanism: a
loop-scoped flag (e.g. `sawResponse`) set on any received HTTP response; the expiry
path dispatches on it. The Skeptic's all-throw probe expectation becomes
`{"kind":"failure","reason":"unreachable"}` with sleeps `[2000,5000,2000,5000]`.

Why not (a) unconditionally: "Cannot reach" after a window in which the server
answered every poll would be false copy. Why not (b): "Sign-in timed out" after a
window in which the client never once reached the server fails the Copy Honesty
Doctrine — it states the clock, not the cause, and sends the user with a dead
network away to "try again" without naming the only remedy that can change the
outcome (check the network). The cause-naming copy is the user-serving choice, and
it is exactly what the acceptance as written already described.

### Acceptance amendment (mine to make — precedented by FLLWUP-5 J-ACCEPT)

Clause 1 is replaced with:

> On a connection-level failure (fetch throw), the driver waits 5 seconds and
> re-polls, within the device-code window. At device-code-window expiry the
> terminal outcome is cause-distinguished: if no token poll in the window ever
> received an HTTP response, the outcome is `unreachable` with its existing
> verbatim copy; if at least one poll received a response, the outcome is
> `timedOut` with its existing copy. No copy string changes.

All other clauses stand. The **goal text is immutable** once In Progress and is
**not** the defect: its directive (retry after 5s on connection-level failure
instead of first-throw terminal) is fully preserved under this ruling — only its
§-citation is wrong (Ruling 2).

## Ruling 2 — Citation errata: §3.2 → §3.5, riding the PR

The Skeptic's finding is accepted as fact (closed-red on the RFC text). The
connection-failure slowdown directive is **RFC 8628 §3.5** ("clients MUST
unilaterally reduce their polling frequency before retrying"; exponential backoff
RECOMMENDED); §3.2 supplies the 5-second default minimum poll *interval*, not a
connection-failure directive. The shipped flat 5s pause is a **client-design
choice within §3.5's mandate**, composes with the configured interval (loop sleep
+ 5s), and is not an RFC-specified value.

- **Code comment, owner's plan, and the PI-SPEC §7.2 clause added by this PR**:
  corrected on the implementing PR, evidence-cited. This surface is prose this
  card's own PR introduced, so Spec Correction Governance's ownership leg puts the
  fix squarely on the PR — no separate card. Suggested replacement text for the
  clause: "On a connection-level failure (fetch throw), the driver waits 5 seconds
  and re-polls, per RFC 8628 §3.5's requirement that a client encountering
  connection problems unilaterally reduce its polling frequency before retrying;
  the 5-second figure is §3.2's default minimum poll interval, adopted as the
  client's fixed slowdown step."
- **Card title/goal citation**: the goal is immutable once In Progress and
  rewriting it is not mine. Both faces stand **as written, with an errata note on
  the card face**: "Title/goal cite RFC 8628 §3.2 for the connection-failure
  slowdown; the directive is §3.5 and the 5s figure is §3.2's default interval —
  see vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md. The goal's normative
  content is unaffected."

## Ruling 3 — No escalation

- The goal is not itself the defect: its directive stands under this ruling; only
  its citation is wrong, handled as errata above.
- No portfolio change, no residual acceptance, no security-model touch, no
  recorded human decision reversed (FLLWUP-22's "obey RFC 8628" human ruling is
  honored — the client moves toward the RFC).

## Fixtures required

1. All-connection-failures across the window → terminal `unreachable`, silent
   retries (no unreachable print mid-window), observed sleep gaps `interval+5s`.
2. Mixed window (≥1 received response, then expiry) → terminal `timedOut`.
3. Retry path (connection failure → 5s → success) — as already planned.
4. FLLWUP-22's 400-window dispatch rows untouched and still pinned.

## Grounding

- `vault/wiki/Copy Honesty Doctrine.md` — state what happened; name only remedies a
  real actor can perform; Gulf of Evaluation.
- `vault/wiki/Stable Keys.md` + `vault/wiki/Copy Honesty Doctrine.md` (FLLWUP-4
  OJ1 rule) — verbatim copy changes only by ruling; here no string changes, both
  existing rows are reused as-is.
- `vault/wiki/Closed Vocabulary Discipline.md` — both outcomes already exist in the
  closed 13-row set; this is dispatch policy, not vocabulary change.
- `council/cards/FLLWUP-22.md` — Phase 1 human ruling ("obey RFC 8628") and the
  owner's record: "client-clock `timedOut` distinct from server-sent
  `expired_token`"; `timedOut` = window expiry without completion.
- `vault/wiki/Spec Correction Governance.md` (EV-12 routing) — citation fix rides
  the implementing PR; goal immutability is this seat's own fold-in rule.
- `vault/wiki/Cheapest To Reverse.md` — tiebreaker not needed; the ruling is
  decided on user value and matches the acceptance as written.
