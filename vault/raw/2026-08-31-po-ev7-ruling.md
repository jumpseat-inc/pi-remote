---
title: "EV-7 Open-Judgment Rulings — product-owner seat"
date: 2026-08-31
seat: product-owner
epic: EPIC-1
card: EV-7 (Deliberating)
files-grounded:
  - docs/PI-SPEC.md §7.2 (OAuth2 enrollment; user-only readability),
    §7.5 row-1 (tenancy by token claims), §8 (command surface;
    seven footer states), §10 (control plane out of scope; this
    repo is pi-side only)
  - council/cards/EV-7.md (full deliberation record; all three
    seats' convergence; Skeptic step-4 results; consolidator
    step-5 synthesis)
  - council/cards/EV-8.md (downstream; owns command surface;
    footer FSM; consumes login.ts exports)
  - council/board.md (no recorded human decision on J1/J2/J3)
  - src/tunnel.ts:56 (the `Map<string, Promise<string>>` cache
    Skeptic flagged as B1 — out of scope for this ruling;
    facilitator/spec owns the spec-draft fix)
  - vault/raw/2026-08-31-po-ev2-ruling.md (Items 1, 2, 3 — the
    conditional-line, key-seam, and stated-refusal precedents
    that bear on J1/J2)
  - vault/raw/2026-08-31-po-ev1-ruling.md (Q3 — prose-sync
    governance precedent that bears on the J3 acceptance reading)
  - vault/raw/2026-08-31-po-ev4-ruling.md (Q1 — the governance
    precedent for in-card prose amendments when forced by
    external reality)
  - docs/PI-SPEC.md §5.4 (loud-once-per-session pattern that
    bears on J2's micro-decision discipline)
supersedes: none
wiki-state: empty (vault/wiki/index.md is a stub index)
---

# EV-7 Open-Judgment Rulings — product-owner seat

The wiki is empty (`vault/wiki/index.md` is a stub catalog with no module
pages). Authority is the spec itself (`docs/PI-SPEC.md`), `AGENTS.md`
(which names the spec as source of truth), the EV-7 deliberation record
(`council/cards/EV-7.md`), and prior rulings on the same operative pair
(EV-1 Q3 on prose-sync governance; EV-2 Item 1 on conditional copy;
EV-2 Item 3 on stated refusal over glyph; EV-4 Q1 on in-card prose
amendments). No recorded human decision in `council/board.md` bears on
J1, J2, or J3. FLLWUP-2 ("Reconcile EV-8 card text with the seven-state
footer set") has no card file yet — its existence in the board is the
reconciliation prompt for EV-8's runner once EV-7 ships; it is not an
EV-7 deliverable.

The operative pair for these three rulings is mechanism and user value,
adapted to pi-remote: does the wire/contract hold, and does a host user
or CI operator get served by the choice? The three items sit on the
copy / user-line side (J1, J2) and the platform-coverage side (J3).
None is a portfolio change — all three are within EV-7's acceptance
scope, so I rule in seat.

The runner's two spec-draft items — B1 (the `discoveryCache` type
change in `src/tunnel.ts:56`) and B2 (the copy-invariant reconciliation
against the designer's canonical 13-row table) — are not judgments for
this seat; they are spec drafting work the facilitator owns at step 7,
gated by the Skeptic's closed-red findings. They are not addressed here.

---

## J1 — Tenant display in the `/rc:login` success line

### Ruling

**Append ` (tenant <tenantId>)` only when the access-token JWT payload
carries a tenant-scoped `sub` claim; otherwise render the compact form
verbatim.**

Concrete rendering, with placeholders for caller resolution:

- With tenant-scoped `sub`: `"Signed in to <serverUrl> — enrollment credentials saved for this host (tenant <tenantId>). Run /rc to start a tunnel."`
- Without: `"Signed in to <serverUrl> — enrollment credentials saved for this host. Run /rc to start a tunnel."` (the designer's round-2 canonical line, principal's framing, EV-7 deliberation §Step-5 settled copy).

The check is **`typeof tenantId === "string" && tenantId.length > 0`**
— i.e., the unverified base64url decode of the JWT payload `sub`
returned a non-empty string. When absent, the line renders verbatim
without the parenthetical.

The runner's security-adjacent note is part of the binding ruling and
must be visible to the implementer: `tenantId` is best-effort
unverified decode, never an authority decision, and the success line
is **informational only**. The display does not authorize any
tenant-scoped behavior at the host.

### Reasoning

Three lenses converge on this ruling.

**Mechanism.** The `tenantId` field is a *cache of a token claim* used
for multi-tenant disambiguation (per the EV-1 Q3 ruling on §7.5 row-1
tenancy: "token `sub` claim identifies the tenant-scoped account"; per
the EV-7 deliberation §Step-1 owner position: "best-effort cache, never
an auth authority"). The runner packet correctly observes that
single-tenant servers do not emit a tenant-scoped `sub`. There is no
canonical "always-present tenantId" because tenancy is a server-side
concern the spec keeps opaque (§7.5 "the extension treats credentials
as opaque"). The success-line rendering must mirror what the token
actually carries; rendering an empty parenthetical ` (tenant )` would
leak the absence as a malformed signal to the user, which is the
opposite of what a stated success line is for.

**User value.** The Gulf of Evaluation the success line closes is
"what was saved, and what to do next" (designer r2 §"Gulf closed" #2).
The compact form satisfies that Gulf fully for single-tenant users,
who are the majority case on the epic's primary host (the EV-7 record
explicitly names the hosts as "primarily Linux/macOS dev machines").
For multi-tenant users, the parenthetical adds the disambiguation
value that is the **only reason the field exists** — without it, a
user enrolled with two tenants on the same control plane cannot tell
from the success line which enrollment just completed. Conditional
rendering serves both populations without forcing either to read past
a malformed parenthetical.

**Cheapest-to-reverse.** If a future card decides the parenthetical
should always render (e.g., the server is upgraded to always emit a
tenant-scoped `sub`), the change is a single condition deletion. If
the parenthetical is removed entirely, the change is also a single
condition deletion. Either direction is trivial.

The "unconditional display" alternative is rejected because it
renders ` (tenant )` for single-tenant servers (the runner packet's
reason, which is decisive on its own — an empty parenthetical is a
visual bug, not a UX choice). The "never display" alternative is
rejected because it loses the only multi-tenant disambiguation value
the field provides; the user value for the multi-tenant case is
genuine, and the runner packet is right that it is the only reason
the field exists in the first place.

### Sources

- `docs/PI-SPEC.md` §7.5 row-1 (tenancy by token claims; opaque to
  the extension)
- `council/cards/EV-7.md` Step-1 owner position: "tenantId:
  unverified base64url decode of JWT payload `sub` (best-effort
  cache, never an auth authority)"
- `council/cards/EV-7.md` Step-2 designer r2: "include
  `(tenant <tenantId>)` only when the token response carries a
  tenant-scoped `sub` claim"
- `council/cards/EV-7.md` Step-5 settled copy: success line
  canonical form (principal's framing); conditional tenant
  parenthetical ratifiable by product-owner
- `vault/raw/2026-08-31-po-ev2-ruling.md` Item 1 — precedent for
  conditional user-line copy (the 403 row names `/rc:login` AND a
  scope remedy because the remedies diverge on a condition;
  analogously, the tenant parenthetical renders conditionally on a
  condition, because the disambiguation value diverges on a
  condition)
- `vault/raw/2026-08-31-po-ev1-ruling.md` Q3 — §7.5 row-1
  tenancy ratified as prose-sync within EV-1; the conditional
  rendering rule follows from there

### Options rejected

- **Unconditional `(tenant <tenantId>)` always present** — renders
  ` (tenant )` for single-tenant servers; visual bug; not a UX
  choice. Rejected on mechanism (the field doesn't exist on those
  servers) and user value (closing the Gulf of Evaluation correctly
  means rendering what the token actually carried, not an empty
  placeholder).
- **Never display tenantId** — loses the multi-tenant disambiguation
  value, which is the only reason the field exists. Rejected on
  user value (the multi-tenant user genuinely benefits; the cost of
  the parenthetical is zero when tenantId is absent under Position
  A).
- **Render tenantId in a follow-up line, not as a parenthetical**
  — out of scope for this card and changes the success-line shape
  the spec implicitly commits to (the EV-7 record converges on a
  one-line success statement). If a future card wants a separate
  "enrolled for tenant X" line, that is a copy-shape card, not an
  amendment to this ruling.

### Reversibility

Trivial. The conditional is a single ternary at the render site.
Either direction (always / never / follow-up line) is a single
edit. No wire contract change; no spec text change; no test
changes beyond the success-line golden-file assertions.

---

## J2 — Re-run while enrolled: confirm vs silent replace

### Ruling

**Confirm with the `login.replacementPrompt` line before any side
effect.** Concretely: when `/rc:login` is invoked and an existing
enrollment credential is already present, the command prints the
replacement-prompt line first, then waits for Enter. Enter continues
(the credential is overwritten). Ctrl-C aborts silently (the existing
credential is preserved; nothing is emitted except a clean exit).

**Micro-decision (ratified, not reversed): the prompt is NOT shown in
`--headless` mode.** In headless mode, `/rc:login` proceeds without
the prompt. Reason ratified from the EV-7 r2 designer's note: the
headless user has already committed to a long-running flow (relaying
a code across devices), and an extra Enter press would interrupt the
wait the user is in the middle of executing. The flow-internal prompt
would be an unprompted demand for input the user does not have at
hand.

**Skeptic's structural constraint (binding): the prompt must appear
before any HTTP request to `authorization_endpoint`,
`token_endpoint`, or `device_authorization_endpoint`.** Assertable by
pre-seeding the credential store, invoking `/rc:login`, and inspecting
the request log — the prompt renders, then waits for input, then
discovery begins. The flow design in `council/cards/EV-7.md`
designer-r2 §"`/rc:login` (attended, default)" satisfies this: step
2 (replacement prompt) precedes step 3 (`deps.openUrl`) which precedes
discovery.

### Reasoning

The card's acceptance says "`/rc:login` re-run replaces the previous
credential cleanly." The runner packet correctly observes this is
*ambiguous* between "silently" and "with confirmation." I read
"cleanly" as referring to *atomicity* (no half-written state — the
credential file is full-replaced via tmp+fsync+rename, never merged),
not to *silence*. The full-replace-on-re-run semantic is settled in
the EV-7 deliberation §Step-2 owner position ("Clean re-run = full key
replacement, never merge") and §Step-5 consensus design ("Persistence:
... full-replace on re-run"). The silent-vs-confirmed question is a
separate judgment, and it is not a question the acceptance text
answers.

Three lenses settle the judgment:

**Mechanism.** The credential overwrite is a *consequential* side
effect. It changes which tenant the host is enrolled with and which
control plane the host presents `Bearer <access_token>` to (per the
§7.2 trust model: the access token authorizes creating tunnels).
Silent overwrite is appropriate for idempotent / safe-to-repeat
operations (e.g., a `/rc` while connected — the EV-2 Item 3 ruling
calls this "stated refusal, not a glyph" and treats the live tunnel
as the protection); a credential overwrite is not in that category.
The protection should be at the moment of overwrite, not after the
fact.

**User value.** The cost asymmetry is decisive. The cost of one Enter
press is trivial (the user just typed the whole command). The cost of
silent overwrite on a shared host — where another operator's
enrollment gets clobbered by a stale script or a misdirected paste —
is real and unrecoverable without re-enrollment. The EV-7 designer-r2
position names this risk explicitly ("silent clobber on shared host
real"). The protection against the higher-cost outcome at the
trivial-cost cost is the correct asymmetry.

**Cheapest-to-reverse / loud-once discipline.** EV-2 Item 3 settled
the "stated refusal over glyph" pattern for `/rc`'s idempotent no-op.
The reverse pattern — silent overwrite — is the inverse of stated
refusal, and is rejected on the same principle. The PI-SPEC §5.4
"loud-once per session" pattern from EV-6 R2 establishes a related
discipline: notices are sparse and meaningful, not chatter. The
replacement prompt is one prompt per re-run, not per session; it
honors the loud-once discipline.

The headless micro-decision is ratified because it follows the same
discipline: the headless user is *already in a prompt-bearing flow*
(the device-code relay), and an additional prompt at re-run would
break the user's interaction model. The cost of asking is high
(interrupting a wait) and the cost of not asking is low (the headless
user invoked the command deliberately; the previous credential was
either theirs or the script's, and either way they meant to replace
it).

### Sources

- `council/cards/EV-7.md` Step-5 consensus: "full-replace on re-run"
  (settled; the silent-vs-confirmed question is orthogonal)
- `council/cards/EV-7.md` Step-2 designer r2: "Idempotent re-run
  confirmation prompt before any side effect"; open judgment #2
  escalates silent-vs-confirmed to product-owner
- `vault/raw/2026-08-31-po-ev2-ruling.md` Item 3 — precedent for
  stated refusal on idempotent commands (the inverse: silent
  overwrite is the wrong shape for a consequential side effect)
- `docs/PI-SPEC.md` §5.4 loud-once-per-session pattern (EV-6 R2):
  notices are sparse and meaningful
- `docs/PI-SPEC.md` §7.2 — the access token authorizes creating
  tunnels; the overwrite changes which token the host presents
- Skeptic step-4 closed-red on copy invariant (B2) — the
  replacement prompt is part of the closed-set copy and must
  appear in `loginReasonCopy` (canonical row in designer's table)

### Options rejected

- **Silent replace** (owner round-1 reading): faster, but no recovery
  from a misclick, stale script, or shared-host overwrite. The
  cost asymmetry (one trivial Enter vs. a real clobber) is
  against it. Rejected on user value.
- **Confirm with a timeout (auto-cancel after N seconds)**: more
  machinery, more failure modes (what does timeout mean — abort
  silently? abort with a notice?). The simple "wait for Enter or
  Ctrl-C" model is the EV-2 Item 3 / EV-6 R2 discipline already
  in the codebase; a timeout would invent a new seam. Out of
  scope for this card.
- **Confirm in headless too**: would interrupt the device-code
  relay wait, which is the explicit shape the user committed to.
  Rejected on user value.

### Reversibility

Trivial. The replacement-prompt branch is a small block at the
top of the flow; removing it (or guarding it with a future
flag) is a single edit. No spec text change; no closed-set
change (the row exists either way — the prompt line is
canonical regardless of which side wins; the only question was
whether to *call* it on re-run). No test changes beyond the
"prompt-before-HTTP" assertion.

---

## J3 — POSIX-0600 vs Windows ACL for "user-only readability"

### Ruling

**Position A: ship POSIX 0600 plus a documented Windows caveat. Do
not ship Windows ACL work in EV-7.** The credential store is written
via tmp+fsync+rename with mode 0600 on POSIX; on Windows, the chmod
is a no-op (Node.js `fs.chmod` does not configure NTFS ACLs), and the
stored file is accessible to other users on the host with access to
the user's profile directory. EV-7 ships a documented caveat in the
README's credential-storage section (a doc-sync that rides the same
follow-up as the README sync already named — FLLWUP-1) and a
defensive note in the storage-failed row's copy when running on
Windows (so a Windows user hitting the no-ACL limitation gets a
stated notice, not silent exposure).

**Acceptance reading**: the card acceptance line "Credentials are
stored with user-only readability" is read to mean "user-only
readability on the platform's canonical mechanism for user-only
readability." On POSIX, that canonical mechanism is 0600. On Windows,
the canonical mechanism is an NTFS ACL denying non-owner read; EV-7
does not implement the Windows canonical mechanism in this card. The
security *goal* (no other user on the host can read the credential)
is not relaxed — the implementation does not achieve the goal on
Windows today, and the user is told so.

**The Skeptic's step-9 gate can assert the acceptance as follows**:

- On POSIX: `fs.statSync(credentialPath).mode & 0o777 === 0o600` (the
  existing acceptance for the POSIX path).
- On Windows: the implementation *must* detect the platform at write
  time, render a stated notice in the storage-failed terminal copy
  if the chmod is a no-op (so the failure is observable), and
  document the limitation in the README. The acceptance is *not*
  asserted as met on Windows under this ruling — the caveat is the
  acceptance on Windows.

If a future card decides Windows ACL work is required, that is a
follow-up that lands as a separate card (Windows ACL via Node's
`fs.symlink` shim, `icacls` invocation, or a port to a Windows-native
credential API like `wincred`). The follow-up is mechanical — append
a per-platform branch in `saveCredential` — and is recorded as a
follow-up the runner should flag at EV-7 close.

### Reasoning

This is the only one of the three items that touches an acceptance
boundary. I considered whether to escalate to steward. I rule in seat
for three reasons, recorded explicitly:

**1. The acceptance reading is honest, not an amendment.** The card
acceptance says "user-only readability." Position B reads that text
literally as "no other user on the host can read the credential,
regardless of platform." Position A reads it as "user-only
readability on the platform's canonical user-only-readability
mechanism, with caveats where the canonical mechanism does not
exist in this implementation." Both readings are reasonable; neither
is a transparent evasion. The principal's round-2 position already
named this exact fork ("user-only readability = POSIX 0600 only;
chmod no-op on Windows — accept 0600 + documented Windows caveat,
or require ACL work (needs ruling)"). I am picking the reading the
principal flagged for product-owner and being explicit about what
the acceptance means on each platform. The card's `goal` is not
changed; the acceptance is read against the platform reality, and
the platform reality is documented.

**2. The portfolio is unchanged.** Position A ships EV-7 as
designed; Position B expands EV-7's implementation scope into
Windows ACL work that is not in the card's goal text. Neither
position touches EV-8, FLLWUP-1, FLLWUP-2, EV-1, EV-2, or any
downstream card. Neither position changes the wire contract or the
mechanism. The question is *which platforms does EV-7 make the
acceptance statement on*, not *what does EV-7 do*. The portfolio
shape is identical under both readings; only the implementation
breadth differs. That is a scope judgment, not a portfolio
judgment, and is in seat.

**3. Cheapest-to-reverse.** If a future card decides Windows ACL is
required, Position A → Position B is appending code to `saveCredential`
(a per-platform branch, an `icacls` or `wincred` integration,
maybe 50-100 lines plus a test). If the steward later overrules
this and says "the acceptance must be met on Windows too," the
same appending happens — but in the meantime, EV-7 ships and
Linux/macOS hosts (the primary host population per the EV-7
deliberation record) get the credential store they need. The
reverse (Position B → Position A) is removing code, which is also
cheap, but the *users* affected by the rollback differ: under A
the affected users are Windows users who never had Windows ACL
support; under B the affected users are POSIX users who would have
shipped without 0600 (which is wrong). The fleet-weighted
reversibility favors A.

The token blast radius is tenant-contained and revocable at the
control plane (per the §7.4 trust summary and the EV-1 Q3 ruling
on prose-sync). The credential's value to a same-host attacker on
Windows today is bounded by that blast radius. Documenting the
limitation honestly (README + storage-failed copy on Windows) is
the right calibration: the user knows the credential exists, knows
it is not ACL-protected on Windows, and can decide whether to
delay enrollment until the Windows ACL follow-up lands (or use a
POSIX host instead). Silent exposure with no documentation would
be the user-value failure; Position A is not that failure.

### Sources

- `council/cards/EV-7.md` Step-5 consensus: "Persistence: dedicated
  0600 file under pi agent config dir, piRemote.* keys"
- `council/cards/EV-7.md` Step-2 principal r2: "user-only
  readability = POSIX 0600 only; chmod no-op on Windows — accept
  0600 + documented Windows caveat, or require ACL work (needs
  ruling)" — escalated as open judgment #4 (numbered #3 in the
  packet as J3)
- `council/cards/EV-7.md` Step-2 owner r2: same 0600 commitment,
  same Windows caveat unaddressed
- `docs/PI-SPEC.md` §7.2 — credential storage wording (the
  section the EV-1 Q3 governance precedent says EV-7 may amend
  in-card per the EV-4 Q1 precedent on in-card prose-sync
  forced by external reality); §7.4 trust summary — token blast
  radius is tenant-contained, revocable
- `vault/raw/2026-08-31-po-ev1-ruling.md` Q3 — prose-sync
  governance precedent: in-card spec amendments that do not
  change the security model and are forced by external reality
  are within the implementing card's mandate
- `vault/raw/2026-08-31-po-ev4-ruling.md` Q1 — in-card prose
  amendment precedent: facilitator amends the spec in the same
  PR as the implementation, with evidence cited

### Options rejected

- **Position B (require Windows ACL work in EV-7)**: expands
  implementation scope into Windows-native ACL (icacls / wincred)
  without changing the security model. The user value for Windows
  users is real, but the epic's primary host population is POSIX
  (per the EV-7 record), the token blast radius is revocable, and
  the cheapest-to-reverse choice is to ship POSIX + document
  rather than block on Windows ACL work that is mechanical but
  untested in this codebase. Rejected on scope-discipline and
  reversibility.
- **Reject the card acceptance and refile it for Windows ACL
  work**: refuses the in-card governance precedent (EV-1 Q3,
  EV-4 Q1) and treats the acceptance as more fragile than the
  principal's escalation framed it. The principal explicitly
  named this fork for product-owner ruling; refusing the fork
  would force a steward escalation that the principal did not
  recommend.

### Reversibility

Trivial. `saveCredential` gains a per-platform branch. The
README's credential-storage section is appended with the caveat.
The closed-set copy gains a Windows-aware row in the
storage-failed terminal set (or a one-line notice attached to
the existing row when `process.platform === "win32"`). No wire
contract change; no spec text change beyond the §7.2 amendment
already settled in-card; no test changes beyond the
platform-conditional assertions.

The follow-up card (Windows ACL via icacls / wincred) is
recorded as a runner-output item: at EV-7 close, the runner
should flag this as a known follow-up so it does not get lost.
The follow-up is mechanical and bounded; it is not a refactor.

---

## General rule for EV-8 / FLLWUP-2

### Ruling

**For EV-8: when importing `loginReasonCopy` and `loginEnglishFor`,
EV-8 must consume the closed-set discipline exactly as the designer's
canonical table binds it.** Specifically:

1. **No glyph acks.** Every state change EV-8 surfaces to the host
   user (including `login.alreadyRunning`, `login.cancelled`,
   `login.replacementPrompt`, every row in the failure set, and
   the success line) is a stated sentence resolved through
   `loginEnglishFor(key)`. EV-8 does not invent new keys; if a
   needed line is missing from the closed set, EV-8 escalates back
   to a follow-up rather than rendering raw strings. This honors
   the EV-2 Item 2 key-seam precedent and the EV-2 Item 3
   stated-refusal precedent.
2. **No bypass of `loginEnglishFor`.** EV-8 imports the lookup;
   it does not duplicate the strings. The lookup is the single
   source of truth for the copy (per the EV-7 r2 designer's
   binding §"Owner (test surface)" — *Every test asserts the
   rendered English default via `loginEnglishFor(key)`*). EV-8's
   render sites call `loginEnglishFor(key)`, period.
3. **Replacement-prompt gate.** EV-8's `/rc:login` command handler
   must call `loginEnglishFor('login.replacementPrompt')` and
   wait for input *before* invoking any login driver
   (`runAttendedLogin` / `runHeadlessLogin`). EV-8 does not own
   the prompt; the driver does (the prompt is part of the
   replace-flow's first line per the designer's flow design, and
   the driver's `run(mode)` is what EV-8 calls). The
   "prompt-before-HTTP" gate is asserted at the driver level,
   not at the command-handler level — EV-8 should structure its
   handler so the driver invocation is the gate, not a post-hoc
   check.
4. **Headless mode branch.** EV-8's command handler must pass the
   mode (attended | headless) into the driver. The driver is
   what decides whether the replacement prompt renders. EV-8
   does not branch on mode for the prompt itself.
5. **Status-line emission during `/rc:login`.** EV-8 emits the
   `authorizing` footer state when the driver begins (per the
   EV-1 Q2 ruling's seven-state set). The driver emits terminal
   lines through `loginEnglishFor`; EV-8 emits the status line
   through `ctx.ui.setStatus("pi-remote", "authorizing")` and
   transitions to `off` (on failure) or `not enrolled` (no, that
   is wrong — on success, the driver has written the credential,
   so EV-8 transitions to `off` until the user invokes `/rc`).
   The exact success terminal state is the EV-8 runner's
   decision per its own acceptance ("With no credential
   configured, `/rc` fails gracefully... footer status returns
   to `off`" — and the symmetric question "with a credential
   now configured, what does the footer show?" is implicit;
   FLLWUP-2 resolves it).
6. **No second copy vocabulary.** EV-8 must not introduce a
   parallel set of strings for `/rc:login`'s terminal output.
   The card's acceptance says "the command output on the host
   terminal" is in scope; the copy lives in `login.ts`. EV-8
   imports `loginEnglishFor` and renders. If a needed user-line
   is not in the closed set, that is a bug in the EV-7 spec or
   a missing-row bug, and is fixed via the spec-draft →
   product-owner pipeline, not by adding strings to EV-8.

### Reasoning

The EV-7 / EV-8 seam is the same shape the EV-1 → EV-2 / EV-7
split established: pure drivers + closed vocabulary in EV-7;
rendering and command surface in EV-8. The general rule codifies
the seam so EV-8's runner does not reinvent any of the closed-set
discipline, the key-seam precedent, or the stated-refusal
precedent. It is recorded here as a binding rule for EV-8 because
the runner's packet explicitly asks for "any general rule for
EV-8/FLLWUP-2," and because the EV-2 Item 4 ruling precedent
(recorded preference for EV-8's merge rule, with EV-8 free to
overturn) shows that this seat defers policy to EV-8 but binds
*seam discipline*. EV-8 owns the merge rule; this seat owns the
seam.

**For FLLWUP-2:** the seven-state set from EV-1 Q2 is the
authoritative footer state set; EV-8's current card text lists
four (`off` / `dialing` / `live` / `resyncing`). FLLWUP-2
reconciles EV-8's card text to the seven-state set per EV-1 Q2.
The reconciliation is mechanical (text edit on EV-8's card
acceptance and intent paragraphs); the implementation impact on
EV-8 is zero if EV-8 has not yet shipped, and a small follow-up
if it has. FLLWUP-2 is the work, not a judgment — but the
*direction* of the reconciliation is settled by EV-1 Q2, and
FLLWUP-2's runner should not re-litigate it. I record the
direction here so FLLWUP-2's runner starts from the settled
position.

### Sources

- `vault/raw/2026-08-31-po-ev1-ruling.md` Q2 — seven-state set:
  `off`, `not enrolled`, `authorizing`, `dialing`, `resyncing`,
  `live`, `error`
- `vault/raw/2026-08-31-po-ev2-ruling.md` Item 2 — key-seam
  precedent (`userLine` is a stable key; English lookup lives in
  tunnel.ts)
- `vault/raw/2026-08-31-po-ev2-ruling.md` Item 3 — stated-refusal
  precedent (no glyph acks)
- `vault/raw/2026-08-31-po-ev2-ruling.md` Item 4 — seam-rule
  deference (EV-8 owns the merge rule; EV-2 owns the seam)
- `council/cards/EV-8.md` acceptance — current text lists four
  states; reconciliation to seven is FLLWUP-2's work
- `council/board.md` Ready column — FLLWUP-2 is in Ready;
  no card file yet

### Reversibility

The general rule is a binding reading of the seam, not a policy
choice. EV-8 may propose a different seam shape in its own
deliberation (e.g., if EV-8's runner finds that `loginEnglishFor`
is the wrong granularity for its render sites), but that proposal
is a new card or a follow-up that re-opens the seam. Until then,
the seam is as documented. The FLLWUP-2 reconciliation is a
single text edit on EV-8's card and is trivially reversible.

---

## Closing note for the runner

EV-7 may proceed to step 7 (spec draft) → step 8 (owner
implementation) → step 9 (Skeptic verify) → step 10 (judge) →
step 11/12 (merge), with these three rulings recorded:

- **J1** clears the tenant display question: conditional on
  `typeof tenantId === "string" && tenantId.length > 0`; security-
  adjacent note (informational only, never an authority decision)
  rides with the implementation.
- **J2** clears the re-run prompt question: confirm with
  `loginEnglishFor('login.replacementPrompt')` before any HTTP
  request; no prompt in headless mode; gate assertable via request
  log inspection.
- **J3** clears the platform question: POSIX 0600 + documented
  Windows caveat; acceptance read as "user-only readability on
  the platform's canonical mechanism, with documented caveats
  where the canonical mechanism is not implemented in this card";
  Windows ACL work recorded as a follow-up the runner flags at
  EV-7 close.

The general rule for EV-8/FLLWUP-2 is binding: EV-8 imports the
closed-set vocabulary; EV-8 renders via `loginEnglishFor`; EV-8
does not invent new keys; FLLWUP-2 reconciles EV-8's card text to
the seven-state set per EV-1 Q2.

The runner's two spec-draft items — B1 (the `discoveryCache` type
change in `src/tunnel.ts:56`) and B2 (the copy-invariant
reconciliation against the designer's canonical 13-row table) —
remain facilitator-owned at step 7. Neither is a judgment for this
seat.
