# FLLWUP-7 design — Windows ACL for credential-file user-only readability

Card: `council/cards/FLLWUP-7.md` (EPIC-1). This spec is the settled output of
the card's council deliberation (rounds 1–2 exchange, skeptic round 3,
consolidator round 4) plus the binding product-owner ruling on the remedy
clause. An owner reading only this file should reach exactly one design.

## 1. Contract change (`src/credential.ts`)

`WriteResult` becomes:

```ts
export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "io_error" | "acl_enforcement_failed" };
```

- `platform_acl_not_supported` is **retired** (skeptic closed-green: zero test
  references; the literal lives only in `src/credential.ts`).
- `{ ok: true }` now means **persisted AND user-only-protected**, on both
  platforms. `{ ok: false }` means **nothing was left on disk**.
- The unconditional post-rename win32 `return { ok: false, reason:
  "platform_acl_not_supported" }` is deleted — today it lies (the file is on
  disk and `readCredential` succeeds while the caller is told nothing was
  saved).
- The module docstring's "Windows (J3)" paragraph flips from documenting the
  gap to describing the enforced ACL and fail-closed semantics.

## 2. Windows write path — icacls, tmp before rename, fail-closed

Mechanism: `icacls` subprocess (`Bun.spawnSync`), **no new runtime
dependency**. On `process.platform === "win32"`, replacing the no-op-chmod
branch:

1. Resolve the current user's SID via `whoami /user /fo csv` (parse the SID
   column — it is never localized). Any failure to resolve ⇒ fail closed with
   `acl_enforcement_failed`. Never fall back to an unprotected write.
2. Open the tmp file (same naming as today), then **apply the ACL to the tmp
   before the credential bytes are written**, mirroring the POSIX
   0600-at-open invariant:
   `icacls <tmp> /inheritance:r /grant:r "*<userSid>:(M)"`.
   - `/inheritance:r` strips inherited ACEs (otherwise `Users` keeps read via
     inheritance regardless of the grant).
   - Grant `(M)` (Modify) — includes DELETE, so re-enrollment's
     rename-over-target keeps working; least-privilege over `:F`.
   - Grant by SID (`*S-1-…`), not by account name — icacls display-name
     parsing is locale-fragile.
3. Non-zero icacls exit, spawn failure, or missing `icacls` ⇒ `rmSync(tmp)`
   and return `{ ok: false, reason: "acl_enforcement_failed" }`. **Nothing is
   renamed** — zero window where the target exists unprotected.
4. Success ⇒ proceed to fsync/close/rename and return `{ ok: true }`.

**POSIX path is frozen by this card**: the `chmodSync(tmp, 0o600)` branch and
its J3 test stay untouched. Only the win32 branch changes. The directory's
inheritance is never stripped — only the credential *file* gets
`/inheritance:r`.

## 3. Injectable ACL executor seam (testability)

`StoreDeps` gains an optional seam so the fail-closed path is testable on
ubuntu:

```ts
export interface StoreDeps {
  configDir: string;
  /** Test seam: overrides the win32 icacls invocation. Defaults to the real spawner. */
  applyAcl?: (path: string) => { ok: true } | { ok: false };
}
```

- The default implementation on win32 resolves the SID and spawns icacls;
  on non-win32 the win32 branch never executes, so the default is never
  called there.
- The seam is threaded through `LoginDeps` as well (same optional
  `applyAcl`), and `finalizeSuccess` passes it into `saveCredential` —
  without this threading, the acl-failed notice path is unreachable on
  non-win32 (skeptic design-gap finding; principal's "same seam" claim was
  inaccurate and is corrected by this pin).
- `saveCredentialAsync` needs no signature change (it takes `StoreDeps`).

Export a pure argv builder so the exact vector is ubuntu-testable without
Windows:

```ts
export function buildWindowsAclArgv(tmp: string, userSid: string): string[]
// exactly [tmp, "/inheritance:r", "/grant:r", `*${userSid}:(M)`]
```

## 4. Copy changes (`src/login.ts`, README, PI-SPEC)

### Storage-failed notice (binding product-owner ruling)

The notice is keyed on `saved.reason === "acl_enforcement_failed"`, **not**
`process.platform === "win32"` (today's platform keying wrongly fires for a
future win32 `io_error` and dies entirely once win32 returns `{ ok: true }`).

`WINDOWS_STORAGE_NOTICE` is replaced by:

```ts
export const ACL_ENFORCEMENT_FAILED_NOTICE =
  " This host could not apply user-only protection to the credential file — the volume may not support NTFS ACLs, or security software blocked it — so nothing was saved. Run /rc:login to retry.";
```

Per the ruling: **no "file an issue" clause** — the failure conditions (EDR
interference, FAT/exFAT volume, missing icacls) are host-local and no
maintainer can apply an ACL on the user's machine; the typed
`acl_enforcement_failed` reason in `LoginOutcome`'s data already provides the
diagnostic trail. The cause clause must name the host (the sentence above
meets the ruling's bar; wording below that bar is implementation taste).
The two existing test references (`WINDOWS_STORAGE_NOTICE` at
`test/login.test.ts:15,314`) update to the new constant.

- `login.failure.storageFailed` row text unchanged; `LoginOutcome` reason
  stays `"storageFailed"`.
- `{ ok: false, reason: "io_error" }` renders the bare row, no tail.
- **Success line stays silent on all platforms** — no NTFS/icacls/ACL mention
  (settled in deliberation, all three seats converge).

### README "Credential storage" section

Replace the "on Windows `chmod` is a no-op, so the 0600
user-only-readability guarantee is not enforced there" clause with: on
Windows user-only readability is enforced via an NTFS ACL applied by icacls
(inherited permissions stripped) before the credential bytes are written;
if the ACL cannot be applied, nothing is saved.

### `docs/PI-SPEC.md` §7.2 "Credential storage" bullet

Same flip (AGENTS.md requires the spec stay in sync): drop "chmod is a
no-op / not portable / documented limitation", affirm the enforced NTFS ACL
with fail-closed semantics.

## 5. Tests

Ubuntu-runnable (the regression net):

1. **Fail-closed invariant**: injected executor returning failure ⇒
   `saveCredential` returns `{ ok: false, reason: "acl_enforcement_failed" }`,
   `readCredential(deps) === null`, `existsSync(credentialPath(deps)) ===
   false`, and no `*.tmp-*` file remains. Run with `process.platform`
   patched to `"win32"`.
2. **Exact argv**: `buildWindowsAclArgv(tmp, "S-1-5-21-…")` equals
   `["<tmp>", "/inheritance:r", "/grant:r", "*S-1-5-21-…:(M)"]`.
3. **Reason-keyed notice** (login tests, `process.platform` patched
   `"win32"` + fake executor injected via `LoginDeps`):
   `acl_enforcement_failed` ⇒ the storage-failed line renders with the
   notice tail; `io_error` ⇒ bare row, no tail. (Skeptic's closed-red on the
   darwin-framed formulation: the darwin framing is dropped — use the
   `win32 + io_error` route.)
4. **Notice string assertions**: contains `nothing was saved`, contains
   `Run /rc:login`; does NOT contain `file an issue`, `may be readable`,
   `other accounts`.
5. **Existing POSIX tests unchanged and green** — including the J3 0600 gate.

`process.platform` patch discipline (skeptic open-untested pin): every test
that patches `process.platform` must save the original and restore it in a
`finally`/`afterEach` — a leaked patch silently corrupts the existing
platform-guarded tests.

Windows-runtime (the acceptance proof):

6. **Read-back test** in `test/credential.test.ts`, guarded
   `test.skipIf(process.platform !== "win32")`: `saveCredential`, then read
   the ACL back and assert **locale-independently**:
   - via `icacls <file> /save <out>` (UTF-16LE with BOM — decode
     accordingly) in SDDL form: no inherited ACEs, no `S-1-1-0` (Everyone),
     no `S-1-5-32-545` (Users), no `S-1-5-11` (Authenticated Users); the
     current user's SID present as a grant. Never assert display-name
     substrings (`Everyone`/`Users` are localized on non-English Windows).
   - then re-enroll (second `saveCredential` over the existing file) and
     assert it still succeeds — settles the "(M) includes DELETE /
     rename-over-target" objection.

## 6. CI — `windows-latest` job (`.github/workflows/gates.yml`)

Add a second job to the existing `gates` workflow (keep the workflow `name:
gates` — the autonomous merge check keys on the workflow):

```yaml
  gates-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.4.0"
      - run: bun install --frozen-lockfile
      - name: Windows credential tests
        run: bun test test/credential.test.ts
```

Scoped to one file so POSIX-flavored tests can't block it. Prerequisite
adopted from the deliberation: guard the J3 POSIX-0600 assertion
(`test/credential.test.ts` "J3 mode gate") with
`test.skipIf(process.platform === "win32")` — NTFS yields `0o666`, and an
unguarded assertion would fail the very job meant to prove the ACL. The
windows job's log showing the read-back test **executing** (not skipped) is
the falsifier for the "Windows-manual" fallback posture EV-7 took.

## 7. Explicitly out of scope

- Any change to the POSIX write path or its tests beyond the skipIf guard
  placement (which is a test-guard change, not a behavior change).
- New runtime dependencies (native NTFS APIs, PowerShell deps).
- `*S-1-3-4` (OWNER RIGHTS) grants — stays out until validated on Windows.
- Stripping inheritance from the `pi-remote/` directory.
- Success-line copy on any platform.
