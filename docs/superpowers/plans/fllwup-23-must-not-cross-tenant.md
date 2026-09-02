# Plan: FLLWUP-23 — §5.10 inverted RFC-2119 keyword (MUST where MUST NOT is meant)

## Card

[council/cards/FLLWUP-23.md](../../../council/cards/FLLWUP-23.md) — one
sentence in `docs/SERVER-SIDE-SPEC.md` §5.10 binds the wrong behavior.

## Defect (verified in the working tree at lines 1642–1644)

> **Grants are explicitly scoped to the admin token's own tenant:** there
> is no cross-tenant grant, and no conformant server MUST honor a grant
> request naming a subject outside the admin's tenant.

The negated subject ("no conformant server") + `MUST` is permission-shaped:
it reads "no server is *required* to honor" — a server that does honor a
cross-tenant grant request remains technically conformant. The intent per
the trust model (§5.7–§5.8) is that honoring such a request is a violation.

## Governing rule

[vault/wiki/Normativity Test.md](../../../vault/wiki/Normativity Test.md)
(EV-12 general rule, applied by EV-14's audit): **every MUST or SHOULD must
bind the behavior it names and name its observation point** — the wire, a
conformance harness, or a restated consequence of an existing invariant.
The wiki explicitly cites this exact sentence as a shipped defect filed as
FLLWUP-23.

The fix satisfies the test: `MUST NOT honor` binds non-honoring (the
behavior the sentence means), and the observation point is the wire — the
next sentence already pins the observable consequence (an other-tenant
`sub` is `404`, no existence leak), which stays untouched.

## Change (exactly one sentence, docs-only)

**Before:**

> …there is no cross-tenant grant, and no conformant server MUST honor a
> grant request naming a subject outside the admin's tenant.

**After:**

> …there is no cross-tenant grant, and a conformant server MUST NOT honor
> a grant request naming a subject outside the admin's tenant.

Scope union stays exactly `{pi-remote:host, pi-remote:admin}`; §5.7's
enforcement algorithm untouched; 404/no-existence-leak semantics untouched;
grants stay tenant-scoped to the admin token's own tenant (EV-13 Q1/Q3 —
not relitigated). Nothing else in the file changes; no source or test
files change.

## Gates (in order, hard stops)

1. `bunx tsc --noEmit` — exit 0
2. `bun test` — exit 0 (docs-only; suite untouched)

Record actual output; no assertion without running.

## Git

- Worktree: `.pi/worktrees/fllwup-23`, branch `fix/fllwup-23-must-not-cross-tenant`
- Commit: `docs(spec): bind cross-tenant grant refusal with MUST NOT in §5.10`
- Push branch, open PR with `gh pr create`, include this plan file.
