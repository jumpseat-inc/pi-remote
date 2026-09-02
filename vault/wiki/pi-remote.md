---
title: pi-remote
type: entity
summary: The pi-side extension exposing a live pi session over AG-UI by dialing out to a relay — the product every ruling and design position in this wiki governs.
aliases: [the extension]
tags: [entity/product]
sources: ["[[EV-1 Ruling]]", "[[EV-3 Ruling]]", "[[EV-8 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
`pi-remote` makes a running pi session remotely observable and drivable: it dials **out** to a relay (never listens), translates live events and JSONL history into AG-UI frames through one pure mapper, injects remote input so it is indistinguishable from typed input, and tears the tunnel down on every shutdown path. Spec: `docs/PI-SPEC.md` (source of truth). The server is a contract, not an implementation — all pi-awareness lives here.

Delivered by [[EPIC-1 Decision Record]]: enrollment is OAuth2 via `/rc:login` (attended PKCE, headless RFC 8628 device flow — no env-var credentials), commands are `/rc`, `/rc:login`, `/rc:off`, the footer carries the [[Seven Footer States]], and teardown runs for every shutdown reason. Modules: [[translate.ts]], [[transport.ts]], [[tunnel.ts]], [[history.ts]], [[inject.ts]], [[login.ts]], [[credential.ts]], [[index.ts]], [[copy.ts]], [[pi-sdk-on.ts]]. Test suite: 207 passing across `gates` and `gates-windows` CI.

The server side it codes against is now specified too: `docs/SERVER-SIDE-SPEC.md` (see [[Server-Side Spec]]), produced by EPIC-2 — self-contained by mandate, with PI-SPEC §10 carrying the one-line pointer to it.

Open items on the board: FLLWUP-11 (stand-in members may TypeError at load in a real pi host — the extension has never been loaded in one; highest severity), FLLWUP-12 (payload-shape honesty), FLLWUP-13..17 (client polish: registerPrompt signature, raise-UI fidelity documentation, local-answer race, tunnel.alreadyLive keying), FLLWUP-24/25/26 (device-flow and copy polish), and FLLWUP-19/20 (PI-SPEC prose sync). The server-spec defects FLLWUP-18/21/22/23 are resolved (see [[Server-Side Spec]]).

## Related
[[EPIC-1 Decision Record]], [[EPIC-2 Decision Record]], [[Server-Side Spec]], [[Seven Footer States]], [[Closed Vocabulary Discipline]], [[Copy Honesty Doctrine]]

## Sources
[[EV-1 Ruling]], [[EV-3 Ruling]], [[EV-8 Ruling]], [[FLLWUP-4 Ruling]]
