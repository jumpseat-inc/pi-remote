---
id: FLLWUP-44
title: "Run the palette-truncation real-host smoke on the settled /rc:login description (designer prediction P1)"
state: Backlog
owner: null
epic: EPIC-7
goal: Observe in a real pi session whether the 77-character settled `rc:login` palette row truncates before the `--headless` token at typical widths; if the real-host observation shows truncation cutting the `--headless` token, swap the settled 77-char description for the pre-authorized owner-r2 shorter fallback form that still satisfies EV-16's acceptance constraints (contains `--headless` and the condition), re-pin the byte-exact real-boundary assertions, and name the swap. Running the smoke and finding no truncation closes the card with the observation recorded.
---

## Intent

Filed from EV-16's step 13, held in-container by draft title, then confirmed
`File` with **one amendment** to the draft goal's contingency clause by a
`product-owner` ruling (job-18). Recorded disposition, verbatim:

> Mode: File — actionable: confidence 0.58 < choice floor 0.60 — Run the
> palette-truncation real-host smoke on the settled /rc:login description
> (designer prediction P1) (active)

The amendment (ruling, verbatim substance): the recorded contingency is not
"do not lengthen the string" but the **owner-r2 shorter fallback form** — if
the real-host observation shows truncation cutting the `--headless` token,
the card swaps the settled 77-char description for the pre-authorized shorter
form that still satisfies EV-16's acceptance constraints (contains
`--headless` and the condition), re-pins the byte-exact real-boundary
assertions, and names the swap. Running the smoke and finding no truncation
closes the card with the observation recorded.

Source: designer prediction P1 (`council/cards/EV-16-deliberation/designer-r1.md`) —
"the truncation point falls inside the proposed description, leaving the user
without the `--headless` clause" — never run; the EV-16 run's one
open-untested residual (consolidator synthesis residual note). The settled
string, measured at 77 chars by the step-9 skeptic (O6), is the shortest
final candidate; `vault/wiki/Real-Surface Verification.md` grounds why only a
real host observes truncation — the load smoke pins the registered string,
not the rendered palette cell.

The contingency swap is a surface-copy change **pre-authorized by the
ruling**: the owner-r2 record carries the shorter-fallback contingency
("with fallback shorter form if truncation bites"), and the consolidator
synthesis records it as available implementation detail — so a swap inside
this card needs no new copy ruling. The swap's replacement must be shorter
than the settled 77-char string (a longer string cannot fix the truncation
the observation shows) and must still satisfy EV-16's acceptance constraints:
contains `--headless` and the condition.

## Acceptance

1. The smoke runs against a real `pi` host session: open the command palette,
   type `/rc:login`, capture the rendered row cell at typical palette widths.
   Record whether the visible description is truncated and where the
   truncation point falls relative to the `--headless` token.
2. No truncation cutting the token ⇒ the card closes with the observation
   recorded on this card; the settled string stands unchanged, no product
   diff.
3. Truncation cutting the token ⇒ swap the settled `rc:login` description for
   the pre-authorized owner-r2 shorter fallback form (shorter than 77 chars;
   contains `--headless` and the `no usable browser` condition); re-pin the
   byte-exact real-boundary assertions (strict-Proxy load-smoke pins and the
   stand-in harness pins); name the swap in the PR; `rc`/`rc:off` negative
   pins (no `--headless`) stay green.
4. No other copy changes ride this card.
