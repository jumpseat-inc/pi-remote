---
title: EPIC-8 Decision Record
type: overview
summary: Synthesis of the two-card run that shipped the /rc:login placeholder pass-through and recorded the installed host's placeholder-discard residual — the wiki's first real-host rendered-TUI observation, a capture-redaction incident, and a flagged dispatch-discipline overshoot.
aliases: [EPIC-8 overview, placeholder decision record]
tags: [overview/epic8, synthesis, login, real-host]
sources: ["[[EPIC-8 Run (EV-18, EV-19)]]"]
created: 2026-09-28
updated: 2026-09-28
---
**What was built.** EPIC-8 widened the attended `/rc:login` URL prompt so the resolved control-plane URL rides as the host `ui.input` **placeholder** argument while the prompt title keeps carrying it as the rendered consent surface. EV-18 (PR #54, `0fdf1d9`) widened the dependency and wiring; EV-19 (PR #55, `b848464`) verified at the installed pi 0.87.1 host that the placeholder is **discarded**. Both merged mode **Deliberate**, all five [[Deterministic Merge Check]] criteria; epic closed `Done` (`281a30f`).

**The core result is negative-space evidence, rendered.** Fact 1 (the extension forwards — an in-repo pin) + fact 3 (the host discards — its source) make fact 2 (no placeholder renders — the real-host observation) legible. A forwarding-only proof would have been [[Fixture-Green Honesty]]'s half-truth; the boundary observation is what makes the named residual honest ([[Real-Surface Verification]], [[Real-Host TUI Observation]]).

**Doctrine this run added:**
- [[Real-Host TUI Observation]] — drive the installed interactive host in tmux/pty, capture the rendered pane, and prove a signed negative over the exact input-line span; keep one resolution tier across claims (anti-splice).
- [[Capture Redaction]] — real-host captures can carry secrets in the typed shell-echo line; redact before committing and treat the raw capture as sensitive.

**Doctrine this run refined:**
- [[Deterministic Merge Check]] — Deliberate exercised as the *resolved* mode (generator subtree), not an explicitly recorded ROOT mode.
- [[Execution-Mode Recording]] — the authority run id is the session-minted id (not the epic key); a wrong id returns `no ROOT manifest`; a ROOT with no recorded `mode` still resolves **Deliberate** when the subtree carries a generator seat.
- [[Runner Stall Recovery]] — the stall window must exceed the longest child; the run's third dispatch is a flagged overshoot of the single-re-dispatch rule.
- [[Record-Push Discipline]] — the EPIC-7-scoped Phase-1 record was stale; EPIC-8 wrote fresh run-scoped rulings + authorizations before its first push; `--admin` unused (no ruleset).
- [[Council Seats]] — promotion ratification + step-13 dispositions (one merge, one drop) exercised by `product-owner`.

**Contradiction at closure.** The `login.urlPrompt` key named by the Phase-1 ruling and the product-owner ruling does not exist (`grep` zero); the consent sentence is a keyless inline literal. Flagged on [[Stable Keys]] / [[Record Accuracy]] / [[login.ts]] / [[copy.ts]].

**Residual.** The greyed in-box render is host-side; it appears for free once a host honors `ui.input(title, placeholder?, opts?)`. The conditional clear-on-type branch is hypothesized-only. No follow-up card was filed — the run's step-13 candidates were merged into EV-19 or dropped.

## Related
[[EPIC-8 Run (EV-18, EV-19)]], [[Real-Surface Verification]], [[Real-Host TUI Observation]], [[Capture Redaction]], [[Fixture-Green Honesty]], [[Record Accuracy]], [[Stable Keys]], [[Deterministic Merge Check]], [[Execution-Mode Recording]], [[Runner Stall Recovery]], [[Record-Push Discipline]], [[Council Seats]], [[pi-remote]], [[EPIC-6 Decision Record]], [[EPIC-4 Decision Record]]

## Sources
[[EPIC-8 Run (EV-18, EV-19)]]