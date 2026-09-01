---
title: FLLWUP-7 Design Position r2
type: source
summary: Designer round-2 position correcting round-1 under fail-closed semantics — WriteResult narrows, the notice becomes reason-keyed, and nothing-saved is stated honestly.
aliases: [FLLWUP-7 design position r2]
tags: [design, credentials, windows, copy]
sources: ["[[FLLWUP-7 Design Position r2]]"]
created: 2026-09-02
updated: 2026-09-02
---
Round-2 designer position (2026-09-01). What changed: round-1's copy claimed the credential was saved with reduced protection; **under fail-closed that sentence is false** — if the ACL fails, the tmp is deleted and nothing is saved. The position narrows `WriteResult` to `{ok:true} | {ok:false, reason:"io_error"|"acl_enforcement_failed"}`, makes the notice reason-keyed, and rewrites the README paragraph and the §7.2 credential-storage bullet. The shipped implementation (PR #17) follows this shape; the remaining remedy-clause question went to the product-owner ruling (no "file an issue"; cause + "Run /rc:login" retry).

## Related
[[Copy Honesty Doctrine]], [[credential.ts]], [[FLLWUP-7 Design Position r1]], [[EV-7 Ruling]]

## Sources
`vault/raw/2026-09-01-design-fllwup-7-r2.md`
