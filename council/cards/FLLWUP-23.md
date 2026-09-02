---
id: FLLWUP-23
title: "Fix §5.10's inverted RFC-2119 keyword: MUST where MUST NOT is meant in the cross-tenant grant sentence"
state: Ready
owner: null
epic: EPIC-2
goal: docs/SERVER-SIDE-SPEC.md §5.10's sentence "there is no cross-tenant grant, and no conformant server MUST honor a grant request naming a subject outside the admin's tenant" is corrected so the keyword matches the intended normativity — a conformant server MUST NOT honor such a request — per the EV-12 rule that a normative keyword must bind the behavior it names.
---

## Intent

Filed from EV-14's normativity sweep (EV-12 general rule: every MUST/SHOULD
must name an observation point and bind the intended behavior), recorded
council-side on council/cards/EV-14.md, per the orchestrator's standing
instruction to file audit failures rather than fix them silently on the
assembly PR.

The defect, pinned by the Skeptic at PR #25 head `998fa3f` (§5.10, lines
1643–44): the negated subject ("no conformant server") combined with `MUST`
reads as "no server is *required* to honor" — permission-shaped, leaving a
server that does honor a cross-tenant grant request technically conformant.
The sentence's evident intent, and the trust model §5.7–§5.8 enforce, is that
honoring such a request is a violation. The fix is the keyword: `MUST NOT`
inside the negated construction (or the sentence restructured so the keyword
binds positively), with no other §5.10 change. One sentence, docs-only.

## Acceptance

- The sentence binds non-honoring as a requirement (MUST NOT, or an
  equivalent positive restatement naming the wire-observable consequence).
- No other §5.10 change; the enforcement algorithm at §5.7 is untouched.
- bunx tsc --noEmit exit 0; bun test exit 0 (docs-only; suite untouched).
