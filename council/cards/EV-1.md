---
id: EV-1
title: "Sync PI-SPEC with the /rc:login OAuth2 enrollment design and colon command naming"
state: Deliberating
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

## Deliberation record

### Recovery note (runner resumed after anti-stall cancel)

Prior runner instance was cancelled mid-deliberation by the hub anti-stall
monitor after 25 min. Durable state at resume: card state `Deliberating`,
board column moved — nothing else. The step-2 independent positions the prior
instance collected were **never persisted** to this record, and the round-2
dispatch's results died with the container. Per board discipline, the record
is the only truth: the independent first pass is re-run below. The ≤3-round
exchange cap binds across the whole card; rounds are counted from this
restart (rounds 1–3 available).

### Step 1 — path classification

- Full council (not mechanical): spec-ambiguous — the goal's open point
  (which OAuth2 grant serves attended vs unattended login) admits more than
  one reasonable design; design-judgment — a real tradeoff exists between
  browser-available attended enrollment and headless unattended enrollment.
- Surface-touching: yes — the doc change defines user-visible command surface
  and the enrollment UX the user experiences; `designer` is seated as a third
  generator in steps 2–3.
- Locked human decisions carried by the card (not open for relitigation):
  commands `/rc`, `/rc:login`, `/rc:off` (colon namespace, never `/rc-off`);
  OAuth2-based enrollment replaces env-var-only setup; both attended and
  unattended login modes must be supported. Which grant serves each mode is
  the open question.
