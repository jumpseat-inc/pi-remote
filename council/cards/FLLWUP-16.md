---
id: FLLWUP-16
title: "Give the Windows SDDL read-back test an explicit timeout sized for process cold start"
state: Backlog
owner: null
epic: EPIC-1
goal: The Windows SDDL read-back test in test/credential.test.ts carries an explicit per-test timeout sized for powershell.exe cold start on CI, so the gate no longer flakes on bun's 5s per-test default.
---

## Intent

Filed from FLLWUP-7's close. During FLLWUP-7's merge check, the `gates-windows`
pull_request run failed once on the read-back test — bun's 5s per-test default
killed a `powershell.exe` cold start mid-run ("killed 1 dangling process",
`exitCode: null`) — while the push-event run at the same SHA passed. The gate
is sound (the rerun passed, and the merge only proceeded after a clean
re-read), but a gate that flakes on runner cold start will produce false
merge-block criterion-2 failures on every future Windows-touching card.

## Acceptance

- The read-back test (and any test spawning powershell.exe or icacls) carries
  an explicit timeout sized for observed Windows process startup (the
  deliberation picks the value and whether it is per-test or per-suite).
- The POSIX-side tests are unaffected.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.
