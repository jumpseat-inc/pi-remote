---
id: FLLWUP-48
title: Generalize the bug2 notify test harness for per-event forwarded contexts
state: Backlog
owner: null
epic: null
goal: Give the `test/bug2-login-notify.test.ts` fake-host harness (`loadEntry`/`fireEvent`) per-event `fakeCtx` variants so a future test can fire a forwarded `deps.on` event (e.g. a `message_start` payload) with the event-shaped context it expects, instead of the single shared `fakeCtx`; the generalization must leave the existing BUG-2/FLLWUP-47 assertions byte-unchanged and `bunx tsc --noEmit` + `bun test` green.
---

## Intent

Filed from FLLWUP-47's step 13. The owner's step-8 note: the harness's `fireEvent`
captures handlers registered through both the direct `pi.on` seam and the `deps.on`
forwarder, but every fired handler receives the one shared `fakeCtx`. Nothing in
FLLWUP-47 or BUG-2 needs per-event context, but a future test firing a forwarded event
with event-shaped context nuances (e.g. a `message_start` payload) may need a ctx variant
shaped for that event.

## Acceptance

- `loadEntry`/`fireEvent` can supply an event-shaped `fakeCtx` (or equivalent) for a
  forwarded `deps.on` event.
- Existing BUG-2 and FLLWUP-47 test assertions are byte-unchanged.
- `bunx tsc --noEmit` and `bun test` are green.