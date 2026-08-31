---
id: EV-5
title: "JSONL history replay and resync"
state: Ready
owner: null
epic: EPIC-1
goal: history.ts replays the active JSONL branch through translate.ts on connect and on resync, framing the batch with replay true and deterministic event ids derived from entry id plus content hash, then answers with resync_done up to the highest replayed seq.
---

## Intent

Implements §5 in `src/history.ts`. Replay walks the active branch with
`buildContextEntries()` semantics (compaction, branch_summary honored) via
`ctx.sessionManager`, falling back to direct JSONL reading for large tails.
User-visible surface — a remote client that connects mid-session, or reconnects
after the relay's cache is gone, sees the session's meaningful history (not
raw file noise) exactly once, even if the replay batch is delivered twice.
This is also what keeps the server dumb (§2) — resync is answered from the
host's JSONL, never from server state.

## Acceptance

- Replaying a session containing compaction and branch summaries emits the
  active branch only — no orphaned or pre-compaction entries — and matches
  what a local reader would consider the session's meaning.
- Replay frames carry `replay: true` and deterministic ids; delivering the
  same replay batch twice yields identical ids, so client-side dedupe by
  event id is sufficient (tested by running the replay twice and comparing).
- A `resync` request after a disconnect produces the replay batch followed by
  `resync_done` whose `uptoSeq` equals the highest replayed seq.
- Compaction entries surface as MESSAGES_SNAPSHOT plus CUSTOM
  `pi.context.compaction`.
