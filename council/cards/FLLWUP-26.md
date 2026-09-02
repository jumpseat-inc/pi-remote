---
id: FLLWUP-26
title: "Scope §1.2/§5.7's 'security decision' vocabulary across per-delivery grant enforcement"
state: Backlog
owner: null
epic: EPIC-2
goal: The §1.2 sentence FLLWUP-21 rewrote — per-frame relay "adjudicates nothing about a relayed frame's payload or routing" — is checked against §5.7's per-delivery grant re-checks (revoked device → detach / never deliver; layered policy → skip) and §4.6 fan-out, and either scoped with a word that admits grant/binding enforcement (INV-4) or the residual tension is documented as intended, so the sentence cannot read as a new universal cap.
---

## Intent

Filed from FLLWUP-21's step 9 (skeptic verify cycle 1, non-blocking residuals;
closed-green operationally, deferred as out of the card's edit scope). Two
residuals, one underlying exercise:

1. §5.6's existing sentence "a security decision on the data plane is what
   §1.2 forbids" cites §1.2 more broadly than the amended §1.2 now supports —
   it is coherent only under the reading "a *further/duplicate* grant
   decision". §5.6 was not editable in FLLWUP-21.
2. §5.7 and §4.6 state grants are re-checked at every delivery opportunity —
   real per-delivery enforcement on the data plane — which sits at the edge
   of the rewritten §1.2 clause. It survives today only because the clause
   scopes to "payload or routing" and grant checks are neither; the skeptic
   recommends a future scoping word so the edge is explicit rather than
   accidental.

Docs-only; likely one sentence in §1.2 and/or a clarifying clause in §5.6/§5.7,
plus a check that INV-1..INV-6 need no amendment.

## Acceptance

- The rewritten §1.2 sentence and §5.7's per-delivery enforcement read
  together without a universal-cap reading; the payload/routing scope of the
  no-decisions rule is explicit at the edge case.
- §5.6's §1.2 citation reads literally true against the final §1.2 text.
- No other §1.2 change than the scoping requires; INV-1..INV-6 unchanged
  unless a defect in them is found (which would be its own finding).
- bunx tsc --noEmit exit 0; bun test exit 0 (docs-only).
