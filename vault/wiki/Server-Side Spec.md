---
title: Server-Side Spec
type: entity
summary: docs/SERVER-SIDE-SPEC.md — the self-contained implementation spec for the pi-remote relay and control plane, produced by EPIC-2 and closed with two known Backlog defects.
aliases: [SERVER-SIDE-SPEC, the server spec]
tags: [entity/spec]
sources: ["[[Server-Side Spec]]", "[[EPIC-2 Decision Record]]"]
created: 2026-09-02
updated: 2026-09-02
---
`docs/SERVER-SIDE-SPEC.md` — produced by [[EPIC-2 Decision Record]] so a server team can implement a conformant relay and control plane reading only this document. Structure: **§1** framing (single responsibility, invariants INV-1..6 stated in the document's own words, RFC 2119 keyword convention, document map, the sole external link to the reference client); **§2** enrollment and identity (discovery, PKCE attended, device flow headless, refresh, token claims, the 401/403 error split); **§3** tunnel lifecycle (POST /tunnels, one-time signed URL with jti consumption, DELETE, error taxonomy, 409 tunnel_already_live); **§4** data-plane relay (four-key envelope, client-owned seq, resume/resync as the only control frames, server-stamped deviceId, MUST-NOT forward resumes, fromSeq advisory); **§5** device registry, grants, push reservation, and the server-side trust summary (scope union exactly {pi-remote:host, pi-remote:admin}; admin-minted device registration; revoked-device check folded into the 401 upgrade branch with three REQUIRED lookup states).

Governance: self-containment per [[Self-Containment Audit]]; normativity per [[Normativity Test]]. PI-SPEC §10 carries the one-line pointer to it; PI-SPEC is otherwise unchanged.

**Known open defects (Backlog, epic-tagged — the closure record announces them):** FLLWUP-22 (§2.3 device-flow poll shape contradicts the shipped headless driver — the live one, steward's residual queue #1), FLLWUP-23 (§5.10 inverted MUST), and FLLWUP-18/19/20/21 as prose-hygiene and conformance-tracking items.

## Related
[[EPIC-2 Decision Record]], [[Self-Containment Audit]], [[Normativity Test]], [[pi-remote]], [[Spec Correction Governance]]

## Sources
Provenance: EPIC-2 card face, council cards EV-9..EV-14, PRs #20-25. No vault/raw/ file — deviation stated.
