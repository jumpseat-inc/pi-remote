# AGENTS.md

Guidance for coding agents working in this repository.

## Project

`pi-remote` is a `pi` extension that exposes an active `pi` session over
AG-UI by dialing out to a relay server. This repo builds the `pi`-side
extension only.

**Read [`docs/PI-SPEC.md`](docs/PI-SPEC.md) first.** It is the source of
truth for the host-side design; [`docs/SERVER-SIDE-SPEC.md`](docs/SERVER-SIDE-SPEC.md)
is the relay/control-plane counterpart. Keep both in sync with any change
that affects the wire format, replay, auth, or security model.

## Current state

- The command surface, outbound transport, live translation, JSONL
  replay/resync, input injection, OAuth2 login drivers, and credential
  storage are implemented. Layout: `index.ts` (entry, commands, live-event
  wiring) plus `src/` modules; tests live in `test/` (one suite per module).
- The unit suite is green: `bunx tsc --noEmit` clean, `bun test` all-pass
  (the only expected non-pass is the Windows-gated credential-ACL skip on
  non-Windows runners).
- **Loadable in a real `pi` host.** `index.ts` binds the real `ExtensionAPI`
  surface (FLLWUP-11): a real load through the installed production loader
  was proven green, and a strict-Proxy load smoke (`test/pi-sdk-load.test.ts`)
  keeps the entry pinned to the real loader's member names. Handler payload
  narrowing matches the installed SDK's event payloads (FLLWUP-12): the live
  subscriptions' handler narrowing was reconciled against the SDK's payload
  types, with real-shaped fixtures feeding the live path. Do not claim beyond
  what is proven above.
- **Discoverable by the package loader.** The entry is root-level
  `index.ts`, so `package.json` declares it via the `pi` manifest
  (`"pi": { "extensions": ["./index.ts"] }`). Without that manifest pi's
  loader scans only the conventional `extensions/` etc. dirs and discovers
  zero extensions. `test/package-manifest.test.ts` pins the discovery
  contract; do not move `index.ts` into `extensions/` (it would force
  rewriting every `./src/*` import).
- The `/rc:login --headless` device flow (RFC 8628) is implemented in
  `src/login.ts` and routed by the command surface: `index.ts` parses the
  `--headless` token from the command args and selects the device-flow
  driver; without it the attended flow runs (BUG-1, PR #30).

## Configuration contract

Two settings, each with an environment override:

| Setting | Env override | Notes |
| --- | --- | --- |
| `piRemote.serverUrl` | `PI_REMOTE_SERVER_URL` | Control-plane base URL. Resolution: env → setting → stored credential → `https://relay.jumpseat.sh` default; the `/rc:login` prompt is the interactive override, pre-filled with the resolved value. Every endpoint is derived via RFC 8414 discovery; never hardcode paths. |
| `piRemote.locale` | `PI_REMOTE_LOCALE` | `en` (default) or `id`; anything else normalizes to `en`. |

Credentials are **never** read from environment variables — they live in
`<configDir>/pi-remote/credentials.json`, user-only (POSIX `0600` / Windows
NTFS ACL). The env override exists for the server URL only.

## Development

Use Bun ([`CLAUDE.md`](CLAUDE.md) has the Bun-specific conventions):

```bash
bun install
bunx tsc --noEmit      # typecheck (CI gate)
bun test               # unit suite (CI gate)
```

CI is [`.github/workflows/gates.yml`](.github/workflows/gates.yml): typecheck
and tests on `ubuntu-latest`, plus a `windows-latest` job that runs the
credential-file ACL test. Keep both jobs green.

Tests are written against a dependency-injected `ExtensionAPI` stand-in, so
behavior is testable without a live `pi` process. Follow the existing
pattern: pure logic in `src/` modules, wiring and session-scoped state in
`index.ts`'s factory closure — **never module-level mutable state**.

## Council card worktrees

During a council run the shared main worktree (`/home/tista/codes/pi-remote`)
is immutable to every seat and agent: never run `git checkout`, `git switch`,
or `git reset` against it. It stays on its branch and its HEAD is never left
detached. Every branch-state change — moving a branch pointer, checking out a
commit, switching branches, rewinding history — happens in a dedicated
worktree created with `git worktree add` (recorded as run ruling R-CONV-1).

A council card's owner branch/worktree is cut from `origin/main` — never the
run's local `main`, which carries unpushed run-state commits:

```bash
git fetch origin
git worktree add ../pi-remote-<card> -b owner/<card>-<slug> origin/main
```

Consequence: a card PR's diff contains only the owner's product/plan change —
run board/config/preflight commits never appear in it. The run's council
record (board, cards, preflight) commits reach `main` through the step-12
direct record push instead.

## Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Examples:

- `feat(transport): add reconnect with exponential backoff`
- `fix(translate): map tool_result events in assistant source order`
- `docs: answer multi-tenancy question in PI-SPEC`
- `chore: add TypeScript config`

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

Scopes mirror the module layout from the spec (§3): `transport`, `translate`,
`history`, `inject`, `tunnel`, or omit the scope for repo-wide changes.