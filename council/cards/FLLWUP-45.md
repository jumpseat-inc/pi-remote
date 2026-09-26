---
id: FLLWUP-45
title: "EV-17 designer CDP smokes (P-A/P-D/E/F/P-G/P-H)"
state: Backlog
owner: null
epic: EPIC-7
goal: Run the six designer CDP smokes (P-A, P-D, P-E, P-F, P-G, P-H) from EV-17's deliberation against a real pi host, record each observation on this card, and close either way — observation-shaped; a prediction observed as predicted is closed-green on the record, and a falsified prediction is a recorded finding routed to its own follow-up card, never an in-card fix; no product diff rides this card.
---

## Intent

Filed from EV-17's step 13, held in-container by draft title, then confirmed `File` with
**one amendment to the draft goal's shape** by a `product-owner` ruling (job-24). Recorded
disposition, verbatim:

> **Ruling: File**, with one amendment to the draft goal's shape: the card is
> **observation-shaped** — it runs the six smokes against a real host, records the
> observations, and closes either way; a falsified prediction is a recorded finding routed
> to its own follow-up, **not** an in-card fix (unlike FLLWUP-44, no shorter-fallback
> remedy is pre-authorized here, so the card cannot carry a contingency swap). The draft
> title stands as written.

Source: designer predictions P-A, P-D, P-E, P-F, P-G, P-H
(`council/cards/EV-17-deliberation/designer-r1.md`, sharpened in `designer-r2.md`) — the
real-host smokes the EV-17 run never ran. P-B/P-C are pure-seam and already covered by
EV-17's acceptance tests; this card covers only the CDP/real-host residuals:

- **P-A** — the dialog mounts within one render frame of the `Waiting for browser…` line
  printing on the real host.
- **P-D** (r2-sharpened) — when the loopback callback wins, the dialog is gone from the
  rendered tree within one frame of the success line printing, and the abort was issued by
  the callback settle path.
- **P-E** (r2-sharpened) — when the redirect timer fires, the dialog is gone within one
  frame of the timeout line printing, the abort was issued by the timer settle path, and
  no `login.cancelled` line prints.
- **P-F** (r2-sharpened) — Escape/dismiss yields `false`, the dialog re-presents within
  one frame, the loopback listener stays awaiting `/callback`; when the signal aborts
  (legit win) the loop exits without re-arming (`waitForCancel` call count stops
  increasing).
- **P-G** — the host-controlled primary button label aligns with the message
  (`Cancel sign-in`, `Cancel`, or similar); not a correctness failure either way, but the
  observation is a record gap.
- **P-H** — `ui.confirm` does not block other command typing while open (type a command
  into the agent prompt with the dialog open; assert delivery). One CDP probe closes
  P-D/P-F/P-H together.

`vault/wiki/Real-Surface Verification.md` grounds why only a real host observes these —
the unit suite pins the wiring, not the rendered dialog.

The amendment's boundary is binding: this is an observation card, not a remediation card.
Unlike FLLWUP-44 (whose contingency swap was pre-authorized by its own ruling), **no
remedy is pre-authorized here** — the card cannot carry a contingency swap, and any
falsified prediction files its own follow-up.

## Acceptance

1. Each of the six smokes runs against a real `pi` host session (CDP where the prediction
   names rendering; a real `ui.confirm` probe for P-F/P-G/P-H), and the observation is
   recorded on this card per prediction — what was seen, not what was expected.
2. Each prediction is marked closed-green (observed as predicted) or closed-red
   (falsified) on the card, with the observed evidence.
3. A falsified prediction produces a recorded finding and its own follow-up card; no
   in-card fix is made and no contingency swap exists on this card.
4. No product diff rides this card.
