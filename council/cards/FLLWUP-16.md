---
id: FLLWUP-16
title: "Give the Windows SDDL read-back test an explicit timeout sized for process cold start"
state: Deliberating
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

---

## Deliberation record

### Step 1 gate decision
Full council path — the acceptance explicitly delegates mechanism+value to deliberation (spec-ambiguous by construction); confined to one test file; NOT surface-touching → no `designer` seated.

### Step 2 — owner (round 1, verbatim)
**Grounding done.** Confirmed in `test/credential.test.ts`: the only real process spawns are inside `resolveSddlAces` (line ~194, `powershell`) and the win32-gated test itself (`whoami` L239, `icacls /save` L245, `icacls` L275). The "fail-closed" and "ACL seam" tests inject a fake argv — no real processes. No `bunfig.toml` exists; no timeout config anywhere; bun installed is 1.4.0. `resolveSddlAces` has exactly one call site: inside the win32 test. Cited grounding: the file itself (L112–290); no wiki page covers test timing policy.

## Position

**(a) Mechanism: per-test timeout, third argument to `test()`. Nothing global.**
- Only one test in the entire suite spawns external processes. A global `--timeout` or bunfig `[test] timeout = 30000` would hand every pure/filesystem test a 30s budget — that converts a genuine hang ("fails in 5s") into a slow hang ("fails in 30s") everywhere else, which is the exact failure mode a per-test override exists to avoid.
- No per-describe mechanism exists (grounded), and the only describe here wraps the whole file anyway, so "per-suite" collapses into "global" at the same cost.
- The risk (Windows process cold start) is scoped to exactly one test body; the budget belongs at that scope. Doing it in the test signature rather than CI flags keeps it platform-neutral, self-documenting, and free on ubuntu where `skipIf` skips the test entirely.

**(b) Value: `30_000`, sized as follows.**
- Evidence base is honest but thin: one observed cold start exceeded bun's 5s default (FLLWUP-7 merge check, `gates-windows` PR run). That tells us ≥5s is reachable, nothing about the tail.
- Worst-case composition: the test makes **four sequential spawns** (`whoami`, `icacls /save`, `powershell` with .NET `RawSecurityDescriptor` load, `icacls`), each subject to windows-latest cold start + Defender real-time scan of freshly written files. Published runner observations put `powershell -NoProfile` cold start at ~1–10s under contention; 4 × 10s worst case ≈ 40s, but the realistic pathological case (one cold start, rest warm) is ~10–15s total. 30s covers a single cold-start hit with ~2× margin and even tolerates two sluggish spawns; it stays far under any job-level budget and still fails a genuinely hung `icacls` in CI-acceptable time. Given one data point, 30s is the conservative pick; 15s would be defensible but re-flakes if the tail is wider than we've seen.

**(c) Exact placement: one line.**
`test/credential.test.ts` L239 — the single `test.skipIf(process.platform !== "win32")("win32 ACL read-back (SDDL via icacls /save): ...", () => {...})` gains a third argument: `}, 30_000);`. No other test changes. The card's acceptance says "any test spawning powershell.exe or icacls" — there is exactly one such test (grep-verifiable), so no additional sites exist. Do **not** also add a bunfig timeout; that would be the global mechanism argued against in (a) sneaking in the back door.

**(d) Falsifiable claims:**
1. **skipIf preserves the timeout arg on bun 1.4.0.** Local one-liner: `test.skipIf(false)("x", () => new Promise(r => setTimeout(r, 6000)), 100)` must fail at ~100ms, not 5000ms. If bun drops the third arg through `skipIf`, this design breaks and we'd need the callback-internal `done`-style or a wrapper — testable on ubuntu in 5 seconds.
2. **No other spawn sites exist in the suite** — `grep -n "spawnSync\|Bun.spawn(" test/*.ts src/**/*.ts` should show all call sites inside `resolveSddlAces` or the win32 test. If a Skeptic finds another, that test needs the same treatment and my "one line" claim is wrong.
3. **CI proof (PR-only, as the card anticipates):** on windows-latest, temporarily inserting `Bun.spawnSync(["powershell", "-NoProfile", "-Command", "Start-Sleep -Seconds 10"])` into the test body passes under 30s and fails under the default 5s — demonstrating the override actually covers cold-start-scale delays. Remove the sleep before merge; the sleep itself must never land.
4. **Assertion neutrality:** the diff touches only the closing line of the test — `expect(...)` count in the file is byte-identical before/after (a Skeptic can diff and count). SDDL semantics untouched, per the binding constraint.

**Tradeoffs accepted:** 30s is sized off one flake data point plus published cold-start ranges, not a measured distribution — we're buying robustness cheaply on a test that runs only on win32 and only once per gate run. If the CI tail later proves wider, bumping the constant is a one-line follow-up; under-sizing to look precise is the worse error on a merge gate.

**Testable claims:** claims 1–2 are locally runnable today on ubuntu; claim 3 is the PR-run proof the card already anticipates; claim 4 is a diff inspection.

### Step 2 — principal (round 1, verbatim)
## Position — FLLWUP-16

### Cross-seam reading

The seam here is not "test file vs. CI runner" — it's **the test body's wall-clock vs. what each code vantage can see spawning**. Two corrections to the card's neutral grounding, both grounded in files:

1. **The read-back test executes 6 external process spawns on win32, not 4.** The four explicit `Bun.spawnSync` calls in the test body (`test/credential.test.ts:194` powershell, `:239` whoami, `:245` icacls `/save`, `:275` icacls) are preceded by `saveCredential(cred(), { configDir: cfg })` at `:234`, which on win32 reaches `defaultApplyAcl` and spawns `whoami` + `icacls` via `node:child_process.spawnSync` (`src/credential.ts:111,120`). The timeout is a budget over the **whole body**, so it must be sized for 6 sequential spawns, not 4. Same count for the "re-enroll replaces" tail (`:279` — one more `saveCredential` → +2 spawns), so worst case in the body is 8.

2. **"Only one test spawns external processes" is false transitively.** On win32, `saveCredential` without an `applyAcl` seam reaches `defaultApplyAcl`, so the round-trip test (`:56`), the full-replace test (`:68`), and the `saveCredentialAsync` test (`:293`) each also spawn `whoami` + `icacls` on Windows. They don't spawn powershell — the cold-start-heavy process — and none has ever flaked; but the acceptance's "any test spawning powershell.exe or icacls" is broader than the observed failure, and the implementer must rule on it consciously rather than assume the card's "only one test" sentence.

The contract actually is: **bun's per-test timeout is the only knob that scopes to a single test body** (no describe-level timeout in the installed bun-types; `setDefaultTimeout` at `bun-types/test.d.ts:408` is file-scoped). `test.skipIf(cond)` returns `Test<T>` (`test.d.ts:542`), and `Test<T>`'s call signature accepts `options?: number | TestOptions` (`test.d.ts:475-486`) — so the third argument after the arrow function is legal and typechecks under the pinned bun 1.4.0 (`gates.yml`).

### Blind spots

- **Store-side vantage (`src/credential.ts`)**: sees `defaultApplyAcl`'s two spawns but cannot see that three additional tests reach it transitively, or that the read-back test stacks four more spawns on top. From inside the module, the flake reads as "a slow consumer," not "my spawns inflate their wall-clock."
- **Test-side vantage (`test/credential.test.ts`)**: sees the four explicit `Bun.spawnSync` calls and reads "only one test spawns processes" as true, because the store's spawns use a *different* spawn API (`node:child_process` vs `Bun.spawnSync`) and are invisible from inside the test body. A timeout sized from the visible 4 spawns undercounts.
- **Neither vantage** can see the bun-side kill mechanism ("killed 1 dangling process") — but that fact is supplied by the runner, not derivable from either code slice. The shared invisible assumption is "spawn = `Bun.spawnSync`," which the grep already disproves.

### Reframe

No reframe needed — the card's core move (per-test timeout on the read-back test) is the obvious clean design and everyone should converge on it. Two sharpenings, not a reframe:

- **Scope the budget to the whole body (6–8 spawns), not the 4 visible `Bun.spawnSync` calls.**
- **Rule explicitly on the three transitive icacls-spawning tests.** My ruling: leave them on the 5s default. They spawn only native `whoami`/`icacls` (cold start ~100–500 ms each, never observed to flake), so a timeout there would mask genuine hang regressions for no observed benefit. If a Skeptic wants them covered, that's a one-line-per-test change — but it must be a stated decision, not an accident of the "only one test" assumption.

### Mechanism: per-test, third argument

**Per-test, not per-suite, not global.**

- Per-suite is not a bun primitive (no describe-level timeout; `setDefaultTimeout` is file-scoped and would widen the ~10 pure tests in the same `describe`, masking hangs — a pure test hanging >5s is a real bug signal we want to keep).
- Global (`bun test --timeout` / `bunfig.toml`) changes every test in every file, including the ubuntu `gates` job which runs the full `bun test` — that violates "POSIX-side tests unaffected" in effect (longer failure latency everywhere) and requires a workflow/config change for a one-test problem.
- Per-test is the narrowest correct scope: only the spawning test changes; the pure tests keep the 5s default as their hang detector; no `gates.yml`/bunfig change; on ubuntu the test skips and nothing at all changes.

**Value: `30_000` ms.**

Sizing: the only observed datapoint is the cold-start tail exceeding 5s once (`gates-windows`, same SHA passed on push). Warm path for this body is ~1–2s (powershell `-NoProfile -NonInteractive` ≈ 1s, six native spawns ≈ trivial). The pathological case — fresh windows-latest runner, first `powershell.exe` execution under Defender/AMSI scan + .NET JIT — is the known spike that broke 5s. 30s is 6× the observed failure threshold and ~15–30× the warm path, deliberately generous because the timeout's only job is to separate "legitimately slow cold start" from "genuine hang," and a flake here costs a false merge-block on every future Windows-touching card (the card's own rationale). 15s (3×) is probably adequate; the flake-cost asymmetry — false block is expensive, an extra 15s of headroom is free — pushes to 30s under Cheapest To Reverse.

**Landing spot:** `test/credential.test.ts`, the single read-back test at line 232, exactly:

```ts
test.skipIf(process.platform !== "win32")(
  "win32 ACL read-back (SDDL via icacls /save): ...",
  () => {
    /* unchanged body */
  },
  30_000 // powershell.exe cold start on windows-latest exceeded bun's 5s default (FLLWUP-7 close); timing only, assertions unchanged
);
```

No other test in the file changes. The `{ timeout: 30_000 }` object form is equally valid; the plain number matches the documented third-arg form.

### Testable claims

1. **Compile-time (Skeptic can run now):** `bunx tsc --noEmit` exits 0 with the third argument added — proves `skipIf`'s returned `Test<T>` callable accepts the timeout under the pinned bun-types.
2. **POSIX-unaffected (local):** on ubuntu, `bun test` stays green and the read-back test is reported skipped; adding the third arg changes zero assertions and the timeout value is never consulted on a skipped test.
3. **The value itself (CI-only, genuinely falsifiable):** "no read-back test times out at 30s across N fresh `windows-latest` runs" — a single `timed out after 30000ms` in `gates-windows` falsifies 30s. Not testable locally; the ubuntu skip is exactly why CI proof happens on the PR, per the card's binding constraint.
4. **Scoping claim (falsifiable by grep):** "the read-back test runs 6–8 spawns (2 per `saveCredential` via `defaultApplyAcl` + 4 direct), and tests at `:56`, `:68`, `:293` transitively spawn 2 each" — grep `src/credential.ts:111,120` and `test/credential.test.ts:194,239,245,275`. If false, the timeout scoping changes; if true, only the read-back test needs the 30s, and the transitive spawners stay on 5s by my ruling above.

No files modified; no git touched.

### Step 3 — bounded exchange
Round 1 only. Positions stabilised: both converge on (a) per-test third-arg timeout as the only correct scope, (b) `30_000` ms, (c) the single read-back test, (d) transitive icacls-spawners stay on the 5s default (owner scoped to one test; principal states it as an explicit ruling). Sole factual delta — spawn count 4 (owner) vs 6–8 (principal) — does not change any design point and is routed to the Skeptic's grep (step 4). No round 2 dispatched.

### Step 4 — skeptic (verbatim)

## Skeptic report — FLLWUP-16 (pre-implementation attack)

### Objections

**O1 — Owner's spawn count ("4 spawns in the read-back body").**
Target: owner claim that the read-back test executes 4 spawns; principal's 6–8 correction.
Settling test: read `src/credential.ts` `defaultApplyAcl`/`writeAtomic` (done) + map every spawn in the test body.
Result: **closed-green for principal / closed-red for owner.** Success path on win32 = **8 spawns**, not 4:
1. `saveCredential` (:234) → win32 branch (credential.ts:144-152) → `defaultApplyAcl` → `spawnSync("whoami")` (credential.ts:111, node:child_process)
2. same call → `spawnSync("icacls", …)` (credential.ts:120)
3. `Bun.spawnSync(["whoami", …])` (:239)
4. `Bun.spawnSync(["icacls", ..., "/save"])` (:245)
5. `resolveSddlAces` → `Bun.spawnSync(["powershell", …])` (:194)
6. `Bun.spawnSync(["icacls", p])` (:275)
7. re-enroll `saveCredential` (:279) → `defaultApplyAcl` → whoami (credential.ts:111)
8. same → icacls (credential.ts:120)

Design impact: **none** — bun's per-test timeout is one wall-clock budget for the whole body, so the 30s covers all 8 spawns. The re-enroll's hidden spawns are inside the timed test, not outside it.

**O2 — Principal's transitive-spawn inventory ("three OTHER tests").**
Target: correction (ii) listing exactly round-trip :56, full-replace :68, saveCredentialAsync :293.
Settling test: enumerate every `saveCredential`/`saveCredentialAsync` call in `test/credential.test.ts` on real win32 (no `applyAcl` seam). `saveCredentialAsync` is literally `saveCredential` (credential.ts:226-229), confirmed.
Result: **closed-red for principal's enumeration.** The three named tests do transitively spawn (round-trip :58; full-replace :70 + :81 → 4 spawns; async :295), but a **fourth** does too: "readCredential returns null when absent; clear removes it" (:95) calls `saveCredential` at :97 → 2 spawns. The set is **4 tests, not 3**. Design impact: none (the "leave on 5s default" rule applies identically to all four; the "native tools, never flaked" rationale is a CI-history claim, below). Factual correction, not a blocker.

**O3 — Owner claim 1: skipIf preserves the third-arg timeout on bun 1.4.0 (runtime).**
Settling test (run): `/tmp/fllwup16/skipif-timeout.test.ts` — control `test(..., 100)` on a hang, target `test.skipIf(false)(..., 100)` on a hang, plus `test.skipIf(true)(..., 100)`; discriminate 100ms-vs-5000ms by failure message and wall time.
Result: **closed-green.** Actual output: `(fail) control-timeout-100 [100.02ms] ^ this test timed out after 100ms.` / `(fail) skipif-timeout-100 [100.00ms] ^ this test timed out after 100ms.` / `(skip) skipif-true-skipped`; total run 210ms. The skipIf variant died at 100ms like the control — the arg is preserved on `bun test v1.4.0 (34cbb9a40)`, not silently dropped to 5000ms. This doubles as the gate-integrity injection: the mechanism went red with the precise diagnosis ("timed out after 100ms") when driven to failure.

**O4 — Principal's typecheck claim: `options?: number | TestOptions` on the skipIf result.**
Settling test: read `node_modules/bun-types/test.d.ts` (the `@types/bun` 1.4.0 index is just a reference to `bun-types`), then compile the exact proposed shape.
Result: **closed-green.** Declaration at test.d.ts:542 `skipIf(condition: boolean): Test<T>`; `Test<T>` callable (test.d.ts:475-505) takes `options?: number | TestOptions`. Scratch compile with the repo's tsc 7.0.2 + typeRoots: `tsc --ignoreConfig --noEmit … /tmp/fllwup16/shape.ts` (both `…, 30_000` and `…, { timeout: 30_000 }`) → exit 0, "SHAPE-TYPECHECK: PASS".

**O5 — Baseline gates on the unmodified tree ("207 green").**
Settling test (run): `bunx tsc --noEmit`; `bun test`.
Result: **closed-green.** `tsc --noEmit` exit 0. `bun test`: **207 pass / 1 skip / 0 fail, 1227 expect() calls, 208 tests across 11 files** (1.0s). The single skip is the win32 read-back test — correct on ubuntu. Baseline `expect()` count 1227 recorded; the card's "count unchanged" is trivially true (working tree clean, no diff yet).

**O6 — Owner claim 3, 30s covers cold-start-scale delays; principal's "never flaked" CI history.**
Settling test: none executable here — the win32-gated test skips on ubuntu and powershell.exe cold-start delay is a windows-latest CI artifact. The settling observation is a green windows-latest run on the branch.
Result: **open-untested (CI-only), accepted per card terms.** Same term applies to O2's four tests' no-flake history.

**O7 (my own attack, stated for the record) — 30s budget lengthens hang-detection latency.** If a save inside the read-back test genuinely hangs on win32, the suite now fails after 30s instead of 5s. That's a latency cost of the mechanism, not a correctness defect; falsifiable only by a CI-observed hang. **open-untested (CI-only)**, not a block.

### What I ran (actual)
```
grep spawn/powershell/icacls/whoami across test/ → spawn sites only in credential.test.ts
read src/credential.ts (defaultApplyAcl :108-126, writeAtomic win32 branch :144-152, saveCredentialAsync :226-229)
bun --version → 1.4.0; tsc --version → 7.0.2; @types/bun → 1.4.0
bun test /tmp/fllwup16/skipif-timeout.test.ts → 0 pass, 1 skip, 2 fail; both hangs "timed out after 100ms"; 210ms wall
tsc --ignoreConfig --noEmit … shape.ts → exit 0 (SHAPE-TYPECHECK: PASS)
bunx tsc --noEmit → exit 0
bun test → 207 pass, 1 skip, 0 fail, 1227 expect(), 208 tests, 1021ms
git status → clean
```

### Verdict
**no open objections.** Both recorded positions' mechanism claims hold as run (O3, O4, O5 green; O1 resolves in principal's favor). Two willingness-to-record corrections to the deliberation record, neither blocking: the read-back body carries **8** spawns on the success path (both counts were wrong — 4 was too low, "6–8" undershoots the exact 8), and **four** tests (not three) transitively spawn whoami+icacls on win32 (missing: "readCredential returns null when absent; clear removes it", :95-97). CI-only items O6 and O7 stand as `open-untested` until a windows-latest run settles the 30s budget claim; the design (per-test 30s, single test, no bunfig) has no local falsification gap.
