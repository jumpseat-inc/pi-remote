---
title: Batched Card Delivery
type: concept
summary: A single council-runner can deliver two cards in one run — one owner branch/PR implementing both, one Skeptic verifying both, one judge evaluating both — with the epic goal encoding the mechanics so closure certifies process as well as product.
aliases: [single-runner batch, one-run batch, R-ONE-RUN-1, batched delivery]
tags: [concept/process, council, merge]
sources: ["[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-24
updated: 2026-09-24
---
The autonomous default is **one `council-runner` per card** — [[Council Seats]]' per-card container, and the reason two runners never run at once against the same board. EPIC-6 exercised a deliberate alternative: **one runner covering two cards**, where a single `owner` implements both changes on one branch and one PR, one `skeptic` verifies both, and one judge evaluates both. [[EPIC-6 Run (FLLWUP-39..40)]] is the worked example.

**When the batch is sound.** The two children were small, non-overlapping, and shared one seam — the vendored SDK type surface in [[pi-sdk-events.ts]] and the adjacent pairing test/comment in [[translate.ts]] — and shared one honesty axis. Cost proportionality is the rationale: one implementation pass and one verification pass replace two of each. The batch is not a way to skip gates; the single owner still clears every gate in full ([[Real-Surface Verification]]), and the single PR still passes the full [[Deterministic Merge Check]].

**How it is recorded and enforced.**
- **The epic `goal` encodes the mechanics.** EPIC-6's goal named "one owner implementation (one branch and one PR) covers both changes, one Skeptic verification covers both, and one judge PASS covers both" — so the judge reads the delivery model as part of acceptance, and `steward`'s closure certifies both the product delta and the order it was built in, not just the product delta.
- **One authority read, one merge SHA.** The single runner is the ROOT; `council_route op:"authority"` keyed to that one ROOT returns one mode (`Verify`) that satisfies both cards, and one squash merge (`cb0ba13`) is the merge for both. [[Execution-Mode Recording]] and [[Deterministic Merge Check]] apply once, not per card.
- **One board writer.** The single runner is the sole writer of both card files and `council/board.md` while it holds them, so the "never two runners at once" rule is preserved trivially ([[Council Seats]]).
- **Single-run is a recorded directive.** Here it was **R-ONE-RUN-1**, a human intake directive recorded at Phase 1 (`council/run-strategy.json`) and on each card face — binding on every seat for the run.

**Boundaries.** Batching answers *how many cards one container may hold*, never *whether a card's gates, skeptic, or judge may be skipped*. A batched card that raises an open-judgment or design dispute still routes it per the normal escalation contract; a batch with a `Needs Human` card does not merge around it. The model also assumes the cards are genuinely adjacent — a heterogeneous pair would forfeit the cost rationale and should run per-card.

## Related
[[Council Seats]], [[Execution-Mode Recording]], [[Deterministic Merge Check]], [[Real-Surface Verification]], [[Record-Push Discipline]], [[EPIC-6 Decision Record]]

## Sources
[[EPIC-6 Run (FLLWUP-39..40)]]