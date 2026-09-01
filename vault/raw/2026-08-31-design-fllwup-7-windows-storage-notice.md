# FLLWUP-7 — Design position (Windows storage copy)

Card: FLLWUP-7 — EV-7 Windows ACL for credential-file user-only
readability.

Seat: design (independent first pass).

## Scope

User-visible surface only. Two pieces of copy flip from
"limitation" to "resolved" when the ACL lands:

1. `src/login.ts` — `WINDOWS_STORAGE_NOTICE` (line 204-205), the
   win32-appended fragment of the `login.failure.storageFailed` row.
2. `README.md` — the Credential-storage section (lines 69-77), in
   particular the clause that today reads "on Windows `chmod` is a
   no-op, so the 0600 user-only-readability guarantee is not
   enforced there."

Both pieces move in the same PR because they are the same
guarantee expressed in two moments (proactive read vs. reactive
error). I am not arguing implementation; I am arguing copy that
makes the implementation honest if it lands as the acceptance
criterion specifies.

## Pre-position observation (settling a scope question before designing)

The Windows notice in `src/login.ts` only ever renders on the
`storageFailed` row. It never renders on a successful Windows
login. The success row (`Signed in to <serverUrl> ...`) carries no
platform-specific signifiers today and should not grow one
silently.

Consequence: on the **happy path** (ACL applied and verified, file
saved at 0o600-equivalent protection), the user sees **nothing**
about the ACL. The guarantee is *enacted*, not narrated. The
README is the place where the user learns about it; the storage-
failed notice is the place where the user learns about it going
wrong.

On the **failure path** the notice has to do two jobs: (a) explain
that the credential is not saved (already in the row) and (b) not
mislead about the platform's protection status (which changes
truth-value across the card).

## Position

### Design position (the change)

The Windows caveat flips from "limitation" to "resolved" only if
the copy becomes **conditional**: one state for "ACL succeeded"
(say nothing; the success line stands) and a different state for
"ACL failed or could not be verified" (be explicit that the file
may exist without user-only protection, and that no credentials
were saved).

Today the notice is single-state and only fires on `storageFailed`;
tomorrow the same row must do duty for both "atomic write failed"
and "ACL applied then failed verification", because the credential
writer returns one of `{ok: true}` / `{ok: false, reason:
"acl_failed" | "io_error" | "platform_acl_not_supported"}` and
`login.ts` collapses them all into `storageFailed`. The smallest
change is to split the notice into a single conditional string.

### Gulf closed

Gulf of Evaluation, for a Windows user in the `storageFailed`
moment. Today the notice tells the user *the platform does not
enforce protection* — after FLLWUP-7 that statement is false on
the happy path, so saying it is a lie; but saying nothing on the
failure path leaves the user unable to interpret the silence as
"the file is unprotected." Conditionalizing the notice closes
both halves: success-path is silent, failure-path is specific.

### Principle and evidence

- **Signifier sized to the consequence of being wrong.**
  `WINDOWS_STORAGE_NOTICE` at `src/login.ts:204-205` collapses
  multiple failure shapes into one platform-level claim. The card
  makes that claim false on the happy path. The smallest-signifier
  fix is conditional copy, plus an explicit `acl_failed` reason in
  `WriteResult` at `src/credential.ts:58` so the branch can fire.

- **Knowledge in the world beats knowledge in the head.**
  README caveat at `README.md:69-77` is the only place a user
  learns anything about file protection *before* running
  `/rc:login`. The acceptance criterion is exact: "state the
  protection is enforced, not merely documented." So the README
  must affirmatively say enforcement is in place, not merely
  imply it.

- **Conceptual-model honesty.** The card's guarantee is per-file
  and per-current-user; it does not extend to disk-level
  encryption, AD policy, or what happens if the ACL call itself
  is denied. The README sentence must not promise more than that.

- **Constraint + forcing function.** If the implementation does
  not distinguish "ACL failed" from "atomic write failed" at the
  type level, the conditional notice cannot fire correctly. The
  minimum type-system change is adding a new `acl_failed` reason
  (or repurposing `platform_acl_not_supported` cleanly) so that
  `login.ts` can branch.

## Replacement copy (exact strings)

### `src/login.ts` — `WINDOWS_STORAGE_NOTICE` becomes a function

```ts
/**
 * FLLWUP-7: the Windows storage-failed notice is now conditional.
 *  - acl_failed: a file may exist on disk without user-only protection.
 *    Tell the user the file is or may be unprotected, not just "not enforced."
 *  - io_error / platform_acl_not_supported: the atomic write could not
 *    complete; there may be no file, or a tmp file that was rolled back.
 *    The credential is unsaved either way; the safety of any residue
 *    is not assumed.
 */
export function windowsStorageNotice(
  failureReason: WriteResult & { ok: false }
): string {
  if (failureReason.reason === "acl_failed") {
    return " Could not verify the NTFS ACL on the saved credential — the file (if any) is NOT restricted to this user and may be readable by other accounts on this host. Run /rc:login to retry; if it repeats, file an issue. No credentials were saved.";
  }
  return " Could not persist credentials locally — no credentials were saved. Run /rc:login to retry.";
}
```

And the append site at `src/login.ts:578-583` becomes:

```ts
let line = loginEnglishFor("login.failure.storageFailed");
if (process.platform === "win32") line += windowsStorageNotice(saved);
print(deps, line);
```

Two precision moves inside the `acl_failed` sentence, both
grounded:

- Dropped the all-caps "READ the README caveat" the old notice
  had. After this card the README *is no longer a caveat* —
  telling a user to READ it for protection info is a one-way
  ratchet that survives the goal flipping. Replaced by "file an
  issue", which closes the loop on a class of bugs that a single
  retry does not fix.

- "may be readable by other accounts on this host" is the
  precision a Windows user needs; "not user-only protected" is
  fuzzier and easier to misread as "the protection is documented
  but not enforced."

### `README.md` (Credential storage section, lines 69-77)

> ## Credential storage
>
> The OAuth2 enrollment credential lives in a dedicated JSON file
> at `<configDir>/pi-remote/credentials.json`, serializing the
> `piRemote.*` keys (server URL, access token, refresh token,
> token expiry, tenant id). User-only readability is enforced on
> POSIX by a mode-0600 file, written atomically via
> tmp+fsync+rename, and on Windows by an NTFS access-control
> list denying read to non-owner (the `pi-remote` extension
> applies and verifies the ACL on every write). A failed flow
> writes nothing half-written; re-running `/rc:login` replaces
> the stored credential cleanly. If the ACL could not be applied
> or verified, `/rc:login` does not report success and tells you
> so.

Two precision moves inside that paragraph:

- "denying read to non-owner" instead of "restricts read access
  to the current user." The verdict the card accepts is the NTFS
  ACL; phrasing as "denying read to non-owner" matches what
  `icacls` and the Win32 security descriptor actually say, which
  is what someone running `icacls <path>` after install will see.
- "the `pi-remote` extension applies and verifies the ACL on
  every write." That second clause is what makes the README
  statement testable: the verification is what the acceptance
  criterion calls for, and saying so in the README is what flips
  the wording from "documented limitation" to "enforced
  guarantee." It also seeds the next subsection if the
  verification step ever fails silently.

## Falsifiable predictions

1. **A user reading the new README who has never seen the old one
   concludes "this is safe on Windows."** Falsifier: a cold-read
   test with a Windows-fluent external reader, given only the new
   paragraph and no prior context, asked "is my saved credential
   protected from other users on this host?" If they answer "I
   don't know" or "only the README says so", the wording is still
   in caveat-territory.

2. **A user who hits `/rc:login` on Windows with a successful
   enrollment does not see a Windows-specific line on the success
   path.** Falsifier: a trace capture of the storage-failed path
   on a successful Windows login, asserting no Windows notice is
   appended to the success row.

3. **A user who hits `/rc:login` on Windows where the ACL call
   failed reads the appended notice and understands (a) the file
   may not exist, (b) if it exists it may be readable by other
   users, (c) what to do next.** Falsifier: replace the notice
   with the new `acl_failed` string in isolation (no surrounding
   context) and ask a reader what they would do; if their action
   is "delete the file" or "ignore and continue", the notice is
   underspecified.

4. **No Windows user reads "README caveat" anywhere in the new
   copy.** Falsifier: grep across `src/login.ts`, `README.md`,
   and the new `acl_failed` string for the substring "README
   caveat"; if it appears, the old caution-handle has survived
   the goal flip and needs removing.

5. **A Windows user who only ever reads the success line learns
   nothing about ACL enforcement.** Predicted, not a bug. The
   alternative — appending an always-on reassurance to the
   success line — has its own conceptual-model cost (a copy
   string that promises something the user can't verify is a
   future-credibility liability). This is a hypothesis for
   product-owner review: if the product seat wants the success
   line to acknowledge protection, that's a card-level decision,
   not a copy edit.

## Open judgments (not settled by the position)

- Whether `WriteResult` should grow an `acl_failed` reason, or
  whether `platform_acl_not_supported` can be repurposed. The
  string I wrote assumes a new reason; if the implementation
  reuses `platform_acl_not_supported`, the conditional notice has
  nothing to branch on and the user cannot distinguish "write
  fine, ACL bad" from "write fine, chmod no-op" — which is the
  exact ambiguity the card aims to retire. This is a single-line
  type decision the deliberation must own; the copy argument
  depends on it.
- Whether the success line on Windows should ever acknowledge
  the ACL. I predict it should not, on conceptual-model grounds,
  but this is a taste judgment that product-owner and owner
  should rule on. The card as written does not require it.
- Whether "file an issue" is the right exit for an unrecoverable
  ACL failure. Acceptable alternatives: print a `KNOWN_ISSUE` key
  the runner can grep for; print the exact error from the ACL
  call into the next-available log channel; or silently fall
  through to success and rely on a future audit. "File an issue"
  forces a human to a decision point rather than burying the
  failure — taste-call, may be overruled.

## Where this position is ungrounded (preferences, ranked last)

- The exact wording "may be readable by other accounts on this
  host" vs "may be readable by other user accounts on this host"
  vs "may be readable by anyone else on this host" — I picked
  "by other accounts" because it carries "user" already in the
  noun and reads as cleanly technical. Pure taste.
- The decision to remove "READ the README caveat" entirely
  rather than rephrase it. The reroute-to-issue-report puts a
  burden on the user that re-READing the README does not. I
  prefer this because the README is not a remediation channel;
  someone running the same ACL failure twice needs *human*
  attention, not *document* attention. Taste, and rank-low.
- Whether the prose "If the ACL could not be applied or verified,
  `/rc:login` does not report success and tells you so" belongs
  in the README paragraph or as a `> Note:` blockquote. I put
  it inline because the first sentence (positive) and the
  negative condition should travel together; if the council
  prefers a quote-block for visual separation, that is a one-
  line refactor. Taste.

## Inputs read

- `src/login.ts` — `WINDOWS_STORAGE_NOTICE` (lines 204-205),
  append site (lines 578-583); `login.failure.storageFailed` row
  in `FAILURE_ROWS`; non-failure copy table at `NON_FAILURE_ROWS`.
- `src/credential.ts` — `WriteResult` type (line 58); POSIX
  chmod/no-op split (lines 84-113); reason `platform_acl_not_supported`.
- `test/login.test.ts` — vocabulary constant test (line 314) and
  surrounding grep-guard expectations; happy-path attended test
  (lines 309-322) confirming the success line is what a user sees
  on a good Windows login.
- `README.md` — Credential storage section (lines 69-77).
- `docs/PI-SPEC.md` §7.2 — the prose parallel to the README.
- `council/cards/FLLWUP-7.md` — the card itself.
- `council/cards/EV-7.md` — J3 close context.
- `vault/raw/2026-08-31-po-ev7-ruling.md` — binding ruling J3.
- `vault/raw/2026-08-31-design-ev7-login-terminal-surface-r2.md`
  — established copy vocabulary (spec §1.2) for the 13 closed
  failure rows; the invariant "every row ends with one of: `no
  credentials were saved.`, `run /rc:login`, or `check the URL
  with your control-plane admin`" is preserved by the new copy.
