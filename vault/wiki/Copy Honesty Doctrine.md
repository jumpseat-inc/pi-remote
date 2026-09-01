---
title: Copy Honesty Doctrine
type: concept
summary: Every user-visible line states what actually happened and names only remedies a real actor can perform — stated sentences over glyphs, no over-promised channels.
aliases: [honest copy, stated refusal, remedy clauses]
tags: [concept/copy, doctrine]
sources: ["[[EV-2 Ruling]]", "[[EV-7 Ruling]]", "[[EV-8 Ruling]]", "[[FLLWUP-5 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[FLLWUP-7 Design Position r2]]"]
created: 2026-09-02
updated: 2026-09-02
---
The most-repeated doctrine in the corpus. Rules, each with a governing precedent:

- **Stated refusal, never a glyph.** Idempotent no-ops and refusals are full sentences naming the state and the fix (EV-2 Item 3: "already connected to `<serverUrl>`; ignoring this `/rc`"; EV-8 J5: "close the tunnel first with /rc:off").
- **Remedy clauses are owed only when a real, distinct next step exists and the named party can change the outcome.** The 403 row names the control-plane admin because granting scope resolves what re-consent cannot (EV-2 Item 1); "file an issue" was rejected for `acl_enforcement_failed` because the condition is host-local — no maintainer can apply an ACL on the user's machine (FLLWUP-7 ruling).
- **Loud-once per session for recurring degradation.** The `fallback_to_steer` notice announces itself once, then stays silent (EV-6 R2) — a flat-every-time register either goes invisible or repeats what the user knows.
- **Never print secrets or placeholders literally.** The tunnel URL is a one-time secret and never appears in copy (EV-2 Item 3); a "resolved" line that still prints the literal `<serverUrl>` marker is not honestly resolved (FLLWUP-4 OJ5).
- **Copy ruled verbatim changes only through its own card and ruling** (FLLWUP-4 OJ1 general rule) — see [[Stable Keys]].

Underlying lens: [[Gulf of Evaluation]] — the copy exists so the user can perceive the system's state without archaeology.

## Related
[[Gulf of Evaluation]], [[Stable Keys]], [[EV-2 Ruling]], [[EV-7 Ruling]], [[EV-8 Ruling]], [[copy.ts]], [[login.ts]]

## Sources
[[EV-2 Ruling]], [[EV-7 Ruling]], [[EV-8 Ruling]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]], [[FLLWUP-7 Design Position r2]]
