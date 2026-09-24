---
id: FLLWUP-36
title: "Ground emission-semantics claims in the event-constructing layer, not only the pass-through emitter"
state: Backlog
owner: null
epic: EPIC-5
goal: make construction-layer grounding of emission-semantics claims a systematic check, not per-clause prose.
---

## Intent

Filed from FLLWUP-12's step 13 (EPIC-4), confirmed `File` by a
`product-owner` ruling. Recorded disposition, verbatim:

> Mode: File — composite 0.42 < merge threshold 1.00 — Ground emission-semantics claims in the event-constructing layer, not only the pass-through emitter (active)

FLLWUP-12's verification grounded its emission-semantics claims by reading
the installed engine's event-constructing layer (agent-loop.js,
anthropic-messages.js, assistant-message-frame.js), not only the
pass-through emitter — and that grounding is what caught the object-identity
premise the pass-through view alone would have blessed. Today that grounding
happens as per-clause prose in a card record; this card makes it
systematic: a documented check (or scripted probe) that any claim about what
the engine emits is verified against the layer that constructs the event,
so future cards cannot rely on emitter-shape reasoning alone.

## Acceptance

- Construction-layer grounding is a systematic, repeatable check for
  emission-semantics claims (documented procedure or scripted probe), not
  per-clause prose.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.
