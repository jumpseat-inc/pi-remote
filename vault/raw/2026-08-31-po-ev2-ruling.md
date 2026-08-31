# EV-2 Open-Judgment Rulings — product-owner seat

Date: 2026-08-31
Card: EV-2 — Control-plane tunnel REST client
Epic: EPIC-1
State at ruling: Deliberating (architecture settled; four open-judgment items routed from the council-runner's step-6 escalation)

The wiki is empty (`vault/wiki/index.md` is a stub catalog with no module
pages). Authority is the spec itself (`docs/PI-SPEC.md`), `AGENTS.md`
(which names the spec as source of truth), the EV-2 deliberation record
(`council/cards/EV-2.md`), and the EV-1/EV-4 ruling precedents on the
mechanism-vs-user-value test and on closed-red prose-sync governance.
No recorded human decision in `council/board.md` bears on these four
questions.

The operative pair for this ruling is mechanism and user value,
adapted to pi-remote: does the wire/contract hold, and does a host
user or CI operator get served by the choice? The copy-judgment
items (#1, #2, #3) sit on the user-value side; the policy item
(#4) sits on the mechanism side. None is a portfolio change — all
four are within EV-2's acceptance scope, so I rule in seat.

---

## Item 1 — 403 remedy line + the card-acceptance reading of "rejected credential"

### Ruling

**Reading B: the 403 user-line names `/rc:login` AND adds a distinct,
non-identical second clause naming the control-plane admin / scope-grant
remedy.** Both clauses appear in the same reason row (`enrollment_rejected`),
the 401 line remains distinct from the 403 line, and neither line
mentions an "admin" until the user has already tried the in-extension
fix first. Concretely (illustrative, owner copy-freedom retained):

- 401 (`enrollment_expired`): "enrollment expired or revoked — run `/rc:login`"
- 403 (`enrollment_rejected`): "this host lacks the `pi-remote:host` scope — run `/rc:login` to re-consent; if the scope is missing after that, ask your control-plane admin to grant it"

The 403 line is **not** identical to the 401 line. The control-plane is
still out of repo scope (§10); the "ask your control-plane admin" clause
is a *remedy reference*, not a control-plane implementation, and is
acceptable because it names a person, not a contract.

The card acceptance — *"An expired or rejected enrollment credential
produces an error that names `/rc:login` as the remedy, not a raw HTTP
trace"* — is read to **include 403** as a rejected credential, on three
grounds:

1. RFC 6750 §3 categorizes 401 and 403 as distinct status classes:
   401 = invalid/revoked/expired token; 403 = valid-but-insufficient-scope.
   Both are "rejected credentials" in plain English — the rejection is
   real in both cases, and the user cannot proceed without action.
2. Collapsing 403 to the 401 copy silently hides the case where
   `/rc:login` cannot help (the host *has* a credential, but it lacks
   scope). Telling such a user "run /rc:login" is misleading — it
   promises a fix the extension cannot deliver.
3. The card acceptance text "names `/rc:login` as the remedy, not a raw
   HTTP trace" constrains the *form* of the message (named remedy, no
   trace), not the *number* of distinct rows. A 403 row that names
   `/rc:login` plus a scope remedy is consistent with the acceptance on
   its face; a 403 row that silently reuses the 401 copy is not, because
   the *named* remedy is wrong.

### Reasoning

The seat is choosing user value over §10 scope purity. §10 keeps the
control-plane implementation out of repo scope, but the user-facing
copy is in EV-2's scope (the card explicitly names it: "An expired or
rejected enrollment credential produces an error that names `/rc:login`
as the remedy, not a raw HTTP trace"). Principal's Reading A argues
"`§10` is dispositive — only client-reachable remedies belong." That
is correct on implementation, wrong on copy. The "ask the admin"
clause is not a control-plane implementation; it is a user instruction
pointing at a person the user can talk to. Owner and designer's
Reading B closes the Gulf of Evaluation correctly: a 403 the user
cannot fix from the extension should not look identical to a 401 they
can. The fix-the-extension-first ordering ("run /rc:login ... if that
doesn't help, ask the admin") matches the actual repair path and
matches the designer's reason-code principle that "the same phrase
across footer/+/rc output/journal" is what makes the system legible.

Mechanism check: the reason→copy vocabulary is a closed set; adding
one row for 403 does not break any wire contract. The 403 row is
distinguished by `kind === "forbidden"` (or whatever the final
discriminator name), not by HTTP status — same row shape as 401.
PI-SPEC §7.2 binds the *enrollment credential* presentation; nothing
in §7.2 says "401 and 403 share a user-line."

User-value check: a host user hitting 403 deserves to know *both*
what to try first and what to do when the first try fails. Reading A
silently sends them on the second loop. Reading B sends them on the
first loop and gives them an escalation path on the second. The
Gulf of Evaluation is closed for the failure mode the spec actually
cares about ("rejected credentials must name a remedy"), and the
remedy named is the *real* remedy.

Reversibility check: trivial — change the reason→message map row.
The discriminator shape is unaffected. If a future card decides the
admin clause is wrong, the row edits back to "/rc:login only."

### Sources

- `docs/PI-SPEC.md` §7.2 (enrollment credential presentation),
  §8 ("`/rc` … if enrolled but the access token is expired, perform
  one silent refresh; if there is no refresh token or the refresh
  fails, output the same `/rc:login` remedy" — establishes the
  `/rc:login` remedy pattern at the command-output level), §10
  (control plane implementation out of scope; user-facing copy in
  scope by acceptance).
- `council/cards/EV-2.md` acceptance — "An expired or rejected
  enrollment credential produces an error that names `/rc:login` as
  the remedy, not a raw HTTP trace."
- RFC 6750 §3 — 401 = invalid/revoked/expired; 403 = valid-but-
  insufficient-scope. (Skeptic-verified via MCP context7 in step 4.)
- EV-2 round-2 convergence: 401 and 403 are distinct `TunnelError`
  kinds; the open question is the *copy* of the 403 row, not its
  *existence*.
- Designer's reason-code vocabulary principle (EV-2 round 1,
  job-12.3): each reason → exactly one user-string + one next
  command; same phrase across footer + `/rc` + journal.

### Options rejected

- **Reading A — 403 names /rc:login only:** silently hides the case
  where `/rc:login` cannot help (scope is missing, not credential).
  Closes the Gulf of Evaluation incorrectly for a failure mode the
  spec cares about. §10 is dispositive for implementation, not for
  copy; the "ask the admin" clause is a user instruction, not a
  control-plane contract.
- **403 reuses the 401 string verbatim:** violates the round-2
  convergence that 401 and 403 are distinct kinds, and violates the
  designer's reason-code principle (same phrase across surfaces
  only when the *remedy* is the same — here, the remedies diverge).

### Reversibility

Trivial. The 403 row in the reason→message map is a single edit.
The `kind` discriminator is unaffected; the wire contract is
unaffected; no other row changes. If the steward later wants to
strip the admin clause, the row reverts to "/rc:login only" in one
edit and no other code moves.

---

## Item 2 — i18n / copy-language seam

### Ruling

**Key-based reason→message table now, with English values populated.**
The export shape the runner packet names (reason → `{footerState,
userLine, severity}`) is the right shape; the `userLine` value is a
**stable message key** (`"tunnel.error.unauthenticated"`,
`"tunnel.error.forbidden"`, `"tunnel.error.unreachable"`,
`"tunnel.error.already_live"`, etc.), and tunnel.ts ships an
**English default lookup** that resolves each key to its English
user-line. The English default lives in tunnel.ts (not index.ts) so
the table is unit-testable without rendering. Future localization
(en→id, etc.) is a separate card that adds a second lookup
(`messages.en.ts`, `messages.id.ts`) and a resolver — not part of
EV-2.

### Reasoning

Two facts decide it. (1) The settled export shape is reason →
`{footerState, userLine, severity}`. If `userLine` is a literal
English string today, future localization is a refactor on every
emission site — every caller has to learn about a new lookup. If
`userLine` is a stable key, future localization is a single new
file plus a resolver hook. The seat chooses the design that makes
the follow-up card mechanical, not the design that makes EV-2
slightly shorter. (2) PI-SPEC §8 already commits to a closed set of
states; the spec's English register is what the §8 prose uses;
mirroring that register in the default lookup means the user-facing
copy and the spec language stay aligned until a localization card
arrives. No Bahasa requirement exists today, so no Bahasa rows
ship now.

The user's today-value is unaffected — the English lines render
identically to literal English strings. The future-value is the
localization card being cheap, which is exactly what makes a
public-goods codebase (PI-SPEC: this is open source, no Google
Maps, no paid services) survive its first non-English user
without a rewrite. The key seam is the cheaper-to-reverse choice
*and* the more durable choice — both lenses agree.

Mechanism check: the table shape is the same shape the runner
packet names. Only the value-type of `userLine` changes (string →
key+lookup). The wire contract is unaffected.

User-value check: today's user sees English copy. Tomorrow's user
sees whatever locale they prefer, with no change to any other code
path. Both are served.

### Sources

- `council/cards/EV-2.md` round-2 convergence: "Copy/reason
  vocabulary lives in tunnel.ts (strings co-located so they're
  unit-testable without index.ts)."
- `council/cards/EV-2.md` step-3 convergence list: "Copy language =
  English (all three; PI-SPEC/card/README English; no Bahasa
  requirement; designer withdrew its ungrounded Bahasa)."
- `docs/PI-SPEC.md` §8 (the seven-state footer prose is in English,
  the canonical register the default lookup must mirror).
- EV-1 Q2 ruling (precedent for closed vocabulary sets: states are
  enumerated exactly, no escape hatches).

### Options rejected

- **Literal English strings now:** makes the localization card a
  refactor across every emission site. Cheaper to ship in EV-2 by
  ~1 hour; more expensive to reverse when a non-English user
  arrives.
- **Ship Bahasa Indonesia strings now:** no Bahasa requirement
  exists, no Bahasa speaker has asked, designer's Bahasa was
  self-flagged as non-native and was withdrawn in round 2.
  Shipping unverified non-English copy is a user-value regression
  in both directions.
- **Defer the key shape entirely (just strings, no seam):** same
  as "literal English strings now," with no future-localization
  hook at all.

### Reversibility

Trivial. The `userLine` field type changes from `string` to a
key type (`type TunnelMessageKey = "tunnel.error.unauthenticated"
| …`) and the lookup is a small `messages` map. If a future card
prefers literal strings, the lookup is bypassed at the call site.
No wire contract change, no emission-site change beyond the
key-vs-string typing.

---

## Item 3 — `already_live` ack density on a redundant `/rc` while connected

### Ruling

**Sentence line, not single-character ack.** The exact form is the
designer's wording from the EV-2 round-1 vocabulary: a stated
refusal, not a glyph. Specifically:

> "already connected to `<serverUrl>`; ignoring this `/rc`"

The line is rendered **once** by the `/rc` command output, and the
footer stays at `live` (no transition, no severity tag, no journal
entry — this is a successful no-op, not an error). The `<serverUrl>`
is the configured control-plane server URL (the same URL the user's
`/rc:login` was aimed at), not the tunnel URL (which is a one-time
secret that must never be displayed).

### Reasoning

Two facts decide it. (1) The Gulf of Evaluation. The host user
typed `/rc`, saw what looked like nothing happen (or, worse, a
single dot that does not parse as "your command was received"), and
will retry. A stated refusal — "already connected to X; ignoring
this /rc" — closes the loop in the user's own language: yes, the
command was received; yes, the system is in the state you wanted;
no, you do not need to do anything. (2) Idempotency-as-refusal is
the principle designer named in round 1: "return existing + emit a
`notified` / `already_live` line, not silent success." A glyph
ack (`.`, `✓`) is closer to silent success than to stated refusal
— it is the operator's signal that something happened, but the
user cannot read it as text. The command palette is text; the
output should be text.

Mechanism check: zero HTTP, one line of stdout, one setStatus call
that is a no-op (state already `live`). The tunnel token never
appears in the line. The line is unit-testable as a pure string
format.

User-value check: the host user knows what happened and why. The
remote observer (if any) sees the same footer they already saw.
Nothing in this ruling changes the wire format.

### Sources

- `council/cards/EV-2.md` round-2 convergence on idempotency:
  "Idempotency guard lives in EV-8 as `activeTunnel: {tunnelId,
  url, expiresAt} | null`, checked BEFORE createTunnel; a second
  `/rc` while connected emits `already_live` line, zero POSTs."
- `council/cards/EV-2.md` round-1 designer principle:
  "Idempotency as a stated refusal (return existing + emit
  `notified` / `already_live` line, not silent success)."
- `docs/PI-SPEC.md` §7.2 (tunnel token is one-time, must never
  appear in logs/copy/persisted settings).
- EV-1 Q2 precedent: closed vocabulary sets are named with the
  user-facing string, not a glyph.

### Options rejected

- **Single-character ack (`.`, `✓`):** fails the Gulf of Evaluation
  for a text-based command palette. Reads as "command received,"
  not as "your command was acknowledged and the system is already
  in the target state."
- **No output at all on idempotent /rc:** same failure mode,
  louder — the user cannot tell `/rc` ran.
- **Verbose multi-line output (status + counter + last dial time):**
  out of scope for an idempotent no-op. The /rc command surface
  is text-based and the line above already gives the user what
  they need to know.

### Reversibility

Trivial. The line is a single string in the same reason→message
table as item 2; edit the string, the line changes. No code path
changes; no test changes beyond the string-match assertion.

---

## Item 4 — Footer-merge policy (severity tag from tunnel.ts vs the rule that consumes it)

### Ruling

**Deferred to EV-8's deliberation, with a recorded preference so the
EV-8 runner does not start from zero.** Tunnel.ts emits each result
tagged with a `severity` field as the runner packet names; **the
merge rule itself is EV-8's policy** because EV-8 owns the
`setStatus` call and the multi-writer merge across transport and
tunnel. EV-2's obligation is just to ship the `severity` tag.

Recorded preference for EV-8 (non-binding, EV-8 may overturn): the
**most-recent-wins** policy for the live→resyncing→live cycle
(transport owns this; resync is a healthy phase, and overwriting
"live" with "resyncing" is the *correct* temporal read for an
observer correlating status with behavior — see EV-1 Q2 ruling).
The **highest-severity-wins** policy for the live/error/dialing
transitions (an error must not be silently overwritten by a
follow-on `live` from a reconnect that hasn't yet succeeded —
errors need to be seen and acknowledged). If EV-8 wants a single
uniform rule, the runner packet's principal+designer convergence
on "highest severity wins" (error > live > resyncing) is the
principled uniform pick; but the more nuanced policy above
matches §8's seven-state semantics better and is cheaper to
reverse than either pure rule.

### Reasoning

Three facts decide it. (1) The seat principle is that EV-8 owns
the footer FSM, full stop. §8 names EV-8 as the command surface
and the merge policy is a property of that surface. EV-2 emitting
the right tag is the right EV-2 obligation; EV-2 deciding the
merge rule is a seam violation. (2) The runner packet itself says
"consolidator and designer agree this is EV-8's policy, not
tunnel.ts's." All three seats agree on the seam; the rule is the
only thing open, and it belongs to EV-8. (3) The rule is not
test-settling at EV-2's gate — it can only be observed once
transport.ts and tunnel.ts are both writing to the footer, which
is EV-8's integration moment. A binding rule from this seat would
preempt EV-8's deliberation with evidence EV-8 is better positioned
to weigh.

The recorded preference is non-binding because EV-8's runner is
the seat that sees transport.ts and tunnel.ts together and can
make the call against the actual integration. If EV-8 decides the
runner packet's uniform "highest-severity-wins" rule is the right
ship, EV-2's `severity` field is already shaped to support that
policy. If EV-8 decides the nuanced split is the right ship, the
`severity` field is also shaped to support that. Either direction
is mechanical from EV-2's side; the seat defers rather than
binding.

### Sources

- `docs/PI-SPEC.md` §8 (EV-8 owns the footer surface; EV-2's role
  is named in the round-2 convergence as "vocabulary map in
  tunnel.ts; render call in EV-8").
- `council/cards/EV-2.md` round-2 convergence: "setStatus CALL
  lives in EV-8; the reason→copy vocabulary map lives in tunnel.ts
  (pure data, unit-testable without index.ts)."
- `council/cards/EV-8.md` (Ready; owns the footer FSM wiring).
- EV-1 Q2 ruling (footer states are *per-phase*, not transport-
  level; the same discipline says merge rules are per-transition,
  not uniform across the lifecycle).
- EV-4 Q1 ruling precedent (seam-rule deference: the seat that
  integrates two surfaces owns the cross-surface policy).

### Options rejected

- **Bind EV-8 to a uniform "highest-severity-wins" rule from this
  seat:** preemptive on EV-8's evidence. EV-8's runner can run
  transport.ts and tunnel.ts together and make the call against
  real integration; this seat cannot. A binding rule from here
  would also be cheaper-to-reverse than a binding rule from
  EV-8 only because EV-8 is downstream — so binding it now would
  *increase* EV-8's reversal cost, not decrease it.
- **Bind EV-8 to a uniform "most-recent-wins" rule from this seat:**
  same problem, plus the active failure: a transport reconnect
  that has not yet succeeded writes `live` and overwrites the
  honest `error`, which is exactly the failure mode §8's seven-
  state set exists to prevent.
- **Defer with no recorded preference:** EV-8's runner starts from
  zero. The runner packet's principal+designer already converged
  on a default ("highest-severity-wins"); the seat defers but
  records where it would have ruled, so EV-8 has a falsifiable
  starting point rather than a blank page.

### Reversibility

Trivial. EV-8's runner can adopt either uniform rule or the
nuanced split without any change to tunnel.ts — the `severity`
tag is shipped regardless. A future EV-8 ruling that picks a
different policy is one edit in EV-8's merge function. If a
future card decides this seat *should* have ruled, the ruling
above is recorded evidence for the steward to overturn, not a
silent precedent.

---

## Closing note for the runner

EV-2 may proceed to step 7 with these four rulings recorded.

- **Item 1** clears the 403 copy. O3 (the Skeptic's "403 copy"
  gate) becomes runnable against a `tunnel.error.forbidden` row
  whose `userLine` key resolves to a string that names
  `/rc:login` AND a distinct non-identical "ask your control-
  plane admin" clause. The 401 and 403 rows are distinct kinds,
  distinct keys, distinct strings.
- **Item 2** fixes the export shape: `userLine` is a stable
  message key, with an English default lookup shipped in
  tunnel.ts. The runner packet's stated reason→`{footerState,
  userLine, severity}` shape is preserved; only the value-type
  of `userLine` becomes a key, not a string.
- **Item 3** settles the `already_live` line to the sentence form,
  with `<serverUrl>` rendered (not the tunnel URL). The line is
  emitted once on the redundant `/rc`; no footer transition; no
  journal entry; tunnel URL never appears.
- **Item 4** defers the merge rule to EV-8 with a non-binding
  recorded preference. EV-2 ships the `severity` tag and does
  not own the merge.

Open post-change gates (step 9): O2 tokenExpiry absolute
timestamp; O3 403 copy per Item 1; O6 refresh-rotation persistence
seam (return-then-persist vs callback — principal's earlier
seam reading is the default: tunnel.ts returns rotated tokens,
EV-8 persists via EV-7-owned keys; settle at step 9 against the
owner impl); O7 discovery cache not module-level state in
tunnel.ts.

The O1 closed-red §3 line-74 prose-sync amendment rides the
EV-2 PR per the EV-4 Q1 governance precedent — facilitator-
authored, evidence-cited, no separate ruling needed.
