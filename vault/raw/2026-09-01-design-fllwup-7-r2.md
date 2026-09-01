# FLLWUP-7 — Design position (Windows storage copy), round 2

Card: FLLWUP-7 — EV-7 Windows ACL for credential-file user-only
readability.

Seat: design, round 2 of a bounded exchange. Supersedes
`vault/raw/2026-08-31-design-fllwup-7-windows-storage-notice.md` where
the round-2 evidence contradicts round-1.

## What changed since round 1

The owner (round 1) and the principal (round 1) both endorse a
**fail-closed** contract on the Windows write path:

- ACL is applied to the **tmp file before rename**, mirroring the
  existing POSIX `chmodSync(tmp, 0o600)` placement (both seats agree;
  the placement is load-bearing — it travels through the rename so
  the target is never world-readable, even briefly).
- On any ACL failure (icacls exit non-zero, `whoami /user` parse
  failure, non-NTFS volume, EDR block) — the tmp is deleted, the
  rename never runs, `WriteResult` returns
  `{ok: false, reason: "acl_enforcement_failed"}`, and **no
  credential file is left on disk**.
- `WriteResult` collapses to
  `{ok: true} | {ok: false; reason: "io_error" | "acl_enforcement_failed"}`.
  The round-1 reason `platform_acl_not_supported` is retired: it
  described yesterday's posture ("this platform cannot do ACLs at
  all") and is now a lie — the platform can; *this host* could not.
- The `login.ts:581` gate changes from
  `process.platform === "win32"` to
  `saved.reason === "acl_enforcement_failed"`. The principal
  correctly flags that a platform-keyed notice would mis-fire for
  a future POSIX `acl_enforcement_failed` (e.g., a macOS
  `chmod`-equivalent failure); I concur.

This contract is materially stronger than what round 1 assumed.
Round 1's `WINDOWS_STORAGE_NOTICE` branch
(`acl_failed`) said: *"the file (if any) is NOT restricted to this
user and may be readable by other accounts on this host."*
**Under fail-closed that sentence is false.** If the ACL fails, the
file does not exist. There is nothing to "may be readable." A
sentence that warns about a non-existent file is the same shape of
UX lie the card exists to delete: the interface implies a hazard
the implementation did not create.

The CI dispute (owner wants a `windows-latest` job running the
read-back test; principal wants ubuntu-runnable unit tests with the
real read-back gated as win32-only and documented as manual) does
not change copy text, only the verb in one phrase: the README can
truthfully say *"enforced"*; it can say *"enforced and CI-verified"*
only if and when the owner-side CI job exists. I default to the
conservative phrasing ("enforced") and leave the upgrade as a
one-word follow-up.

## Design position

Three pieces of copy flip in lockstep, and one piece of copy stays
silent.

**1. The conditional Windows-failure notice keys on
`acl_enforcement_failed`, not on `process.platform`, and tells the
truth about a non-existent file.**

**2. The README credential-storage paragraph replaces the
"chmod-is-a-no-op" clause with an affirmative statement of
enforcement; the PI-SPEC §7.2 parallel paragraph gets the same flip.**

**3. The success line does not change.** No platform-specific
signifier on the happy path. The guarantee is enacted, not narrated.

### Gulf closed

Gulf of Evaluation, for a Windows user in the storage-failed moment
where the ACL did not apply. Round 1's notice told the user *"the
file may be readable by other accounts"* — a warning about a hazard
that, under fail-closed, does not exist. That is a worse failure
mode than the old one: a stated-but-absent hazard teaches the user
to distrust the tool when no hazard is present, which is exactly
the kind of conceptual-model corruption that makes a future real
failure get ignored ("the tool always says that"). The new notice
replaces "may be readable" with "nothing was saved; here is what to
do" — which is what the user actually needs to act on. Gulf narrows
sharply.

### Principle and evidence

- **Signifier sized to the consequence of being wrong.**
  `WINDOWS_STORAGE_NOTICE` at `src/login.ts:204-205` today tells a
  Windows user on the failure path *"this platform does not enforce
  user-only file permissions for the saved credential (READ the
  README caveat)."* Under fail-closed, that sentence is false on
  every code path that triggers it (the platform *does* enforce;
  the ACL *just failed*; there is no file to caveat about). The
  smallest-signifier fix is to make the notice conditional on the
  *reason* and brief on the *action*: nothing was saved, retry, and
  if it repeats, file an issue.

- **Knowledge in the world beats knowledge in the head.**
  README §Credential storage and PI-SPEC §7.2 are the only places a
  user learns about file protection *before* running `/rc:login`.
  The acceptance criterion is exact: "state the protection is
  enforced, not merely documented." So both must affirmatively say
  enforcement is in place on Windows, naming the mechanism (NTFS ACL
  applied via `icacls`), the placement (tmp, before rename, so the
  target inherits the ACL), and the failure shape (enforcement
  failure ⇒ no file saved).

- **Conceptual-model honesty.** The card's guarantee is per-file
  and per-current-user. It does not extend to disk-level encryption,
  AD policy, what happens if the ACL call itself is denied, or what
  another administrator on the host can do with sufficient
  privilege. The README sentence must not promise more than that.

- **Forcing function.** The `WINDOWS_STORAGE_NOTICE` is currently
  a string constant appended on platform. Two changes are required
  for the new copy to be reachable: (a) `WriteResult.reason` gains
  the `acl_enforcement_failed` literal (the principal's narrowing
  of the type), and (b) the append site at `src/login.ts:581`
  branches on `saved.reason === "acl_enforcement_failed"` rather
  than `process.platform === "win32"`. These are one-line type
  decisions the deliberation must own.

- **The two gulfs, named.** The round-1 draft closed the Gulf of
  Evaluation by warning the user about a file that may exist. After
  fail-closed, the Gulf of Evaluation closes by telling the user
  what actually happened (no file was saved) and what to do next
  (retry, file an issue if it repeats). The Gulf of Execution
  closes by giving the user a one-command retry (`/rc:login`) and a
  forcing function for the abnormal case (file an issue).

## Replacement copy — exact final strings

### `src/login.ts` — `WINDOWS_STORAGE_NOTICE` becomes a reason-keyed function

The constant is replaced by a function (or a reason→string table)
keyed on the failed-write reason. Only `acl_enforcement_failed`
renders the Windows-shaped notice; `io_error` renders nothing
extra (POSIX and Windows see the same line).

```ts
/**
 * FLLWUP-7: the platform notice is keyed on the credential-write
 * failure REASON, not on `process.platform`. Under fail-closed,
 * `acl_enforcement_failed` means the tmp file was deleted and the
 * rename never ran; nothing was saved. `io_error` is the same
 * shape on every OS and needs no platform-specific tail.
 */
export const ACL_ENFORCEMENT_FAILED_NOTICE =
  " On Windows this host refused to apply the per-user NTFS ACL on the credential file, so the tmp was deleted and nothing was saved. Run /rc:login to retry; if it repeats, file an issue.";
```

Append site at `src/login.ts:578-583`:

```ts
if (!saved.ok) {
  let line = loginEnglishFor("login.failure.storageFailed");
  if (saved.reason === "acl_enforcement_failed") line += ACL_ENFORCEMENT_FAILED_NOTICE;
  print(deps, line);
  return { kind: "failure", reason: "storageFailed" };
}
```

Note: the append is no longer keyed on `process.platform`. Today
only Windows produces `acl_enforcement_failed`; the type-level
generality matches the principal's flag and leaves the door open
without changing today's behavior.

### `src/credential.ts` — `WriteResult` narrows

```ts
export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "io_error" }
  | { ok: false; reason: "acl_enforcement_failed" };
```

The former `platform_acl_not_supported` literal is retired. Any
call site that still references it is a stale comment from EV-7's
J3 ruling; under FLLWUP-7 the platform is supported and the host
was the failure.

### `README.md` — Credential storage paragraph

Replace the current lines 71-78:

```md
## Credential storage

The OAuth2 enrollment credential lives in a dedicated JSON file at
`<configDir>/pi-remote/credentials.json`, serializing the `piRemote.*`
keys (server URL, access token, refresh token, token expiry, tenant
id). User-only readability is enforced on POSIX by a mode-0600
file, written atomically via tmp+fsync+rename; on Windows it is
enforced by an NTFS access-control list that grants read and write
access only to the current user (inherited ACEs are removed), also
applied to the tmp file before rename so the target inherits the
ACL and never exists world-readable. If the NTFS ACL cannot be
applied on this host (non-NTFS volume, `icacls` blocked, `whoami`
unavailable), the tmp is deleted, no credential is written, and
`/rc:login` reports storage failed with no credentials saved — run
`/rc:login` again to retry. A failed flow writes nothing
half-written; re-running `/rc:login` replaces the stored credential
cleanly.
```

### `docs/PI-SPEC.md` §7.2 — Credential storage bullet

Replace the current line-311 sentence in the Credential storage
bullet:

> User-only readability is enforced on POSIX by a mode-0600 file (written atomically via tmp+fsync+rename); on Windows `chmod` is a no-op, so the 0600 guarantee is not portable there — the limitation is documented in the README's credential-storage section (riding FLLWUP-1) and surfaced as a platform notice in the storage-failed copy when running on Windows.

with:

> User-only readability is enforced on POSIX by a mode-0600 file (written atomically via tmp+fsync+rename) and on Windows by an NTFS access-control list granting read and write to the current user only, applied to the tmp file before rename so the target inherits the ACL; if the ACL cannot be applied on this host, the tmp is deleted and no credential is written. Both paths fail closed: a credential is on disk only if protection was successfully applied.

### `src/credential.ts` — header comment block

The existing J3 comment at `src/credential.ts:18` reads:

```
 * Windows (J3): `fs.chmod` is a no-op and EV-7 does not implement an NTFS ACL.
 * The file is still written, but `saveCredential` returns
 * `{ ok: false, reason: "platform_acl_not_supported" }` so the login driver
```

Replace with:

```
 * Windows (FLLWUP-7): the tmp file is opened with `openSync(tmp, "w",
 * 0o600)` for the create-mode bits, then an NTFS ACL is applied
 * via `icacls /inheritance:r /grant:r "*<userSID>:F"` before rename.
 * If the ACL call or the SID lookup fails, the tmp is deleted and
 * `{ ok: false, reason: "acl_enforcement_failed" }` is returned;
 * no credential file is left on disk (fail-closed).
```

### What stays the same

- The `login.failure.storageFailed` row in `FAILURE_ROWS` (lines
  172-176 of `src/login.ts`): *"Could not persist credentials
  locally — run /rc:login to retry. No credentials were saved."* —
  unchanged. It already preserves the spec §1.2 invariant
  *"every row ends with one of: `no credentials were saved.`,
  `run /rc:login`, or `check the URL with your control-plane
  admin`"*; the new tail adds specificity without breaking that
  invariant.
- `LOGIN_SUCCESS_COPY` (`"Signed in to `<serverUrl>` — enrollment
  credentials saved for this host. Run /rc to start a tunnel."`).
  No platform-specific suffix on success. The guarantee is enacted,
  not narrated.

## Falsifiable predictions (re-evaluated under fail-closed)

Round 1 listed six predictions. Drop the ones that no longer apply;
restate the ones that do.

**Drop.** "The `acl_failed` notice text *mentions 'may be readable by
other accounts on this host'*." That sentence asserted a hazard
that, under fail-closed, does not exist. The new notice does not
contain the phrase, and a test asserting its absence is no longer
the falsifier of the right thing.

**Restate.**

1. *The failed-write notice contains the phrase `nothing was saved`.*
   Round 1 had `no credentials were saved` in the row text and a
   "may be readable" warning in the tail. Under fail-closed the
   correct shape is `nothing was saved` (in the tail) plus `no
   credentials were saved` (in the row) — the tail is the part
   that explains *why*. The unit test at
   `test/login.test.ts` for the row+tail concatenation asserts
   `ACL_ENFORCEMENT_FAILED_NOTICE.includes("nothing was saved")`.
   The CDP smoke is `bun run src/login.ts` against a mocked
   `saveCredential` returning `{ok: false, reason:
   "acl_enforcement_failed"}` and asserting the rendered stdout
   line contains `"nothing was saved"` and does **not** contain
   `"may be readable"`, `"other accounts"`, or any phrase
   implying a residual file.

2. *The failed-write notice does not key on
   `process.platform === "win32"`.* A unit test on a fake executor
   that returns `{ok: false, reason: "acl_enforcement_failed"}`
   while `process.platform` is patched to `"darwin"` (or any
   non-win32) renders the tail. The current code at
   `src/login.ts:581` would fail this test; the proposed change
   makes it pass. This is the falsifier for the principal's
   type-level generality argument.

3. *The success line contains no NTFS, no `icacls`, no
   `acl_enforcement_failed`.* `LOGIN_SUCCESS_COPY` is unchanged;
   the test at `test/login.test.ts:304-313` (the canonical-success
   assertion) covers this.

4. *The README paragraph does not contain `chmod is a no-op` and
   does contain `enforced`.* A static-grep guard in
   `test/login.test.ts:292-302` (the form that already
   grep-guards `src/login.ts` and `src/credential.ts`) is extended
   to also read `README.md` and assert the absence of the
   `chmod is a no-op` substring on the credential-storage
   paragraph, and the presence of the word `enforced` on the same
   paragraph. The current README fails both halves; the proposed
   text passes them.

5. *On Windows, after `saveCredential` returns
   `{ok: false, reason: "acl_enforcement_failed"}`,
   `existsSync(credentialPath(deps))` is `false`.* This is the
   load-bearing owner-side testable claim (owner's claim #1 in
   round 1). It needs `skipIf(!win32)` and the
   `windows-latest` CI job the owner argues for. Under fail-closed
   it is the test that *proves* the new copy is honest: if a file
   exists after `ok: false`, the notice's "nothing was saved" is a
   lie and the design has regressed to round 1's hazard.

**Add.**

6. *The notice appended to the storage-failed row will not fire for
   `saved.reason === "io_error"`.* A unit test on the same fake
   executor returning `{ok: false, reason: "io_error"}` asserts the
   rendered line equals `loginEnglishFor("login.failure.storageFailed")`
   exactly — no platform tail. Today the code appends the notice
   on every win32 failure; after the change it does not. This
   guards against a future regression where a windows-only tail
   is driven from the wrong reason.

## Where this position changed my mind

- **Round 1 said:** the `acl_failed` branch should warn that the
  file "may be readable by other accounts on this host." **Round
  2 says:** under fail-closed that warning describes a file that
  does not exist. I was wrong to design it that way; both seats
  moved the contract underneath me, and the right response is to
  let the copy follow the contract. The new copy tells the user
  what actually happened (nothing was saved, here is the cause,
  here is the retry) and stops inventing hazards.
- **Round 1 said:** reason names should be `acl_failed` (or
  `platform_acl_not_supported` repurposed). **Round 2 adopts the
  principal's `acl_enforcement_failed` naming** because the old
  names describe the platform; the new name describes the host,
  which is the entity that actually failed.
- **Round 1 hedged** on whether to keep `process.platform ===
  "win32"` as the branch key. **Round 2 drops it** in favor of
  `saved.reason === "acl_enforcement_failed"`, on the principal's
  flag and on the principle that platform-keyed UI strings drift
  away from the truth as the implementation broadens.

## Where this position is ungrounded (preferences, ranked last)

- The exact tail wording — *"On Windows this host refused to apply
  the per-user NTFS ACL on the credential file, so the tmp was
  deleted and nothing was saved. Run /rc:login to retry; if it
  repeats, file an issue."* — is the smallest honest phrasing I
  could land under the spec §1.2 row invariant; "refused to apply"
  reads as a host action rather than a platform feature gap, which
  I think is the right shape, but a longer form
  ("`icacls` could not be run, or reported failure") may serve
  power users better. Taste.
- The phrase *"if it repeats, file an issue"* rather than a
  pointer to a control-plane admin (the §1.2 third terminal). The
  failure is on the user's host, not the control plane; the
  control-plane-admin remedy does not apply. I picked
  issue-tracking because the next debugging step is *"what made
  `icacls` fail on this host"* and the maintainer is the right
  person for that. Taste.
- Whether the README paragraph should add a single illustrative
  example of the `icacls` command line for transparency, or stay
  prose-only. I prefer prose-only because the implementation may
  evolve (the principal's `(M)` vs `(F)` discussion is evidence
  the exact flag set is not yet settled) and pinning example
  commands in user docs invites staleness. Taste.
- The owner-side vs principal-side CI dispute does not change
  copy text. If the owner-side `windows-latest` CI job lands, the
  README can upgrade one phrase from *"enforced"* to
  *"enforced and CI-verified on Windows"*; if the principal-side
  manual-test path wins, the README should add *"the Windows ACL
  is exercised by a read-back test gated to Windows; the test is
  run manually until a Windows CI runner is added."* I do not
  editorialize between them — the copy change is mechanical either
  way, and one sentence is the limit of what I have ground for.

## What this seat escalates

Nothing. The CI dispute (owner vs principal) is an engineering
decision about runner cost vs gate rigor; either path yields copy
the user can rely on, and the difference is a single sentence in
the README. Product-owner is not needed: the card's acceptance
criterion says *"state the protection is enforced, not merely
documented"* and both paths satisfy it.

## Inputs read this round

- `src/login.ts` — `WINDOWS_STORAGE_NOTICE` (lines 203-205),
  append site (lines 578-583), `login.failure.storageFailed` row
  (lines 172-176), `LOGIN_SUCCESS_COPY` (line 187/197).
- `src/credential.ts` — `WriteResult` type (line 58 area), the
  J3 / FLLWUP-7 comment blocks (lines 4-23, 94-113), the
  `platform_acl_not_supported` return (line 113).
- `README.md` — Credential storage section (lines 71-78).
- `docs/PI-SPEC.md` §7.2 — Credential storage bullet (line 311).
- `test/login.test.ts` — vocabulary constant test (line 314),
  grep-guard (lines 292-302), happy-path attended test (lines
  309-332).
- `council/cards/FLLWUP-7.md` — the card itself.
- `council/board.md` — board record (FLLWUP-7 listed under
  "Deliberating").
- `vault/raw/2026-08-31-design-fllwup-7-windows-storage-notice.md`
  — my round-1 draft, now superseded.
- `vault/raw/2026-08-31-design-ev7-login-terminal-surface-r2.md` —
  the §1.2 vocabulary invariant that the new copy preserves.
- `vault/raw/2026-08-31-po-ev7-ruling.md` — the J3 ruling that
  the round-1 notice described; this round retires it.
