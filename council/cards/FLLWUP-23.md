---
id: FLLWUP-23
title: "Fix §5.10's inverted RFC-2119 keyword: MUST where MUST NOT is meant in the cross-tenant grant sentence"
state: In Review
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
