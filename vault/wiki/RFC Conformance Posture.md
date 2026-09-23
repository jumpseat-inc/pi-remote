---
title: RFC Conformance Posture
type: concept
summary: When shipped client behavior diverges from a published RFC, the client moves and the spec stays standards-accurate — the spec is never bent to match the implementation.
aliases: [client conforms to the RFC, standards conformance posture]
tags: [concept/doctrine, rfc, conformance]
sources: ["[[RFC Conformance Posture]]", "[[EPIC-2 Decision Record]]", "[[Server-Side Spec]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]"]
created: 2026-09-02
updated: 2026-09-23
---
**Provenance:** the human's Phase 1 rulings Q1/Q2 on the FLLWUP-22 and FLLWUP-18 card faces (PRs #26/#29, 2026-09-02) and the FLLWUP-24 product-owner ruling (`vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md`). Earlier lint passes recorded this page as having no `vault/raw/` file; the Q3 ruling below supplies one.

The posture, established by two human rulings closing the EPIC-2 residual queue and extended by a third:

- **Q1 (FLLWUP-22): "obey RFC 8628."** The spec mandated device-flow polls answered `400` + `{"error": …}` (per RFC 8628 §3.5); the shipped headless driver aborted non-2xx polls. The ruling: **the client adapts** — the poll loop was reordered (body parsed before the status gate, four-code dispatch) so client and spec are both RFC-conformant. The spec's §2.3 was not weakened to match the client.
- **Q2 (FLLWUP-18): same posture for RFC 6749.** The refresh request migrated from JSON body to §2.3.1 form-encoding — client and spec §2.4 in one PR — rather than promoting the divergence to a permanent documented exception.
- **Q3 (FLLWUP-24, product-owner 2026-09-23): the §3.5 slowdown, client-side.** The headless poll now retries a connection-level failure rather than aborting — a flat five-second wait, then re-poll. Boundary note: **§3.5** requires a client hitting connection problems to reduce its polling frequency and *recommends* exponential backoff; the flat five seconds, adopted from **§3.2**'s default minimum poll interval, is a client design choice **within** the mandate. "Conform" here does not mean "implement backoff". The goal/plan/comment initially cited §3.2; the correction rode the implementing PR as errata ([[Spec Correction Governance]]).

**Why it matters:** the spec is the contract other implementers build against; bending it to match shipped behavior teaches every future implementer the wrong wire. The cost lands once, on the client, with fixtures. Notable supersession: EV-10 had earlier aligned spec §2.4 **to** the client's JSON body — this posture reverses that alignment in favor of the RFC, and the reversal is flagged rather than silent. Boundary: the posture applies to *published* RFCs; where no RFC governs, the spec reflects the ruled design (every other doctrine page).

## Related
[[Copy Honesty Doctrine]], [[Server-Side Spec]], [[Normativity Test]], [[Cause-Distinguished Expiry]], [[login.ts]], [[tunnel.ts]], [[EPIC-2 Decision Record]]

## Sources
Provenance: FLLWUP-22/FLLWUP-18 card faces (Phase 1 rulings), PRs #26/#29; FLLWUP-24 product-owner ruling `vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md`; [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]].
