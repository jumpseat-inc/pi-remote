---
title: EPIC-6 Decision Record
type: overview
summary: Synthesis of the two-card single-runner run — batched card delivery, declare-or-annotate-with-reason for vendored fields, and the comment-level record-accuracy variant — with EPIC-5's announced residuals now delivered.
aliases: [EPIC-6 overview, SDK vendoring residuals decision record]
tags: [overview/epic6, synthesis, sdk]
sources: ["[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-24
updated: 2026-09-24
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the [[EPIC-3 Run (FLLWUP-27..30)]] / [[EPIC-4 Run (FLLWUP-11..12)]] precedent. Authority is the card faces (EPIC-6, FLLWUP-39..40), PR #47, and the run ledger.

**What was built.** EPIC-6 delivered two small residuals from the EPIC-5 run in a **single council run** (**R-ONE-RUN-1**): one `owner` implementation on one branch/PR (#47, squash `cb0ba13`), one skeptic, one judge. FLLWUP-39 closed the sibling of FLLWUP-38's vendoring fix — `PiThinkingContent.thinkingSignature` and `PiToolCall.thoughtSignature` declared with line-referenced provenance, and two adjacent real fields (`redacted?`, `namespace?`) *deliberately omitted with reasons* rather than silently. FLLWUP-40 corrected the FLLWUP-12 pairing test's source comment, which overstated what the test pins beyond the value-level decode comparison. Both merged with `gates` SUCCESS on head + merged SHA, mode `Verify`, all five [[Deterministic Merge Check]] criteria.

**Doctrine this run added:**
- [[Batched Card Delivery]] — one runner may hold two adjacent cards: one owner branch/PR, one skeptic, one judge; the epic `goal` can encode the mechanics so closure certifies process as well as product.

**Doctrine this run refined:**
- [[Real-Surface Verification]] — the vendored-surface remedy generalizes to **declare-or-annotate-with-reason**: declare the real optional fields the surface carries, and annotate (with reasons) the real fields you knowingly leave out, so an omission is never indistinguishable from an audit gap.
- [[Record Accuracy]] / [[Fixture-Green Honesty]] — a third variant of "the record claims more than the evidence": a **source comment** that overstates what its test pins (after a card count in FLLWUP-33 and a test header in FLLWUP-32). The remedy is comment-only; assertions stay byte-identical.
- [[Execution-Mode Recording]] / [[Deterministic Merge Check]] — one ROOT authority read and one merge SHA satisfy both cards of a batch.
- [[Council Seats]] — promotion ratification (`product-owner`) exercised again; the single container authored both card records.
- [[Record-Push Discipline]] — R-PUSH-1/R-ADMIN-1 re-recorded run-scoped; `--admin` unused (`main` unprotected).

**Residual at closure.** **None accepted.** `steward` job-15 ratified EPIC-6 `Done` — both children delivered from one run, no follow-ups filed. This closes EPIC-5's announced-debt trail: FLLWUP-39..40 were the two ungrouped residuals EPIC-5's closure had announced.

**Process lesson.** The batch model shows that run-mechanics can be carried in the epic's own acceptance text. When the goal names one owner / one skeptic / one judge, the closure ruling stops being a product-only judgement and becomes a certification of the build order too — a useful lever when a human wants a specific delivery shape, and a warning that goals which encode mechanics demand manifests that can prove them.

**Gap carried forward.** The EPIC-5 run (the seven-card run that produced FLLWUP-39..40 and systematized [[Emission-Semantics Fidelity]] via FLLWUP-36) is **not yet ingested**; this record references its cards and records rather than its own wiki pages. Flagged in log.md.

## Related
[[EPIC-6 Run (FLLWUP-39..40)]], [[Batched Card Delivery]], [[Real-Surface Verification]], [[Record Accuracy]], [[Fixture-Green Honesty]], [[Execution-Mode Recording]], [[Deterministic Merge Check]], [[Council Seats]], [[Record-Push Discipline]], [[pi-sdk-events.ts]], [[translate.ts]], [[EPIC-4 Decision Record]], [[EPIC-3 Decision Record]]

## Sources
[[EPIC-6 Run (FLLWUP-39..40)]]