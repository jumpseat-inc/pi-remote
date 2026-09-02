---
title: tunnel.ts
type: entity
summary: The control-plane REST client — Bearer-authenticated POST /tunnels, RFC 8414 discovery with refresh, and the key-based reason→message copy table with severity tags.
aliases: [the tunnel client]
tags: [entity/module, tunnel, copy]
sources: ["[[EV-2 Ruling]]", "[[EV-7 Ruling]]", "[[EV-8 Ruling]]", "[[RFC Conformance Posture]]"]
created: 2026-09-02
updated: 2026-09-02
---
The other network module (§7.2 client half). Creates tunnels via Bearer-authenticated `POST /tunnels` (returns `{tunnelId, url, tokenTtl}` — one-time signed wss URL), deletes via `DELETE /tunnels/:id`, discovery per RFC 8414 with `authorization_endpoint`/`token_endpoint`/`device_authorization_endpoint` required, refresh as `grant_type=refresh_token` (no separate /refresh), discovery cache not module-level state. `createTunnel` is 401-terminal by design — the credential-terminality seam of [[Retry Policy]].

**Refresh primitive (FLLWUP-18, PR #29 — RFC Conformance Posture):** `refreshAccessToken` sends `application/x-www-form-urlencoded` (URLSearchParams body) per RFC 6749 §2.3.1, replacing the earlier JSON body that had been aligned to the client — spec §2.4 amended in the same PR, client and spec RFC-conformant together.

Copy lives here per EV-2 Item 2: a reason→`{footerState, userLine, severity}` map with stable keys and English defaults, unit-testable without rendering. `ALREADY_LIVE_COPY` is the one remaining verbatim-ruled literal (keying deferred to FLLWUP-17). Severity tags feed [[Footer Merge Policy]]; `TunnelError` kinds are distinct for 401 (`enrollment_expired`) and 403 (`enrollment_rejected`) with ruling-fixed remedy copy (EV-2 Item 1: /rc:login + admin clause).

## Related
[[Stable Keys]], [[Copy Honesty Doctrine]], [[Retry Policy]], [[Footer Merge Policy]], [[login.ts]]

## Sources
[[EV-2 Ruling]], [[EV-7 Ruling]], [[EV-8 Ruling]]
