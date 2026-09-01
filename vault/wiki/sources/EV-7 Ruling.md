---
title: EV-7 Ruling
type: source
summary: Product-owner ruling on login copy and storage — conditional tenant display, confirm-before-replace gated at the driver, and POSIX 0600 with an honest Windows caveat.
aliases: [EV-7 Open-Judgment Rulings]
tags: [council/ruling, login, credentials, windows]
sources: ["[[EV-7 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Three rulings on EV-7 (2026-08-31). **J1** — the success line appends ` (tenant <tenantId>)` only when the token carries a tenant-scoped `sub`; tenantId is a best-effort unverified decode, never an authority decision. **J2** — re-run while enrolled confirms before any HTTP request (Enter continues, Ctrl-C aborts silently); the prompt lives at the driver, not the command handler, and is never shown in `--headless`. "Replaces the previous credential cleanly" reads as atomicity (tmp+fsync+rename), not silence. **J3** — POSIX 0600 plus a documented Windows caveat; "user-only readability" means the platform's canonical mechanism, and the Windows-ACL follow-up was flagged at close (became FLLWUP-7, delivered as PR #17). Also bound the five-point general rule for EV-8 (no glyph acks, no bypass of the copy lookup, driver-side prompt gate, authorizing→off transitions, no second copy vocabulary).

## Related
[[Copy Honesty Doctrine]], [[login.ts]], [[credential.ts]], [[Stable Keys]], [[FLLWUP-7 Design Position r2]]

## Sources
`vault/raw/2026-08-31-po-ev7-ruling.md`
