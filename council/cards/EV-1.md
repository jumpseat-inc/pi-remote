---
id: EV-1
title: "Sync PI-SPEC with the /rc:login OAuth2 enrollment design and colon command naming"
state: Ready
owner: null
epic: EPIC-1
goal: docs/PI-SPEC.md specifies the /rc, /rc:login, and /rc:off command surface with OAuth2-based host enrollment replacing env-var-only setup, covering both attended and unattended login.
---

## Intent

The spec is the source of truth (repo AGENTS.md requires keeping it in sync),
and it currently pins `PI_REMOTE_SERVER_URL` + `PI_REMOTE_HOST_KEY` env vars
(§7.2) and the `/rc-off` command name (§8), both of which the feature owner has
overruled. This card rewrites §7.2 and §8 so enrollment is OAuth2-based via
`/rc:login`, with credentials persisted in extension settings, and renames
`/rc-off` to `/rc:off`. It must also pin the currently open design points the
Council settles: which OAuth2 grant serves the attended mode (browser
available) vs the unattended headless mode, what the control plane must expose
for each, where the resulting credential is stored, and how `/rc` behaves when
no credential exists yet (prompt to run `/rc:login` vs inline).

## Acceptance

- §8 command table lists `/rc`, `/rc:login`, and `/rc:off` with no `/rc-off`
  anywhere in the doc.
- §7.2 no longer presents env vars as the primary setup path; settings-based
  OAuth2 enrollment is the documented path and env vars are at most a
  documented override.
- Both attended and unattended login modes have a specified flow with the
  control-plane endpoints they require listed as contract (like §5.3).
- No other section's wire contract (§4–§6 framing, §5.3 handshake, §7.3
  grants) is altered.
