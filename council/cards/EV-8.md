---
id: EV-8
title: "Command surface and lifecycle wiring"
state: Ready
owner: null
epic: EPIC-1
goal: The extension registers /rc, /rc:off, and the session_shutdown handler so /rc dials and reaches live status, /rc:off closes the socket and notifies the control plane, teardown runs for every shutdown reason, and both commands are idempotent no-ops when already in the target state.
---

## Intent

Implements §8 in `src/index.ts` — the entry point that registers commands,
subscribes the live event path (pi.on → translate.ts → transport.ts), and owns
teardown. `/rc` prompts once for a control-plane URL if unset and points the
user at `/rc:login` when no credential exists (EV-7); `/rc:off` (colon
namespace per the owner's decision — never `/rc-off`) closes the WS and
deletes the tunnel; the `session_shutdown` handler tears down for **every**
shutdown reason (`quit`, `reload`, `new`, `resume`, `fork`) so exiting without
`/rc:off` never leaves a live tunnel. User-visible surface — the `/rc`,
`/rc:login`, `/rc:off` command palette entries with their output copy, and the
footer status via `ctx.ui.setStatus("pi-remote", …)` showing exactly one of
seven states in lifecycle order — `off`, `not enrolled`, `authorizing`,
`dialing`, `resyncing`, `live`, `error` (spec §8 authoritative; product-owner
ruling EV-1 Q2 as source). Every state change is a stated sentence resolved
through `loginEnglishFor` (EV-7), never a glyph ack or a raw string.

## Acceptance

- `/rc` on an enrolled host ends with footer status `live` and frames flowing;
  a second `/rc` while connected notifies and changes nothing.
- `/rc:off` while live ends with status `off`, the tunnel deleted at the
  control plane, and a second `/rc:off` is a clean no-op.
- Quitting, reloading, starting a new session, resuming, and forking — each
  with the tunnel live and without calling `/rc:off` — all leave the tunnel
  deleted and the WS closed (one test per reason).
- With no credential configured, `/rc` fails gracefully and its output tells
  the user to run `/rc:login`; footer status is `not enrolled`.
- Footer status is exactly one of seven states in lifecycle order — `off`,
  `not enrolled`, `authorizing`, `dialing`, `resyncing`, `live`, `error`
  (spec §8 / EV-1 Q2); `error` derives only from the typed transport stream
  (EV-3/EV-7), and `resyncing` is shown during a replay (EV-5). A remote
  observer can correlate status with behavior.
- `/rc:login` sets the footer to `authorizing` when the login driver begins
  and returns it to `off` on terminal; the seven-state set has no `idle`
  state (EV-7's success→idle is reconciled to `off` per spec §8).
