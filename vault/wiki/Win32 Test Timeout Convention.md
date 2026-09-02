---
title: Win32 Test Timeout Convention
type: concept
summary: Tests that spawn Windows processes carry an explicit 30s per-test timeout via test()'s third argument — never global/bunfig — because cold process start on CI exceeds bun's 5s default.
aliases: [win32 timeout convention, per-test timeout]
tags: [concept/testing, windows, ci]
sources: ["[[Win32 Test Timeout Convention]]"]
created: 2026-09-02
updated: 2026-09-02
---
**The convention:** any test that spawns a Windows process (`powershell.exe`, `icacls`, `whoami` chains) carries an explicit per-test timeout of **30 000 ms** via `test("…", fn, 30_000)` — bun's third-argument form. Never a global or bunfig-level timeout (that would inflate every test's failure signal repo-wide), never per-`describe` (the spawn is per-test). **Transitive spawn tests** — tests that pass through a code path which internally spawns (4 of them in `credential.test.ts`) — stay on the 5s default by stated ruling: only the test that directly owns the process boundary pays the budget.

**Provenance deviation, stated:** this convention has no `vault/raw/` source file. Its provenance is the council record — `council/cards/FLLWUP-16.md` — and PR #19 (merge `d458478`, head `10118e7`), where the full council (deliberation, Skeptic pre-implementation run, judge) settled mechanism, value, and scope. Filed directly as a concept because the raw layer had nothing to ingest; if a future ruling contradicts this page, the card record and PR are the authority.

**Evidence:** the failure mode was observed twice in CI, both times on `gates-windows` only, both times passing on rerun at the same SHA (run `33546082482` on `main` at `0fa852b`, and FLLWUP-7's merge-check run) — bun's 5s per-test default killed a `powershell.exe` cold start (`"killed 1 dangling process"`, `exitCode: null`). Post-fix, the 30s budget held green on `windows-latest` across the PR head and merged SHA. A flaky criterion-2 failure is handled per the [[Deterministic Merge Check]] precedent (rerun + clean re-read, never a lowered bar) — this convention removes the flake source instead.

## Related
[[credential.ts]], [[Deterministic Merge Check]], [[Verify Cycle Cap]], [[Fixture-Green Honesty]]

## Sources
Provenance: `council/cards/FLLWUP-16.md`, PR #19 (`d458478`). No `vault/raw/` file — deviation stated above.
