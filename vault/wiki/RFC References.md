---
title: RFC References
type: concept
summary: The four IETF RFCs the pi-remote system builds on — 2119 for normative language, 6749/8628 for the enrollment flows, 8414 for discovery — each with its role in the corpus.
aliases: [RFCs, RFC index]
tags: [concept/protocol, rfc]
sources: ["[[Server-Side Spec]]", "[[login.ts]]", "[[tunnel.ts]]", "[[RFC Conformance Posture]]"]
created: 2026-09-02
updated: 2026-09-02
---
The published RFCs the system builds on, and what each governs here:

- **[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)** — the normative keyword convention. The server spec's MUST/SHOULD/MAY vocabulary follows it, constrained by the [[Normativity Test]]: every keyword must name an observation point, and one-sided bounds are never normative.
- **[RFC 6749](https://www.rfc-editor.org/rfc/rfc6749)** — OAuth 2.0: the refresh flow (`grant_type=refresh_token` at token_endpoint, no separate /refresh), the `pi-remote:host`/`pi-remote:admin` scope model, and §2.3.1 form-encoding — the client and the server spec §2.4 were migrated to form-encoding together (FLLWUP-18), per the [[RFC Conformance Posture]].
- **[RFC 8628](https://www.rfc-editor.org/rfc/rfc8628)** — the device authorization grant: the headless `/rc:login --headless` flow, the four error codes the client dispatches (`authorization_pending`/`slow_down` retriable; `access_denied`/`expired_token` terminal), and the §3.2 connection-failure slowdown (FLLWUP-24). The §2.3 poll-shape contradiction was resolved with the client conforming to this RFC (FLLWUP-22, PR #26).
- **[RFC 8414](https://www.rfc-editor.org/rfc/rfc8414)** — authorization-server discovery: the metadata document with `authorization_endpoint`/`token_endpoint`/`device_authorization_endpoint` required and `revocation_endpoint` optional, as the server spec §2.2 and [[tunnel.ts]]'s discovery implement it.

All four are externally-sourced standards — this page indexes where the corpus uses them; the RFC texts themselves are the authority.

## Related
[[RFC Conformance Posture]], [[login.ts]], [[tunnel.ts]], [[Server-Side Spec]], [[Normativity Test]], [[Copy Honesty Doctrine]]

## Sources
[[Server-Side Spec]], [[login.ts]], [[tunnel.ts]], [[RFC Conformance Posture]], https://www.rfc-editor.org
