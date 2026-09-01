---
id: FLLWUP-11
title: "Reconcile the ExtensionAPI stand-in's non-on members with the real SDK surface"
state: Backlog
owner: null
epic: EPIC-1
goal: Every non-on member of index.ts's ExtensionAPI stand-in (getSetting, env, setStatus, input, sessionId, readActiveBranch, isIdle, configDir, version, platform, arch) either exists on the installed pi SDK's ExtensionAPI or is removed from the stand-in, so the extension loads against a real pi host without a TypeError.
---

## Intent

Filed from FLLWUP-9's step 13 (deliberation finding S-O5). FLLWUP-9 vendored the
real SDK's typed `on()` union but left the stand-in's twelve other members
untouched; the deliberation found they have no counterpart on the installed
SDK's `ExtensionAPI` (pi-coding-agent/dist/core/extensions/types.d.ts) or its
loader's runtime object — `pi.configDir()` would be a **TypeError at load** in
a real pi host. Everything shipped so far is fixture-tested against the
stand-in, so no live host has exercised this surface. This card reconciles the
whole stand-in (not just `on`) and models `ExtensionHandler`'s
`(event, ctx) => Promise<R|void>|R|void` return shape. Severity flag from the
orchestrator: if the load-time TypeError is real, this is the highest-priority
post-epic item — the extension may not load in production at all until it
lands.

## Acceptance

- Each of the twelve member names is verified against the installed SDK:
  exists (typed against the real signature) or removed with its usage
  replaced by the real SDK surface or a documented local capability.
- The `ExtensionHandler` return shape matches the real SDK's
  `(event, ctx) => Promise<R|void>|R|void` union.
- A load smoke against the installed SDK (or its type surface, where runtime
  loading is not testable in-repo) demonstrates no missing-member error.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.
