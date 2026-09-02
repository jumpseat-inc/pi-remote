---
title: Self-Containment Audit
type: concept
summary: The mechanical gate enforcing a document's independence — zero references to sibling specs, codebases, or decision ids; exactly one external link; run on the real artifact.
aliases: [self-containment mandate, blocklist audit]
tags: [concept/process, documentation]
sources: ["[[EPIC-2 Decision Record]]", "[[Server-Side Spec]]"]
created: 2026-09-02
updated: 2026-09-02
---
The human's binding constraint for EPIC-2: `docs/SERVER-SIDE-SPEC.md` MUST NOT reference `docs/PI-SPEC.md` or the pi-remote codebase — it stands alone for a reader assumed to have neither. EV-14 enforced it mechanically:

- **Blocklist grep** (Phase 1 ruling R5): `PI-SPEC`, `docs/PI-SPEC`, `src/`/`test/` paths, module file names, card/decision ids (`EV-\d+`, `FLLWUP-\d+`, `EPIC-\d+`) — zero hits.
- **Soft-phrase read-through**: "as the client does", "the host spec" — restatements must be complete on the page, not pointers.
- **Exactly one external link**: `https://github.com/jumpseat-inc/pi-remote`, in the conformance framing section, characterized as reference implementation — never a dependency ("nothing in the document is correct only because the client does X").
- **On the real artifact** (Phase 1 ruling R1): sections were appended incrementally to the single document, so the audit ran against what actually ships, not a concatenation of section files.

**The two-audit split:** the self-containment audit is stated nowhere on the page (R5 keeps the document clean); the conformance audit (every wire contract checked against the shipped client) runs council-side and is recorded on the card. Verification lives in the record; independence lives on the page. Corollary from steward's closure ruling: an audit that can only pass by finding nothing is an audit incentivized to find nothing — findings are surfaced and carded, never suppressed to make an audit green (see [[Fixture-Green Honesty]]).

## Related
[[Server-Side Spec]], [[Fixture-Green Honesty]], [[Normativity Test]], [[Spec Correction Governance]], [[EPIC-2 Decision Record]]

## Sources
[[EPIC-2 Decision Record]], [[Server-Side Spec]]
