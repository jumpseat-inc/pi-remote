---
id: EPIC-1
title: "pi-remote — remote control for a live pi session over AG-UI"
state: Done
owner: null
epic: null
goal: A running pi session can be observed and driven in real time from granted remote client devices through a relay, with correct replay on reconnect, injected input that behaves like typed input, and no tunnel left alive after shutdown.
---

## Intent

Implements docs/PI-SPEC.md end to end on the pi side. A running pi session dials
out to a relay, translates its live event stream and JSONL history into AG-UI
frames through one pure mapper, injects remote input so it is indistinguishable
from typed input, and tears the tunnel down on every shutdown path. Enrollment
is user-friendly from day one — an OAuth2-based `/rc:login` replaces env-var
setup, and commands use the `/rc:` colon namespace (`/rc`, `/rc:login`,
`/rc:off`). The server stays a dumb relay behind a fixed contract (§5.3,
§7.2–7.3); all pi-awareness lives in this extension.

Delivered by children EV-1 through EV-8; this card tracks the whole feature
and is not actionable on its own.

## Acceptance

Observed as met when every child card EV-1 through EV-8 has reached Done and
the assembled extension satisfies the spec end to end — a fresh host can go
from `pi install` to a remotely driven session with `/rc:login` and `/rc` only,
and no shutdown path leaves a live tunnel behind.
