---
id: FLLWUP-19
title: "Align PI-SPEC §7.2's no-lookup-state prose with the governing spec's server-state position"
state: Backlog
owner: null
epic: EPIC-2
goal: docs/PI-SPEC.md §7.2's sentence that the server needs no lookup state to authenticate a dial is amended to match the governing tunnel-lifecycle spec, which requires exactly two pieces of server state — the consumed-token jti set and live-tunnel existence — with the dial remaining lookup-free beyond them.
---

## Intent

Filed from EV-11's step 13 (Skeptic non-blocking disclosed note). PI-SPEC §7.2
still says "the server needs no lookup state to authenticate a dial" — written
before the tunnel-lifecycle spec (docs/SERVER-SIDE-SPEC.md §3.1, EV-11) made
two REQUIRED pieces of server state explicit: the consumed-token `jti` set
(single-use enforcement) and live-tunnel existence (the `409 tunnel_already_live`
guard). The claim is looser than the governed reality; a PI-SPEC reader could
implement a server that misses the single-use set. Docs-only prose sync —
EV-11's PR changed only claim-name spellings in PI-SPEC, per its settled sync
scope, so this drift is pre-existing and untouched.

## Acceptance

- §7.2's no-lookup-state sentence is amended to state the two REQUIRED pieces
  of server state and that the dial itself requires no per-dial lookup beyond
  them — matching docs/SERVER-SIDE-SPEC.md §3.1's position.
- No other §7.2 change; the two specs agree after the edit.
- bunx tsc --noEmit exit 0; bun test exit 0 (docs-only; suite untouched).
