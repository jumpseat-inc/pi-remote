---
title: EV-5 Ruling
type: source
summary: Product-owner ruling correcting MESSAGES_SNAPSHOT to init-only, fixing the resync wire shape to pi.resync.done, hardening parseInbound, and reading §2's lock as outbound-only.
aliases: [EV-5 Open-Judgment Rulings]
tags: [council/ruling, history, transport, spec-governance]
sources: ["[[EV-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Three rulings on EV-5 (2026-08-31). **A** — `MESSAGES_SNAPSHOT` is emitted exactly once at replay init (destructive state-reset carrying the active-branch message list); compaction points emit CUSTOM `pi.context.compaction` only in-stream — an in-stream snapshot would clobber streamed panes, and fabricating a message list from a summary string invents content not in the JSONL. **B1** — §5.3's literal `{type:"resync_done", uptoSeq}` corrected to CUSTOM `pi.resync.done` (AG-UI has no RESYNC_DONE); rides the implementing PR. **B2** — §2's "AG-UI frames and nothing else" lock is outbound-only by its literal text; `parseInbound` hardens to a discriminated union (`AgUiFrame | resume | resync | null`), the envelope stays exactly `{v, seq, ack, frame}`, and §2 is not amended. The general rule binding FLLWUP-6/7/8 and FLLWUP-4/5 flows from this ruling.

## Related
[[Spec Correction Governance]], [[history.ts]], [[transport.ts]], [[Closed Vocabulary Discipline]]

## Sources
`vault/raw/2026-08-31-po-ev5-ruling.md`
