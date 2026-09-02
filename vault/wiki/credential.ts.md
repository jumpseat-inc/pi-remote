---
title: credential.ts
type: entity
summary: The 0600 tmp+fsync+rename credential store with Windows NTFS ACL enforcement and the fail-closed WriteResult contract.
aliases: [the credential store]
tags: [entity/module, credentials, windows]
sources: ["[[EV-7 Ruling]]", "[[FLLWUP-7 Design Position r2]]", "[[Win32 Test Timeout Convention]]"]
created: 2026-09-02
updated: 2026-09-02
---
Stores `{serverUrl, accessToken, refreshToken, tokenExpiry, tenantId}` (user-only readability). POSIX path: tmp file, fsync, atomic rename, mode 0600 (`mode & 0o777 === 0o600` is the standing gate). FLLWUP-7 (PR #17) added the Windows path: `icacls /inheritance:r /grant:r "*SID:(M)"` on the tmp file before the bytes are written, **fail-closed** — if the ACL cannot be applied, the tmp is deleted and nothing is saved. `WriteResult` is `{ok:true} | {ok:false, reason:"io_error"|"acl_enforcement_failed"}`; the `acl_enforcement_failed` notice states the host cause and "Run /rc:login to retry" (ruled copy — no "file an issue"). The real-Windows SDDL read-back proved the enforcement (`D:PAI(A;;FA;;;SY)(A;;FA;;;BA)(A;;0x1301bf;;;LA)`), and the test asserts the parsed semantic property (canonical SIDs, mask ⊇ Modify), not raw strings — the bounded fourth-verify-cycle lesson.

Known limits: on Windows the ACL test can only run on `gates-windows`. Its read-back test carries an explicit 30s per-test timeout per the [[Win32 Test Timeout Convention]] — the cold-start flake that motivated it (bun's 5s default killing a `powershell.exe` start) was observed twice in CI before the fix, and can no longer recur from timing.

## Related
[[Copy Honesty Doctrine]], [[Verify Cycle Cap]], [[Win32 Test Timeout Convention]], [[login.ts]], [[FLLWUP-7 Design Position r2]]

## Sources
[[EV-7 Ruling]], [[FLLWUP-7 Design Position r2]]
