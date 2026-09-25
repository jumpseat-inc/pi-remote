---
id: FLLWUP-42
title: "Fix src/copy.ts's section comment that still says \"exactly the 22 settled keys\" after EV-15's 21-key landing"
state: Backlog
owner: null
epic: EPIC-7
goal: The section comment above `indonesianCopy` in `src/copy.ts` (~line 49) still reads "exactly the 22 settled keys" while the module header's COVERAGE BOUNDARY paragraph (line 11) states 21 after EV-15's `rc.serverUrlRequired` removal; the comment is corrected so the two statements agree, with no other content change.
---

## Intent

Filed from EV-15's step 13, held in-container by draft title, then confirmed
`File` by a `product-owner` ruling (job-15). Recorded disposition, verbatim:

> Mode: File — Verified in the working tree: `src/copy.ts:49` still reads
> "exactly the 22 settled keys" while the updated header (line 11) states
> 21. The comment is now factually false. The fix is small, mechanical, and
> fully specified. The draft title is accurate as written; no amendment.

EV-15 removed `rc.serverUrlRequired`'s id row, landing `indonesianCopy` at
21 keys and updating the header's COVERAGE BOUNDARY paragraph — but the
divider-comment above the overlay table was missed. Verified in the working
tree at main `da427ca`: the section comment still says "exactly the 22
settled keys, all non-empty." Comment-only correction; no key changes, no
assertion changes, no behavior change.

## Acceptance

1. The section comment above `indonesianCopy` states the actual key count
   (21), consistent with the header's COVERAGE BOUNDARY paragraph.
2. No other line of `src/copy.ts` changes; `test/copy.test.ts` is
   untouched and green.
3. `bunx tsc --noEmit` clean; `bun test` passes (the Windows-gated
   credential-ACL skip is the only expected non-pass).
