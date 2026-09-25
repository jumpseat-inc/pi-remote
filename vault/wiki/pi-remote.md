---
title: pi-remote
type: entity
summary: The pi-side extension exposing a live pi session over AG-UI by dialing out to a relay — the product every ruling and design position in this wiki governs.
aliases: [the extension]
tags: [entity/product]
sources: ["[[EV-1 Ruling]]", "[[EV-3 Ruling]]", "[[EV-8 Ruling]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]", "[[EPIC-3 Run (FLLWUP-27..30)]]", "[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-02
updated: 2026-09-24
---
`pi-remote` makes a running pi session remotely observable and drivable: it dials **out** to a relay (never listens), translates live events and JSONL history into AG-UI frames through one pure mapper, injects remote input so it is indistinguishable from typed input, and tears the tunnel down on every shutdown path. Spec: `docs/PI-SPEC.md` (source of truth). The server is a contract, not an implementation — all pi-awareness lives here.

Delivered by [[EPIC-1 Decision Record]]: enrollment is OAuth2 via `/rc:login` (attended PKCE, headless RFC 8628 device flow — no env-var credentials), commands are `/rc`, `/rc:login`, `/rc:off`, the footer carries the [[Seven Footer States]], and teardown runs for every shutdown reason. Modules: [[translate.ts]], [[transport.ts]], [[tunnel.ts]], [[history.ts]], [[inject.ts]], [[login.ts]], [[credential.ts]], [[index.ts]], [[copy.ts]], [[pi-sdk-on.ts]], [[pi-host.ts]], [[pi-sdk-events.ts]]. Test suite: 207 at EPIC-1 close, 237 after the login-polish and EPIC-3 runs, **270 after EPIC-4**, **279 after EPIC-6** (248 at the FLLWUP-11 merge; see [[EPIC-4 Run (FLLWUP-11..12)]]); CI runs `gates` and `gates-windows`.

The server side it codes against is now specified too: `docs/SERVER-SIDE-SPEC.md` (see [[Server-Side Spec]]), produced by EPIC-2 — self-contained by mandate, with PI-SPEC §10 carrying the one-line pointer to it.

Open items on the board: FLLWUP-13..17 (client polish: registerPrompt signature, raise-UI fidelity documentation, local-answer race, tunnel.alreadyLive keying), FLLWUP-26 (server-spec vocabulary scoping), FLLWUP-19/20 (PI-SPEC prose sync), and the seven EPIC-4 residuals FLLWUP-32..38 grouped under **EPIC-5** (now delivered). **FLLWUP-11** (stand-in members may TypeError at load in a real host — the extension had never been loaded in one) and **FLLWUP-12** (payload-shape honesty) were delivered by the [[EPIC-4 Run (FLLWUP-11..12)]]: the extension now loads through the installed production loader (`REAL LOAD OK`), every live handler narrows on the real payload shapes, and the stand-in gap is closed ([[Real-Surface Verification]], [[Emission-Semantics Fidelity]]). FLLWUP-34 (`AGENTS.md`'s stale "Current state") was promoted `Ready` by steward once FLLWUP-12 landed, then delivered by the **EPIC-5 run** (not yet ingested into this wiki), which closed all seven EPIC-4 residuals FLLWUP-32..38. That run's two step-13 follow-ups — **FLLWUP-39** (vendored thinking/tool-call signature fields) and **FLLWUP-40** (pairing-test source comment) — were then delivered together by the [[EPIC-6 Run (FLLWUP-39..40)]] in a single runner ([[Batched Card Delivery]]), closing EPIC-5's announced-debt trail. FLLWUP-24/25 were delivered by the [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]; its filed FLLWUP-27..30 were delivered by the [[EPIC-3 Run (FLLWUP-27..30)]], and the EPIC-3 residual FLLWUP-31 is now delivered too (PR #37) — `AGENTS.md`'s stale suite count is corrected. The server-spec defects FLLWUP-18/21/22/23 are resolved (see [[Server-Side Spec]]).

## Related
[[EPIC-1 Decision Record]], [[EPIC-2 Decision Record]], [[EPIC-3 Decision Record]], [[EPIC-4 Decision Record]], [[EPIC-6 Decision Record]], [[Server-Side Spec]], [[Seven Footer States]], [[Closed Vocabulary Discipline]], [[Copy Honesty Doctrine]], [[Run Workspace Isolation]], [[Real-Surface Verification]], [[Batched Card Delivery]], [[pi-host.ts]], [[pi-sdk-events.ts]], [[AG-UI]]

## Sources
[[EV-1 Ruling]], [[EV-3 Ruling]], [[EV-8 Ruling]], [[FLLWUP-4 Ruling]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], [[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-6 Run (FLLWUP-39..40)]]
