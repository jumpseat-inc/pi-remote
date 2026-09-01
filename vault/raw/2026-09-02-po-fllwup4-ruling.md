# FLLWUP-4 Open-Judgment Rulings — product-owner seat

Date: 2026-09-02
Card: FLLWUP-4 — EV-2 localization seam: second (en→id) message lookup and resolver
Epic: EPIC-1
State at ruling: Deliberating (architecture settled; five open-judgment items
OJ1–OJ5 routed from the council-runner's step-6 escalation; all skeptic
objections closed, two closed-red record corrections absorbed).

The wiki is an empty stub (`vault/wiki/index.md` has no module pages), so —
as in the EV-2 ruling — authority is `docs/PI-SPEC.md`, the recorded
rulings (`vault/raw/2026-08-31-po-ev2-ruling.md` Items 1–3), the FLLWUP-3 /
FLLWUP-14 cards, and the FLLWUP-4 deliberation record itself. No recorded
human decision in `council/board.md` bears on these five items. The
operative pair is mechanism and user value: does the resolver actually
hold, and does a host user at a terminal get served by the choice. None of
the five items changes the portfolio — no card is declined, no residual is
permanently accepted, no human decision is touched — so I rule in seat on
all five; nothing defers to steward.

## OJ1 — ALREADY_LIVE_COPY keying: follow-up card

Ruled for position (A). EV-2 Item 3 ruled this exact string verbatim —
"already connected to `<serverUrl>`; ignoring this `/rc`" — and fixed its
semantics (successful no-op, not an error, no footer transition, tunnel URL
never shown). Keying it introduces a net-new key and a re-point at
index.ts:462 that reddens the green test/index.test.ts:288 — none of which
FLLWUP-4's goal requires: the goal is a second lookup plus a resolver
"alongside tunnel.ts's existing key-based reason-to-message table," and
ALREADY_LIVE_COPY is not in that table. Work that needs a goal change to
justify is by definition not a fold-in. The designer's refusal-moment
argument is genuine user value and is exactly why the follow-up should be
filed promptly — proposed key `tunnel.alreadyLive` (not `tunnel.error.*`,
per Item 3's not-an-error ruling), id row preserving `/rc` byte-identical,
the semicolon, and the `<serverUrl>` placeholder — but urgency does not
convert out-of-goal work into in-goal work.

## OJ2 — Id-table coverage: 22 keys

Ruled for 22 (the mandated 16 + the 6 `rc.*`/`shutdown.closed`/
`rc:login.refusal` command-output rows). The card's own surface text —
"every tunnel.ts-sourced command-output line and footer-adjacent message" —
names these rows: they are the command-output lines index.ts actually
prints, and shipping `status.*` in Indonesian while the adjacent `/rc`
refusals stay English is a mixed-language seam at precisely the surface the
goal claims. 16 satisfies the letter of the acceptance bullet but not the
goal's surface sentence. 50 is rejected: the 28 login-flow rows are a
translation project re-introducing the unverified non-native Bahasa risk
EV-2 Item 2 explicitly declined, and no new evidence has arrived since that
decline. The skeptic-verified 22-key count is exact (closed-green).
Partial coverage is announced in the id-table module per FLLWUP-14's
honest-boundaries discipline (settled as S8 regardless of this ruling), and
that announcement must also name the keyless English `inputPrompt` literal
at index.ts:542 as sitting outside the keyed surface — the skeptic's
closed-red record correction stands; "complete at 50 keys" was never true.

## OJ3 — Locale source: env-over-setting

Ruled for position (B): `PI_REMOTE_LOCALE` env → `piRemote.locale` setting
→ fail-open `"en"`, with anything unrecognized normalized to `"en"`. The
owner's fact is true — zero `process.env` consumption in src/ and index.ts
— but it does not reach `pi.env`, and the actual entry-point precedent is
index.ts:657-658: `pi.env("PI_REMOTE_SERVER_URL") ?? pi.getSetting(...)`,
where env already wins. A second configuration knob that reverses that
order gives the operator two mental models for one extension; consistency
of the configuration surface is user value, and the skeptic verified
(closed-green) that both factual halves hold, leaving a pure judgment that
the existing precedent settles. Cost is one line of fallback logic;
reversibility is trivial.

## OJ4 — tunnel.error.urlExpired remedy: /rc

Pinned: the remedy is `/rc`, and both the id row and the English row name
it. Mechanism: re-dial = `createTunnel` = `POST /tunnels`, which is exactly
what `/rc` performs for an enrolled host (PI-SPEC §8 `/rc` row: "Otherwise
POST /tunnels, dial the signed URL"). An expired tunnel URL is a
dial-target problem, not an enrollment-credential problem; `/rc:login`
re-runs OAuth enrollment, cannot mint a fresh tunnel URL any faster than
`/rc`, and sends the user through a consent flow they do not need — EV-2
Item 1 binds remedy clauses to name the *real* next step, and here the real
next step is `/rc`. Because sister rows name a command and this one names
none, the English row gains the named command in the same pass (owner
retains copy-freedom on wording, e.g. "The tunnel URL expired — run /rc to
re-dial") so the two locales do not diverge in meaning. Note the
distinction from OJ1: this English row was never ruled verbatim, so
amending it overturns nothing.

## OJ5 — <serverUrl> print-side substitution: in-card

Ruled for position (A), scoped strictly to the two re-pointed sites
(index.ts:129 errorSentence, index.ts:443 doTeardown), each render()ing the
resolved line with `{ serverUrl }`. The card's goal is copy that "can
resolve in a language other than English"; a resolved line that still
prints the literal `<serverUrl>` marker is not honestly resolved, and
shipping id rows that inherit the defect entrenches it in two locales
instead of one — the designer's point that a catalog entry for these
strings must come with substitution or the card entrenches the bug is
decisive on user value. Skeptic facts: no test pins the :129/:443 outputs,
so substitution reds nothing; the converged two-re-point design is
unaffected either way. The principal's "render-pipeline bug" framing is
accurate, but the cheapest honest boundary is to fix it where this card
already touches; a follow-up card for a two-site render fix the current
card is already editing is process for its own sake. index.ts:462 stays
parked — the OJ1 follow-up owns that site and its pinned test.

## General rule for the remaining Backlog (FLLWUP-11..16)

Three standing rules. (1) Copy or constants ruled verbatim by a prior
ruling change only through their own card and ruling — never folded into an
adjacent card, however small the edit (OJ1's pattern). (2) Where any card
ships knowingly partial coverage of a surface, the partiality is announced
at the surface itself — module comment, README, or spec row — not only in
the card record; FLLWUP-14's honest-boundaries discipline is generalized
from docs to code. (3) New configuration follows the existing entry-point
precedence (env overrides setting) rather than inventing per-feature source
orders; new key names are free at authoring time but become stable,
non-relitigable contract from merge — the FLLWUP-3 stable-dispatch-key rule
applies from merge onward, not before.

## Reversibility

All five rulings are cheap to reverse: OJ1 defers rather than acts; OJ2's
22 rows are a superset of the mandated 16, so narrowing costs nothing and
widening later is additive; OJ3 is one fallback clause; OJ4 is two string
edits; OJ5 is two render-call sites with no pinning tests. The only
hard-to-reverse artifact would have been shipping 50 unverified Bahasa rows
— which is precisely what this ruling declines.
