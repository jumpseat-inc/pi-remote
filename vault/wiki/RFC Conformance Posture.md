---
title: RFC Conformance Posture
type: concept
summary: When shipped client behavior diverges from a published RFC, the client moves and the spec stays standards-accurate — the spec is never bent to match the implementation.
aliases: [client conforms to the RFC, standards conformance posture]
tags: [concept/doctrine, rfc, conformance]
sources: ["[[RFC Conformance Posture]]", "[[EPIC-2 Decision Record]]", "[[Server-Side Spec]]"]
created: 2026-09-02
updated: 2026-09-02
---
**Provenance deviation, stated:** no `vault/raw/` file — provenance is the human's Phase 1 rulings Q1/Q2 on the FLLWUP-22 and FLLWUP-18 card faces (2026-09-02) and PRs #26/#29.

The posture, established by two human rulings closing the EPIC-2 residual queue:

- **Q1 (FLLWUP-22): "obey RFC 8628."** The spec mandated device-flow polls answered `400` + `{"error": …}` (per RFC 8628 §3.5); the shipped headless driver aborted non-2xx polls. The ruling: **the client adapts** — the poll loop was reordered (body parsed before the status gate, four-code dispatch) so client and spec are both RFC-conformant. The spec's §2.3 was not weakened to match the client.
- **Q2 (FLLWUP-18): same posture for RFC 6749.** The refresh request migrated from JSON body to §2.3.1 form-encoding — client and spec §2.4 in one PR — rather than promoting the divergence to a permanent documented exception.

**Why it matters:** the spec is the contract other implementers build against; bending it to match shipped behavior teaches every future implementer the wrong wire. The cost lands once, on the client, with fixtures. Notable supersession: EV-10 had earlier aligned spec §2.4 **to** the client's JSON body — this posture reverses that alignment in favor of the RFC, and the reversal is flagged rather than silent. Boundary: the posture applies to *published* RFCs; where no RFC governs, the spec reflects the ruled design (every other doctrine page).

## Related
[[Copy Honesty Doctrine]], [[Server-Side Spec]], [[Normativity Test]], [[login.ts]], [[tunnel.ts]], [[EPIC-2 Decision Record]]

## Sources
Provenance: FLLWUP-22/FLLWUP-18 card faces (Phase 1 rulings), PRs #26/#29. No vault/raw/ file — deviation stated above.
