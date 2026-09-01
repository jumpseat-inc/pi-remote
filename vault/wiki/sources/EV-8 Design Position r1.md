---
title: EV-8 Design Position r1
type: source
summary: Designer round-1 position on the footer merge policy — Gulf-of-Evaluation analysis of live-clears-error vs sticky-error, the FOOTER falsifiable test, and the /rc-off-vs-/rc copy asymmetry note.
aliases: [EV-8 design position r1]
tags: [design, footer, merge, copy]
sources: ["[[EV-8 Design Position r1]]"]
created: 2026-09-02
updated: 2026-09-02
---
Round-1 designer position on EV-8 (2026-08-31). Analyzed both merge options through the user-comprehension lens: **Option A "live clears error"** (honest at the moment a recovered tunnel is genuinely live) vs **Option B "error sticky until user acts"** (never hides a failure) — with a falsifiable FOOTER test prediction for the Skeptic. The deliberation's Skeptic verification later proved the live-implies-verified-open invariant, which EV-8 J1 cited when amending product-owner's EV-2 Item 4 preference. Also raised the `/rc:off`-when-not-live vs `/rc`-when-already-live **copy asymmetry** — the two idempotent no-ops had non-identical register, resolved by the stated-refusal standard — and refined round-0 predictions.

## Related
[[Footer Merge Policy]], [[Gulf of Evaluation]], [[Copy Honesty Doctrine]], [[EV-8 Ruling]]

## Sources
`vault/raw/2026-08-31-design-ev8-merge-lifecycle-r1.md`
