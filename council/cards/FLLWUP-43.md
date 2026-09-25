---
id: FLLWUP-43
title: "Wire a real platform browser opener into the production entry so login.failure.browserOpenFailed is production-reachable"
state: Backlog
owner: null
epic: EPIC-7
goal: The production entry supplies a real `openUrl` dep (platform opener via the host surface, e.g. `pi.exec` invoking the platform open/xdg-open/cmd start), so an attended `/rc:login` on a browserless machine actually reaches the Phase-1-fixed `browserOpenFailed` row; tests pin the wired opener path, the failure route, and the absent-opener fallback.
---

## Intent

Filed from EV-16's step 13, held in-container by draft title, then confirmed
`File` by a `product-owner` ruling (job-18) — "title and goal as drafted — no
amendment". Recorded disposition, verbatim:

> Mode: File — duplicate: certainty 0.55 < noul threshold 0.60 — Wire a real
> platform browser opener into the production entry so
> login.failure.browserOpenFailed is production-reachable (active)

EV-16 landed the `login.failure.browserOpenFailed` row and the settled
`openUrl` contract, but the production entry's deps object supplies no
`openUrl` — the failure branch is production-dormant, and PR #50's dormancy
disclosure names exactly this follow-up card. This card closes that dormancy.

The settled `openUrl` contract from EV-16's design
(`docs/superpowers/specs/2026-09-25-EV-16-design.md`, deliberation record in
`council/cards/EV-16-deliberation/`) is carried into this card as
**already-settled design, not relitigated**: `openUrl` absent ⇒ proceed with
the conditional `opening` print; present-and-false/rejects ⇒ the
`login.failure.browserOpenFailed` row + `{ kind: "failure", reason:
"browserOpenFailed" }`, with the attempt before the fallback print.

Grounding the ruling cited: EV-16's settled design §8 ("No opener wiring in
EV-16 (follow-up card)" — the principal's `pi.exec` sketch is the starting
point); consolidator synthesis S10 (the dead-row finding deliberately deferred
to this card); `vault/wiki/Real-Surface Verification.md` and
`vault/wiki/Fixture-Green Honesty.md` (a fixture-injected `openUrl` proves
nothing about a real user reaching the row).

## Acceptance

1. The production entry's deps object (the factory closure in `index.ts`)
   supplies a real `openUrl` implemented through the host surface — e.g.
   `pi.exec` invoking the platform opener (`open` / `xdg-open` /
   `cmd /c start`), per the design spec's named starting sketch. No hardcoded
   endpoint paths; the opener's failure is a genuine production condition on a
   browserless host.
2. With the wired opener failing (resolves `false` or rejects), an attended
   `/rc:login` emits the Phase-1-fixed `login.failure.browserOpenFailed` row
   and does not print the fallback or waiting lines; outcome is
   `{ kind: "failure", reason: "browserOpenFailed" }` — the settled contract,
   re-pinned with the real dep wired.
3. With `openUrl` absent (or injectable absence in tests), behavior stays as
   EV-16 landed: no `opening` print, fallback + waiting proceed, no failure
   row.
4. Tests pin the wired opener path, the failure route, and the
   absent-opener fallback; the full suite and typecheck stay green, and the
   production boot/load gate still passes with the opener wired.
5. The production-reachability change is named in the PR (the dormancy
   disclosed by PR #50 is closed); any AGENTS.md / spec prose that still
   describes the branch as fixture-only is synced in the same PR.
