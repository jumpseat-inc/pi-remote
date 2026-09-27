---
title: Notify Sink
type: concept
summary: In pi 0.87.1 interactive mode, user lines go through ctx.ui.notify (chat transcript); footer sentences stay on setStatus only — console.log writes into the prompt box and desyncs redraw.
aliases: [notify vs footer, user-line surface, TUI print sink]
tags: [concept/ui, login, tui, doctrine]
sources: ["[[BUG-2 Run]]", "[[FLLWUP-47 Run]]"]
created: 2026-09-27
updated: 2026-09-27
---
pi 0.87.1 interactive mode owns stdout and parks the hardware cursor in the editor for IME. It does not redirect stdout (`takeOverStdout` runs only for non-interactive and RPC). A `console.log` or `process.stdout.write` is therefore raw terminal output at the cursor, inside the prompt box, and it shifts the physical screen relative to the TUI's virtual buffer. Differential redraw then paints the next footer sentence on the following row and never erases the previous one.

That is what a successful attended `/rc:login` looked like before the [[BUG-2 Run]]: `If the browser does not open, visit: \`<authorizeUrl>\`` and the success line sat in the editor region, and both `Authorizing with the control plane…` and `Off` stacked under the footer. The [[Seven Footer States]] machine was already correct — authorizing, then exactly `Off`. The stacked sentences were the redraw desync, not a second `setStatus`. `Waiting for browser…` is printed the same way, but the cancel dialog (`ctx.ui.confirm`) repaints over it; the lines that bookend that dialog are the ones that stick.

**The split.** User lines go through `ctx.ui.notify`. In 0.87.1 an info notify is `showExtensionNotify` → `showStatus`, which appends to the chat transcript (`chatContainer`), not `this.editor`. Footer sentences stay on `ctx.ui.setStatus("pi-remote", …)` only — they must not also be printed. Copy is unchanged ([[copy.ts]], [[Copy Honesty Doctrine]]). The same production `print` in [[index.ts]] serves `/rc`, `/rc:off`, shutdown, the while-live refusal, and both login drivers, so both the [[login.ts]] helper and the entry-point wiring have to use the sink. Leaving either on `console.log` reproduces the bug on the next command.

**Fallback, not a ban.** [[login.ts]] `print` calls an injected `onUserLine` when present and `console.log` only when it is absent. Production always injects `onUserLine: deps.print`. The fallback exists so driver tests that do not pass a sink stay green. It is not a production path: `createLoginCommand` has one construction site, and it always passes the sink.

**What a stub does not prove.** A test that records a stand-in `notify` shows the call. It does not show that pi paints that call outside the prompt box. The [[BUG-2 Run]] Skeptic read the installed `pi-tui` 0.87.1 interactive-mode binding before calling the surface closed ([[Real-Surface Verification]]). The vendored signature on [[pi-sdk-on.ts]] matches `types.d.ts:77` byte for byte.

**Row-level delivery pinned (FLLWUP-47, PR #53).** `shutdown.closed` (`Remote tunnel closed`) is delivered because `onShutdown` calls `deps.print`. The [[BUG-2 Run]] accepted that on constructor wiring alone; the [[FLLWUP-47 Run]] closed the gap. It fires the real `pi.on("session_shutdown")` handler and asserts the whole sink transcript `toEqual(["Remote tunnel closed"])`, with defect injection proving the test goes red when the row is dropped. A `toContain` could not pin it: `rc.offLifecycle` and `shutdown.closed` render identical bytes ([[Twin-Row Delivery Hazard]]).

The perception failure — the user cannot tell authorizing has ended, because the old sentence is still on screen — is the [[Gulf of Evaluation]] applied to a cursor bug rather than to missing copy.

## Related
[[BUG-2 Run]], [[FLLWUP-47 Run]], [[Twin-Row Delivery Hazard]], [[login.ts]], [[index.ts]], [[pi-sdk-on.ts]], [[copy.ts]], [[Seven Footer States]], [[Gulf of Evaluation]], [[Copy Honesty Doctrine]], [[Real-Surface Verification]], [[Fixture-Green Honesty]]

## Sources
[[BUG-2 Run]], [[FLLWUP-47 Run]]
