---
title: index.ts
type: entity
summary: The extension entry point — command surface (/rc, /rc:login, /rc:off), live-path wiring, footer merge FSM, session_shutdown teardown for all five reasons, and the typed on() bridge.
aliases: [the entry point, lifecycle wiring]
tags: [entity/module, lifecycle]
sources: ["[[EV-8 Ruling]]", "[[FLLWUP-5 Ruling]]", "[[FLLWUP-4 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Implements §8: registers `/rc`, `/rc:login`, `/rc:off`; wires the live path (`pi.on` → [[translate.ts]] → [[transport.ts]]); owns teardown (`session_shutdown` for quit/reload/new/resume/fork — one test per reason). Ruling-shaped behavior: `/rc` is idempotent with the ruled `already connected` sentence; `/rc:login` while non-idle is refused ("close the tunnel first with /rc:off"); the URL prompt fires only out-of-band after `/rc:login` (EV-8 J2 — the §8 sentence was amended); the footer merge is the kind-first FSM of [[Footer Merge Policy]] with `ERROR_DIAL_THRESHOLD = 10`; the seven-state footer renders via `ctx.ui.setStatus("pi-remote", …)`.

Type history: the local permissive `ExtensionAPI` stand-in (`on(event: string, …)`) was FLLWUP-9's target — now `src/pi-sdk-on.ts` vendors the real SDK union (`DepsOnEvent = PiSDKOnEvent | "ui.confirm"` for the synthetic case), and the seven subscriptions use manual PiEvent construction (FLLWUP-5 S-O2), never `ev as PiEvent`. Config precedence follows the entry-point pattern `pi.env(…) ?? pi.getSetting(…)` — now including `PI_REMOTE_LOCALE` (FLLWUP-4 OJ3).

## Related
[[Footer Merge Policy]], [[Seven Footer States]], [[pi-sdk-on.ts]], [[Copy Honesty Doctrine]], [[Retry Policy]]

## Sources
[[EV-8 Ruling]], [[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]]
