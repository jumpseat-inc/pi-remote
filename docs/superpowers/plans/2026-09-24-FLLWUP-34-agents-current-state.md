# FLLWUP-34 — Update AGENTS.md's "Current state" once FLLWUP-12 lands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AGENTS.md's stale "not yet loadable in a real `pi` host" bullet with the post-FLLWUP-11 + post-FLLWUP-12 reality, under FLLWUP-31's observe-and-state discipline.

**Architecture:** Docs-only change. The old bullet's claims are each checked against the cards' recorded outcomes (FLLWUP-11: real load green through the installed production loader; FLLWUP-12: the eleven live subscriptions' handler narrowing reconciled to the real SDK payload shapes) and rewritten as a state-of-the-repo statement that cannot rot into a new false claim.

**Tech Stack:** Markdown only. Gates `bunx tsc --noEmit` and `bun test` run as hygiene; no code change.

**Spec:** The card itself (mechanical path, no design-spec file): FLLWUP-34, filed from FLLWUP-11 step 13, confirmed File by product-owner ruling. Grounding: `council/cards/FLLWUP-11.md`, `council/cards/FLLWUP-12.md`, `council/cards/FLLWUP-31.md` (observe-and-state precedent), `vault/wiki/index.md` (Fixture-Green Honesty, Real-Surface Verification, Record Accuracy).

## Global Constraints

- Diff discipline: allowed — `AGENTS.md`, the plan file under `docs/superpowers/plans/`. Forbidden — anything under `council/`, `vault/`, `.pi/`; no other cards.
- Worktree `/home/tista/codes/pi-remote-fllwup-34`, branch `owner/fllwup-34-agents-current-state`, cut from `origin/main` at `94d0550` (the run's local `main` is never the base).
- Main checkout `/home/tista/codes/pi-remote` is immutable: no `git checkout` / `git switch` / `git reset` against it (R-CONV-1).
- Observe-and-state (FLLWUP-31): no count pinned as eternal. State the observed reality now; frame counts as completed events, not standing facts.
- Do not claim more than proven: FLLWUP-11 proved (a) a strict-Proxy load smoke green in-repo (`test/pi-sdk-load.test.ts`) and (b) a real load through the installed production loader (`loadExtensionFromFactory`) green with 11 subscriptions live — recorded on the card. Keep qualifications that remain true.
- No threshold lowered, no finding suppressed; gates run in full regardless of docs-only scope.

## Review Focus

- **Stale-claim honesty:** the new text must not introduce a new eternal count or an unproven capability claim. Pinned by Task 1 step 3 (self-review against the proven set).
- **Diff containment:** nothing outside `AGENTS.md` + plan file. Pinned by Task 2 step 1 (`git diff --stat origin/main`).
- **Gates not skipped because docs-only:** both gates run and observed, not assumed. Pinned by Task 3 steps 1–2.

---

### Task 1: Rewrite the stale bullet

**Files:**
- Modify: `AGENTS.md` (`## Current state`, third bullet)
- Create: `docs/superpowers/plans/2026-09-24-FLLWUP-34-agents-current-state.md` (this plan)

**Interfaces:**
- Consumes: FLLWUP-11 and FLLWUP-12 recorded outcomes (cards), FLLWUP-31's observe-and-state wording precedent.
- Produces: one replacement bullet stating the post-FLLWUP-11 + post-FLLWUP-12 reality.

- [ ] **Step 1: Replace the stale bullet**

  Old text (verbatim, AGENTS.md `## Current state`, third bullet):

  > - **Not yet loadable in a real `pi` host.** `index.ts` binds a local
  >   `ExtensionAPI` stand-in whose non-`on` members (`getSetting`, `env`,
  >   `configDir`, `sessionId`, `readActiveBranch`, …) have no counterpart on
  >   the installed `pi` SDK, so a real host fails at load. FLLWUP-11 and
  >   FLLWUP-12 (`council/cards/`, tracked in `council/board.md`) gate that
  >   reconciliation. Do not claim installability until they land.

  New text (verbatim replacement):

  > - **Loadable in a real `pi` host.** `index.ts` binds the real
  >   `ExtensionAPI` surface (FLLWUP-11): a real load through the installed
  >   production loader was proven green, and a strict-Proxy load smoke
  >   (`test/pi-sdk-load.test.ts`) keeps the entry pinned to the real loader's
  >   member names. Handler payload narrowing matches the installed SDK's
  >   event payloads (FLLWUP-12): the live subscriptions' handler narrowing
  >   was reconciled against the SDK's payload types, with real-shaped
  >   fixtures feeding the live path. Do not claim beyond what is proven
  >   above.

  Discipline notes: counts are framed as completed events ("was proven",
  "was reconciled"), never as standing facts; the council-card pointers are
  kept only as provenance, not as live gating instructions; nothing claims
  beyond real-load-green + surface-pinned + payload-narrowing-reconciled.

- [ ] **Step 2: Verify the plan file exists at its final path**

  Run: `test -f docs/superpowers/plans/2026-09-24-FLLWUP-34-agents-current-state.md && echo ok`
  Expected: `ok`.

- [ ] **Step 3: Self-review against the proven set**

  Re-read the replacement against FLLWUP-11/12's recorded outcomes: every
  claim maps to a recorded, skeptic-verified outcome; no eternal count; no
  claim beyond what the cards recorded. Fix any overstatement before
  committing.

- [ ] **Step 4: Commit**

  ```bash
  git add AGENTS.md docs/superpowers/plans/2026-09-24-FLLWUP-34-agents-current-state.md
  git commit -m "docs: update AGENTS.md Current state for real-host loadability (FLLWUP-12)"
  ```

### Task 2: Diff containment check

**Files:** none (verification only)

- [ ] **Step 1: Confirm product-only diff**

  Run: `git diff --stat origin/main`
  Expected: exactly `AGENTS.md` and the plan file, nothing else. Any other
  path is a hard stop.

### Task 3: Gates in full, in the worktree

**Files:** none (verification only)

**Interfaces:**
- Consumes: the Task 1 commit at HEAD.
- Produces: observed gate results, reported verbatim in the owner's turn output.

- [ ] **Step 1: Typecheck**

  Run: `bunx tsc --noEmit; echo "exit=$?"`
  Expected: `exit=0`.

- [ ] **Step 2: Unit suite**

  Run: `bun test`
  Expected: all-pass; the Windows-gated credential-ACL skip on non-Windows is
  the only expected non-pass. Record actual pass/skip/fail counts.

- [ ] **Step 3: Record and report**

  Record each gate's actual exit code and counts; report verbatim in the
  owner's turn output. A failing gate is a hard stop-and-fix, not a note.

### Task 4: Push and open the PR

**Files:** none (git operations only)

- [ ] **Step 1: Push**

  ```bash
  git push -u origin owner/fllwup-34-agents-current-state
  ```

  If remote auth fails, report the exact error — no improvised credential
  workarounds.

- [ ] **Step 2: Open PR against main**

  ```bash
  gh pr create --base main --head owner/fllwup-34-agents-current-state \
    --title "docs: update AGENTS.md Current state for real-host loadability (FLLWUP-12)" \
    --body "Update AGENTS.md's stale 'Not yet loadable in a real pi host' bullet (FLLWUP-34). FLLWUP-11 (PR #38) proved a real load through the installed production loader; FLLWUP-12 (PR #39) reconciled handler payload narrowing with the real SDK event payloads. Docs-only; no other content change. Observe-and-state discipline per FLLWUP-31."
  ```

- [ ] **Step 3: Report and end the turn**

  Report: worktree path, branch, PR URL/number, headRefOid, the final
  "Current state" bullet verbatim, and each gate's actual result. Do not poll
  CI; do not merge.
