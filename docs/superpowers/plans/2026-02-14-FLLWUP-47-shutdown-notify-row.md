# Plan: FLLWUP-47 — Pin shutdown.closed delivery through ctx.ui.notify with a row-level test

Card: `council/cards/FLLWUP-47.md` (mechanical — the card's Intent/goal is the handoff).
Worktree: `/home/tista/codes/pi-remote-fllwup-47`, branch `owner/FLLWUP-47-shutdown-notify-row`,
cut from `origin/main` @ `2ab38b9eac6f986ac47976655ac4791687c59368`.

## Why

BUG-2 routed the production print sink through `ctx.ui.notify`
(`index.ts:968` `print: (line) => requireCtx().ui.notify(line)`). The
`session_shutdown` subscription (`index.ts:1000-1004`) calls
`controller.onShutdown()` (`index.ts:730-734`) whose final row is
`deps.print(loginEnglishFor("shutdown.closed"))` — English
`Remote tunnel closed` (`src/copy.ts:88`). No test drives that path and
asserts the row at the notify sink; the existing `/rc:off` assertion is
satisfied by the `rc.offLifecycle` row (same English string), so a future
edit that breaks only the shutdown delivery would stay green.

## Steps

1. **Extend the entry harness** in `test/bug2-login-notify.test.ts`:
   `fakePi.on` currently discards handlers (`on: () => () => {}`). Record
   handlers by event name and expose a `fireEvent(event)` helper that invokes
   the captured handler with the fake ctx. The `session_shutdown` handler is
   fire-and-forget (`void controller.onShutdown()`), so add a small
   `waitForNotifyRow` poll (deadline-bounded) before asserting.
2. **Add the row-level, path-specific test** (no production change expected —
   this is a regression pin):
   - load the real entry (default export) against the fake host,
   - drive `session_shutdown` with the fake ctx,
   - assert `notifyLines` `toEqual(["Remote tunnel closed"])` (exactly that
     row, nothing else — proves the shutdown path delivered it independently
     of `/rc:off`),
   - assert sentinels: `console.log` / `process.stdout.write` silent.
3. **Falsify the test** (TDD red-at-base evidence): temporarily mutate
   `index.ts`'s `onShutdown` to drop the `deps.print(...)` row, run the new
   test in isolation → must go red with a failure naming the missing row;
   revert → green. This proves the test is genuinely row-level and
   path-specific (the mutation keeps the constructor `print→notify` wiring,
   exactly the later-edit failure mode the card describes).
4. **Gates** (per AGENTS.md / `.github/workflows/gates.yml` — no import or
   boot gates exist in this repo):
   - `bun install`
   - `bunx tsc --noEmit` — clean
   - `bun test` — all-pass (only expected non-pass: Windows-gated
     credential-ACL skip on non-Windows)
5. **Ship**: Conventional Commits (`test(bug2): ...`, plan under `chore(docs)`
   or `docs:`), push `owner/FLLWUP-47-shutdown-notify-row`, open PR with `gh`.

## Out of scope (card-forbidden)

- `src/copy.ts` rows (byte-unchanged), footer FSM, the no-sink
  `console.log` fallback in `src/login.ts`.
- No production code change unless the test reveals a real defect (then:
  exact change + why, in the report).

## Verified grounding

- `index.ts:730-734` `onShutdown` → `teardown(); applyFooter("off");
  deps.print(loginEnglishFor("shutdown.closed"))` (read).
- `index.ts:1000-1004` `pi.on("session_shutdown", ...)` fire-and-forget (read).
- `index.ts:968` `print → requireCtx().ui.notify` (read).
- `src/copy.ts:87-88` `rc.offLifecycle` and `shutdown.closed` are both
  `"Remote tunnel closed"` in English (read).
- `test/bug2-login-notify.test.ts` harness: `loadEntry()` fake host with
  `on: () => () => {}`; sentinel pattern `installSentinels()` /
  `expectSentinelsSilent()` (read).
- Fresh-entry shutdown touches only `applyFooter("off")` (→ `setStatus`,
  provided in fake ctx) and the single print; no transport, no credential
  read on the teardown path (read `doTeardown`, index.ts:521-543).
