# pi-remote

A `pi` extension that makes an active, running session remotely controllable.

Run `/rc` from inside a `pi` session and it dials **out** to a relay server,
exposing the session over [AG-UI](https://docs.ag-ui.com/) so your other
devices can watch and drive it — streaming replies, tool calls, and input —
from anywhere. No inbound ports, no firewall changes.

> **Status: implemented and loadable in a real `pi` host.** The command
> surface, outbound transport, live translation, JSONL replay, input
> injection, OAuth2 enrollment drivers, and credential storage are all
> implemented, with a green unit suite (`bun test`: all-pass except the one
> Windows-gated credential-ACL skip; `bunx tsc --noEmit`: clean). `index.ts`
> binds the real `ExtensionAPI` surface (FLLWUP-11/12), and the package
> declares its entry through the `pi` manifest's `extensions` field in
> `package.json`, so pi's package loader discovers and loads it.
>
> The design is [`docs/PI-SPEC.md`](docs/PI-SPEC.md) for the host side and
> [`docs/SERVER-SIDE-SPEC.md`](docs/SERVER-SIDE-SPEC.md) for the relay and
> control plane.

## Configuration

`pi-remote` needs one thing to work: the URL of the **control plane** (the
relay's HTTP side). There is no built-in default — an unconfigured host stays
`not enrolled` and refuses to dial.

| Setting | Env override | Purpose |
| --- | --- | --- |
| `piRemote.serverUrl` | `PI_REMOTE_SERVER_URL` | Control-plane base URL, e.g. `https://relay.example.com`. Every OAuth2 and tunnel endpoint is derived from it at runtime via RFC 8414 discovery (`GET /.well-known/oauth-authorization-server`); no paths are hardcoded. |
| `piRemote.locale` | `PI_REMOTE_LOCALE` | Message locale: `en` (default) or `id`. Anything unrecognized falls back to `en`. |

The server URL resolves in this order: **`PI_REMOTE_SERVER_URL` →
`piRemote.serverUrl` → the URL stored in the credential file**. If all three
are empty, `/rc:login` prompts for the URL interactively and `/rc` refuses to
dial.

Set the setting in your pi settings (`~/.pi/agent/settings.json` for every
session, or `.pi/settings.json` for one project):

```json
{
  "piRemote": {
    "serverUrl": "https://relay.example.com"
  }
}
```

or export the override for one shell:

```bash
export PI_REMOTE_SERVER_URL=https://relay.example.com
```

Nothing else is configured through the environment: **credentials are never
carried in environment variables** (spec §7.2). Enrollment writes them to a
user-only credential file instead.

## Usage

```text
/rc:login        # enroll this host once (attended, browser-based OAuth2)
/rc              # dial out and stream the session
/rc:off          # close the tunnel and revoke the tunnel token
```

1. **Configure** `piRemote.serverUrl` as above.
2. **Enroll** with `/rc:login`. It opens your browser for Authorization Code +
   PKCE (RFC 7636 / RFC 8252) against the control plane and writes
   `<configDir>/pi-remote/credentials.json`. Re-running replaces the stored
   credential cleanly. It refuses to run while a tunnel is live — `/rc:off`
   first.
3. **Dial** with `/rc`. The extension `POST`s `/tunnels`, receives a
   single-use, signed `wss://` URL, connects, and begins translating live
   events. Idempotent: a second `/rc` while live just notifies.
4. **Watch and drive** from a granted client device. Client apps are a
   separate effort; `docs/PI-SPEC.md` fixes the contract they build against.
5. **Close** with `/rc:off`. Quitting, reloading, or switching sessions tears
   the tunnel down as well, via an idempotent `session_shutdown` handler.

The footer status (`pi-remote` in the status bar) shows exactly one of seven
states, in lifecycle order: `off` → `not enrolled` → `authorizing` →
`dialing` → `resyncing` → `live` → `error`.

### Commands

| Command | Behavior |
| --- | --- |
| `/rc` | With no enrollment credential, refuses to dial and names the next step (`run /rc:login`); footer `not enrolled`. If enrolled but the access token is expired, performs one silent refresh; if there is no refresh token or the refresh fails, prints the same `/rc:login` remedy and does not dial. Otherwise `POST /tunnels`, dials the signed URL, and starts translating live events. Idempotent. OAuth enrollment is never attempted from `/rc`. |
| `/rc:login` | Enroll the host with the control plane's OAuth2 authorization server: the **attended** flow (default) opens the default browser (Authorization Code + PKCE). Persists the credential in the user-only `0600` credential file; on failure, prints what to do next. Refuses to run while a tunnel is live. |
| `/rc:off` | Tear down the tunnel and revoke the token. Idempotent. |

> **Headless is not wired yet.** The RFC 8628 device-flow driver for headless
> hosts is implemented in `src/login.ts`, but the command surface currently
> always runs the attended flow — the `--headless` flag from spec §7.2/§8 is
> not routed. Track this against the FLLWUP cards before relying on it.

## How it works

```
┌─────────────────────────────┐
│  pi session (your machine)  │
│  ┌───────────────────────┐  │
│  │  pi-remote extension  │  │
│  │  · AG-UI translation  │  │
│  │  · input injection    │  │
│  │  · JSONL replay       │  │
│  └───────────┬───────────┘  │
└──────────────┼──────────────┘
               │ dials OUT over wss:// (AG-UI frames only)
               ▼
┌─────────────────────────────┐
│  Relay server (opaque pipe) │
└──────────────┬──────────────┘
               │ wss fan-out
        ┌──────┴──────┐
        │  Clients    │
        │  (future)   │
        └─────────────┘
```

The extension is the star; the server is deliberately dumb. Every byte over
the tunnel is a standardized AG-UI frame — the server relays and caches
opaque frames and never learns what a `pi` session is.

- **One translator, two triggers.** Live `pi` event-bus events and session
  history replay both go through the same pure `pi → AG-UI` mapper, so a
  reconnecting client sees exactly the same stream as a live one.
- **The local JSONL is the source of truth.** The server keeps only a
  best-effort ring buffer for fast catch-up; anything older is regenerated by
  the extension straight from the session file. Long outages lose nothing.
- **Remote input is real input.** Client messages are injected via
  `pi.sendUserMessage()` (with steer / follow-up delivery), so they behave
  exactly like typed ones — including landing in the session log.
- **Durable tunnels.** Heartbeats, exponential-backoff reconnects, a stable
  connection id per session, and monotonic sequence numbers with per-device
  acks. Clients resume from where they left off; replay frames carry
  deterministic ids so nothing double-executes.

## Security

The tunnel drives a coding agent with arbitrary `bash`, so it is shaped
accordingly:

- **Outbound-only.** The extension never listens. All traffic leaves the
  host; the host needs no open ports.
- **Server-signed, one-time tunnel tokens.** `/rc` gets a short-lived
  `wss://` URL whose token is single-use and expires in seconds; the host
  never holds a signing key.
- **Per-device, tenant-scoped grants.** Devices register with the control
  plane and may only reach tunnels of their tenant. The server enforces
  grants at fan-out; the extension never sees client credentials.

## Credential storage

The OAuth2 enrollment credential lives in a dedicated JSON file at
`<configDir>/pi-remote/credentials.json`, serializing the `piRemote.*` keys
(server URL, access token, refresh token, token expiry, tenant id). User-only
readability is enforced on POSIX by a mode-0600 file, written atomically via
tmp+fsync+rename. On Windows, user-only readability is enforced via an NTFS
ACL applied by icacls to the temp file (inherited permissions stripped, the
current user granted Modify) before the credential bytes are written; if the
ACL cannot be applied, nothing is saved. A failed flow writes nothing
half-written; re-running `/rc:login` replaces the stored credential cleanly.

## Development

```bash
bun install
bunx tsc --noEmit      # typecheck
bun test               # unit suite
```

Bun is the runtime and test runner ([`CLAUDE.md`](CLAUDE.md) covers the Bun
conventions used here). CI ([`.github/workflows/gates.yml`](.github/workflows/gates.yml))
runs the typecheck and the suite on `ubuntu-latest`, plus a `windows-latest`
job that executes the credential-file ACL test (the suite skips it elsewhere).

The extension is developed test-first against a local `ExtensionAPI` stand-in,
so the unit suite exercises the full behavior without a live `pi` process.
Layout:

```
index.ts        entry point: command + event wiring, session-scoped state
src/
├── transport.ts   outbound wss dial, reconnect/backoff, heartbeat, seq/ack
├── translate.ts   pure pi event → AG-UI frame mapper (live + replay)
├── history.ts     JSONL → translate.ts (replay / resync)
├── inject.ts      client input → sendUserMessage (steer / followUp)
├── tunnel.ts      control-plane REST client
├── login.ts       OAuth2 attended + device-flow drivers
├── credential.ts  credential file read/write + user-only enforcement
├── merge.ts       footer state merge
├── copy.ts        locale overlay and fallback resolver
└── …
test/           one suite per module, plus fixtures/
```

## Install

Once the SDK reconciliation lands, `pi-remote` installs as a standard `pi`
package:

```bash
pi install git:github.com/jumpseat-inc/pi-remote
```

For local development before that, load the entry file directly:

```bash
pi --extension ./index.ts
```

(Neither path works against a real host yet — see the status note at the top.)

## Scope

This repo builds the **`pi`-side extension only**. The relay server, its
control plane, and the client apps are separate efforts; `docs/PI-SPEC.md`
and `docs/SERVER-SIDE-SPEC.md` fix the wire, replay, and auth contracts they
must satisfy.