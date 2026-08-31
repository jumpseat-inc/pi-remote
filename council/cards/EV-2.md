---
id: EV-2
title: "Control-plane tunnel REST client"
state: Deliberating
owner: null
epic: EPIC-1
goal: tunnel.ts creates a tunnel via POST /tunnels using the enrollment credential, consumes the returned signed one-time wss URL, and deletes the tunnel via DELETE /tunnels/:id on teardown.
---

## Intent

Implements §7.2's client half of the contract in `src/tunnel.ts` — the only
code besides `transport.ts` that touches the network. It presents the
enrollment credential (from `/rc:login` provisioning, EV-7) as opaque, sends
session id, session name, cwd, and host metadata, and hands the signed
one-time `wss://` URL plus TTL to the transport (EV-3). User-visible surface —
none directly; this is host-side plumbing, but its failure copy (bad or expired
enrollment credential, control plane unreachable) surfaces in the `/rc`
command output and footer status, and those messages should name the fix (run
`/rc:login`).

## Acceptance

- With a valid enrollment credential, a tunnel create request returns a
  parseable `{ tunnelId, url, tokenTtl }` and the extension dials within the
  TTL.
- A second create while already connected is not issued — `/rc` stays
  idempotent (EV-8 relies on this).
- On teardown the extension issues DELETE for its tunnel id and discards all
  token state; the token is never persisted.
- An expired or rejected enrollment credential produces an error that names
  `/rc:login` as the remedy, not a raw HTTP trace.

---

## Step 1 — gate (facilitator)

State `Ready`. **Full council** (cross-seam: `src/tunnel.ts` is one of the two
network modules; it consumes the EV-7-provisioned enrollment credential and
hands the signed `wss://` URL + TTL to EV-3 transport; its failure copy
surfaces in EV-8's `/rc`/footer output; where the one-silent-refresh of spec §8
lives is un-pinned and genuinely ambiguous; 401 vs 403 vs expired vs
unreachable handling, idempotency mechanism, and token-discard timing are
design judgments). **Surface-touching** (failure and status copy name the fix
`run /rc:login`) — designer seated alongside owner and principal in steps 2–3.
