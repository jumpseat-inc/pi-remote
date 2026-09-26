# Owner — round 1 (job-21.1, step 2 independent first pass)

Grounding: card, settled design pass (S8/S9), own prior positions (owner-r1/r2 in EV-16-deliberation), `src/login.ts` in full (attended driver ~465–650, facade ~845–915, `login.cancelled` at :201), `index.ts` wiring (`createLoginCommand` at :676, `requireCtx()` at :910), `src/copy.ts` coverage boundary, `test/login.test.ts` harness patterns, `vault/wiki/login.ts.md` (line 55 records the red-at-base boundary for exactly this card).

## Position — EV-17 owner, first independent pass

### Approach

**Mechanism (as settled, S8 — carried verbatim, no re-litigation):**

1. **`LoginDeps.waitForCancel?: (signal: AbortSignal) => Promise<boolean>`** — new optional dep. Absent ⇒ behavior byte-identical to today, so every existing test and the headless flow are untouched.

2. **Dialog wiring in `index.ts` at the `createLoginCommand` call site (:676):**
   ```ts
   waitForCancel: async (signal) =>
     requireCtx().ui.confirm(CANCEL_DIALOG_TITLE, CANCEL_DIALOG_MESSAGE, { signal }),
   ```
   with the settled strings (`Waiting for browser…` / `Cancel sign-in?`) as **exported verbatim constants in `src/login.ts`** — same precedent as `ACL_ENFORCEMENT_FAILED_NOTICE` and `ALREADY_LIVE_COPY`: ruled-verbatim login copy that isn't a keyed row lives as a `login.ts` constant (Stable Keys doctrine; keyless, English under every locale per the announced coverage boundary, which gets one sentence added in `src/copy.ts` naming the two new constants). `requireCtx()` is in scope at that call site (closure of `createRemoteController`, same pattern as `deps.inputPrompt` at :950).

3. **Re-arm loop lives in the driver, not the wiring.** The settled text says the dep is "implemented as `requireCtx().ui.confirm(...)`" — one confirm invocation per call — and "re-armed on `false` until the signal aborts." I read the re-arm as a driver-side loop over the dep (reading (a)); the alternative — the dep itself loops and the driver awaits once — is behaviorally equivalent and I have no stake in it, but (a) keeps `index.ts` minimal and makes the loop unit-testable with fakes. Driver shape, inside the existing try block after the `waiting` print:
   ```ts
   const ctrl = new AbortController();
   ctl.wake = () => {                       // new field on the shared ctl object
     ctrl.abort();                          // dismiss the dialog, stop re-arming
     if (!settled) { settled = true; settle({ type: "cancelled" }); }
   };
   if (deps.waitForCancel) {
     void (async () => {
       while (!ctrl.signal.aborted) {
         let yes: boolean;
         try { yes = await deps.waitForCancel!(ctrl.signal); }
         catch { return; }                  // abort-rejection ⇒ dismissed, not cancelled
         if (yes && !settled) { settled = true; settle({ type: "cancelled" }); return; }
       }
     })();
   }
   ```
   The existing `timer` / `const cb = await cbPromise; clearTimeout(timer);` stays exactly as is — `clearTimeout` post-await is what prevents a duplicate timeout settle once wake has settled. The `settled` guard already makes first-wins total (callback, timeout, confirm-cancel, `cancel()` all race through one flag). The racer gets no independent `await`; a rejection from an abort-dismissed dialog is caught inside the loop, and the loop's own promise can never reject, so no unhandled-rejection window.

4. **`cancel()` wakes the wait** — Acceptance 5's "reachable, not removed" half:
   ```ts
   const cancel = (): void => {
     ctl.cancelled = true;   // unchanged: headless poll-loop checks still work (test 11)
     ctl.wake?.();           // new: settles the attended callback wait {type:"cancelled"}
   };
   ```
   `ctl.wake` is assigned unconditionally (not only when `waitForCancel` is present), so `cancel()` interrupts the attended wait even in tests that don't wire the dialog; it is cleared (`ctl.wake = undefined`) in the driver's `finally` so a stale cancel can't reach a dead run. The headless driver is untouched — `ctl.cancelled` flag checks already work there; the card is attended-scoped. **Critical semantic preserved: abort alone is not cancel.** `ctrl.abort()` without settle is what happens when the callback/timeout legitimately wins — only `wake` (confirm-true or `cancel()`) settles `{ type: "cancelled" }`. This keeps the dead `cb.type === "cancelled"` branch reachable via exactly two honest causes and nothing else.

5. **Copy printing is already structural and needs zero change:** the driver's cancelled branches only return the outcome; the facade prints `login.cancelled` (`src/login.ts:201` text) exactly once at `outcome.kind === "cancelled"`. No new line, no driver print, no new refusal line — all as settled.

**Files changed:** `src/login.ts` (dep type, `LoginControl.wake`, driver race + loop + wake, facade `cancel()`, two exported constants), `index.ts` (one `waitForCancel` entry at :676), `test/login.test.ts` (new describe block), `src/copy.ts` (one coverage-boundary sentence), `docs/PI-SPEC.md` §7.2 (attended bullet gains the cancel affordance — prose-sync riding the implementing PR per Spec Correction Governance).

### Acceptance → test map (all in `test/login.test.ts`, reusing `makeControl`/`attendedDeps`/`captureLog`/`tempConfigDir`)

| # | Test |
|---|---|
| 1 | Injected `waitForCancel` gate resolved `true` ~10ms into the wait ⇒ `{ kind: "cancelled" }`; `logs.filter(l => l === "Sign-in cancelled — no credentials were saved.")` length exactly 1; `loginEndpointRequestLog` has **zero** token-endpoint or device-endpoint entries (reset at run start; the cancelled path never reaches exchange); `readCredential` null (⇒ 4). Plus re-arm test: gate resolves `false` then `true` ⇒ the dep was invoked twice before the cancel. |
| 2 | Same test wraps the awaited run in `Date.now()` with `redirectTimeoutMs: 2000`: `expect(elapsed).toBeLessThan(2000)` — strictly less, discriminating interrupt from timer-fire (timeout path ⇒ `elapsed ≥ redirectTimeoutMs`, reason `redirectTimeout`). |
| 3 | `redirectTimeoutMs: 2000` with the seam firing at ~10ms — the cancel path wins by two orders of magnitude. |
| 5a | `createLoginCommand` + `cmd.cancel()` mid-wait ⇒ `{ kind: "cancelled" }`, elapsed ≪ timeout, one cancel line — this is `vault/wiki/login.ts.md:55`'s recorded red-at-base boundary ("cancel flag set mid-wait … elapsed ≈ timeout on current code"): red at base (flag-only ⇒ runs to full timeout, `redirectTimeout`), green at head. |
| 5b | Dead-branch reachability is 5a's assertion itself (the wake settle goes through `cb.type === "cancelled"`); a companion test pins that a legitimate callback win **aborts the signal and does not** settle cancelled (dep receives `signal.aborted === true` before its gate resolves). |

Red-at-base record (owner mode, per the seven-field convention): base = commit immediately preceding EV-17's first mechanism merge; transplant = the new test block; the 5a half is base-native red (per-failure lines will name elapsed ≈ `redirectTimeoutMs` and kind `redirectTimeout`, not the mechanism — the mechanism's artifacts are the dep and `wake`, absent at base); the 1–3 half is transplant-qualified red at base (type error: `LoginDeps` has no `waitForCancel`) — stated explicitly in the record.

### Tradeoffs accepted

- **Direct `requireCtx().ui.confirm` at the `index.ts` call site rather than a new `RemoteControllerDeps` member.** The settled text names `requireCtx().ui.confirm(...)` and `index.ts` already calls `requireCtx()` directly for `setStatus`/`sessionId`. Cost: `test/index.test.ts` can't intercept the dialog at the deps layer; compensated by pinning the exported constants byte-exact against the settled strings in a unit test, and the driver-side seam carries all behavioral tests. If the Skeptic wants a deps member for index-level testability, that's an implementation-local swap, not a design reopening.
- **Racer never awaited** — it lives briefly past `cbPromise` settlement until the abort dismisses it. Bounded and caught; avoids restructuring a stable driver.
- **`ctl` grows a `wake` field** rather than a new driver parameter — the ctl object is already the facade↔driver cancellation channel; a second channel would be worse.

### Risks

1. **Abort semantics of the real `ui.confirm` on a pending dialog** — resolve-false vs reject. O1 proved existence + compile (types.d.ts:72-73/:39, scratch probe exit 0), not runtime dismiss behavior. Mitigation at implementation: read the installed `timed-confirm.ts` example source, and the driver handles both branches anyway (loop exit on `signal.aborted`, `catch` on rejection) — so the risk is contained to whether the dialog visually dismisses, not to outcome correctness.
2. **Re-arm busy-loop** if a fake resolves `false` synchronously forever — only a test-authoring hazard; production `confirm` resolves on user action. Test fakes will gate explicitly.
3. **Dialog UX semantics** ("No" on *Cancel sign-in?* re-arms the dialog) is the settled, byte-fixed design — noted, not reopenable.

### Open items (explicitly not decided by me)

- **Where the re-arm loop lives** (driver vs inside the dep) — settled text supports both readings; I chose driver-side, will follow any Skeptic/principal preference.
- **`RemoteControllerDeps` member vs direct `requireCtx()`** — as above.
- **PI-SPEC §7.2 prose-sync scope**: I claim the attended-flow bullet must gain one sentence naming the confirm-dialog cancel (new user-visible behavior). If the facilitator classes this as out-of-card scope, flag it now, not at PR time.

### Testable claims

1. **Base is red for the wake boundary:** at `origin/main`, `runAttendedLogin` + `cmd.cancel()` mid-wait with `redirectTimeoutMs` small resolves only at timer fire — elapsed ≥ `redirectTimeoutMs`, reason `redirectTimeout` (wiki `login.ts.md:55` predicts this; a 10-line probe at base will confirm before the mechanism lands).
2. **Head is green on all five:** the tests in the map above, run via `bun test` with `bunx tsc --noEmit` clean.
3. **Non-regression is structural:** because `waitForCancel` is optional and every new code path is behind `deps.waitForCancel` / `ctl.wake?.()`, the existing 1466-line suite passes unmodified — falsifiable by running it.
4. **Abort is not cancel:** a test where the callback (real code, matching state) wins the race observes `signal.aborted === true` and outcome `success` — proving the dialog dismissal path can never fabricate a cancellation.

**Position:** implement the settled S8 design exactly as mapped above — `waitForCancel` dep with driver-side re-arm loop racing `cbPromise`, `ctl.wake` settle-to-`{type:"cancelled"}` as the shared mechanism for confirm-cancel and `cancel()`, abort-without-settle reserved for legitimate wins, verbatim constants in `src/login.ts`, facade prints the cancel line once (already structural), Acceptance 1–5 satisfied by the six tests mapped (with the wiki-recorded red-at-base pair for Acceptance 5), no copy change anywhere, PI-SPEC §7.2 prose-sync riding the PR.
