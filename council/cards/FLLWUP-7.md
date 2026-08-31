---
id: FLLWUP-7
title: "EV-7 Windows ACL for credential-file user-only readability"
state: Backlog
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
