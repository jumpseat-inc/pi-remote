---
title: Execution-Mode Recording
type: concept
summary: The card's execution mode is read from the run substrate, not a seat's report — and because the runner re-derives its own path, recording Direct is the robust default that never HALTs.
aliases: [execution mode, recorded mode, ROOT mode, mode Direct]
tags: [concept/process, merge]
sources: ["[[EPIC-3 Run (FLLWUP-27..30)]]", "[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-23
updated: 2026-09-24
---
A card runs in one of three modes, and the [[Deterministic Merge Check]] is keyed to it:

- **Deliberate** — the full council: steps 2–14 (generators, skeptic, judge); all five criteria.
- **Verify** — one owner, one skeptic, one judge; criterion 3 scopes to the single skeptic dispatch; all five criteria.
- **Direct** — the owner-only lane (criteria 1, 2, 5; no skeptic, no judge).

**Where the mode comes from.** The orchestrator's `council_dispatch` `mode` parameter is written to the dispatched job's **ROOT manifest**; `council_route op:"authority"` (run id + runner ROOT id) reads it back from the run substrate — the merge check's mechanical input, never a seat's report.

**Why the runner and the record can disagree.** The runner derives its own path: council.md step 1 asks for `council_route op:"route"`, and when that returns a *fallback* (no recorded decision for the card's current packed state) the runner's own step-1 judgment governs. On the autonomous path `council_route` is parent-only — it is not exposed in a seat child — so the runner falls back to judgment. A mode **recorded stricter than the runner executes** therefore demands evidence the run never produced, and the merge check HALTs verbatim:

> `HALT: EV-<n> — mode <mode> requires a goal evaluation and none is recorded`

An absent recorded mode also HALTs — inferring one is exactly the discretion the check removes.

**The robust default is `Direct`.** It is self-correcting because the resolution upgrades to `Deliberate` the moment a generator seat (`principal`/`designer`/`consolidator`) appears in the subtree:

| Recorded | Runner executes | Resolved | Outcome |
|---|---|---|---|
| Direct | owner-only | Direct | criteria 1/2/5 — fine |
| Direct | owner + skeptic + judge | Direct | criteria 1/2/5 — fine (evidence unused) |
| Direct | full council (generators) | Deliberate | criteria 1–5 — fine |
| Verify | owner-only | Verify | HALT — no goal evaluation |
| Deliberate | owner-only | Deliberate | HALT — no goal evaluation |

**Repair shape.** A recorded-vs-executed mismatch is repaired by producing the missing evidence **at the recorded mode** (dispatch the missing skeptic/judge), never by merging on the runner's report and never by re-recording to the executed mode mid-card.

**Observed.** The [[EPIC-3 Run (FLLWUP-27..30)]] recorded `Direct` on all four cards and had zero mode trouble; the mismatch pattern above is the failure shape the Direct default exists to avoid.

**`Verify`, and orchestrator-supplied mode (EPIC-4).** The [[EPIC-4 Run (FLLWUP-11..12)]] recorded **`Verify`** on both cards — the right mode when Phase-1 rulings have already settled the design forks: no deliberation/generators, but one owner, one skeptic, and one judge still run, so all five criteria hold with criterion 3 scoped to the single Verify skeptic dispatch. It also confirmed the parent-only claim from the other direction: the runner reported `council_route` **unavailable in its container**, so the recorded mode **handed in the dispatch input** was applied as authoritative and not re-recorded. `Verify` is safe when the runner always executes at least the mechanical path (owner + skeptic + judge); the HALT risk is a mode recorded stricter than what actually runs.

**One ROOT mode for a two-card batch (EPIC-6).** The [[EPIC-6 Run (FLLWUP-39..40)]] recorded **`Verify`** on a single runner covering **two** cards; `council_route op:"authority"` keyed to that one ROOT (job-14) returned the mode both cards' merge checks used, and one squash SHA (`cb0ba13`) was both cards' merge — a per-card mode read would have been redundant ([[Batched Card Delivery]]). Run ids are keyed to the host session, so the EPIC-5 and EPIC-6 runs shared one run id and one manifest forest.

## Related
[[Deterministic Merge Check]], [[Council Seats]], [[Record-Push Discipline]], [[Runner Stall Recovery]], [[Batched Card Delivery]], [[EPIC-3 Decision Record]], [[EPIC-4 Decision Record]], [[EPIC-6 Decision Record]]

## Sources
[[EPIC-3 Run (FLLWUP-27..30)]], [[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-6 Run (FLLWUP-39..40)]]