# FLLWUP-16 design — explicit timeout for the Windows SDDL read-back test

Card: `council/cards/FLLWUP-16.md` (epic EPIC-1). Settled by Council
deliberation round 1 (owner + principal), Skeptic verification (O1–O7), and
consolidator synthesis — no open judgment, no blocking objections.

## Problem

The single win32-gated read-back test in `test/credential.test.ts`
("win32 ACL read-back (SDDL via icacls /save): …") spawns external processes
on windows-latest CI. Under load, a `powershell.exe` cold start has twice
exceeded bun's 5s per-test default (observed: FLLWUP-7 merge check; main at
0fa852b, run 33546082482 — "killed 1 dangling process", `exitCode: null`).
Bun kills child processes spawned during a timed-out test, so a slow cold
start reads as a gate failure even though the gate is sound. False
merge-block criterion-2 failures will recur on every future
Windows-touching card unless the budget is sized for cold start.

## Settled design

- **Mechanism: per-test timeout via the third argument to `test()`.**
  Not global (`bun test --timeout` / `bunfig.toml [test]`) — that would hand
  every pure/filesystem test a 30s budget and lengthen hang-failure latency
  suite-wide, violating "POSIX-side tests unaffected" in effect. Not
  per-suite — bun has no per-describe timeout; `setDefaultTimeout` is
  file-scoped and would widen the ~10 pure tests in the same `describe`,
  whose 5s default is the hang detector we want to keep. The risk is scoped
  to one test body, so the budget lives at that scope; on ubuntu the test
  skips and the third argument is never consulted.
- **Value: `30_000` ms.** The body executes **8 sequential spawns** on the
  win32 success path (2 per `saveCredential`→`defaultApplyAcl` at
  `credential.ts:111,120` — initial save at test `:234` and re-enroll at
  `:279` — plus 4 direct `Bun.spawnSync` calls: whoami `:239`, icacls /save
  `:245`, powershell `:194`, icacls `:275`). Warm path is ~1–2s; the
  pathological case is a fresh runner's first `powershell.exe` execution
  under Defender/AMSI scan + .NET JIT. 30s is 6× the observed failure
  threshold and ~15–30× the warm path; the flake-cost asymmetry (false
  merge-block is expensive, headroom is free) picks 30s over 15s under
  Cheapest To Reverse. Still fails a genuinely hung `icacls` in
  CI-acceptable time.
- **Placement: one line.** The read-back test's closing becomes
  `}, 30_000);` — with a comment noting the reason (powershell.exe cold
  start on windows-latest exceeded bun's 5s default; timing only,
  assertions unchanged). Nothing else changes: no bunfig, no workflow edit,
  no other test.
- **Scope ruling:** exactly one test carries the timeout. Four *other*
  tests transitively spawn `whoami`+`icacls` on win32 via
  `saveCredential`→`defaultApplyAcl` (round-trip `:56`, full-replace `:68`,
  "readCredential returns null when absent; clear removes it" `:95–97`,
  `saveCredentialAsync` `:293`) — they stay on the 5s default. They spawn
  only native tools (no powershell, the cold-start-heavy process), have
  never flaked, and a timeout there would mask genuine hang regressions.

## Binding constraints

- Timing only — the FLLWUP-7 semantic SDDL assertions (canonical SIDs, mask
  ⊇ 0x1301bf, OS-converter parse) are untouched; the `expect()` count in the
  file is unchanged.
- POSIX-side tests unaffected; no change reaches them.
- Local (ubuntu) proof is limited — the win32-gated test skips — so the
  settling observation for the 30s budget is a green `gates-windows` run on
  the PR (accepted CI-only term, per the card's own acceptance).

## Verified preconditions (Skeptic, run)

- `test.skipIf(cond)` preserves the third-arg timeout on bun 1.4.0
  (runtime probe: control and skipIf variants both timed out at ~100ms,
  not 5000ms).
- `Test<T>`'s callable accepts `options?: number | TestOptions` under the
  pinned bun-types 1.4.0 (`bun-types/test.d.ts:475–505, 542`); both
  `30_000` and `{ timeout: 30_000 }` typecheck.
- Baseline gates: `bunx tsc --noEmit` exit 0; `bun test` 207 pass / 1 skip /
  0 fail (the skip is the win32 read-back test on ubuntu).
