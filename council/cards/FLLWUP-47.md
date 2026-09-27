---
id: FLLWUP-47
title: Pin shutdown.closed delivery through ctx.ui.notify with a row-level test
state: Done
owner: owner/FLLWUP-47-shutdown-notify-row (PR #53, merged 8ade4fb)
epic: null
goal: An automated test drives the production shutdown path that prints shutdown.closed and asserts the exact English row `Remote tunnel closed` is passed to ctx.ui.notify and is not written by console.log or process.stdout.write.
---

## Intent

BUG-2 routed the production print sink through `ctx.ui.notify`. The Skeptic verified that `rc.unenrolled`, `rc.offLifecycle`, and `rc:login.refusal` have row-level notify assertions, and that `shutdown.closed` does not. Its only proof is that `index.ts`'s `onShutdown` calls `deps.print(loginEnglishFor("shutdown.closed"))` and that `print` is wired to `notify`. A later edit can keep that constructor wiring and still fail to deliver this row.

The English row, emitted by `loginEnglishFor("shutdown.closed")`, is exactly `Remote tunnel closed`. This card adds the missing row-level test. It does not change copy, the footer state machine, or the no-sink `console.log` fallback in `src/login.ts`.

## Acceptance

- An automated test invokes the production shutdown path and records the notify sink.
- The sink receives exactly `Remote tunnel closed`.
- That delivery does not call `console.log` or `process.stdout.write`.
- Existing copy rows are byte-unchanged. `bunx tsc --noEmit` and `bun test` are green.
