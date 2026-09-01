---
id: FLLWUP-1
title: "Sync README with the OAuth2 enrollment reality"
state: Done
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

### Step 8 — owner plans, then implements (job-40.1, settled 11.4m, 18 turns)

Owner implemented in isolated worktree `.worktrees/flluwp-1-readme-sync` on
branch `flluwp-1-readme-sync` (based on main @ 259a9d7); single commit
`2cbfe44 docs: sync README with /rc:login OAuth2 enrollment (FLLWUP-1)`
(README.md only, 34+/7-). PR **#12** open against main. Head SHA
`2cbfe4491e6a87793c2245e8864ab3c174a959b0` (PR headRefOid matches). Local
gates re-run in the worktree after the edit: `bunx tsc --noEmit` exit 0;
`bun test` 155 pass / 0 fail / 869 expect — exit 0. Owner's acceptance
evidence: zero `PI_REMOTE_HOST_KEY` and zero `/rc-off` in README (grep exit
1); colon table rows `/rc` / `/rc:login` (attended + `--headless`) /
`/rc:off` with bare-`/rc` no-credential refusal naming `/rc:login` and
`/rc:login`-while-live refusal "close the tunnel first with /rc:off"; full
seven-state footer in lifecycle order; new `## Credential storage` section
with POSIX 0600 + Windows chmod no-op caveat; `PI_REMOTE` occurs exactly
once (the URL override), "Credentials are never carried in environment
variables" present. Owner's stated deviations: no plan file written
(mechanical handoff IS the plan — adjudicated scope); "Not yet installable"
tagline left intact after a contradiction check (no contradiction found);
spec-vs-README register choices for the credential section. Facilitator
then verified the observed artifacts directly: `gh pr view 12` → OPEN,
base main, headRefOid 2cbfe449…, mergeable MERGEABLE; `gh pr checks 12` →
`gates` workflow SUCCESS (two rows, both gates/SUCCESS); main worktree
clean (`git status --short` empty, no cached diff — no leaked deltas
recurred). Step-8 condition met: branch exists with an open PR → `In
Review` from the observed artifacts, per council.md step 8.

### Step 9 — Skeptic verification (job-40.2, settled 3.2m, 14 turns)

Skeptic verified the branch at head `2cbfe4491e6a87793c2245e8864ab3c174a959b0`
(PR #12). **Verdict: no open objections.** Gates re-run on the branch: `bunx
tsc --noEmit` exit 0; `bun test` 155 pass / 0 fail / 869 expect, exit 0.
All acceptance probes closed-green, each actually run: `PI_REMOTE_HOST_KEY`
absent (grep exit 1); `/rc-off` absent (colon namespace only); setup section
names `/rc:login` attended (default) + `--headless` with PKCE/RFC 8252
loopback and RFC 8628 device-flow semantics; seven footer states in lifecycle
order (off → not enrolled → authorizing → dialing → resyncing → live →
error); credential-storage section with POSIX 0600 tmp+fsync+rename AND
Windows chmod-no-op caveat; `PI_REMOTE_SERVER_URL` sole env override with
"Credentials are never carried in environment variables"; `/rc:login`
while-live refusal and bare-`/rc` no-credential refusal naming `/rc:login`;
scope — `gh pr diff 12 --name-only` lists README.md only. Gate integrity:
injected `PI_REMOTE_HOST_KEY` caught on line 121 and `/rc-off` caught on
lines 85/86/91, both restored; tsc/test measure TypeScript not content, so
the grep assertions ARE the content gates and provably fail when they
should. Contradiction sweep vs §7.2/§8 of the rewritten spec: no
contradictions found. Skeptic explicitly noted (non-objection): the README
now carries the EV-8 J5 while-live refusal copy, which spec §8's `/rc:login`
row itself never gained — README ahead of spec, not a contradiction; carried
to step 13 as a surfaced-but-undone item.

### Step 10 — Judge stop condition (job-40.3, settled 0.4m, 10 turns)

Judge dispatched per the binding step-10 rule (product-owner ruling,
vault/raw/2026-08-31-po-ev1-step10-judge-object.md): object = the PR branch
at the Skeptic-verified SHA 2cbfe44, not main. Input was the card's goal +
the Skeptic's evidence, nothing else. **Verdict: PASS.** Judge independently
re-ran the decisive checks at the SHA: `git show 2cbfe44:README.md | grep
PI_REMOTE_HOST_KEY` exit 1, `PI_REMOTE_SERVER_URL` the only env var named
(line 118) with "Credentials are never carried in environment variables";
Install section documents `/rc:login` attended (default) + `--headless`;
command table has `/rc:login` with while-live refusal and `/rc:off`; no
`/rc-off` anywhere. Basis: README matches the EV-1 rewritten spec §7.2/§8 —
no legacy host-key or env-var enrollment, `/rc:login` is the sole documented
enrollment path.

### Step 11 — merge gate (deterministic merge check, all five criteria)

Per features-deliver.md the human merge gate is the deterministic artifact
check; executed mechanically, no discretion. Immediately pre-merge,
re-read `gh pr checks 12 --json name,state,workflow` → `gates` workflow
SUCCESS (two rows, keyed on the `workflow` field, not the job name), and
`gh pr view 12 --json headRefOid` → 2cbfe4491e6a87793c2245e8864ab3c174a959b0
= the exact SHA the Skeptic verified and the judge PASSed. Five criteria:
(1) owner gates green in full — tsc exit 0, bun test 155/0, each re-run by
the owner, the Skeptic, and the judge; (2) GitHub Actions `gates` workflow
SUCCESS on the PR head SHA; (3) no blocking Skeptic objection (all
closed-green); (4) judge verdict PASS; (5) no Needs Human state, no
outstanding ruling. Merged via `gh pr merge 12 --merge --match-head-commit
2cbfe4491e6a87793c2245e8864ab3c174a959b0` (=head match enforced; a mismatch
would have halted). PR #12 MERGED at 2026-09-01T01:55:00Z, merge commit
**0d6dd9725180686c97afc810df85013dbdabc760**. CI on the merged SHA:
`gh api .../commits/0d6dd97.../check-runs` → `gates` completed, conclusion
success.

### Step 12 — sync and reconcile

`git fetch origin main` + `git merge --ff-only origin/main` → clean
fast-forward 055f4a9..0d6dd97 (README.md +34/−7). Card set `Done` on
frontmatter and board from the observed artifacts — merged (0d6dd97) with
CI green on the merged SHA — never from a seat's report. validate.py clean;
commit + push the reconciliation.
