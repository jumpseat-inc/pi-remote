# AGENTS.md

Guidance for coding agents working in this repository.

## Project

`pi-remote` is a `pi` extension that exposes an active `pi` session over
AG-UI by dialing out to a relay server. This repo builds the `pi`-side
extension only.

**Read [`docs/PI-SPEC.md`](docs/PI-SPEC.md) first.** It is the source of
truth for the design; keep it in sync with any change that affects the wire
format, replay, or security model.

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
