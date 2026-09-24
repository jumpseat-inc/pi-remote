---
title: pi-host.ts
type: entity
summary: FLLWUP-11's local host-capability module — resolves the pi agent dir (PI_CODING_AGENT_DIR → $HOME/.pi/agent), a fail-open settings.json piRemote read, and node:os hostMetadata; the five members re-homed from the removed stand-in.
aliases: [local host capabilities, pi-host]
tags: [entity/module, host, sdk]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]"]
created: 2026-09-24
updated: 2026-09-24
---
Created by FLLWUP-11 (R-TYPE-1) to carry the removed stand-in members that are genuinely *local* capabilities rather than real SDK surface. The real `ExtensionAPI` exposes none of `getSetting`, `env`, `setStatus`, `input`, `sessionId`, `readActiveBranch`, `isIdle`, `configDir`, `version`, `platform`, `arch` — verified against `dist/core/extensions/types.d.ts` **and** the loader's runtime api object (`loader.js` ~line 200), where calling `pi.configDir()` is a TypeError at load.

Three pure functions with injectable I/O seams (no module-level mutable state):
- `resolvePiAgentDir({env, homedir})` — `PI_CODING_AGENT_DIR` env override, else `$HOME/.pi/agent`; provenance is the SDK's `dist/config.js` (`ENV_AGENT_DIR`, `CONFIG_DIR_NAME = ".pi"`, `getAgentDir()`).
- `readHostSettings({configDir, readFile?})` — guarded read of `<configDir>/settings.json`, returning its `piRemote` object (`{}` on any failure). **Read-only, fail-open**: a missing or corrupt file never blocks the extension from loading.
- `hostMetadataFromOs({platform, arch})` — `node:os` metadata; informational only (the server spec permits an empty `hostMetadata`).

`env` needs no wrapper (`process.env` directly). `version` is **dropped entirely** — the SDK exposes no version accessor on `ExtensionAPI`, and `hostMetadata` is informational.

Re-homing totals for the 13 non-`on` base members: 2 kept typed-to-real (`registerCommand`, `sendUserMessage`), 5 re-homed to the real `ExtensionContext`, **5 here**, 1 dropped (`version`). The module is covered by `test/pi-host.test.ts`; the boundary proof is `test/pi-sdk-load.test.ts`'s production-loader smoke ([[Real-Surface Verification]]).

## Related
[[Real-Surface Verification]], [[pi-sdk-on.ts]], [[pi-sdk-events.ts]], [[index.ts]], [[pi-remote]], [[EPIC-4 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]]