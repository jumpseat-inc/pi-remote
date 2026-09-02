---
title: Closed Vocabulary Discipline
type: concept
summary: Enumerated state, reason, and dispatch-key sets are closed — new values enter only through a ruling, and CUSTOM name is the sole dispatch key.
aliases: [closed vocabularies, dispatch keys]
tags: [concept/states, doctrine]
sources: ["[[EV-1 Ruling]]", "[[EV-3 Ruling]]", "[[EV-4 Ruling]]", "[[FLLWUP-3 Design Position r3]]", "[[FLLWUP-4 Ruling]]", "[[EPIC-2 Decision Record]]"]
created: 2026-09-02
updated: 2026-09-02
---
Three closed sets govern the wire and the UI, each enumerated by ruling: the [[Seven Footer States]] (EV-1 Q2), the five-value [[Reason Taxonomy]] (EV-3 S3), and the CUSTOM event convention `{type:"CUSTOM", name:"pi.<category>", value:{pi, data}}` with `name` the sole dispatch key (EV-4 Q1). Rules that hold across all three:

- A transport (or mapper) may only claim values from its set — EV-3: no `kind:"error"` exists because a terminal event from a non-terminal mechanism is "a lie in the event stream."
- Payload-variant events fan out into **distinct dispatch keys per client-perceived concept** rather than discriminator fields under one key (FLLWUP-3 round-3 unanimous; applied by FLLWUP-3's J-3 ruling and FLLWUP-4).
- Names become [[Stable Keys]] — non-relitigable contract from merge (FLLWUP-4 general rule).
- A second wire format never exists: pi concepts without an AG-UI equivalent are always CUSTOM with pi-prefixed names (EV-4).
- **Shrink is also a ruling act.** EV-13 Q1 dropped `pi-remote:device` from the server spec's grantable-scope union — a grantable scope with no bearer is "dead vocabulary the day it ships" (the opaque-secret device credential never touches the AS). Re-adding later requires a ruling: the documented route for closed-vocabulary growth in either direction.

## Related
[[Seven Footer States]], [[Reason Taxonomy]], [[Stable Keys]], [[translate.ts]], [[Spec Correction Governance]]

## Sources
[[EV-1 Ruling]], [[EV-3 Ruling]], [[EV-4 Ruling]], [[FLLWUP-3 Design Position r3]], [[FLLWUP-4 Ruling]]
