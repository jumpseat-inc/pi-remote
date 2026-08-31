---
title: "pi-remote — `pi` Extension Spec"
type: spec
summary: Specification for the pi-remote extension only — the AG-UI gateway that dials out from an active pi session, translates both live events and JSONL history into AG-UI frames, injects remote input, and owns tunnel security from the host side.
status: proposed
created: 2026-08-31
---

# `pi-remote` — `pi`-side spec

## 1. Purpose & scope

This repo builds **the `pi`-side extension only**: an installable `pi` package
that makes an active, running `pi` session remotely controllable by dialing
*out* to a relay server and exposing the session over **AG-UI**.

Everything server-side is reduced to a **contract, not an implementation**. The
server this extension dials into is assumed to be a standardized-frame relay:
it accepts and forwards **AG-UI frames and nothing else**. We do not design a
two-plane server here — no data/control plane split on our side of the wire,
only the narrow control-plane REST surface the extension needs to exist
(tunnel creation, token exchange, device grants).

Key decisions at a glance:

| Decision | Where |
| --- | --- |
| All AG-UI translation happens in this extension; the server only accepts standardized messages | §2 |
| AG-UI is the only wire format; pi-specific concepts escape as `CUSTOM` events, never a second format | §4 |
| Session history is translated from the local JSONL by the extension, on demand, through the same mapper as live events | §5 |
| WS transport with application-level seq/ack; the local JSONL is the source of truth for replay | §6 |
| Security: outbound-only dialing, server-signed one-time tunnel tokens, tenant-scoped per-device grants | §7 |
| 1:N fan-out with the extension as single producer owning the monotonic sequence | §9 |

## 2. The translation boundary (locked decision)

**All AG-UI translation happens in this extension.** Two consequences:

1. **The server only accepts standardized messages.** Every byte leaving the
   extension over the tunnel is a well-formed AG-UI frame (inside the framing
   envelope of §6). The server never learns what a `pi` session file, a
   `BashExecutionMessage`, or a compaction entry is. It relays, caches, and
   forwards opaque standardized frames.
2. **History translation is not a server feature.** When a client needs to
   catch up beyond the server's cache, the server relays a standard `resync`
   request downstream, and **this extension regenerates AG-UI frames from the
   local JSONL**. The server never inspects, translates, or stores session
   history in a pi-specific form.

This keeps the trust and knowledge boundary in one place: the host machine
already holds the session; it also holds the only pi-aware code. The server
stays dumb and swappable.

## 3. Extension architecture

Distributed as a `pi` package (`pi install git:…/pi-remote`), loaded via
`jiti`, with runtime deps in `dependencies` per pi package conventions.

```
src/
├── index.ts        # entry: registers commands, hooks, shutdown handler
├── transport.ts    # outbound wss dial, reconnect/backoff, heartbeat, seq/ack
├── translate.ts    # pi event → AG-UI frame  (the single translator, see §5)
├── history.ts      # JSONL reader → translate.ts  (replay / resync)
├── inject.ts       # client input → sendUserMessage (steer/followUp)
└── tunnel.ts       # control-plane REST client: tunnel create, token exchange
```

Module rules:

- `translate.ts` is a **pure function**: `(pi event or JSONL entry) → AG-UI
  frame(s)`. No I/O, no socket references. Both the live path (§4) and the
  replay path (§5) call it. One mapping, two triggers.
- `transport.ts` is the only module that touches the network.
- No background resources started from the factory; the tunnel is created by
  `/rc` and torn down by an idempotent `session_shutdown` handler (§8).

## 4. Live translation: pi event bus → AG-UI

The extension subscribes via `pi.on()` and emits AG-UI events wrapped in the
framing envelope (§6). Mapping (using pi's real event names):

| pi surface | AG-UI event | Notes |
|---|---|---|
| `agent_start` / `agent_settled` | `RUN_STARTED` / `RUN_FINISHED` | `agent_settled`, not `agent_end`, so retries/compaction retries don't emit premature run-end |
| `message_update` (`assistantMessageEvent` text deltas) | `TEXT_MESSAGE_CONTENT` (+ `TEXT_MESSAGE_START`/`END` around the message) | streaming assistant reply |
| thinking content in `message_update` | `THINKING_TEXT_MESSAGE_*` | reasoning pane |
| `tool_execution_start` / `_update` / `_end` | `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END` | rich tool UI |
| `tool_result` message events | `TOOL_CALL_RESULT` | final result, assistant source order |
| `turn_start` / `turn_end` | `STEP_STARTED` / `STEP_FINISHED` | |
| `ui.confirm` / approval-style prompts (`ui_prompt_start`/`ui_prompt_end`) | `CUSTOM` (`pi.human_input`) | human-in-the-loop; client replies flow back via injection (§5.3). AG-UI native interrupt framing if/when the client implements it |
| `context` / token budgets / compaction (`session_compact`) | `CUSTOM` (`pi.context.*`) | escape hatch |
| `model_select`, `thinking_level_select`, `session_info_changed` | `CUSTOM` (`pi.session.*`) | client-side status |
| user input (from a client) | `TEXT_MESSAGE_START` (role `user`) | injected locally, then echoed onto the wire like any other message |

pi concepts AG-UI cannot express are **always** `CUSTOM` events — never a
second wire format. `CUSTOM` payloads carry `{ pi: <event-name>, data: … }`.

## 5. History translation: JSONL → AG-UI (locked decision)

On `(re)connect`, or when the server relays a `resync` request it cannot serve
from its ring buffer, the extension replays session history **by translating
the JSONL through the same `translate.ts` mapper** used for live events.

### 5.1 Why in the extension (rationale)

- The server must only accept standardized messages (§2). If the server
  translated history, it would need the pi session format — a pi-aware,
  stateful server, exactly what this design refuses to build.
- The JSONL lives on the host. Reading it there is free, always current, and
  survives server restarts by construction.

### 5.2 Replay algorithm

1. Read the session file via `ctx.sessionManager` where possible
   (`getBranch()` from the current leaf) and fall back to reading the JSONL
   directly for large tails — both produce the same entry stream.
2. Walk the **active branch** (`buildContextEntries()` semantics): honors
   compaction (`retainedTail` / `firstKeptEntryId`) and `branch_summary`, so
   replayed history is what the session actually means, not raw file noise.
3. For each entry, emit AG-UI events through `translate.ts`:
   - `message` entries → the message/step/tool-call events of §4
   - `compaction` → `MESSAGES_SNAPSHOT` + `CUSTOM` (`pi.context.compaction`)
   - `model_change` / `thinking_level_change` / `session_info` → `CUSTOM`
   - `custom` / `custom_message` / `bashExecution` → mapped per §4 rules
4. Frame the batch with `replay: true` and a deterministic **event id derived
   from the JSONL entry id + content hash**, so a replay can never
   double-execute a tool call on the client even if delivered twice — replay
   idempotency with a concrete, stable key.

### 5.3 Resync handshake (contract the server must relay)

```
client → server : { type: "resume", deviceId, lastAckedSeq }
server → ext    : served from ring buffer if possible,
                  else { type: "resync", fromSeq }   ← relayed as-is
ext → client    : replay batch (§5.2), then { type: "resync_done", uptoSeq }
```

The extension treats `resync` requests as replay triggers and answers from the
JSONL — it never assumes the server has anything.

## 5.4 Input injection (client → pi)

Remote input arrives as AG-UI user-message frames. The extension converts them
and injects with `pi.sendUserMessage()` so they behave exactly like typed
input:

| Client intent | Extension behavior |
|---|---|
| New prompt while idle | `pi.sendUserMessage(text \| content[])` |
| Mid-stream redirect | `pi.sendUserMessage(…, { deliverAs: "steer" })` |
| Queue after current work | `pi.sendUserMessage(…, { deliverAs: "followUp" })` |
| Approval response for a `pi.human_input` prompt | resolved via the matching pending UI prompt when the mode supports it; otherwise surfaced as a steering message |

The `input` event exposes `source: "extension"` for these messages; the
extension does **not** filter or transform its own injections (`action:
"continue"`), so remote messages are indistinguishable from typed ones in the
session log — which is what makes §5 replay correct by construction.

## 6. Transport & durability

The pi-side responsibilities, pinned:

- **Dial out** over `wss://` to the relay. Reconnect with exponential backoff
  + jitter; heartbeat pings; stable **logical connection id** = session id
  (`ctx.sessionManager.getSessionId()`), so a reconnect re-binds to the same
  session rather than spawning a new tunnel.
- **Envelope.** Every frame is `{ v, seq, ack, frame }` — AG-UI event inside
  `frame`, monotonic `seq` owned by the extension (single producer ⇒ single
  total order; this is what makes the 1:N fan-out decision in §9 workable), `ack`
  echoing the highest processed inbound seq.
- **Durability split.** The server may keep a best-effort ring buffer for fast
  catch-up. The **source of truth is the local JSONL** (§5). The extension
  keeps no durable buffer of its own beyond the in-flight window.
- **Idempotency.** Live frames carry UUID event ids; replay frames carry the
  deterministic ids of §5.2. Clients dedupe by event id.

## 7. Security

The tunnel is the highest-privilege surface in the design — it drives a coding
agent with arbitrary `bash` — so the extension side is specified fully even
though the server is not built in this repo.

### 7.1 Outbound-only dialing

- The extension **never listens**. `/rc` does not open ports, bind sockets, or
  require host firewall changes. The only network role of the host is
  *outbound client* of the relay (data) and *outbound HTTPS client* of the
  control plane (tunnel lifecycle).
- All tunnel traffic flows inside the extension's single outbound WebSocket.

### 7.2 Host enrollment

An alternative design — *host-minted, server-signed* tokens — forces a
signing key distribution problem before anything works. **Chosen instead: the
server mints and signs; the host never holds a signing key.**

- One-time setup: the user configures a **host enrollment key** — a
  long-lived credential issued by the control plane and stored in extension
  settings (`PI_REMOTE_SERVER_URL` + `PI_REMOTE_HOST_KEY` env vars, or the
  settings block). This key authorizes *creating tunnels*, nothing else.
  On a multi-tenant server the key is issued **to a tenant** (a user or
  account); the extension treats it as opaque and the server resolves
  key → tenant on every request.
- `/rc` flow:
  1. Extension `POST /tunnels` to the control plane with the host key,
     payload: session id, session name, cwd, host metadata.
  2. Server responds with `{ tunnelId, url, tokenTtl }` — a **signed, expiring
     `wss://` URL with a one-time token** (`wss://server/tunnelId?token=…`).
     The token is self-describing: it embeds its claims (`tenantId`,
     `tunnelId`, `sessionId`, `exp`), so the server needs no lookup state to
     authenticate a dial.
  3. Extension dials the URL within the token TTL (default 60 s). The token is
     **single-use**: consumed on successful WS upgrade, then bound to that
     socket. A replayed URL is rejected.
- The host stores no tunnel secrets after connection: the token is discarded,
  and the connection itself is the capability.

### 7.3 Per-device registry grants

- Client devices are registered with the control plane (out of scope to
  build; the extension only depends on the contract). Each device holds a
  `deviceId` + device credential. Grants are **tenant-scoped**: devices are
  members of a tenant and may connect to tunnels of their tenant.
  Tenant membership is the base grant; the server may layer narrower
  per-tunnel or per-host restrictions on top, but the extension never
  depends on them.
- **The server enforces grants** at fan-out — the extension never authenticates
  clients directly and never sees client credentials.
- The extension's only device-awareness is the frame envelope: inbound frames
  (input, acks, resumes) carry the sending `deviceId`. The extension:
  - tracks `lastAckedSeq` per device (for its own reconnect accounting and to
    know when replay is needed), and
  - tags `pi.human_input` resolutions with the resolving `deviceId`, so an
    approval has an audit identity.
- Revocation is a control-plane act; a revoked device's frames stop arriving.
  The extension treats the server as the authority and does not need to act.

### 7.4 Trust summary

| Component | Holds | Can do |
|---|---|---|
| Host (extension) | host enrollment key | create tunnels, dial out, translate, inject |
| Server | enrollment registry, device registry, signing key | mint/revoke tunnel tokens, enforce device grants, relay frames |
| Client device | device credential | connect to granted tunnels, ack, resume, send input |

Compromise blast radius: a leaked host key lets an attacker **create tunnels
for sessions they can already see locally** (i.e., they are on the host) — it
does not grant session access by itself, and its damage is contained to its
own tenant. A leaked tunnel token is bounded by its TTL and single-use
property, and only reaches its own tunnel.

### 7.5 Multi-tenancy

The server may be multi-tenant; this extension does not change shape to
support it. Tenancy is carried entirely by credentials, at three contract
points:

| Contract point | Tenant identity | Extension behavior |
|---|---|---|
| Enrollment key (§7.2) | key belongs to a tenant | opaque credential, presented as-is |
| Tunnel token (§7.2) | `tenantId` claim inside the signed token | opaque, dialed as-is |
| Device grants (§7.3) | tenant-scoped device membership | never sees credentials; only `deviceId` in the envelope |

The data-plane frame envelope carries **no** tenant identity: every WS
connection is already bound to exactly one `(tenant, tunnel)` pair by its
token, so the server scopes all relay, fan-out, and ring-buffer state by
connection. `tunnelId` must be globally unique (server-assigned), and the
session id used as the logical connection id is already a UUID — neither
requires namespacing on the wire.

## 8. Lifecycle & command surface

| Command | Behavior |
|---|---|
| `/rc` | Ensure settings exist (prompt once for server URL / enrollment key if missing), `POST /tunnels`, dial the signed URL, start translating live events. Idempotent: if already connected, notify and no-op. |
| `/rc-off` | Close the WS, notify the control plane (`DELETE /tunnels/:id`), discard token state. Idempotent. |
| `session_shutdown` handler | Tear down the tunnel for **every** shutdown reason (`quit`, `reload`, `new`, `resume`, `fork`) — exiting without `/rc-off` must not leave a live tunnel. Idempotent with `/rc-off`. |

Status surface: footer status via `ctx.ui.setStatus("pi-remote", …)` showing
tunnel state (`off` / `dialing` / `live` / `resyncing`), so the host user can
always see that the session is remotely reachable.

## 9. Resolved design questions

1. **Where the token is minted and stored.** Answered by §7.2: the *server*
   mints and signs the one-time tunnel token; the host holds only the
   long-lived host enrollment key used to request tunnels. This avoids the
   alternative of host-minted/server-signed tokens, which would require
   distributing a server signing key to every host, and would erode the
   signing-key trust boundary between host and server.
2. **Push provider.** Server-side concern; the extension is unaffected. For
   the registry record shape, reserve `pushProvider: "webpush" | "apns" |
   "fcm"` (default `"webpush"` — no vendor account, works for a browser PWA
   client first). The extension never sees push payloads; it only triggers the
   server's "tunnel ready" notification implicitly by creating the tunnel.
3. **Multiple concurrent clients vs 1:1.** **1:N (small N)**. Because the
   extension is the single producer and owns the monotonic `seq`, fan-out is
   trivially consistent — every client sees the same ordered stream, and each
   client acks/resumes independently via its `deviceId` (§7.3). The server's
   per-device bookkeeping stays bookkeeping, not protocol logic. Input from
   any granted device is accepted in v1; concurrent-input arbitration (locks,
   device classes like viewer/operator) is deferred — the JSONL records who
   sent what via source attribution.

## 10. Out of scope (this repo)

- The server/relay implementation and its control plane REST API (only the
  contract surfaces in §5.3, §7.2–7.3 are fixed here), including multi-tenant
  features — §7.5 ensures the wire contract carries tenancy by credentials
  alone, so the server can add it without touching this extension.
- The client application(s).
- Push delivery implementation.
- MQTT transport swap (frame format stays transport-agnostic by §6).
- Headless/RPC-mode gateway reuse (revisit after the interactive extension
  ships).
