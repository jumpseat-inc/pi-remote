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
- `transport.ts` is the only module that touches the network over the
  outbound WebSocket tunnel; `tunnel.ts` is the control-plane REST client
  and touches the network over HTTPS (tunnel lifecycle + token exchange,
  §7.2).
- No background resources started from the factory; the tunnel is created by
  `/rc` and torn down by an idempotent `session_shutdown` handler (§8).

## 4. Live translation: pi event bus → AG-UI

The extension subscribes via `pi.on()` and emits AG-UI events wrapped in the
framing envelope (§6). Mapping (using pi's real event names):

| pi surface | AG-UI event | Notes |
|---|---|---|
| `agent_start` / `agent_settled` | `RUN_STARTED` / `RUN_FINISHED` | `agent_settled`, not `agent_end`, so retries/compaction retries don't emit premature run-end |
| `message_start` + `message_update` (`assistantMessageEvent` text deltas) | `TEXT_MESSAGE_START` / `TEXT_MESSAGE_CONTENT` | role comes from the message (user or assistant); `TEXT_MESSAGE_START` fires on the first text delta, deltas stream as `TEXT_MESSAGE_CONTENT` |
| `message_end` | `TEXT_MESSAGE_END` | symmetric close of the message framing pair; emitted once the message has streamed text (`translate.ts` fires it only for a message whose `message_start`/`message_update` opened text) |
| thinking content in `message_update` | `REASONING_MESSAGE_*` | reasoning pane — corrected against AG-UI's reasoning-message migration (S1: `THINKING_TEXT_MESSAGE_*` deprecated); thinking block ids use `<assistantId>:think:<contentIndex>` |
| `message_update` (`assistantMessageEvent` `toolcall_start`/`toolcall_delta`/`toolcall_end`) | `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END` | rich tool UI — corrected against the pi SDK generation lane (S2: `tool_execution_*` fires in a separate execution lane after `message_end`, carrying a static args snapshot + `partialResult`, and would attach tool calls to a closed assistant message); `TOOL_CALL_START.parentMessageId` = requesting assistant messageId |
| `tool_execution_start` / `_update` / `_end` | `CUSTOM` (`pi.tool.*`) | execution lane output (`partialResult`) has no AG-UI tool-progress event (S2) — escapes as `CUSTOM`, never smuggled into `TOOL_CALL_ARGS` |
| `tool_result` message events | `TOOL_CALL_RESULT` | final result, assistant source order; `content` flattened to a string from pi's `(TextContent|ImageContent)[]` blocks (S8) |
| `turn_start` / `turn_end` | `STEP_STARTED` / `STEP_FINISHED` | |
| `ui.confirm` / approval-style prompts (`ui_prompt_start`/`ui_prompt_end`) | `CUSTOM` (`pi.human_input`) | human-in-the-loop; client replies flow back via injection (§5.3). AG-UI native interrupt framing if/when the client implements it |
| `context` / token budgets / compaction (`session_compact`) | `CUSTOM` (`pi.context.*`) | escape hatch |
| `model_select`, `thinking_level_select`, `session_info_changed` | `CUSTOM` (`pi.session.*`) | client-side status |
| `queue_update` | `CUSTOM` (`pi.session.queue_update`) | queue snapshot (`{steering, followUp}`), not a delta; client diffs snapshots — no SDK `queue_drained` event exists |
| `bash_execution_update` | `CUSTOM` (`pi.tool.bash_execution_update`) | live bash output delta (`{id?, delta}`); the `_update` suffix is the live/replay distinction against the JSONL replay name `pi.tool.bash_execution` |
| `auto_retry_start` / `auto_retry_end` | `CUSTOM` (`pi.session.retry_start` / `pi.session.retry_end`) | retry state (`attempt`, `maxAttempts`, `delayMs`, `errorMessage` / `success`, `finalError?`); raw SDK names ride in `value.pi` |
| `summarization_retry_scheduled` / `_attempt_start` / `_finished` | `CUSTOM` (`pi.session.summary_retry_scheduled` / `summary_retry_branch` or `summary_retry_compaction` / `summary_retry_finished`) | `attempt_start` fans out on `data.source`: `branchSummary` → `summary_retry_branch`, `compaction` → `summary_retry_compaction`; payload passes through verbatim |
| `tool_execution_update` (refined) | `CUSTOM` (`pi.tool.update` + `pi.tool.progress`) | conditional split by payload: `args` present → `pi.tool.update {toolCallId, args}`; `partialResult` present → `pi.tool.progress {toolCallId, partialResult}`, emitted after `update` when both carry; empty-string `partialResult` emits |

pi concepts AG-UI cannot express are **always** `CUSTOM` events — never a
second wire format. The `CUSTOM` frame is `{ type: "CUSTOM", name: "pi.<category>",
value: { pi: <event-name>, data: … } }` — `name` is the sole dispatch key, `pi`
is provenance, and `data` is the semantic payload.

The `queue_update`, `bash_execution_update`, `auto_retry_*`, and
`summarization_retry_*` families are **not runtime-observable** in the
installed pi SDK: `ExtensionAPI.on()` is a typed whitelist that does not
include them (`dist/core/extensions/types.d.ts` ~905–941) and the runtime
session→extension forwarder whitelists only agent/turn/message/
tool_execution events (`dist/core/agent-session.js` ~470–555). Their
mapper rows are contract-green, not live; wiring lands with the SDK bridge
(FLLWUP-8/9), and this caveat is amended again in the same PR that makes
it false. This caveat does **not** cover `pi.tool.update` /
`pi.tool.progress`: `tool_execution_update` is bridgeable today (typed
`on("tool_execution_update")` overload; forwarder at
`agent-session.js:537–546`).

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
   - `compaction` → `CUSTOM` (`pi.context.compaction`); `MESSAGES_SNAPSHOT` emitted at
     init, carrying the active branch (ruling A — cited O9, O10)
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
ext → client    : replay batch (§5.2), then { type: "CUSTOM", name: "pi.resync.done", value: { uptoSeq } } (ruling B1 — cited O8: no RESYNC_DONE in the AG-UI enum)
```

The extension treats `resync` requests as replay triggers and answers from the
JSONL — it never assumes the server has anything.

Inbound resume and resync control frames are runtime-validated by
`transport.ts`'s `parseInbound` against a discriminated union (resume, resync,
AG-UI event, ack-only); control frames do not surface to the `onInbound` AG-UI
consumer. The relay server's role is unchanged: it relays these frames opaquely
per §5.3 and §7.3. (ruling B2 — cited O6)

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

**Intent field.** The delivery-intent (`steer` / `followUp`) rides the optional
`name` field on the inbound `TEXT_MESSAGE_START` frame: absent or unknown is
treated as absent and the decision is idle-decided (mid-stream default is
`steer`). This is a documented pi-remote extension convention — no fifth
envelope key and no `CUSTOM` wrapper for the common user-message path.

**Approval response frame.** A pending approval raised as `CUSTOM`
(`pi.human_input`) is answered from the client with an inbound `CUSTOM`
`pi.human_input.response`, `value.data: { promptId, occurrence, response }`,
matched against the extension's `(promptId → occurrence)` pending registry;
`deviceId` is taken from the envelope and recorded with the resolution.

**Permanent steering fallback (R3).** Direct in-session resolution is **not
wired** — the extension does not sponsor or wrap the host UI. An approval
answer is surfaced as a steering message via `sendUserMessage` (the
spec-mandated path in row 4 above), with a loud-once
`pi.human_input.fallback_to_steer` notice (R2) — a single stated sentence on
the first such fallback per session, silent thereafter. Already-resolved
(stale) answers are surfaced as `pi.human_input.stale`, not delivered. This is
permanent behavior, not a stopgap.

**Human-input completion (FLLWUP-5).** When a resolution is applied to a
prompt EV-6 tracked, the extension emits a single CUSTOM
`pi.human_input.resolved` frame, `value.data: { promptId, occurrence,
deviceId, ts }` — `promptId`/`occurrence` the compound key the raise
established, `deviceId` the resolving device from the inbound envelope
(never free text), `ts` the host clock at emission. It is emitted for a
direct resolution and for a tracked steering fallback, and never for an
untracked fallback (a prompt this host never raised — a phantom ack) or
for a stale answer (already surfaced via `pi.human_input.stale`). The
raise-side `ui_prompt_end` mapping is an informational passive mirror:
`CUSTOM` `pi.human_input.closed`, `value.data: { kind, title,
schemaVersion: 1 }`, a distinct dispatch name that cannot be correlated
to a promptId and is never merged with `pi.human_input.resolved`. The
resolved frame is lifecycle-emitted (no JSONL entry kind) and surfaces in
the live stream after resync. The raise path is wired as of FLLWUP-8: a
live SDK `ui_prompt_start` raises `CUSTOM` `pi.human_input` with
`value.pi: "ui_prompt_start"` and `value.data: { kind, title,
schemaVersion: 1, promptId }`, so contract (b) — a remote answer matching
a raised prompt — is runtime-observable end to end. On the live raise
path `promptId` is a bucket hash over `(kind, title)`; `occurrence` is
the true discriminator and the counter restarts per session — `promptId`
alone is never a global identity. Prompt-body fidelity loss: the
installed SDK discards the message body, so `select`/`editor`/`custom`
prompts carry only `kind` + `title?` on the wire (for `custom` there is
no title at all). The client must not dispatch on `value.pi`; the CUSTOM
`name` is the sole dispatch key.

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
server mints and signs; the host never holds a signing key.** The host's
identity with the control plane is an **OAuth2 enrollment credential**
obtained via `/rc:login` (§8) and persisted in extension settings — never a
static key, never an environment variable.

- **Endpoint discovery.** All control-plane endpoints are derived at runtime
  from RFC 8414 discovery (`GET /.well-known/oauth-authorization-server`
  against the configured server URL); no endpoint paths are hardcoded. The
  discovery metadata must include `authorization_endpoint`,
  `token_endpoint`, and `device_authorization_endpoint` — all three are
  required contract fields. `revocation_endpoint` (RFC 7009) is optional.
- **Attended enrollment (browser available) — Authorization Code + PKCE
  (RFC 7636, native-app pattern per RFC 8252).** `/rc:login` opens the
  default browser at `{authorization_endpoint}` with `client_id=pi-remote`,
  `response_type=code`, `code_challenge_method=S256`, a generated
  `code_challenge`, `redirect_uri=http://127.0.0.1:<ephemeral>/callback`,
  `scope=pi-remote:host`, and `state`. The extension is a **public client** —
  no client secret. The loopback redirect is bound to 127.0.0.1 only, and
  the listener lives for the duration of the `/rc:login` command only
  (§7.1 — the extension never listens otherwise).
- **Unattended enrollment (headless host) — Device Authorization Grant
  (RFC 8628).** `/rc:login --headless` POSTs `{device_authorization_endpoint}`
  to obtain a device code, prints `user_code` and `verification_uri_complete`
  — the single short value the user relays to another device — then polls
  `{token_endpoint}` with
  `grant_type=urn:ietf:params:oauth:grant-type:device_code`, honoring the
  RFC 8628 semantics: `interval` between polls, `slow_down`,
  `authorization_pending` (keep polling), and the terminal conditions
  `expired_token` and `access_denied` (failure names the `/rc:login` remedy).
- **Token issuance and refresh.** Both flows exchange at `{token_endpoint}`
  (`grant_type=authorization_code` with `code_verifier`, or the device-code
  grant). When the response includes a refresh token, the extension stores it
  and refreshes silently at tunnel time with
  `grant_type=refresh_token` at `{token_endpoint}` — there is no separate
  refresh endpoint.
- **Credential storage.** The enrollment credential is persisted in a dedicated JSON file at `<configDir>/pi-remote/credentials.json`, serializing the `piRemote.*` keys: `piRemote.serverUrl`, `piRemote.accessToken` (short-TTL), `piRemote.refreshToken` (long-lived, revocable at the control plane), `piRemote.tokenExpiry`, and `piRemote.tenantId` (cached from the token). User-only readability is enforced on POSIX by a mode-0600 file (written atomically via tmp+fsync+rename), and on Windows by an NTFS ACL applied via icacls to the temp file (inherited permissions stripped, the current user granted Modify by SID) before any credential byte is written, so the ACL travels through the rename and no unprotected window exists. Enforcement is fail-closed: if the ACL cannot be applied (non-NTFS volume, security software, missing icacls), the temp file is deleted, nothing is saved, and the storage-failed copy names the host-local cause and `/rc:login` as the retry (riding FLLWUP-7). A failed flow writes nothing half-written; re-running `/rc:login` replaces the stored credential cleanly. The token authorizes *creating tunnels*, nothing else.
- **Environment override (documented override only).** The control-plane
  server URL may be overridden with the `PI_REMOTE_SERVER_URL` environment
  variable. **Credentials are never carried in environment variables.**
  Settings-based OAuth2 enrollment above is the documented path; the env
  override exists for the server URL only.
- `/rc` flow:
  1. Extension `POST /tunnels` to the control plane with
     `Authorization: Bearer <access_token>`, payload: session id, session
     name, cwd, host metadata.
  2. Server responds with `{ tunnelId, url, tokenTtl }` — a **signed,
     expiring `wss://` URL with a one-time token**
     (`wss://server/tunnelId?token=…`). The token is self-describing: it
     embeds its claims (`tenantId`, `tunnelId`, `sessionId`, `exp`), so the
     server needs no lookup state to authenticate a dial.
  3. Extension dials the URL within the token TTL (default 60 s). The token
     is **single-use**: consumed on successful WS upgrade, then bound to that
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
| Host (extension) | OAuth2 access/refresh token (from `/rc:login`) | create tunnels (Bearer-authenticated), dial out, translate, inject |
| Server | authorization-server (enrollment) registry, device registry, signing key | issue/revoke enrollment credentials, mint/revoke tunnel tokens, enforce device grants, relay frames |
| Client device | device credential | connect to granted tunnels, ack, resume, send input |

Compromise blast radius: a leaked access or refresh token lets an attacker
**create tunnels for sessions they can already see locally** (i.e., they are
on the host) — it does not grant session access by itself, and its damage is
contained to its own tenant; the refresh token is additionally revocable at
the control plane. A leaked tunnel token is bounded by its TTL and single-use
property, and only reaches its own tunnel.

### 7.5 Multi-tenancy

The server may be multi-tenant; this extension does not change shape to
support it. Tenancy is carried entirely by credentials, at three contract
points:

| Contract point | Tenant identity | Extension behavior |
|---|---|---|
| Enrollment credential (§7.2) | token `sub` claim identifies the tenant-scoped account | opaque credential, presented as Bearer at `POST /tunnels` |
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
| `/rc` | If no enrollment credential exists, **refuse to dial** and output a line naming the next step (`run /rc:login`); footer state `not enrolled`. If enrolled but the access token is expired, perform **one silent refresh**; if there is no refresh token or the refresh fails, output the same `/rc:login` remedy and do not dial. Otherwise `POST /tunnels` (§7.2), dial the signed URL, and start translating live events. Idempotent: if already connected, notify and no-op. OAuth enrollment is never attempted from `/rc` — that is `/rc:login`'s job. The control-plane URL prompt fires **only out-of-band after `/rc:login`**, never from a bare `/rc`: a user without a configured URL is told to run `/rc:login` (the remedy they need anyway), and no serverUrl-only credential store is introduced — the durable home for the URL is the full credential file `/rc:login` writes on success (J2, amending §8's earlier "/rc prompts once…" line). |
| `/rc:login` | Enroll the host with the control plane's OAuth2 authorization server: the **attended** flow (default) opens the default browser (Authorization Code + PKCE, §7.2); the `--headless` flag runs the RFC 8628 device flow and prints `user_code` + `verification_uri_complete`. Persists the credential in the dedicated user-only 0600 credential file (`<configDir>/pi-remote/credentials.json`, §7.2); on failure, prints what to do next. Refuses to run while a tunnel is live — close the tunnel first with `/rc:off`. The same refusal rule applies across all non-idle states (`dialing`, `resyncing`, `authorizing`, `error`); the login driver is entered only from `off` and `not enrolled`. |
| `/rc:off` | Close the WS, notify the control plane (`DELETE /tunnels/:id`), discard token state. Idempotent. |
| `session_shutdown` handler | Tear down the tunnel for **every** shutdown reason (`quit`, `reload`, `new`, `resume`, `fork`) — exiting without `/rc:off` must not leave a live tunnel. Idempotent with `/rc:off`. |

Status surface: footer status via `ctx.ui.setStatus("pi-remote", …)` showing
exactly one of seven states, in lifecycle order: `off` → `not enrolled` →
`authorizing` → `dialing` → `resyncing` → `live` → `error`.

- `off` — no tunnel, no credential action pending.
- `not enrolled` — no credential; distinct from `off` because it names the
  next step (`/rc:login`).
- `authorizing` — OAuth enrollment in progress (browser or device flow).
- `dialing` — dialing the signed `wss://` URL.
- `resyncing` — replay in progress (§5); a healthy phase distinct from
  `dialing` (the connection is already up) and from `live` (no new frames,
  only replay).
- `live` — connected; frames flowing.
- `error` — terminal failure state with the reason shown.

The host user can always see that the session is remotely reachable.

## 9. Resolved design questions

1. **Where the token is minted and stored.** Answered by §7.2: the *server*
   mints and signs the one-time tunnel token; the host holds only the
   OAuth2 access/refresh credential obtained from `/rc:login`. This avoids the
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
