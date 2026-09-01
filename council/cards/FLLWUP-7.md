---
id: FLLWUP-7
title: "EV-7 Windows ACL for credential-file user-only readability"
state: Deliberating
owner: null
epic: EPIC-1
goal: On Windows, the pi-remote credential file at the agent config path is readable only by the host user, enforced via an NTFS ACL rather than the no-op chmod, closing the gap EV-7 documented.
---

## Intent

Filed from EV-7's close per the binding product-owner ruling J3: EV-7 shipped
POSIX 0600 (tmp+fsync+rename, asserted `mode & 0o777 === 0o600`) plus a
documented Windows caveat — on Windows `fs.chmod` is a no-op and the
credential file is readable by other users with profile-directory access. The
security goal is not relaxed, but it is unmet on Windows today, and the user
is told. This card closes that gap. Post-epic scope — the primary fleet is
POSIX; Backlog keeps it from the epic's delivery loop. User-visible surface —
the Windows caveat in the README credential-storage section and the stateful
notice in storage-failed copy (`process.platform === "win32"`) both flip from
"limitation" to "resolved" when this lands.

## Acceptance

- The credential file on Windows carries an NTFS ACL restricting read access
  to the current user (icacls or the Win32 security API — the deliberation
  picks), verified by a test that reads the ACL back.
- The POSIX path is unchanged: 0600 via tmp+fsync+rename, existing gate stays
  green.
- The README caveat and the win32 storage-failed notice are updated to state
  the protection is enforced, not merely documented.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.

## Deliberation record

### Round 1 — independent first pass (owner, principal, designer)

**Design note:** vault/wiki has no pages covering credential storage or Windows ACLs (index is empty) — wiki grounding unavailable for this card.

**owner (verbatim):**

Grounding: `src/credential.ts` currently short-circuits win32 after rename and unconditionally returns `{ ok: false, reason: "platform_acl_not_supported" }` (lines ~105–108); `src/login.ts`'s `finalizeSuccess` appends `WINDOWS_STORAGE_NOTICE` ("this platform does not enforce…") only when `process.platform === "win32"`; the README caveat is in the "Credential storage" section; the gates workflow (`.github/workflows/gates.yml`) runs only `ubuntu-latest` — **there is no `docs/gates/GATE-EVIDENCE.md` in this repo**, so the workflow file is the authoritative gate record, and it never executes a single line of Windows code today. The wiki (`vault/wiki/index.md`) is empty of relevant pages, confirming the card's note.

Mechanism: **icacls subprocess, not a Win32 security API dependency.** The Win32 route (SetNamedSecurityInfoW via a native dep or `Bun.ffi` against advapi32) means a new runtime dependency or ~100 lines of hand-rolled SECURITY_DESCRIPTOR construction to protect one JSON file — the failure mode of getting the DACL slightly wrong is silently locking the *owner* out, which is worse than the current documented gap. `icacls` ships on every supported Windows release, is one `spawnSync` call, and is independently inspectable (`icacls <file>` is exactly what our test reads back). Risks of icacls are bounded and handleable: localization (mitigate by granting on the user SID — `*S-1-…` — which icacls accepts), FAT/exFAT volumes with no ACL support, and EDR interference — all of which should map to a storage failure, not a silent success.

Write-path change: apply the ACL to the **tmp file before rename**, mirroring the existing POSIX `chmodSync(tmp, 0o600)` placement. This is the load-bearing detail: the ACL travels through the rename, so there is zero window where the target exists world-readable, and POSIX behavior is untouched. `process.platform === "win32"` branch becomes: `spawnSync("icacls", [tmp, "/inheritance:r", "/grant:r", `*${userSid}:F`])` — `/inheritance:r` strips inherited ACEs (otherwise "Users" keeps read via inheritance no matter what you grant), then non-zero exit or missing SID ⇒ `rmSync(tmp)` + `{ ok: false, reason: "platform_acl_not_supported" }`; success ⇒ `{ ok: true }`. The unconditional post-rename win32 `ok: false` must be deleted. The user SID is obtainable without a dependency: `whoami /user` parse, or (`process.env.USERNAME` + computer SID via `whoami /user /fo csv`). The `WriteResult` reason string stays as-is — it's internal-only, and existing tests already reference it.

The honest ACL test — this is where the card's acceptance criterion meets reality: CI is `ubuntu-latest`, so a Windows-only test never runs in CI, and a test that never runs is the same "documented, not enforced" posture EV-7 took, dressed up. The only honest reading of "verified by a test that reads the ACL back" is **adding a `windows-latest` job to gates.yml** running `bun test test/credential.test.ts` (scoped, so unrelated POSIX-flavored tests can't block the gate). The test itself: `saveCredential`, then `spawnSync("icacls", [path])`, assert (a) no `(<I>)` inherited marker in output, (b) no `Everyone`/`Users`/`Authenticated Users` ACE, (c) the current user appears as a grant entry. Guard with `test.skipIf(process.platform !== "win32")` so the POSIX suite is unaffected; on Linux it's a no-op, on the new Windows job it's the actual gate.

Copy changes: `WINDOWS_STORAGE_NOTICE` should survive but flip meaning — from "does not enforce" to "could not be enforced on this host" — because after this card, the *failure* path on Windows means ACL application failed (EDR, FAT volume, icacls missing), which is now an abnormal condition worth a sharper sentence. Success on Windows prints the same success line as POSIX. README flips to: "On Windows, user-only readability is enforced via an NTFS ACL applied by icacls; inherited permissions are stripped." The "platform_acl_not_supported" comment blocks in `credential.ts` need the same flip.

Tradeoffs accepted:

- CI cost and flakiness of a windows-latest job, scoped to one test file to contain blast radius — this is the price of the acceptance criterion being verifiable rather than aspirational.
- Subprocess dependency on `icacls` instead of in-process API — accept failure→storage-failure semantics rather than adding a native dep for one call.
- `icacls` output parsing in the test is locale-fragile on non-English Windows; accepted because assertions are on structural markers (`(<I>)`, absence of well-known accounts) plus the username, not localized phrases.
- If the council rejects a Windows CI job, the fallback test (`skipIf` on non-win32) is only honest if we *say in the README that CI does not exercise it* — I'd rather not ship that asterisk.

Testable claims:

1. Current code: on any platform, `saveCredential` on win32 returns `{ok:false}` *after successfully writing the file* — i.e., credentials are persisted and the user is told storage failed, which is itself a UX bug this card should fix. Test: on win32, after `ok:false`, `existsSync(credentialPath(deps))` is `true` (today: true — surprising; after the fix with successful icacls: `ok:true`).
2. ACL pre-rename placement: a test asserting `icacls <target>` shows no `(<I>)` after `saveCredential` would fail on a design that ACLs the target *after* rename only if the rename window is hit — but deterministically, `/inheritance:r` on tmp guarantees the renamed file has zero inherited ACEs; the read-back test proves the observable claim either way.
3. POSIX invariance: existing test 13 (`mode & 0o777 === 0o600`) must stay green untouched; any patch touching the `process.platform !== "win32"` branch is out of scope for this card.

Recommended design:

- **icacls subprocess** on the tmp file *before* rename: `icacls <tmp> /inheritance:r /grant:r "*<userSID>:F"`; failure ⇒ delete tmp, return `platform_acl_not_supported`; success ⇒ `ok: true`. Delete the unconditional win32 `ok:false`.
- **Add a windows-latest job** to `.github/workflows/gates.yml` running `bun test test/credential.test.ts`; add a `skipIf(!win32)` test that runs `icacls <file>` and asserts no inherited ACEs and no Everyone/Users grants, current user present.
- **Copy flip:** README "enforced via NTFS ACL"; `WINDOWS_STORAGE_NOTICE` → "could not be enforced on this host" (failure path only); update the two J3 comment blocks in `credential.ts`.
- **SID acquisition** without a dependency: parse `whoami /user /fo csv`; treat any failure as ACL failure (storage failure), never fall back to an unprotected write.
- **No POSIX changes** — the `chmodSync`/0600 path and its test are frozen by this card.

**principal (verbatim):**

## Cross-seam reading

The contract that actually exists is not the one the card assumes. Three files encode the Windows caveat three different ways, and only one of them is the source of truth:

- **`src/credential.ts:57-58`** — `WriteResult = { ok: true } | { ok: false; reason: "platform_acl_not_supported" | "io_error" }`.
- **`src/credential.ts:111-114`** — on win32, `writeAtomic` has already `rename`d the credential into place, then returns `{ ok: false, reason: "platform_acl_not_supported" }`. The file is *fully written and persisted*; the result then claims it wasn't.
- **`src/login.ts:204-205`** — `WINDOWS_STORAGE_NOTICE` describes a *permanent* platform flaw ("this platform does not enforce user-only file permissions").
- **`src/login.ts:581`** — the notice is keyed on `process.platform === "win32"`, *not* on `saved.reason`. So the copy is driven by the platform, while the failure semantics are driven by an enum value whose meaning this card changes.

The seam risk is concrete: `WriteResult.reason` and the platform check are two independent encodings of the same caveat, and the one the user sees (`login.ts:581`) is keyed to the dimension that stops being meaningful once this lands. Today, on Windows, `saveCredential` returns `{ok:false}` while `readCredential` then succeeds — the "a failed flow writes nothing half-written" guarantee is currently false on win32 (it writes *completely*, then reports failure). The card's own gate file `docs/gates/GATE-EVIDENCE.md` does not exist (`find`/`read` both fail); the real gate is `.github/workflows/gates.yml`, `runs-on: ubuntu-latest`, no Windows runner. The "reads the ACL back" test therefore cannot be CI-green on current infra.

(`README.md` "Credential storage" block and `docs/PI-SPEC.md:311` both restate the win32 no-op caveat; both must flip.)

## Blind spots

- **Import/data vantage (`src/credential.ts`):** cannot see that its `{ok:false}` return is already a lie on win32 — the renderer prints "No credentials were saved" while the tokens are on disk. The person inside the store sees `platform_acl_not_supported` as a *clean enum*, not as "I persisted a secret and told the user I didn't."
- **Frontend/copy vantage (`src/login.ts`):** cannot see that keying the notice on `process.platform` instead of `saved.reason` will silently stop firing the notice *at all* the moment Windows starts returning `{ok:true}` — but will *still* fire it, wrongly, for any future win32 `io_error`. The two sides each assume the other owns the "what does failure mean here" decision.

## Reframe

The card is framed as "pick a Windows ACL mechanism." The seam worth owning is that **`WriteResult` must stop encoding "written-but-unprotected" as a success-shaped outcome.** Reframe: on any platform, `{ok:true}` means "persisted *and* user-only-protected," and `{ok:false}` means "nothing was left on disk." That forces the ACL to be applied to the temp file *before* rename (before any credential byte sits at the stable path), and forces fail-closed on ACL failure. This is not just copy-flipping; it's a correction to a contract that is currently self-contradictory.

Mechanism answer, for clarity: **icacls subprocess, no new dependency.** The runtime is Bun-only (`Bun.serve` is already embedded in `login.ts`), so `Bun.spawnSync` is in-scope; `icacls.exe` ships on every supported Windows since Vista. A native NTFS dependency is supply-chain + build bloat injected into a security-sensitive path for a ~3-line task — reject it. PowerShell `Set-Acl` buys nothing over icacls for *setting*; PowerShell is only the right tool for the *read-back test* (its SDDL output is locale-independent, icacls' human output is not).

## Testable claims

1. **Contract contradiction is real and currently green-lit by accident.** Falsifiable today on Windows: `saveCredential(cred, {configDir})` returns `{ok:false}` yet `readCredential({configDir})` returns `cred` with both tokens. Test to write: *on any platform*, `{ok:false} ⇒ readCredential() === null` (nothing left on disk). This is the fail-closed assertion, and it is testable on ubuntu CI via an injectable ACL-applier seam whose fake returns non-zero exit.
2. **`(R,W)` is not enough.** Granting read+write without delete breaks the *second* login, because `renameSync` over an existing target needs `DELETE`/`FILE_DELETE_CHILD`. The grant must be Modify (`(M)` = read/write/execute/delete). Falsifiable: `icacls <file> /inheritance:r /grant:r <owner>:(R,W)` then attempt to replace the file — fails EACCES on Windows.
3. **The argv is the unit-under-test on ubuntu.** Extract a pure `buildWindowsAclArgv(tmp)` and an injectable `applyWindowsAcl(tmp, exec)`. CI (ubuntu) can assert the exact vector `["icacls", tmp, "/inheritance:r", "/grant:r", "<owner>:(M)"]` and that a non-zero exit maps to `{ok:false, reason:"acl_enforcement_failed"}` with the tmp removed. The actual read-back (locales vary; icacls output is human-text) belongs in a `process.platform === "win32"`-gated test (`test.runIf`/skip-guard) and goes in the gate evidence as "requires Windows/manual run," not silently skipped-as-green.

## Risks

- **Non-NTFS/network volumes** (FAT32, exFAT, some UNC): icacls exits non-zero → fail closed. Right choice, but it converts a today-succeeds enrollment into a hard failure for those users; the notice copy must say "protection couldn't be applied, nothing saved," not "unsupported platform."
- **Grantee resolution** locally varies for AzureAD/domain/MSA accounts. Prefer granting by SID (`*<sid>:(M)`, resolved once via a single PowerShell read of `WindowsIdentity::GetCurrent().User.Value`), falling back to `%USERNAME%`. `*S-1-3-4` (OWNER RIGHTS) is the zero-subprocess ideal but was not confirmed accepted by icacls in my verification — validate on a Windows box before committing to it.
- **Do not strip the directory.** Only the credential *file* gets `/inheritance:r`. Stripping `pi-remote/` would break tmp-file creation and rename on re-enrollment.

## Recommended design

- **Mechanism:** icacls subprocess via `Bun.spawnSync`; grant `icacls <tmp> /inheritance:r /grant:r <owner-SID>:(M)` (Modify, so re-enrollment's atomic replace still works); no new dependency.
- **Write path:** open tmp → apply ACL to the empty tmp (before writing credential bytes, mirroring the POSIX `0600 at open` invariant) → write → fsync → rename. On non-zero icacls exit, `rmSync(tmp)` and return failure *without renaming*.
- **Contract:** change `WriteResult` to `{ ok: true } | { ok: false; reason: "io_error" | "acl_enforcement_failed" }`; drop `platform_acl_not_supported`; `{ok:true}` now means "persisted and protected" on both platforms; `{ok:false} ⇒ no file left`.
- **Copy:** `login.ts:581` keys the notice on `saved.reason === "acl_enforcement_failed"` (not `process.platform`); the notice text changes from "this platform does not enforce…" to "…could not apply user-only protection, so nothing was saved." Update the `login.ts` docstring, `README.md` Credential-storage block, and `PI-SPEC.md §7.2` (AGENTS.md requires the spec stay in sync).
- **Tests:** CI keeps the POSIX 0600 gate green; add (a) fail-closed unit test via fake ACL executor asserting `ok:false ⇒ readCredential()===null`, (b) exact-argv test for the icacls vector, both ubuntu-runnable; (c) the real ACL read-back test gated `process.platform === "win32"` and documented as Windows-manual in the gate evidence.
- **Flag the stale reference:** `docs/gates/GATE-EVIDENCE.md` doesn't exist; the gate living in `.github/workflows/gates.yml` (ubuntu-latest) is why the read-back test provably cannot run in CI — the acceptance's "verified by a test that reads the ACL back" must be worded as "gated to win32 and recorded as manual," not presented as a green CI check.

**designer (verbatim):**

Position written to `vault/raw/2026-08-31-design-fllwup-7-windows-storage-notice.md`. Summary:

- **Design position.** The Windows caveat flips from "limitation" to "resolved" only if the copy becomes conditional — one state for "ACL succeeded" (say nothing; the success line stands), a different state for "ACL failed or could not be verified" (be explicit that the file may exist without user-only protection, and that no credentials were saved). Today the notice is single-state and only fires on `storageFailed`; tomorrow the same row must do duty for both "atomic write failed" and "ACL applied then failed verification", because the credential writer returns a `WriteResult` and `login.ts` collapses its reasons into `storageFailed`. The smallest change is to split the notice into a single conditional string gated on a new `acl_failed` reason in `WriteResult`.
- **Gulf closed.** Gulf of Evaluation, for a Windows user in the `storageFailed` moment.
- **Principle and evidence.** Signifier sized to consequence (current `WINDOWS_STORAGE_NOTICE` at `src/login.ts:204-205` collapses multiple failure shapes into one platform-level claim that is about to become false); knowledge in the world (README caveat at `README.md:69-77` is the only pre-`/rc:login` source); conceptual-model honesty (the guarantee is per-file, not disk-wide); constraint + forcing function (the type at `src/credential.ts:58` needs a new reason so the conditional notice can fire).
- **Falsifiable predictions.** (1) A cold reader of the new README concludes "this is safe on Windows" — falsifier: cold-read test with no prior context. (2) A successful Windows `/rc:login` shows no Windows-specific line on the success path — falsifier: trace capture of the storage-failed path on success. (3) A user who hits the `acl_failed` branch understands (a) file may not exist, (b) if it exists it may be readable by other users, (c) what to do next — falsifier: out-of-context read of just the new sentence. (4) "README caveat" no longer appears anywhere in the new copy — falsifier: grep across `src/login.ts`, `README.md`, and the new string. (5) A user who only reads the success line learns nothing about ACL enforcement — predicted, not a bug; flagged for product-owner review as a card-level decision if the surface ever grows.
- **Preferences, ranked last.** Wording on the `acl_failed` noun phrase ("by other accounts" vs alternatives); the decision to remove "READ the README caveat" entirely rather than rephrase it (I prefer routing to issue-report because the README is not a remediation channel; rank-low); whether the negative ACL-failed clause in the README is inline prose or a blockquote.

Three open judgments surfaced for `product-owner` and `owner`: (a) whether `WriteResult` grows an `acl_failed` reason or reuses `platform_acl_not_supported`; (b) whether the Windows success line should ever acknowledge the ACL; (c) whether "file an issue" is the right exit or should be a `KNOWN_ISSUE` key / log channel. These are not settled by copy alone.
