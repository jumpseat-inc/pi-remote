# Round 2 summary (step 3, jobs 21.4/21.5/21.6)

Positions stabilized at round 2; the exchange stopped early (cap ≤3 not hit).

## Convergence
- **Mechanism converged** (owner r2, principal r2, designer r2): optional `LoginDeps.waitForCancel?: (signal) => Promise<boolean>`; driver-side re-arm loop over the dep; `ctl.wake` = abort signal + settle `{type:"cancelled"}` (external `cancel()` sets flag then wakes); single guarded `finish(result)` = settled-guard + clearTimeout + abort + settle, routed from all four terminal paths (server callback, timer, confirm-true, cancel); verbatim constants in `src/login.ts`; facade prints `login.cancelled` exactly once (unchanged); confirm-true settles cancelled WITHOUT setting `ctl.cancelled` so the dead `:575` branch becomes reachable via two honest causes.
- **`requireCtx` scope dispute — owner conceded on line evidence** (index.ts:176 `createRemoteController` vs :904/:910 `export default` closure; :676 call site cannot resolve `requireCtx`): production wiring threads a new `RemoteControllerDeps` member (e.g. `uiConfirm`) built at :950 from `requireCtx().ui.confirm`. NOTE (facilitator): both seats independently agree, but per the convergence rule this stays a testable claim for the Skeptic (compile probe), not a settled fact.
- **Spin objection withdrawn**: principal confirmed owner's top-of-loop `!ctrl.signal.aborted` check exits cleanly under the verified abort-resolves-`false` SDK semantics; the surviving mandatory guard is abort-on-every-terminal-path (the finisher). Owner additionally writes the loop condition as `!signal.aborted && !settled`.
- **Rejection semantics**: re-arm on rejection (rejection ≠ abort ≠ cancel), pinned by an explicit test — owner accepted principal's recommendation.
- **Print-once vacuity**: owner conceded; Acceptance 1's print-once assertion drives `createLoginCommand().run("attended")` (facade), never the raw driver.
- **Designer deltas**: legitimate-win abort wired into server-callback and timer settle paths (finisher) so P-D/P-E are wired not emergent; P-D/P-E/P-F sharpened to bind WHICH settle path issued the abort; open item 1 (four-step cancel) answered by code shape; open item 6 reduces to a one-line implementation comment.

## Still open after round 2
1. **Host `ui.confirm` polarity** (principal's sharpened P-G): the driver maps `true → cancelled`; the binding assumes the host's primary/affirmative button resolves `true`. Pin against the real host contract (test or smoke).
2. **Modal semantics of `ui.confirm`** (designer P-H): whether the dialog swallows typed input mid-wait — smoke-falsifiable, no correctness consequence mid-`/rc:login` (input loop already parked, Skeptic O2).
3. **Non-interactive host gating** (principal): whether the `waitForCancel` dep is wired only where `confirm` can genuinely wait on a user (vs unconditionally). Designer r1 open item 5 held optional-absent acceptable by construction.
4. Designer P-G/P-H predictions and P-A/P-D/P-E CDP smokes remain unrun — carry to step 13 as smoke follow-ups unless the Skeptic runs them.
