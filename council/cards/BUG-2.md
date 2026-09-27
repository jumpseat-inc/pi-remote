---
id: BUG-2
title: "Stop /rc:login user lines from landing in the TUI prompt box via console.log"
state: Ready
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
