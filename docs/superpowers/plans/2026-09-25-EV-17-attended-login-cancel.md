# EV-17 — Attended `/rc:login` Cancel Affordance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During an attended `/rc:login`, the user can cancel via a `ui.confirm` dialog before the 300s `redirectTimeoutMs` elapses — outcome `{ kind: "cancelled" }`, the cancel line printed exactly once by the facade, no credential written.

**Architecture:** All abort plumbing is new in `src/login.ts`'s attended driver: one guarded `finish(result)` routed from all four terminal paths (callback win, timer fire, confirm-cancel, external `cancel()` wake), an `AbortController` whose signal dismisses the dialog, and a driver-side re-arm loop over the new `LoginDeps.waitForCancel` dep (rejection re-arms; abort is detected via `signal.aborted`, never via the resolved value). `index.ts` wires `uiConfirm`/`hostMode` lazily through `requireCtx()` and threads `waitForCancel` **only** when host mode is `"tui"` (ruling Q2 — presence gate, not behavior change).

**Tech Stack:** TypeScript, Bun test, node:http loopback (unchanged), vendored `src/pi-sdk-on.ts` type mirror.

**Spec:** `docs/superpowers/specs/2026-09-25-EV-17-design.md` (binding; committed f76e9c7) + `council/cards/EV-17.md`.

## Global Constraints

- Copy is byte-exact, settled, not re-litigable: dialog title `Waiting for browser…`, dialog message `Cancel sign-in?`; wait line and `login.cancelled` = `Sign-in cancelled — no credentials were saved.` unchanged.
- The cancel line is printed **exactly once by the facade, never by the driver**.
- The two dialog strings are exported verbatim constants in `src/login.ts` (Stable Keys precedent). No `src/copy.ts` rows.
- `waitForCancel` semantics where wired: re-arm on `false` until the signal aborts; rejection re-arms; abort is an ordinary `false` (O-2) — never branch on the resolved value to detect abort.
- Gate keys on the real host property `mode === "tui"` (ruling Q2); in all other modes the dep stays `undefined`.
- Confirm-cancel settles `{ type: "cancelled" }` **without** setting `ctl.cancelled` (O-5).
- Conventional Commits; no scope beyond the spec's changed-file list.
- Exit condition of every task: `bunx tsc --noEmit` clean, affected tests green.

## Review Focus

1. **Gate resolves `true` after abort** (e.g. confirm resolves late) — must not double-settle; the loop checks `signal.aborted || settled` before branching on the value. Pinned by the finisher-totality cancel() test (signal-aborted + frozen dep count) and the no-spin test.
2. **Rejection-forever gate** — re-arm loop spins hot until the timeout settles it. Accepted by the settled design (rejection ≠ abort ≠ cancel); the 300s timer is the bound. Pinned by the rejection-re-arm test's finite shape.
3. **`cancel()` before the wake is installed** (mid-discovery/prompt) — flag-only, no wake; base behavior preserved. Not tested (unchanged base path); noted here.
4. **Abort mid-token-exchange** — wake/abort only apply during the wait; the post-fetch `if (ctl.cancelled)` check (existing) covers a cancel during the exchange. Not modified.
5. **`hostMode` returning an unexpected value** — `deps.hostMode?.() === "tui"` is a strict equality gate; any other value or an absent dep means no affordance. Pinned by the Q2 gate tests in `test/index.test.ts`.

---

### Task 1: Type remediation (ruling Q1 — route (a))

**Files:**
- Modify: `src/pi-sdk-on.ts` (the `PiExtensionContext.ui` object literal)

**Interfaces:**
- Produces: `PiExtensionContext.ui.confirm(title: string, message: string, opts?: { signal?: AbortSignal; timeout?: number }): Promise<boolean>` — the structural mirror Task 4's real entry wiring compiles against.

- [ ] **Step 1: Add the `confirm` declaration with provenance comment**

Inside `ui: { ... }`, after `input`:

```ts
/** Real signature (installed types.d.ts:73; ExtensionUIDialogOptions :37-42):
 * confirm(title: string, message: string, opts?: { signal?: AbortSignal; timeout?: number }): Promise<boolean> */
confirm(title: string, message: string, opts?: { signal?: AbortSignal; timeout?: number }): Promise<boolean>;
```

Both optional members declared (EPIC-6/FLLWUP-39 declare rule).

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit` — clean.

- [ ] **Step 3: Commit** — `feat(sdk): declare ui.confirm on the vendored ExtensionContext mirror (EV-17 Q1)`

### Task 2: Driver-mechanism failing tests (test map 1–6, 8–10)

**Files:**
- Modify: `test/login.test.ts` — new `describe("EV-17: attended cancel affordance")` block at end of file, reusing `makeControl`/`attendedDeps`/`captureLog`/`fakeJwt`/`resp` harness.

**Interfaces:**
- Consumes: `runAttendedLogin(deps, existing, ctl)`, `createLoginCommand(deps).run("attended")`, `loginEndpointRequestLog`.
- Produces: the acceptance surface — every numbered map item as a real test (item 7 lives in Task 4's sibling suite).

- [ ] **Step 1: Write the tests.** `const CANCEL_LINE = "Sign-in cancelled — no credentials were saved."`. All cancel-scenario runs use `attendedDeps(c, { skipCallback: true }, { redirectTimeoutMs: 2000, waitForCancel: gate })` so the wait is parked with no callback inbound.

  1. **A1 raw driver** — gate `async () => true`; assert outcome `{ kind: "cancelled" }`; elapsed wall-clock strictly < 2000; **zero** occurrences of CANCEL_LINE in the driver's logs (the driver never prints it — print-once is the facade's, asserted in test 2); `loginEndpointRequestLog` has zero token-endpoint or device-endpoint entries; `readCredential({ configDir })` is null (A4).
  2. **A1 print-once via facade** — `createLoginCommand(deps).run("attended")` with the same gate; assert outcome cancelled and `logs.filter(l => l === CANCEL_LINE).length === 1`; `readCredential` null.
  3. **A5 dead-branch reachability** — `runAttendedLogin(deps, null, ctl)` with a test-owned `ctl = { cancelled: false }`, gate resolving `true`; assert outcome cancelled **and** `ctl.cancelled === false` (an implementation that sets the flag on the confirm path fails).
  4. **Rejection re-arms** — gate rejects on call 1, resolves `true` on call 2; assert outcome cancelled and dep invoked exactly twice.
  5. **Finisher totality — server-callback win** — default `attendedDeps` (callback completes), gate `async (signal) => { seen = signal; calls++; await tick(10); return false; }`, `redirectTimeoutMs: 5000`; assert outcome success, `seen.aborted === true`, and `calls` frozen across a 30ms post-run wait (no re-arm after a legitimate win).
  6. **Finisher totality — timer fire** — `skipCallback`, gate false-forever (10ms ticks), `redirectTimeoutMs: 100`; assert outcome `{ kind: "failure", reason: "redirectTimeout" }`, signal aborted, calls frozen.
  7. **Finisher totality — confirm-true** — gate resolves `true` once; assert outcome cancelled, exactly one dep invocation, signal aborted.
  8. **No spin on abort / cancel() wake** — gate false-forever (10ms ticks); `createLoginCommand(deps)`; `setTimeout(() => cmd.cancel(), 50)`; assert outcome cancelled, elapsed < 2000, signal aborted, dep call count frozen after the win.

- [ ] **Step 2: Run to red**

Run: `bun test test/login.test.ts -t "EV-17"`
Expected: FAIL — `waitForCancel` is not a `LoginDeps` member (TS excess-property at runtime ignored; driver never wakes) → cancel-scenario tests time out at 2000ms with `redirectTimeout` failures, not cancelled outcomes.

- [ ] **Step 3: Commit the red tests** — `test(login): EV-17 attended-cancel acceptance tests (red)`

### Task 3: Driver mechanism (`src/login.ts`)

**Files:**
- Modify: `src/login.ts` — `LoginDeps`, verbatim constants, `runAttendedLogin`, `createLoginCommand`.

**Interfaces:**
- Produces: `LoginDeps.waitForCancel?: (signal: AbortSignal) => Promise<boolean>`; exported `LOGIN_ATTENDED_CANCEL_TITLE = "Waiting for browser…"`, `LOGIN_ATTENDED_CANCEL_MESSAGE = "Cancel sign-in?"`; `ctl` param type `{ cancelled: boolean; wake?: () => void }` with `wake` installed by the driver = `() => finish({ type: "cancelled" })`.

- [ ] **Step 1: Add the dep + constants** — `waitForCancel?` on `LoginDeps`; the two exported constants adjacent to the copy vocabulary with a Stable-Keys provenance comment.
- [ ] **Step 2: Rewire `runAttendedLogin`** (exact placement):
  - Widen the `ctl` param type to `{ cancelled: boolean; wake?: () => void }` (default unchanged). `runHeadlessLogin` untouched.
  - Before the server: `const ctrl = new AbortController(); const signal = ctrl.signal;` hoist `let timer: ReturnType<typeof setTimeout> | undefined;` next to `let settled = false;`, then the single guarded finisher:
    ```ts
    const finish = (result: CallbackResult): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      ctrl.abort();
      settle(result);
    };
    ```
  - Server handler: replace `if (!settled) { settled = true; settle(result); }` with `finish(result)` (callback win aborts the signal → dialog dismissed).
  - At the wait: `timer = setTimeout(() => finish({ type: "timeout" }), timeoutMs);` (finish's guard subsumes the old `if (!settled)`), then `ctl.wake = () => finish({ type: "cancelled" });`, then the re-arm loop:
    ```ts
    const waitForCancel = deps.waitForCancel;
    if (waitForCancel) {
      void (async () => {
        while (!signal.aborted && !settled) {
          let decided: boolean;
          try {
            decided = await waitForCancel(signal);
          } catch {
            continue; // EV-17: rejection re-arms — rejection ≠ abort ≠ cancel.
          }
          if (signal.aborted || settled) return; // abort is never read off the value
          if (decided) {
            finish({ type: "cancelled" });
            return;
          }
        }
      })();
    }
    ```
  - The existing post-await `clearTimeout(timer)` and the `if (ctl.cancelled)` / `if (cb.type === "cancelled")` dispatch stay unchanged (the confirm path makes the second branch reachable; confirm-cancel never sets `ctl.cancelled`).
- [ ] **Step 3: Facade wake** — in `createLoginCommand`: `const ctl: { cancelled: boolean; wake?: () => void } = { cancelled: false };` and `cancel()` becomes `ctl.cancelled = true; ctl.wake?.();` (set-then-wake, per spec; the wake is a test/external seam, not a second user surface).
- [ ] **Step 4: Run to green**

Run: `bun test test/login.test.ts`
Expected: PASS — all EV-17 tests green, zero pre-existing regressions.

- [ ] **Step 5: Commit** — `feat(login): guarded finisher + re-arm loop make attended login cancellable (EV-17)`

### Task 4: Red-at-base record (map item 7, O-3-corrected timing-only) — `test/login-cancel.test.ts`

**Files:**
- Create: `test/login-cancel.test.ts` — self-contained (own minimal fetch/control helpers; imports only `createLoginCommand`, `loginEndpointRequestLog` types-free) so the single file materializes at the base sha verbatim.

**Interfaces:**
- Consumes: `createLoginCommand(deps)` + `cmd.cancel()` — both exist at base (cancel flips the flag only) and at head (set-then-wake).

- [ ] **Step 1: Write the falsifier.** Fresh temp configDir (no credential), discovery+token fake fetch, no `openUrl` (fallback+waiting, no callback), `redirectTimeoutMs: 500`, `inputPrompt`-free (no existing credential → no replacement prompt). Start the run; `setTimeout(() => cmd.cancel(), 50)`; assert outcome `{ kind: "cancelled" }` **and** elapsed strictly < 500 (interrupt, not a reason-flip at timer fire) and exactly one CANCEL_LINE. Never assert on a failure reason (O-3: a "reason redirectTimeout" red would mis-diagnose).
- [ ] **Step 2: Head half.** Run: `bun test test/login-cancel.test.ts` → PASS (0 fail). Record the sha + command + output.
- [ ] **Step 3: Base half.** In a detached worktree at the base sha (the origin/main commit this branch was cut from; main checkout untouched), copy in `test/login-cancel.test.ts` (bare copy — the only non-base file), run the same command, expect FAIL with elapsed ≥ 500 and outcome cancelled. Record the seven convention fields (base identity + selection rule, transplant identity, exact command, raw red output, worktree provenance, copy set, head half). Remove the worktree after.
- [ ] **Step 4: Commit** — `test(login): red-at-base falsifier — cancel() wakes the attended wait (EV-17 item 7)`

### Task 5: Entry wiring + Q2 gate (`index.ts`, `test/index.test.ts`)

**Files:**
- Modify: `index.ts` — `RemoteControllerDeps`, the `export default` closure, the `createLoginCommand` call site in `rcLoginCommand`.
- Modify: `test/index.test.ts` — `HarnessOptions`/`deps` gain `uiConfirm`/`hostMode`; new tests in the `/rc:login` describe.

**Interfaces:**
- Consumes: Task 1's `ui.confirm` mirror; Task 3's `LoginDeps.waitForCancel` + the two title/message constants.
- Produces: `RemoteControllerDeps.uiConfirm?: (title: string, message: string, opts: { signal?: AbortSignal }) => Promise<boolean>`; `RemoteControllerDeps.hostMode?: () => string`.

- [ ] **Step 1: Write the failing gate tests** (index harness):
  1. **Non-interactive (Q2):** `hostMode: () => "rpc"`, `uiConfirm` resolving `true` (with call counter), `redirectTimeoutMs: 300`, no `openUrl`; discovery/token fetch stubbed. Run `/rc:login` attended; assert the wait ended by timeout (redirectTimeout failure copy), `uiConfirm` **never called** — no affordance, exactly as at base.
  2. **`uiConfirm` absent:** `hostMode: () => "tui"`, no `uiConfirm` → same timeout outcome.
  3. **Positive control (tui):** `hostMode: () => "tui"`, `uiConfirm` resolves `true` and records `(title, message)`; run `/rc:login`; assert cancel line printed once, `uiConfirm` called once with exactly `LOGIN_ATTENDED_CANCEL_TITLE` / `LOGIN_ATTENDED_CANCEL_MESSAGE`.

  Run to red (members don't exist → harness deps reject / threading never fires → tests 1/3 red).
- [ ] **Step 2: Wire `index.ts`:**
  - `RemoteControllerDeps` gains the two optional members (doc comments citing EV-17 Q1/Q2).
  - `export default` closure (lazy capture, same pattern as `inputPrompt`): `uiConfirm: (title, message, opts) => requireCtx().ui.confirm(title, message, opts), hostMode: () => requireCtx().mode,`
  - `rcLoginCommand`'s `createLoginCommand({...})` call site:
    ```ts
    waitForCancel:
      deps.uiConfirm && deps.hostMode?.() === "tui"
        ? (signal) => deps.uiConfirm!(LOGIN_ATTENDED_CANCEL_TITLE, LOGIN_ATTENDED_CANCEL_MESSAGE, { signal })
        : undefined,
    ```
    (import the two constants from `./src/login`)
- [ ] **Step 3: Run to green.** `bun test test/index.test.ts` — PASS.
- [ ] **Step 4: Commit** — `feat(index): thread TUI-gated waitForCancel through /rc:login (EV-17 Q2)`

### Task 6: PI-SPEC §7.2 prose-sync (ruling Q3)

**Files:**
- Modify: `docs/PI-SPEC.md` — attended-enrollment bullet in §7.2.

- [ ] **Step 1: Append exactly one sentence** to the attended bullet naming the affordance and the gate, e.g.: `On interactive hosts (run mode \`tui\`) the attended wait additionally offers a cancel affordance — a \`ui.confirm\` dialog ("Waiting for browser…" / "Cancel sign-in?") that ends the flow at once with the \`login.cancelled\` outcome and no credential written — while non-interactive hosts offer no such affordance and the wait ends by callback, mismatch, or timeout.`
- [ ] **Step 2: Commit** — `docs(spec): §7.2 names the attended cancel affordance (EV-17 Q3)`

### Task 7: Full gates + PR

- [ ] `bunx tsc --noEmit` — clean.
- [ ] `bun test` — full suite green (only acceptable non-pass: the Windows-gated credential-ACL skip).
- [ ] `bun test test/pi-sdk-load.test.ts` — entry surface touched, load smoke green.
- [ ] Push `owner/ev17-attended-login-cancel`, open PR against `main` citing the spec file.
