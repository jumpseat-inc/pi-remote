---
title: login.ts
type: entity
summary: The /rc:login OAuth2 drivers — PKCE loopback for attended, RFC 8628 device flow for headless — with the replacement-prompt gate living at the driver.
aliases: [the login drivers]
tags: [entity/module, login]
sources: ["[[EV-7 Ruling]]", "[[FLLWUP-5 Ruling]]", "[[EV-8 Ruling]]", "[[RFC Conformance Posture]]"]
created: 2026-09-02
updated: 2026-09-02
---
Pure drivers implementing EV-1's pinned contract: attended = Authorization Code + PKCE (public client, loopback `http://127.0.0.1:<ephemeral>/callback`); unattended = `/rc:login --headless` on the RFC 8628 device flow (prints `user_code` + `verification_uri_complete`, honors `interval`/`slow_down`/`authorization_pending`/`expired_token`/`access_denied`). RFC 8414 discovery with three required endpoints; refresh via `grant_type=refresh_token`.

**Device-flow poll contract (FLLWUP-22, PR #26 — RFC Conformance Posture).** The headless driver's poll loop parses the response body **before** the status gate and dispatches the four RFC 8628 codes on 2xx-or-400 alike: `authorization_pending` and `slow_down` continue polling, `access_denied` and `expired_token` terminate with their own outcomes; all other non-2xx → `tokenExchangeFailed`. The 2xx-with-error-field shape remains a pinned tolerated legacy form. Three polish items are carded Backlog: RFC 8628 §3.2 connection-failure slowdown (FLLWUP-24), surfacing `error_description` (FLLWUP-25, needs a copy ruling), 5xx retry reconsideration (declined — the settled no-retry stance is on FLLWUP-22's record).

Ruling-shaped behavior: the replacement prompt (re-run while enrolled) renders and waits **at the driver, before any HTTP request** (Skeptic-assertable via request log), never in `--headless`; the success line conditionally appends ` (tenant <tenantId>)` only when the token carries a tenant-scoped `sub`; `LoginOutcome` carries the typed `acl_enforcement_failed` reason rendered per FLLWUP-7's ruled copy (host cause + nothing-saved + "Run /rc:login" — no "file an issue"). Copy resolves through `loginEnglishFor` — no bypass, no second vocabulary (EV-7 general rule).

## Related
[[Copy Honesty Doctrine]], [[credential.ts]], [[Stable Keys]], [[Seven Footer States]], [[tunnel.ts]], [[RFC Conformance Posture]]

## Sources
[[EV-7 Ruling]], [[FLLWUP-5 Ruling]], [[EV-8 Ruling]]
