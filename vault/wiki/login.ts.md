---
title: login.ts
type: entity
summary: The /rc:login OAuth2 drivers — PKCE loopback for attended, RFC 8628 device flow for headless — with the replacement-prompt gate living at the driver.
aliases: [the login drivers]
tags: [entity/module, login]
sources: ["[[EV-7 Ruling]]", "[[FLLWUP-5 Ruling]]", "[[EV-8 Ruling]]", "[[RFC Conformance Posture]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]"]
created: 2026-09-02
updated: 2026-09-23
---
Pure drivers implementing EV-1's pinned contract: attended = Authorization Code + PKCE (public client, loopback `http://127.0.0.1:<ephemeral>/callback`); unattended = `/rc:login --headless` on the RFC 8628 device flow (prints `user_code` + `verification_uri_complete`, honors `interval`/`slow_down`/`authorization_pending`/`expired_token`/`access_denied`). RFC 8414 discovery with three required endpoints; refresh via `grant_type=refresh_token`.

**Device-flow poll contract (FLLWUP-22, PR #26 — RFC Conformance Posture).** The headless driver's poll loop parses the response body **before** the status gate and dispatches the four RFC 8628 codes on 2xx-or-400 alike: `authorization_pending` and `slow_down` continue polling, `access_denied` and `expired_token` terminate with their own outcomes; all other non-2xx → `tokenExchangeFailed`. The 2xx-with-error-field shape remains a pinned tolerated legacy form.

**Device-flow polish (FLLWUP-24/25, PRs #31/#32).** A connection-level poll failure (`fetch` throw) waits five seconds and re-polls instead of failing terminal `unreachable` — the directive is RFC 8628 **§3.5**, the five seconds §3.2's default minimum interval ([[RFC Conformance Posture]]). At window expiry the terminal outcome is **cause-distinguished** ([[Cause-Distinguished Expiry]]). The server's `error_description` surfaces on `tokenExchangeFailed` only, as an additive second line `login.failure.detail` (`Details from the server: \`<errorDescription>\``) through a ruled sanitizer; the four ruled rows are byte-identical ([[Copy Honesty Doctrine]]). The attended (PKCE) path emits no detail line. `/rc:login --headless` flag routing (BUG-1, PR #30) selects the device flow at the command surface ([[index.ts]]). A 5xx-retry reconsideration stays declined on FLLWUP-22's record.

Ruling-shaped behavior: the replacement prompt (re-run while enrolled) renders and waits **at the driver, before any HTTP request** (Skeptic-assertable via request log), never in `--headless`; the success line conditionally appends ` (tenant <tenantId>)` only when the token carries a tenant-scoped `sub`; `LoginOutcome` carries the typed `acl_enforcement_failed` reason rendered per FLLWUP-7's ruled copy (host cause + nothing-saved + "Run /rc:login" — no "file an issue"). Copy resolves through `loginEnglishFor` — no bypass, no second vocabulary (EV-7 general rule).

## Related
[[Copy Honesty Doctrine]], [[credential.ts]], [[Stable Keys]], [[Cause-Distinguished Expiry]], [[Seven Footer States]], [[tunnel.ts]], [[RFC Conformance Posture]], [[RFC References]]

## Sources
[[EV-7 Ruling]], [[FLLWUP-5 Ruling]], [[EV-8 Ruling]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]
