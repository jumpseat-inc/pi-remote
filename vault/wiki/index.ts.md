---
title: index.ts
type: entity
summary: The extension entry point — command surface (/rc, /rc:login, /rc:off), live-path wiring, footer merge FSM, session_shutdown teardown for all five reasons, and the typed on() bridge.
aliases: [the entry point, lifecycle wiring]
tags: [entity/module, lifecycle]
sources: ["[[EV-8 Ruling]]", "[[FLLWUP-5 Ruling]]", "[[FLLWUP-4 Ruling]]", "[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]", "[[EPIC-4 Run (FLLWUP-11..12)]]"]
created: 2026-09-02
updated: 2026-09-24
---
Implements §8: registers `/rc`, `/rc:login`, `/rc:off`; wires the live path (`pi.on` → [[translate.ts]] → [[transport.ts]]); owns teardown (`session_shutdown` for quit/reload/new/resume/fork — one test per reason). Ruling-shaped behavior: `/rc` is idempotent with the ruled `already connected` sentence; `/rc:login` while non-idle is refused ("close the tunnel first with /rc:off"); the URL prompt fires only out-of-band after `/rc:login` (EV-8 J2 — the §8 sentence was amended); the footer merge is the kind-first FSM of [[Footer Merge Policy]] with `ERROR_DIAL_THRESHOLD = 10`; the seven-state footer renders via `ctx.ui.setStatus("pi-remote", …)`.

Type history: the local permissive `ExtensionAPI` stand-in (`on(event: string, …)`) was FLLWUP-9's target — `src/pi-sdk-on.ts` vendors the real SDK union (`DepsOnEvent = PiSDKOnEvent | "ui.confirm"` for the synthetic case). The stand-in's non-`on` members were fully reconciled by the [[EPIC-4 Run (FLLWUP-11..12)]]: the entry point no longer calls `pi.getSetting`/`pi.env`/`pi.configDir`; settings and the agent dir come from [[pi-host.ts]] (`resolvePiAgentDir`, `readHostSettings`) and `process.env`, the UI/session members route through the real `ExtensionContext`, and the live handlers narrow on the real payload shapes in [[pi-sdk-events.ts]] ([[Real-Surface Verification]]). BUG-1 (PR #30) threaded argv through the command-handler type and both registrations so `/rc:login --headless` selects the device-flow driver; before it, the flag was parsed nowhere and every invocation ran attended ([[login.ts]]).

## Related
[[Footer Merge Policy]], [[Seven Footer States]], [[pi-sdk-on.ts]], [[pi-host.ts]], [[pi-sdk-events.ts]], [[Real-Surface Verification]], [[EPIC-4 Decision Record]], [[Copy Honesty Doctrine]], [[Retry Policy]]

## Sources
[[EV-8 Ruling]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]], [[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]], [[EPIC-4 Run (FLLWUP-11..12)]]
