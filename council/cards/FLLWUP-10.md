---
id: FLLWUP-10
title: "Sync spec §8 /rc:login row with the while-live refusal"
state: Done
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
Card set `In Progress` on frontmatter and board; validate.py clean; board
commit 4bdc73e.

### Step 8 — owner plans, then implements (job-41.1, settled 12.9m, 22 turns)

Owner implemented in isolated worktree on branch
`flluwp-10-spec-login-refusal`, based on origin/main @ 0a5629e; single
commit `aa65589 docs: §8 rc:login row names the while-live refusal
(FLLWUP-10)` touching only docs/PI-SPEC.md (`git diff --numstat` = `1 1`).
PR **#13** open against main, head SHA
`aa655892ce80621ce461fa9b04ac78f85b020190` (PR headRefOid matches). The §8
`/rc:login` Behavior cell gained, after "…on failure, prints what to do
next.": "Refuses to run while a tunnel is live — close the tunnel first
with /rc:off. The same refusal rule applies across all non-idle states
(dialing, resyncing, authorizing, error); the login driver is entered only
from off and not enrolled." — README-register opening sentence (README.md:85
phrasing) plus the full EV-8 J5 semantics. Local gates re-run in the
worktree after the edit: `bunx tsc --noEmit` exit 0; `bun test` 155 pass /
0 fail / 869 expect — exit 0 (card baseline exactly). Owner's acceptance
evidence: one-line diff (seven-state set and every other row byte-identical);
grep-verified README.md:85 and src/login.ts:240 unmodified and agreeing.
Facilitator then verified the observed artifacts directly: `gh pr view 13`
→ OPEN, base main, headRefOid aa65589…, mergeable MERGEABLE; `gh pr checks
13` → `gates` workflow SUCCESS (two rows, both gates/SUCCESS); `gh pr diff
13 --name-only` → docs/PI-SPEC.md only; main worktree clean (`git status
--short` empty — no leaked deltas recurred). Step-8 condition met: branch
exists with an open PR → `In Review` from the observed artifacts, per
council.md step 8 (the owner's gate report is not a precondition for the
transition). Board commit fbc16dc.

### Step 9 — Skeptic verification (job-41.2, settled 2.5m, 17 turns)

Skeptic verified the branch at head `aa655892ce80621ce461fa9b04ac78f85b020190`
(PR #13). **Verdict: no open objections.** All 10 objections closed-green,
each actually run: (1) §8 /rc:login row contains the exact remedy copy
"close the tunnel first with /rc:off" (grep exit 0); (2) row carries the
full J5 semantics (non-idle states, driver only from off/not enrolled);
(3) `git diff origin/main -- docs/PI-SPEC.md` is exactly one hunk touching
only the /rc:login row; (4) seven-state footer set byte-identical to main;
(5) grep consistency README.md + src/login.ts + §8 all carry "close the
tunnel first with /rc:off"; (6) docs-only diff (`--name-only` = docs/
PI-SPEC.md only); (7) `bunx tsc --noEmit` exit 0; (8) `bun test` 155 pass /
0 fail / 869 expect, exit 0. Gate integrity proven: `git show
origin/main:docs/PI-SPEC.md | grep -c "close the tunnel first"` exits 1 (the
pre-merge file lacks the sentence — the content gate provably fails where
the change is absent), and the repo's own test (index.test.ts) genuinely
asserts the refusal copy `loginEnglishFor("rc:login.refusal")` =
"close the tunnel first with /rc:off" is printed when /rc:login runs while
live (footer unchanged). Verify cycle 1 of ≤3: green, no fix round.

### Step 10 — Judge stop condition (job-41.3, settled 0.2m, 4 turns)

Judge dispatched per the binding step-10 rule (product-owner ruling,
vault/raw/2026-08-31-po-ev1-step10-judge-object.md, general rule — cited
in the dispatch): object = the PR branch at the Skeptic-verified SHA
aa65589, not main; input was the card's goal + the Skeptic's evidence,
nothing else. **Verdict: PASS.** Judge independently re-ran the decisive
test at the SHA: `git show aa65589:docs/PI-SPEC.md | grep -c "close the
tunnel first"` → 1 (refusal copy present in §8's /rc:login row), and the
negative `git show origin/main:docs/PI-SPEC.md | grep -c "close the tunnel
first"` → 0 (provably a new addition — exactly what the card requires).
Basis: spec §8 now aligns with the shipped implementation and README.

### Step 11 — merge gate (deterministic merge check, all five criteria)

Per features-deliver.md the human merge gate is the deterministic artifact
check; executed mechanically, no discretion. Immediately pre-merge,
re-read `gh pr checks 13 --json name,state,workflow` → `gates` workflow
SUCCESS (two rows, keyed on the `workflow` field, not the job name), and
`gh pr view 13 --json headRefOid` → aa655892ce80621ce461fa9b04ac78f85b020190
= the exact SHA the Skeptic verified and the judge PASSed. Five criteria:
(1) owner gates green in full — tsc exit 0, bun test 155/0, each re-run by
the owner, the Skeptic, and the judge; (2) GitHub Actions `gates` workflow
SUCCESS on the PR head SHA; (3) no blocking Skeptic objection (all
closed-green); (4) judge verdict PASS; (5) no Needs Human state, no
outstanding ruling. Merged via `gh pr merge 13 --merge --match-head-commit
aa655892ce80621ce461fa9b04ac78f85b020190` (=head match enforced; a
mismatch would have halted). PR #13 MERGED at 2026-09-01T02:16:30Z, merge
commit **3c4e32b8fef91fc12239d2c5c5337b87acd6097e**. CI on the merged SHA:
`gh api .../commits/3c4e32b.../check-runs` → `gates` completed,
conclusion success (polled to green).

### Step 12 — sync and reconcile

`git fetch origin main` — ff-only refused: origin/main advanced 0a5629e..
3c4e32b while local main carried this run's two unpushed council board
commits (decbef7, 5806031), a benign divergence (local commits touch only
council/; the merge touches only docs/PI-SPEC.md — disjoint). No forced
resolution: `git rebase origin/main` replayed the two local-only commits
onto the merge cleanly; verified `3c4e32b` IS an ancestor of the new HEAD
(the merge was fully preserved — nothing discarded) and the rebased local
commits still differ from 3c4e32b only under council/. Card set `Done` on
frontmatter and board from the observed artifacts — merged (3c4e32b) with
CI green on the merged SHA — never from a seat's report. validate.py clean;
commit + push the reconciliation below.

### Step 13 — follow-ups

Nothing new surfaced undone: the card's own drift (spec §8 behind the
while-live refusal) is closed by this merge; one objection category
(README ahead of spec) existed only as this card's premise and is now
converged across all three sources. No draft-then-confirm flow needed — no
follow-up cards written; nothing requiring a human approval gate.

### Step 14 — persist

No durable wiki artifact was surfaced for vault/ in this run (the wiki is
dry — the stub catalog has no module pages; nothing new to ingest).
Nothing under vault/ was hand-edited — the wiki-ingest channel belongs to
the orchestrator per the autonomy map.
