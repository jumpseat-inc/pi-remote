---
id: FLLWUP-10
title: "Sync spec §8 /rc:login row with the while-live refusal"
state: Ready
owner: null
epic: EPIC-1
goal: docs/PI-SPEC.md §8's /rc:login row names the while-live refusal ("close the tunnel first with /rc:off") so the spec agrees with the shipped implementation and README copy.
---

## Intent

Filed from FLLWUP-1's step 13. The while-live refusal is a binding
product-owner ruling (EV-8 J5: `/rc:login` while the tunnel is live, dialing,
resyncing, authorizing, or error is refused with a single stated sentence —
"close the tunnel first with /rc:off" — the driver enters only from `off` and
`not enrolled`). The merged implementation and README both carry it; §8's
`/rc:login` row never gained it, leaving the spec behind the shipped behavior
it governs. Docs-only, one row. User-visible surface — the spec's command
table, the contract surface client and host operators read.

## Acceptance

- §8's `/rc:login` row states the while-live refusal with the exact remedy
  copy ("close the tunnel first with /rc:off"), matching the J5 ruling and
  the README register.
- No other §8 row or section changes; the seven-state set is untouched.
- grep consistency: README.md, src/login.ts (or index.ts), and §8 all carry
  the same refusal semantics.
- Docs-only PR — gates stay green (tsc exit 0, bun test 155 pass).
