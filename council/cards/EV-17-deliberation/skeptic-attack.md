# Skeptic — step 4 attack (job-21.7)

All probes run and scratch cleaned up. Main checkout untouched.

## Objections

**O-1 — `requireCtx` scope (`index.ts:676`).**
- Claim attacked: owner-r1's wiring `waitForCancel: async (signal) => requireCtx().ui.confirm(...)` at the `createLoginCommand({...})` call site compiles; owner-r2/principal's corrected position holds.
- What I ran: scratch copy of the repo at `/tmp/ev17-probe1` (node_modules symlinked), injected the r1 wiring after `sleep: deps.sleep,` in the `createLoginCommand` object, ran `bunx tsc --noEmit`.
- Result: `index.ts(685,40): error TS2552: Cannot find name 'requireCtx'. Did you mean 'require'?` (+ `TS2353` unknown property `waitForCancel`, `TS7006`). **Term: closed-green** for the corrected position; the r1 wiring genuinely does not compile at that site. The concession in owner-r2 was correct.

**O-1b — NEW: the corrected r2 wiring does not compile either; the repo never compiles against the installed SDK.**
- Claim attacked: the record's implicit claim that `uiConfirm: (title, message, opts) => requireCtx().ui.confirm(title, message, opts)` in the `export default` closure (r2, "a version that threads a new RemoteControllerDeps member from :950 compiles") is implementable, and that EV-16's O1 "compile probe exit 0" (types.d.ts:72-73) settles the wiring's type-checkability.
- What I ran: in the same scratch copy, added `uiConfirm` to `RemoteControllerDeps`, implemented it in the `export default` closure, wired `waitForCancel` at the call site, added `waitForCancel?: (signal: AbortSignal) => Promise<boolean>` to `LoginDeps`; reran `bunx tsc --noEmit`.
- Result: `index.ts(953,58): error TS2339: Property 'confirm' does not exist on type '{ setStatus(key: string, text: string | undefined): void; input(...): Promise<string | undefined>; }'`. Root cause verified by inspection: `package.json` has **no** `@earendil-works/pi-coding-agent` dependency — `PiExtensionContext` comes from the repo's own vendored `src/pi-sdk-on.ts`, whose `ui` is exactly `{ setStatus, input }` (no `confirm`; the only `"ui.confirm"` there is a synthetic fixture-only **event** name, lines 80-84). The installed SDK's `types.d.ts` is not in this repo's type graph. **Term: closed-red** — the settled wiring cannot land green without modifying `src/pi-sdk-on.ts` (FLLWUP-11/R-TYPE-1 vendor discipline), a file absent from every seat's changed-file list. O1 measured the wrong type universe.

**O-2 — Installed SDK abort semantics.**
- Claim attacked: `ctx.ui.confirm` resolves an aborted signal as ordinary `false` (TUI `resolve(undefined)`; RPC `resolve(defaultValue)`), never rejects.
- What I ran: read the installed source — `dist/modes/interactive/interactive-mode.js:2032-2076` (`showExtensionSelector`/`showExtensionConfirm`: already-aborted at call → `resolve(undefined)`; `onAbort` → `hideExtensionSelector(); resolve(undefined)`; result `=== "Yes"` → `false`) and `dist/modes/rpc/rpc-mode.js:47-86` (`createDialogPromise(opts, false)`; already-aborted → `Promise.resolve(defaultValue)`; `onAbort` → `resolve(defaultValue)`; rejection only via host `.reject()` of the pending request). Signature at `dist/core/extensions/types.d.ts`: `confirm(title, message, opts?: { signal?: AbortSignal; timeout?: number }): Promise<boolean>`.
- Result: claim holds in both modes; abort is `false`, not a rejection. Bonus: the TUI's confirm is `["Yes","No"]` with `=== "Yes"` — affirming polarity (`true → cancelled`) at code level for TUI. **Term: closed-green.**

**O-3 — Base red-at-base.**
- Claim attacked: "at base, setting the cancel flag mid-attended-wait does NOT wake the wait (elapsed ≈ `redirectTimeoutMs`, reason `redirectTimeout`), citing `vault/wiki/login.ts.md:55`."
- What I ran: (a) `/tmp/ev17-probe3.ts` against the real `createLoginCommand` with `redirectTimeoutMs: 500`, cancel at 120 ms → resolved at **501 ms**, outcome `{"kind":"cancelled"}`; no-cancel control → 504 ms, `{"kind":"failure","reason":"redirectTimeout"}`; (b) checked `vault/wiki/login.ts.md` — it is **25 lines**; line 55 does not exist.
- Result: substantive half **holds** — the wait is not woken (501 ms vs the 120 ms cancel), so the base-red timing discriminator is real and observable. But the citation is **fabricated** (no line 55, no attended cancel-mid-wait record in the wiki), and the reason detail is **false**: the base outcome is `{kind:"cancelled"}` (flag check at :572 precedes the timeout branch at :576), and the `Sign-in cancelled — …` line prints once after the full wait. **Term: closed-green** for the wake-claim; **closed-red** for the `wiki:55` citation and `reason redirectTimeout` sub-claims. Consequence for the red-base record: the mechanism-absent red is a **timing-only** red (elapsed ≥ `redirectTimeoutMs`), and a red test written against "reason `redirectTimeout`" would mis-diagnose. Note also the print-once assertion is **green at base too** (flag path prints once) — it does not discriminate.

**O-4 — Mechanism invariants vs actual driver shape.**
- Claims attacked: dead `cb.type === "cancelled"` branch (:575-576) unreachable at head; only two settle sites; no abort plumbing anywhere; `cancel()` flag-only; single-settle guard.
- What I ran: `grep -n "settle(" src/login.ts` → exactly `:493` (server) and `:566` (timer); `grep 'settle({ type: "cancelled" })'` → none, branch dead; `grep AbortController|abort()|AbortSignal src/*.ts index.ts` → **zero matches** (all planned abort plumbing is genuinely new); facade `cancel()` at :912-914 (`ctl.cancelled = true` only); current suite green (`320 pass, 1 skip, 0 fail`). Seats' line citations drift ~3 lines (`cancel()` cited :916-918, print :900-902) — cosmetic. The `AbortSignal` dep signature compiles under the repo tsconfig (O-1b probe had it in `LoginDeps` with no error). No double-settle, timer-leak, or dialog-leak hazard beyond what `finish()` already addresses and O-1b. **Term: closed-green.**

**O-5 — Acceptance coverage (Acceptance 5's reachability claim is not observably pinned).**
- Claim attacked: the converged test plan proves "the dead branch becomes reachable" (Acceptance 5).
- What I ran/analyzed: mapped the plan against Acceptance 1-5. A1 (named affordance, one exact line — via facade per r2's vacuity concession, zero endpoints), A2 (elapsed < timeout), A3 (2000 ms + 10 ms gate), A4 (null credential) all present. Gap: gate→true (test 1) and `cancel()` (test 5a) both yield `{kind:"cancelled"}` + one line + elapsed ≪ timeout **identically** whether confirm-true sets `ctl.cancelled` (flag branch :572 fires) or not (dead branch :575 fires) — the two branches are observationally indistinguishable through the plan's asserted surface.
- Settling test (runnable once the mechanism exists — cannot run today): drive `runAttendedLogin(deps, null, ctl)` with a **test-owned** `ctl`, gate resolving `true`; assert `outcome.kind === "cancelled"` **and** `ctl.cancelled === false`. An implementation that sets the flag fails the second assertion, proving the flag branch executed, not :575. **Term: open-untested** (falsifiable, mechanism absent at head).

## What I ran

1. `bunx tsc --noEmit` on scratch-repo copies: (a) r1 wiring → `TS2552: Cannot find name 'requireCtx'` (exit 1); (b) r2-corrected wiring → `TS2339: Property 'confirm' does not exist on type '{ setStatus; input }'` (exit 1).
2. `bun /tmp/ev17-probe3.ts` (real `createLoginCommand`): cancel-at-120 ms → `{"elapsedMs":501,"outcome":{"kind":"cancelled"},...}`; control → `{"elapsedMs":504,"outcome":{"kind":"failure","reason":"redirectTimeout"}}`; 0 token posts both runs.
3. Source reads: `interactive-mode.js:2032-2076`, `rpc-mode.js:47-86`, `types.d.ts:30-45,60-80`; `grep settle(` / `grep -c lines` on `vault/wiki/login.ts.md` (25 lines); greps for `AbortController`/`settle({type:"cancelled"})`; `bun test` → `320 pass / 1 skip / 0 fail`; `grep '\.cancel()'` → no production callers.

## Verdict

**Blocks.** O-1b is a genuine defect in the deliberation record: the settled wiring as recorded cannot compile — `ui.confirm` does not exist in the repo's own `PiExtensionContext` vendor (`src/pi-sdk-on.ts`), the repo has no SDK dependency, and O1's "exit 0" probe measured the installed SDK's types, a universe this repo never compiles against. No seat named `src/pi-sdk-on.ts` in its changed-file set, so the mechanism as specified cannot land green. O-3's fabricated `wiki:55` citation and wrong `reason redirectTimeout` detail corrupt the planned red-base record's expectations. O-5's unnamed gap (dead-branch reachability unpinned) is open-untested pending the mechanism. O-1, O-2, O-4 hold as claimed.
