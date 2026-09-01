---
id: FLLWUP-17
title: "Key ALREADY_LIVE_COPY as tunnel.alreadyLive and localize it (OJ1 follow-up)"
state: Backlog
owner: null
epic: EPIC-1
goal: Give the already-live refusal line a stable message key (tunnel.alreadyLive — not tunnel.error.*, per EV-2 Item 3's not-an-error ruling), re-point its single print site through the resolver, and add the Bahasa Indonesia row, so the line resolves under a non-English locale like every other tunnel-sourced line.
---

## Intent

Filed from FLLWUP-4 step 13 per product-owner ruling OJ1 (binding): EV-2 Item 3
ruled ALREADY_LIVE_COPY verbatim and fixed its semantics as a successful no-op,
so keying it is a net-new key plus a copy change needing its own card — "work
that needs a goal change to justify is not a fold-in."

## Acceptance

- `ALREADY_LIVE_COPY` in src/tunnel.ts becomes the keyed row
  `tunnel.alreadyLive` with the English value unchanged from the ruled
  verbatim string (semicolon and successful-no-op semantics preserved).
- The id row in src/copy.ts: preserves `/rc` byte-identical, the semicolon
  shape, and the `<serverUrl>` placeholder; the print-site render substitutes
  it (FLLWUP-4 pattern).
- The print site (index.ts, the ALREADY_LIVE_COPY branch of rcCommand — :462
  at filing, :472 after FLLWUP-4) re-points through
  englishFor("tunnel.alreadyLive") + renderCopy.
- test/index.test.ts:288's verbatim pin is amended deliberately to pin the
  key-resolved output instead — the ruling notes keying "reddens the green
  test"; that amendment is this card's job, not a side effect.
- Per the PO general rule: the key is free at authoring time but becomes
  stable, non-relitigable contract from merge. bunx tsc --noEmit exit 0;
  bun test exit 0.
