---
title: pi-sdk-on.ts
type: entity
summary: The vendored typed on() union — 36 real SDK event literals plus the ui.confirm synthetic escape, with a cast-free guard bridge and a permanent negative probe.
aliases: [the typed on bridge, PiSDKOnEvent]
tags: [entity/module, types]
sources: ["[[FLLWUP-5 Ruling]]", "[[FLLWUP-4 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
FLLWUP-9's deliverable (PR #15), replacing the permissive `on(event: string, …)` stand-in. `PiSDKOnEvent` vendors the **36 real SDK event-name literals** (verified 36/36 symmetric-diff against the installed `types.d.ts` — zero `ui.confirm`, which the SDK does not emit); `DepsOnEvent = PiSDKOnEvent | "ui.confirm"` exists only for `RemoteControllerDeps.on`, because the synthetic ui.confirm path is load-bearing (deleting it fails exactly 5 tests). The bridge is a cast-free guard: `if (event === "ui.confirm") return; pi.on(event, handler);` — proven mandatory (unguarded form → TS2345). A permanent negative `@ts-expect-error` probe makes a future over-broad `on(event: string, …)` a compile error in both directions (directive removed → TS2345; union widened → TS2578).

Rider (FLLWUP-3 general rule): the union reflects the real SDK whitelist — until the SDK forwards a family, that family stays unwired, and no dead subscriptions may be added. The stand-in's twelve non-`on` members were found absent from the real SDK (FLLWUP-11, Backlog — potential load-time TypeError severity).

## Related
[[Fixture-Green Honesty]], [[Stable Keys]], [[index.ts]], FLLWUP-11, [[Closed Vocabulary Discipline]]

## Sources
[[FLLWUP-5 Ruling]], [[FLLWUP-4 Ruling]]
