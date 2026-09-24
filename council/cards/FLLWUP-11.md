---
id: FLLWUP-11
title: "Reconcile the ExtensionAPI stand-in's non-on members with the real SDK surface"
state: In Progress
owner: null
epic: EPIC-4
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

## Run rulings — /features-deliver EPIC-4 (2026-09-24)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-TYPE-1 (this card)** — SDK type-surface strategy: the needed real SDK
  signatures are **vendored** into `src/` with provenance notes and a
  re-diff-on-upgrade discipline (extending FLLWUP-9's `pi-sdk-on.ts` pattern);
  the SDK is **not** added as a dependency. Each of the twelve non-`on`
  stand-in members is verified against the installed SDK — typed against its
  real signature where it exists, or removed with its usage re-homed to the
  real surface (`ctx.ui.setStatus`, `ctx.ui.input`, `ctx.isIdle()`,
  `ctx.sessionManager`, `ctx.cwd`) or a documented local capability
  (`process.env`, `node:os`, local config-dir resolution).
- **R-PAYLOAD-1 (FLLWUP-12)** — Handler narrowing is corrected to the real
  payload shape for all eleven live subscriptions; documentation-only where the
  real payload genuinely lacks a needed field, recorded on the card. Fixtures
  feed real-shaped payloads.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-11 → FLLWUP-12. This card
  runs first.
- **R-PUSH-1 (run-wide)** — Run-scoped authorization: the step-12 record
  commit may be committed and pushed directly to `main` for this run only.
  Never extended to any later run.
- **R-ADMIN-1 (run-wide)** — Run-scoped authorization:
  `gh pr merge <PR> --squash --admin --match-head-commit <X>` may be used if a
  `main` ruleset blocks an ordinary merge. Unused while `main` is unprotected.
  Never extended to any later run.
- **R-MERGE-1 (run-wide)** — This run is unattended. The orchestrator (and the
  runner under the deterministic merge check) executes the merge check and the
  merge without pausing for human confirmation, including the first merge of
  the run.

**Recorded execution mode (orchestrator routing, EV-69):** **Verify** — one
owner, one skeptic, one judge; all five deterministic-merge criteria with
criterion 3 scoped to the single Verify skeptic dispatch.
