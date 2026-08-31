---
id: EV-7
title: "/rc:login OAuth2 enrollment command"
state: Ready
owner: null
epic: EPIC-1
goal: Running /rc:login provisions working enrollment credentials for the configured control plane without env vars, in both an attended mode with a browser present and an unattended headless mode, and /rc thereafter creates tunnels with no further setup.
---

## Intent

The feature owner's headline ask — setup must not require hand-editing env
vars. `/rc:login` runs an OAuth2 flow against the control plane and persists
the resulting credential in extension settings, replacing the
`PI_REMOTE_SERVER_URL` + `PI_REMOTE_HOST_KEY` setup path (spec update in
EV-1). Attended mode has a browser available (open or launched); unattended
mode must work on a headless host where the user can relay one short value
between the host terminal and another device. The grant choice per mode is an
open design point the Council settles (device authorization grant and refresh
token persistence are the obvious candidates), constrained by §7.2's trust
model — the host holds only its own enrollment credential, never a signing
key. User-visible surface — the `/rc:login` command output on the host
terminal — step-by-step copy, the code or URL to complete the flow, an
explicit success line, and a failure line that names what to do next.

## Acceptance

- On a machine with a browser, `/rc:login` completes with at most the command
  invocation plus browser interaction, and a following `/rc` creates a tunnel
  with no env vars set.
- On a headless host, `/rc:login` completes by relaying a single short value
  (code or URL) through another device, with the terminal copy stating
  exactly what to carry where.
- The provisioned credential survives a pi restart; `/rc` uses it without
  prompting again.
- A failed or cancelled flow leaves no half-written credential and the
  command output says so.
- Credentials are stored with user-only readability, and `/rc:login` re-run
  replaces the previous credential cleanly.
