---
id: FLLWUP-10
title: "Sync spec §8 /rc:login row with the while-live refusal"
state: In Progress
owner: null
epic: EPIC-1
goal: docs/PI-SPEC.md §8's /rc:login row names the while-live refusal ("close the tunnel first with /rc:off") so the spec agrees with the shipped implementation and README copy.
---

## Intent

Filed from FLLWUP-1's step 13. The while-live refusal is a binding
product-owner ruling (EV-8 J5: `/rc:login` while the tunnel is live, dialing,
resyncing, authorizing, or error is refused with a single stated sentence —
"close the tunnel first with /rc:off" — the driver enters only from `off` and
`not enrolled`). The merged implementation and README both carry it; §8's
`/rc:login` row never gained it, leaving the spec behind the shipped behavior
it governs. Docs-only, one row. User-visible surface — the spec's command
table, the contract surface client and host operators read.

## Acceptance

- §8's `/rc:login` row states the while-live refusal with the exact remedy
  copy ("close the tunnel first with /rc:off"), matching the J5 ruling and
  the README register.
- No other §8 row or section changes; the seven-state set is untouched.
- grep consistency: README.md, src/login.ts (or index.ts), and §8 all carry
  the same refusal semantics.
- Docs-only PR — gates stay green (tsc exit 0, bun test 155 pass).

## Run record

### Step 1 — read and gate (facilitator record)

Card read in full; `state: Ready` at open. Classification: **mechanical** —
docs-only, single row of a single file (docs/PI-SPEC.md §8), and the content
decision is already adjudicated by a binding product-owner ruling (EV-8 J5,
recorded on council/cards/EV-8.md's step-6 RULINGS: `/rc:login` while the
tunnel is live, dialing, resyncing, authorizing, or error is refused with
the single stated sentence "close the tunnel first with /rc:off"; footer
unchanged; driver not entered; the driver enters only from `off` and
`not enrolled`). No tradeoff exists for a deliberation to weigh; goal and
acceptance are concrete, the remedy copy is dictated verbatim.
**Surface-touching: yes** — the spec's command table is the contract surface
client and host operators read. Mechanical + surface-touching seats no
`designer` (no deliberation to join); mechanical path: steps 2–6 skipped,
proceed to step 7.

Grounding recon: `vault/wiki/index.md` is an empty stub catalog (no module
pages — nothing to drill into; semantics grounded in docs/PI-SPEC.md itself,
which I read in full around §8). Confirmed by read: §8's `/rc:login` row
(line 363) describes attended/`--headless` flows, credential persistence,
and failure remedy — no while-live refusal; README.md's `/rc:login` row
(line 85) already carries "Refuses to run while a tunnel is live — close
the tunnel first with `/rc:off`"; `src/login.ts:240` carries
`"rc:login.refusal": "close the tunnel first with /rc:off"` (the shipped
implementation). Two of three sources of truth already agree; §8 lags — the
exact drift this card exists to close. No other §8 row needs touching; the
seven-state set (lines 367–381) is untouched by the goal. Gates for this
repo: `bunx tsc --noEmit` exit 0 and `bun test` exit 0 (155 green baseline),
enforced by `.github/workflows/gates.yml`; no Mongo, no import smoke, no
GATE-EVIDENCE.md. Seats resolved at card open: owner, skeptic, judge all
present in the packaged pi-council agents dir
(.pi/git/github.com/tistaharahap/pi-council/council/agents/); no repo-local
override shadows them.

### Step 7 — hand to one owner (mechanical path)

No deliberation ran, so no spec file is created (mechanical path ceremony
rule) — the owner's handoff IS the card itself (its `Intent`/`goal`/
`Acceptance`) plus the binding content decisions carried in the step-8
dispatch. Card set to `In Progress` on frontmatter and board; validate.py
clean below before the owner dispatch. Facilitator process notes carried
into the dispatch: owner alone; isolated worktree for ALL git work
(standing process note — a prior card's owner leaked staged deltas into the
main worktree's index); gates for this repo are `bunx tsc --noEmit` exit 0
and `bun test` exit 0 (155 green baseline), no Mongo, no GATE-EVIDENCE.md.
