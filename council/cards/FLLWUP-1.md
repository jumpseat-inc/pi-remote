---
id: FLLWUP-1
title: "Sync README with the OAuth2 enrollment reality"
state: In Progress
owner: null
epic: EPIC-1
goal: README.md no longer references PI_REMOTE_HOST_KEY or env-var-based enrollment and documents /rc:login OAuth2 enrollment as the setup path, matching the spec as rewritten by EV-1.
---

## Intent

Filed from EV-1's step 13 (objection O-13, closed-green, out of EV-1's
docs-only scope). EV-1 retired `PI_REMOTE_HOST_KEY` entirely (product-owner
ruling Q1, binding) and made settings-based OAuth2 enrollment the setup path,
but README.md line 93 still presents the old env-var setup. User-visible
surface — the README's setup section, the first thing a new host operator
reads; it currently instructs a setup path that no longer exists.

## Acceptance

- No occurrence of `PI_REMOTE_HOST_KEY` anywhere in README.md.
- The README's setup section names `/rc:login` (attended and unattended) as
  the enrollment path and matches docs/PI-SPEC.md §7.2's post-EV-1 text.
- Any other README prose contradicting the rewritten spec (command names,
  footer states) is brought in line in the same pass.

## Run record

### Step 1 — read and gate (facilitator record)

Card read in full; `state: Ready` at open. Classification: **mechanical** —
docs-only, single file (README.md), and every content decision is already
adjudicated by binding rulings (EV-1 Q1 `PI_REMOTE_HOST_KEY` retirement,
EV-7 J3 Windows credential caveat riding this card, EV-8 J2 URL-prompt
placement, EV-8 J5 `/rc:login`-while-live refusal, FLLWUP-2's seven-state
footer set, sole `PI_REMOTE_SERVER_URL` env override). No tradeoff exists for
a deliberation to weigh; goal and acceptance are concrete. **Surface-touching:
yes** — the README setup section is user-visible copy (the card's own Intent
says so). Mechanical + surface-touching seats no `designer` (no deliberation
to join). Mechanical path: steps 2–6 skipped, proceed to step 7.

Grounding recon: `vault/wiki/index.md` is an empty stub catalog (no module
pages — nothing to drill into; semantics grounded in docs/PI-SPEC.md post-
EV-1 text, which I read in full: §7.2 enrollment, §8 command surface + J2
amendment + seven-state footer list). README.md is untouched since the
initial commit fddb68b (EV-7 added no README content) — full sync required,
no reconciliation duplication. Current contradictions confirmed by read:
`/rc-off` (README:74, :78), `PI_REMOTE_HOST_KEY` (README:93), four-state
footer sentence (README:77), no `/rc:login` row anywhere, no credential-
storage section (spec §7.2 mandates one for the Windows caveat). Source
confirms the target reality: `src/login.ts` (`/rc:login`, `PI_REMOTE_SERVER_URL`
named in copy, `close the tunnel first with /rc:off` refusal), `src/merge.ts`
(seven-state footer union), zero `/rc-off` and zero `PI_REMOTE_HOST_KEY` in
src/. Seats resolved at card open: owner, skeptic, judge all present in the
packaged pi-council agents dir; no repo-local override shadows them.

### Step 7 — hand to one owner (mechanical path)

No deliberation ran, so no spec file is created (mechanical path ceremony
rule) — the owner's handoff IS the card itself plus the binding content
decisions carried from Phase 1/rulings, listed in the step-8 dispatch.
Card set to `In Progress` on frontmatter and board; validate.py clean
before the owner dispatch. Facilitator process notes: owner alone;
card goal/acceptance + binding decisions; isolated worktree for ALL git
work (standing process note — a prior card's owner leaked staged deltas
into the main worktree's index); gates for this repo are
`bunx tsc --noEmit` exit 0 and `bun test` exit 0 (155 green baseline), no
Mongo, no GATE-EVIDENCE.md (gates are the card's own acceptance commands).
