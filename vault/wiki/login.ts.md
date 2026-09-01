---
title: login.ts
type: entity
summary: The /rc:login OAuth2 drivers — PKCE loopback for attended, RFC 8628 device flow for headless — with the replacement-prompt gate living at the driver.
aliases: [the login drivers]
tags: [entity/module, login]
sources: ["[[EV-7 Ruling]]", "[[FLLWUP-5 Ruling]]", "[[EV-8 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Pure drivers implementing EV-1's pinned contract: attended = Authorization Code + PKCE (public client, loopback `http://127.0.0.1:<ephemeral>/callback`); unattended = `/rc:login --headless` on the RFC 8628 device flow (prints `user_code` + `verification_uri_complete`, honors `interval`/`slow_down`/`authorization_pending`/`expired_token`/`access_denied`). RFC 8414 discovery with three required endpoints; refresh via `grant_type=refresh_token`.

Ruling-shaped behavior: the replacement prompt (re-run while enrolled) renders and waits **at the driver, before any HTTP request** (Skeptic-assertable via request log), never in `--headless`; the success line conditionally appends ` (tenant <tenantId>)` only when the token carries a tenant-scoped `sub`; `LoginOutcome` carries the typed `acl_enforcement_failed` reason rendered per FLLWUP-7's ruled copy (host cause + nothing-saved + "Run /rc:login" — no "file an issue"). Copy resolves through `loginEnglishFor` — no bypass, no second vocabulary (EV-7 general rule).

## Related
[[Copy Honesty Doctrine]], [[credential.ts]], [[Stable Keys]], [[Seven Footer States]], [[tunnel.ts]]

## Sources
[[EV-7 Ruling]], [[FLLWUP-5 Ruling]], [[EV-8 Ruling]]
