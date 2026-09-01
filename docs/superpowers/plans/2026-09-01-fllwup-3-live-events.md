# FLLWUP-3 Live Events Mapper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map the remaining live pi events (`queue_update`, `bash_execution_update`, `auto_retry_*`, `summarization_retry_*`) and land the settled conditional `tool_execution_update` split (`pi.tool.update` / `pi.tool.progress`) in the pure EV-4 fold.

**Architecture:** Mapper-only extension of `src/translate.ts`'s `PiEvent` union + `translateLive` switch cases, pinned by fixtures in `test/translate.test.ts`, plus a verbatim `docs/PI-SPEC.md` §4 amendment. No `index.ts` changes (dead-wiring grep gate).

**Tech Stack:** Bun + TypeScript, no new dependencies, no new imports in `translate.ts`.

**Spec:** `docs/superpowers/specs/2026-09-01-FLLWUP-3-design.md` — the contract. The mapping table (§3), conditional-emission matrix (§4), fixture/gate list (§5), doc-comment requirements (§6), and PI-SPEC amendment text (§7) are copied from there verbatim; this plan does not re-derive them.

## Global Constraints

- Pure fold unchanged: `translate(input, state)` signature, purity guards G-11/G-12 green, no new imports in `translate.ts`.
- `CUSTOM` shape `{ type: "CUSTOM", name: "pi.<category>", value: { pi, data } }`; `name` sole dispatch key; `data` verbatim passthrough.
- NO `index.ts` changes of any kind. `grep -nE 'deps\.on\("(queue_update|bash_execution_update|auto_retry_start|auto_retry_end|summarization_retry_scheduled|summarization_retry_attempt_start|summarization_retry_finished)"' index.ts` exits 1; `grep -n "as PiEvent" index.ts` exits 1.
- Gates in order: `bunx tsc --noEmit` exit 0 → `bun test` exit 0 (155 baseline + new fixtures) → grep gates → determinism double-run.
- Conventional Commits: `feat(translate)` for code+tests, `docs` for the PI-SPEC amendment.

---

### Task 1: Failing fixtures first (TDD red)

**Files:**
- Modify: `test/translate.test.ts`

- [ ] Add a `describe("FLLWUP-3 ...")` block with, per §5:
  1. Per-event single-frame fixtures for rows 1–5 and 7 (exact `name`, `value.pi`, `value.data`).
  2. Two `summarization_retry_attempt_start` fixtures (6a branchSummary → `pi.session.summary_retry_branch`; 6b compaction → `pi.session.summary_retry_compaction`).
  3. Conditional-emission matrix fixtures (§4): both fields → exactly `[pi.tool.update, pi.tool.progress]` in order with `toolCallId` on both; args-only → 1 update 0 progress; partialResult-only → 1 progress 0 update; `partialResult: ""` → progress emitted. No `TOOL_CALL_ARGS` in any output.
  4. O-5 neither-field pin: `{toolCallId}` alone → exactly 0 frames.
  5. Row 6c pin: `source` neither value → exactly 0 frames (out-of-union payload via deliberate cast).
  6. Live/replay non-collapse (H3): JSONL `bash_execution` ≠ `pi.tool.bash_execution_update`; live `bash_execution_update` ≠ `pi.tool.bash_execution`.
  7. Determinism double-run over a sequence containing every new event: byte-identical frames.
- [ ] Update the existing O2 fixture (3 asserted frames → 4) — same change set as the split.
- [ ] Run `bun test` → new fixtures FAIL (events unmapped; `default: break` drops them). Red confirmed.

### Task 2: Union + fold cases (green)

**Files:**
- Modify: `src/translate.ts` (PiEvent union + `translateLive` cases; no new imports)

- [ ] Add the seven new `PiEvent` variants per spec §3 (`summarization_retry_attempt_start` carries `data: { source: "branchSummary" } | { source: "compaction"; reason: string }`; the fold inspects `data.source`).
- [ ] Replace the `tool_execution_update` case with the §4 conditional split + §6 doc-comment (H2/H7 rationale).
- [ ] Add cases: `queue_update` (snapshot note), `bash_execution_update` (J-1 doc-comment per §6), `auto_retry_start`, `auto_retry_end`, `summarization_retry_scheduled`, `summarization_retry_attempt_start` (6a/6b/6c fan-out), `summarization_retry_finished`.
- [ ] Run `bun test` → all green (155 baseline + new). Run `bunx tsc --noEmit` → 0.
- [ ] Commit: `feat(translate): map remaining live pi events and split tool_execution_update`.

### Task 3: PI-SPEC §4 amendment (verbatim from spec §7)

**Files:**
- Modify: `docs/PI-SPEC.md`

- [ ] Add the five table rows below the `model_select, thinking_level_select, session_info_changed` row.
- [ ] Add the evidence-cited caveat paragraph immediately after the table's closing paragraph, scoped to the four new families only (O-1), explicitly excluding `pi.tool.update`/`pi.tool.progress`.
- [ ] Run all gates: tsc, bun test, dead-wiring greps, purity greps.
- [ ] Commit: `docs: record FLLWUP-3 live-event mappings in PI-SPEC §4`.

### Task 4: PR

- [ ] Push `flluwp-3-live-events` to origin; open PR with `gh` (base main) referencing FLLWUP-3.
