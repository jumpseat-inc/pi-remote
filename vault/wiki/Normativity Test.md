---
title: Normativity Test
type: concept
summary: A MUST or SHOULD must name its observation point — the wire, a conformance harness, or a restated consequence of an existing invariant — and one-sided bounds are never normative.
aliases: [observation-point test, normative keyword audit]
tags: [concept/spec, doctrine]
sources: ["[[EPIC-2 Decision Record]]", "[[Server-Side Spec]]", "[[FLLWUP-4 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
EV-12's product-owner general rule, written for the server-side spec and applied by EV-14's audit as a defect check (not a judgment call): **every MUST or SHOULD must name its observation point** — the wire (a frame or field a harness can check), a conformance harness, or a restated consequence of an invariant already on the page. Everything else is clearly-marked guidance. **One-sided bounds are never normative** — a number only one peer can be held to is a promise the wire cannot make true.

It earned its place twice:

- **It decided a real design fork.** The frame-size bound (EV-12 OJ-1): the owner's ~1 MiB SHOULD cap failed the test because the host's replay-snapshot builder is unbounded — a conformant host can legitimately exceed any one-sided floor, so the cap is unenforceable; the ruling landed pure non-normative guidance (byte-based ring budgeting, never truncate or split) instead of publishing a fictitious number.
- **It caught a shipped defect.** §5.10's "no conformant server MUST honor a cross-tenant grant" binds the wrong behavior — the intended normativity is MUST NOT. Filed as FLLWUP-23.

It also reconciled a governance tension: descriptive text vs normative prohibition is decided by observability (a resume frame in the server→host direction IS harness-checkable, so MUST NOT was honest even though today's host tolerates it — EV-12 OJ-4), and pinning an advisory value was honest where the field rides a fully-specified frame (fromSeq, EV-12 OJ-5) but inventing semantics for an unread field would not be.

## Related
[[Server-Side Spec]], [[Self-Containment Audit]], [[Closed Vocabulary Discipline]], [[RFC References]], [[Deterministic Merge Check]], [[Cheapest To Reverse]]

## Sources
[[EPIC-2 Decision Record]], [[Server-Side Spec]]
