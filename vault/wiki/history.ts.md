---
title: history.ts
type: entity
summary: Active-branch JSONL replay through translate.ts — one init MESSAGES_SNAPSHOT, deterministic frame ids, per-past-run RUN pairs, and the resync terminator pi.resync.done.
aliases: [the replay module]
tags: [entity/module, history, replay]
sources: ["[[EV-5 Ruling]]", "[[EV-4 Ruling]]", "[[FLLWUP-3 Design Position r3]]"]
created: 2026-09-02
updated: 2026-09-02
---
Implements §5: walks the active branch (compaction and branch_summary honored) via `ctx.sessionManager`, falling back to direct JSONL for large tails, emitting through the same `translate(input, state)` fold as the live path. Ruling-shaped properties:

- **One `MESSAGES_SNAPSHOT` at replay init** carrying the active-branch message list; compaction points emit `CUSTOM pi.context.compaction` only in-stream (EV-5 A — an in-stream snapshot would clobber streamed panes, and a summary string cannot fabricate a message list).
- **One RUN pair per past run** (EV-4 Q2); runIds are deterministic, minted here — `run-<fnv1a(sessionId + firstUserEntryId)>` — and threaded through the fold; past-run boundary = user entry through the last assistant/toolResult before the next user entry.
- **Deterministic frame ids** `fnv1a(entryId + \0 + contentHash + \0 + frameOrdinal)` (frame-granularity), never overwritten by transport UUID stamping; `replay: true` is a frame-level field; the batch ends with CUSTOM `pi.resync.done` `{uptoSeq}` (EV-5 B1 — AG-UI has no RESYNC_DONE).
- STEP frames omitted (JSONL has no turn entries); FLLWUP-3 added the four runtime-dead families' mappings; the JSONL adapter entry remains `SessionEntry → JsonlEntry`.
- `onResync(fromSeq)` (transport) is the injected trigger wired by [[index.ts]].

## Related
[[translate.ts]], [[Spec Correction Governance]], [[Closed Vocabulary Discipline]], [[transport.ts]], [[index.ts]], [[AG-UI]]

## Sources
[[EV-5 Ruling]], [[EV-4 Ruling]], [[FLLWUP-3 Design Position r3]]
