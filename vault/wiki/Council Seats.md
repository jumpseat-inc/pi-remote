---
title: Council Seats
type: entity
summary: The ruling, verification, and working seats of the council process, with the authority map that re-homed human powers for autonomous runs.
aliases: [council, seats, ruling seats]
tags: [entity/process]
sources: ["[[EV-1 Ruling]]", "[[Judge Object Rule]]", "[[FLLWUP-5 Ruling]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]"]
created: 2026-09-02
updated: 2026-09-23
---
Seats exercised across the epic: **product-owner** (judgment — open-judgment rulings, mid-flow decisions, promotion ratification), **steward** (strategy — build order, retirements, ending the run; also the escalation boundary for security-model spec changes), **skeptic** (verification — runs the real gates and adversarial probes; its closed-red findings twice corrected the record), **judge** (step-10 verdict, bound by the [[Judge Object Rule]]), **owner / principal / designer** (working seats; designer holds no ruling authority on surface-touching cards), **consolidator** (sorts settled vs open-judgment vs open-objections), **council-runner** (the per-card container).

Provenance note worth keeping: the EV-1 ruling records that the product-owner seat's grounding framework originates from a different product (pi-council's origin) and was explicitly disclaimed for pi-remote — grounding lenses are borrowed instrumentarily, and the seats say so when they do not apply.

Two governance lessons the corpus demonstrates: recorded *preferences* are advisory (EV-8 J1 amended EV-2 Item 4's), and a seat's own out-of-scope call can be overruled by its ruling seat when the Skeptic's evidence changes the facts (FLLWUP-5 S-O2).

**Operational diagnosis pattern (from the residual run):** a seat freezing mid-turn with turns AND cost frozen across two wait windows is a seat-level transient, not an environment hang — probe the environment first (e.g. run the suite directly; it completed in under a second), then re-dispatch fresh; two consecutive freezes at the same long-generation step indicates the generation length, not the model — mitigate with chunked writes (compose large documents in bounded tool calls) before routing a model change to the human.

**Batch-run mechanics (device-flow polish run).** `steward` sequences a human-promoted batch of `Ready` cards as a portfolio ruling — order, gating, and epic-mixing — and may fix a precondition (FLLWUP-25 gated on a prior product-owner copy ruling). A Skeptic block that turns on user-visible copy returns the card to `In Progress` **and routes to `product-owner` first** — the owner may not change ruled copy, so it cannot be an owner fix (FLLWUP-24). A behavior the Skeptic proves only by ad-hoc probe files a follow-up so it becomes fixture-pinned (FLLWUP-28/29; see [[Fixture-Green Honesty]]). Seat worktree discipline: seats operate only inside their own isolated worktree — a `git checkout` in the shared main worktree left it detached and broke the facilitator's rebase (FLLWUP-30).

## Related
[[Judge Object Rule]], [[Verify Cycle Cap]], [[Spec Correction Governance]], [[Cause-Distinguished Expiry]], [[EPIC-1 Decision Record]]

## Sources
[[EV-1 Ruling]], [[EV-1 Step-10 Judge-Object Ruling]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]
