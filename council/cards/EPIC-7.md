---
id: EPIC-7
title: "Default relay URL, attended-login cancellation, and --headless discoverability"
state: Done
owner: null
epic: null
goal: Done means pi-remote resolves its control-plane URL through env → setting → stored credential → the literal default `https://relay.jumpseat.sh`, keeps the `/rc:login` URL prompt as the interactive override affordance pre-filled with the resolved value, lets the user cancel an attended (non-headless) `/rc:login` before its timeout elapses, and makes `--headless` discoverable — in the `/rc:login` description and in the reachable browser-open failure line — so a user on a remote machine can find it.
---

## Intent

The relay defaults must work out of the box, the attended login must be escapable, and
headless mode must be discoverable by a user whose machine is remote. Today a fresh host
must be handed a control-plane URL, the attended `/rc:login` can only end by browser
callback, mismatch, or a five-minute timeout, and `--headless` is visible only in the spec.
This epic tracks those three threads and the surfaces they touch; it is not itself
actionable.

## Acceptance

Observed as met when EV-15, EV-16, and EV-17 are all `Done`, with `bunx tsc --noEmit` exit 0
and `bun test` green:
- EV-15: fallback to the literal `https://relay.jumpseat.sh` as the last-resort tier; stored
  credential still wins; precedence pinned by test; `/rc:login` URL prompt retained and
  pre-filled with the resolved value; `noServerUrl` removal named in the PR;
  serverUrl-rendering surfaces pinned to the literal default.
- EV-16: `/rc:login`'s registered description contains `--headless` with its condition named;
  `rc`/`rc:off` descriptions pinned not to; the attended `browserOpenFailed` line is reachable
  (routed from `openUrl` failure) and names `/rc:login --headless`; harness widening declared.
- EV-17: attended `/rc:login` can be cancelled before the `redirectTimeoutMs` wait expires —
  proven by an elapsed-time assertion, not the outcome alone — printing exactly
  `Sign-in cancelled — no credentials were saved.` once and persisting no credential.
- EV-16 and EV-17 copy was settled in one shared design pass, recorded in both cards.
- `AGENTS.md`'s configuration contract and `docs/PI-SPEC.md` §7.2/§8 reflect the new default
  tier and the prompt-prefill behavior.

## Closure (run 2026-09-25)

Delivered by children EV-15, EV-16, EV-17 — all merged and `Done`:

- **EV-15** — default control-plane URL to `https://relay.jumpseat.sh` (PR #49, merged `9fbca4e`).
- **EV-16** — `--headless` discoverability on the `/rc:login` surface (PR #50, merged `5bfb4e2`).
- **EV-17** — attended `/rc:login` cancel affordance (PR #51, merged `cbe8bf9`).

Gates on `main` at closure: `bunx tsc --noEmit` exit 0; `bun test` 332 pass / 1 skip
(Windows-gated ACL, expected) / 0 fail; `council/validate.py` clean. `AGENTS.md`'s
configuration contract and `docs/PI-SPEC.md` §7.2/§8 carry the default tier, the
prompt-prefill behavior, the reachable `browserOpenFailed` remedy, and the attended cancel
affordance.

Follow-ups filed during the run: FLLWUP-41, FLLWUP-42 (from EV-15); FLLWUP-43, FLLWUP-44
(from EV-16); FLLWUP-45, FLLWUP-46 (from EV-17).