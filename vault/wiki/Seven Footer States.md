---
title: Seven Footer States
type: entity
summary: The authoritative footer state set in lifecycle order — off, not enrolled, authorizing, dialing, resyncing, live, error — enumerated by EV-1 Q2 and rendered by EV-8's merge.
aliases: [footer states, state set]
tags: [entity/states, footer]
sources: ["[[EV-1 Ruling]]", "[[EV-8 Ruling]]", "[[EV-3 Ruling]]", "[[BUG-2 Run]]"]
created: 2026-09-02
updated: 2026-09-27
---
EV-1 Q2 ruled `resyncing` back in as a seventh state (overturning the deliberation's six-state convergence — a "missing-seat gap, not an intentional exclusion") because EV-8's acceptance had committed to it. The set, in lifecycle order: **off, not enrolled, authorizing, dialing, resyncing, live, error**.

Semantics per later rulings: `not enrolled` is the un-credentialed state whose remedy is `/rc:login`; `authorizing` is emitted by the login driver on begin and transitions to `off` on terminal; `reconnecting` is a payload sub-state of `dialing`, never an eighth state; `resyncing` is a replay overlay never produced by the merge; `error` is the terminal *rendering* state, reached only by EV-8's threshold — see [[Footer Merge Policy]]. The set is a [[Closed Vocabulary Discipline]] instance: EV-8 surfaces no state outside it, and copy for every transition resolves through the key tables.

**Rendering, not a new state (BUG-2).** Login user lines are not footer text. They go through [[Notify Sink]]. The footer sentences stay on `setStatus("pi-remote", …)` only. The [[BUG-2 Run]] did not add, remove, or reorder a state: after a successful attended login the last `setStatus` argument is still exactly `Off`, and the sequence still includes `Authorizing with the control plane…`. **Superseded inference, flagged:** a screenshot that shows both sentences stacked is not evidence of a second footer write. Before the notify sink, `console.log` desynced the TUI buffer so the old sentence was never erased.

## Related
[[Footer Merge Policy]], [[Notify Sink]], [[Reason Taxonomy]], [[Closed Vocabulary Discipline]], [[index.ts]], [[login.ts]]

## Sources
[[EV-1 Ruling]], [[EV-3 Ruling]], [[EV-8 Ruling]], [[BUG-2 Run]]
