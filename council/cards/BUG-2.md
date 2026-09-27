---
id: BUG-2
title: "Stop /rc:login user lines from landing in the TUI prompt box via console.log"
state: Done
owner: null
epic: null
goal: Attended and headless `/rc:login` user lines, including exactly `If the browser does not open, visit: `<authorizeUrl>``, `Waiting for browser…`, and `Signed in to `<serverUrl>` — enrollment credentials saved for this host. Run /rc to start a tunnel.` with ` (tenant ` + the tenant id + `)` appended when a tenant id is present, are delivered through `ctx.ui.notify` and are not written by `console.log` or `process.stdout.write`, and the production command print wiring in `index.ts` likewise calls `ctx.ui.notify` instead of `console.log`, proven by an automated test; after a successful attended login the last `ctx.ui.setStatus("pi-remote", …)` argument is exactly `Off`.
---

## Intent

A successful attended `/rc:login` in pi 0.87.1 interactive mode paints its user lines into the prompt box. The screenshot shows `If the browser does not open, visit: `<authorizeUrl>`` and the success line sitting in the editor region, with both `Authorizing with the control plane…` and `Off` stacked under the footer instead of the second replacing the first.

Those two login lines are not footer text. `src/login.ts`'s `print` helper hardcodes `console.log` and ignores any injected sink. `index.ts` wires the controller's `print` the same way: `(line) => console.log(line)`. pi's TUI owns stdout and parks the hardware cursor in the editor for IME. Interactive mode does not redirect stdout (`takeOverStdout` runs only for non-interactive and RPC). A `console.log` is therefore raw terminal output at the cursor, inside the prompt box, and it shifts the physical screen relative to the TUI's virtual buffer. Differential redraw then paints the post-login `Off` status on the next row and never erases `Authorizing with the control plane…`. `Waiting for browser…` is printed the same way but the cancel dialog (`ctx.ui.confirm`) repaints over it; the lines that bookend that dialog are the ones that stick.

pi's own non-blocking surface is `ctx.ui.notify`. In 0.87.1 an info notify is appended to the chat transcript (`showStatus`), not the editor. The footer sentences stay on `ctx.ui.setStatus("pi-remote", …)` only — they must not also be printed. Copy text is unchanged. The same `print` helper serves the headless flow, and the production `index.ts` print wiring serves `/rc`, `/rc:off`, and shutdown lines, so leaving either seam on `console.log` reproduces the bug on the next command.

Out of scope: browser-opener wiring (FLLWUP-43), copy changes, and the footer state machine itself (authorizing then off is already correct; the stacked sentences are the redraw desync).

## Acceptance

- An automated test drives attended `/rc:login` to success and asserts the fallback, waiting, and success lines are passed to the notify sink with the exact English rows above (tenant parenthetical appended only when a tenant id is present), and that `console.log` / `process.stdout.write` are not called for them.
- The same test asserts the recorded `setStatus("pi-remote", …)` sequence still includes `Authorizing with the control plane…` and ends with exactly `Off`.
- Headless login lines and the production `index.ts` print wiring (`rc.unenrolled`, `rc.offLifecycle`, `rc:login.refusal`, `shutdown.closed`, and the headless "Enrolling this host against …" line) go through `ctx.ui.notify`, not `console.log`.
- Existing copy rows are byte-unchanged. `bunx tsc --noEmit` and `bun test` are green.

## Run record

### Step 1 — read and gate (facilitator)
Card read; `state: Ready`. `council_route` op `route` → fallback (`no recorded decision for the current packed state`; the tool also returned `mode: Deliberate` with `source: fallback`, which is not a recorded mode). Step 1's own judgment applies. Classification: **mechanical** — narrowly scoped and unambiguous, confined to the login print sink and the production command print wiring in `index.ts`. The goal names the sink (`ctx.ui.notify`), the forbidden writers (`console.log` / `process.stdout.write`), the exact copy rows, and the terminal `setStatus` value. No design tradeoff left open. **Surface-touching: yes** — the lines move off the prompt box onto the notify surface; a person reads them in a different place. Copy is unchanged. Mechanical + surface-touching seats no `designer`. Steps 2–6 skipped.

### Step 7 — mechanical handoff
No deliberation ran, so no spec file; the card's own `Intent` / `goal` / `Acceptance` is the handoff. Card set `In Progress`.

### Step 8 — owner implements (job-1, settled 15.3m)
Isolated worktree `../pi-remote-bug-2`, branch `owner/BUG-2-login-notify`, PR **#52** open at head `68cd9ce063abfd0c1ff9252db78acbe26420a8d8` (observed via `gh pr view 52`: state OPEN, not draft, base `main`). Card set `In Review` from that open PR, not from the owner's gate report.

### Step 9 — skeptic verifies (job-2, settled 19.3m)
`council_route` op `recheck` at `68cd9ce063abfd0c1ff9252db78acbe26420a8d8` → fallback, `rechecked: false`; no re-route. Surface-touching bit was in the dispatch. Skeptic verdict: **VERIFIED, no block**. Own gates: `bun install --frozen-lockfile` exit 0; `bunx tsc --noEmit` exit 0; `bun test` 331 pass / 7 skip / 0 fail. Rendered surface grounded in installed pi 0.87.1: `notify` → `showStatus` → chat transcript, not the editor; production `print` calls `ctx.ui.notify`. Red-at-base reproduced on an equal triple (base `74abc8ea6aeb320f221def97ca41c670220c1601`, transplant `test/bug2-login-notify.test.ts`, command `bun test test/bug2-login-notify.test.ts`): 0 pass / 3 fail at base, 3 pass / 0 fail at head; all three reds derived mechanism-absent. Non-blocking note: `shutdown.closed` has no dedicated row-level notify assertion (wiring proof only).

### Step 10 — judge (job-3, settled 0.4m)
Input: the `goal` + Skeptic evidence + pinned head only. **Verdict: PASS**. Judge re-ran `bun test test/bug2-login-notify.test.ts` at `68cd9ce` — 3 pass / 0 fail / 16 expect() calls — plus full suite 331 pass / 7 skip / 0 fail and `bunx tsc --noEmit` clean.

### Step 11 — human merge gate
Human said "Merge it". Merged `gh pr merge 52 --merge --match-head-commit 68cd9ce063abfd0c1ff9252db78acbe26420a8d8` (no `--admin`). PR MERGED at 2026-09-27T13:57:17Z, merge commit `112ed2245e7b67c8224f1bf2046d3b42a7058fe2`. CI on that SHA: workflow `gates` run 36324181683, `gates` success, `gates-windows` success.

### Step 12 — sync and reconcile
`git fetch origin`. Local `main` was ahead 4 / behind 4 (council record commits vs the merge). Fast-forward impossible. Union-merged `origin/main` (merge `ff0998e`); ort auto-resolved, no conflict markers in `council/`. `112ed224` is an ancestor of HEAD. Card set `Done` from that observed merged SHA with green CI. Direct record push not executed: `council/phase1-authorizations.json` grants `direct-record-push-to-main` for run `EPIC-7` only, not this run.
