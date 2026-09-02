---
id: FLLWUP-23
title: "Fix §5.10's inverted RFC-2119 keyword: MUST where MUST NOT is meant in the cross-tenant grant sentence"
state: Done
owner: null
epic: EPIC-2
goal: docs/SERVER-SIDE-SPEC.md §5.10's sentence "there is no cross-tenant grant, and no conformant server MUST honor a grant request naming a subject outside the admin's tenant" is corrected so the keyword matches the intended normativity — a conformant server MUST NOT honor such a request — per the EV-12 rule that a normative keyword must bind the behavior it names.
---

## Intent

Filed from EV-14's normativity sweep (EV-12 general rule: every MUST/SHOULD
must name an observation point and bind the intended behavior), recorded
council-side on council/cards/EV-14.md, per the orchestrator's standing
instruction to file audit failures rather than fix them silently on the
assembly PR.

The defect, pinned by the Skeptic at PR #25 head `998fa3f` (§5.10, lines
1643–44): the negated subject ("no conformant server") combined with `MUST`
reads as "no server is *required* to honor" — permission-shaped, leaving a
server that does honor a cross-tenant grant request technically conformant.
The sentence's evident intent, and the trust model §5.7–§5.8 enforce, is that
honoring such a request is a violation. The fix is the keyword: `MUST NOT`
inside the negated construction (or the sentence restructured so the keyword
binds positively), with no other §5.10 change. One sentence, docs-only.

## Acceptance

- The sentence binds non-honoring as a requirement (MUST NOT, or an
  equivalent positive restatement naming the wire-observable consequence).
- No other §5.10 change; the enforcement algorithm at §5.7 is untouched.
- bunx tsc --noEmit exit 0; bun test exit 0 (docs-only; suite untouched).

## Step 9 — Skeptic verification (job-2.2; PASS)

Verified in a throwaway worktree at PR #27 head `6e94151419916c82238f4d1558b39e0b24eb59de`; no branch modification, no pushes, probe artifacts removed. All checks **closed-green** by actual observed output:

1. PR #27 `state: OPEN` at head `6e941514…59de`, not merged.
2. Diff confined: docs/SERVER-SIDE-SPEC.md changes exactly one hunk (`@@ -1640,8 +1640,8 @@`, 2 del/2 add — the one sentence); scope-union paragraph, the `404 (no existence leak…)` sentence, and the `Partition {204,…,5xx}` line byte-identical; §5.7 untouched; zero `src/`/`test/` files in the diff; no merge commits in range.
3. Normativity: `MUST NOT honor` now binds non-honoring (honoring a cross-tenant grant ⇒ non-conformant) per the EV-12 Normativity Test; the descriptive "there is no cross-tenant grant" clause is kept separate; observation point is the unchanged wire consequence directly below (other-tenant `sub` → `404`). No residual ambiguity.
4. Gates re-run at PR head (fresh bun install): `bunx tsc --noEmit` exit 0; `bun test` → `218 pass / 1 skip / 0 fail` (win32 ACL platform skip), exit 0. Both gates proven fail-capable by injection (type error → tsc exit 1; failing assertion → bun test exit 1), then restored.
5. Plan file `docs/superpowers/plans/fllwup-23-must-not-cross-tenant.md` exists, matches the shipped diff verbatim, no placeholder text.

Non-blocking note (closed-green): the PR branch carries the `Ready → In Progress` bookkeeping while the `In Progress → In Review` transition is main-side (`0573fcd`) — the normal branch-for-work-start / main-for-PR-open split, not a PR defect.

**Verdict: PASS — no open objections, no open-untested items.** Step-9 cycle counter: 1 of 3 used.

## Step 10 — Judge dispatch (job-2.3; PASS)

Judge dispatched with exactly the card's `goal` plus the Skeptic's step-9 evidence — nothing else — and framed per the standing step-10 rule (product-owner general rule, vault/raw/2026-08-31-po-ev1-step10-judge-object.md, wiki: Judge Object Rule): it evaluates the PR branch at the Skeptic-verified SHA (PR #27, head `6e941514`), not main. Settled in 1.6 minutes. Verdict: **PASS**.

Basis (summary): (1) the new `MUST NOT` is a prohibition — it names the observation point (whether a server honors a cross-tenant grant request) and binds non-honoring as a requirement, satisfying the EV-12 rule; the descriptive clause remains a separate factual statement; (2) scope confined — exactly one hunk in one file, §5.7 untouched, no source/test files; (3) wire consistency preserved — the unchanged downstream observable (other-tenant `sub` → `404`) aligns with the new norm.

## Step 11 (autonomous form) — deterministic merge check

All five criteria confirmed against the PR head SHA `6e94151419916c82238f4d1558b39e0b24eb59de`:

1. Owner gates green in full — skeptic-verified (`tsc --noEmit` exit 0; `bun test` 218 pass / 1 skip / 0 fail; both proven fail-capable by injection).
2. GitHub Actions green on the PR head SHA — `gh pr checks 27 --json name,state,workflow` keyed on the `workflow` field: `gates` and `gates-windows` both present with `state: SUCCESS`. Head SHA re-read immediately before merging: still `6e941514…`.
3. No blocking Skeptic objection — step 9 PASS, none.
4. Judge verdict `PASS` — step 10.
5. No `Needs Human` state or outstanding ruling — card `In Review`; the defect's governing rule (EV-12 Normativity Test) was a recorded audit finding applied as written.

**Merge executed and pinned:** `gh pr merge 27 --merge --match-head-commit 6e94151419916c82238f4d1558b39e0b24eb59de` → PR state MERGED, merge commit `a07e3221fe32804bba071a9d126daa3fd4cdc739`.

## Step 12 — Sync and reconcile

Local main had diverged (three council bookkeeping commits ahead of `90ed2fe` while origin/main held the merge); reconciled by `git rebase origin/main` — merge commit `a07e322` preserved untouched, bookkeeping replayed on top. Post-rebase verification: `git diff 6e941514 HEAD -- docs/SERVER-SIDE-SPEC.md` is empty (merged implementation byte-identical to the PR head the criteria were checked against). CI on the merged SHA observed directly: `gates` workflow `conclusion: success`, `status: completed` at `a07e322` on main.

Card set **Done** on both the card face and the board from these observed artifacts. Reconciliation committed to main and pushed.
