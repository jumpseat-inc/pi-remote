---
id: EPIC-4
title: "Real-host installability — reconcile the ExtensionAPI stand-in and handler payload narrowing with the installed pi SDK"
state: Ready
owner: null
epic: null
goal: pi-remote loads against the installed pi SDK with no missing-member error and no silently-dropped live event — every non-on member of index.ts's ExtensionAPI stand-in either exists on the real SDK's ExtensionAPI or is removed, and every forward() handler's payload narrowing matches the real SDK's event payload shapes — observed as met when FLLWUP-11 and FLLWUP-12 are both Done with bunx tsc --noEmit exit 0 and bun test green.
---

## Intent

Grouping card for the two installability residuals filed out of FLLWUP-9's
step 13 (deliberation findings S-O5 and F-2). They were carried under EPIC-1
(Done) with no live home; this epic gives them one.

Everything shipped so far is fixture-tested against the local `ExtensionAPI`
stand-in in `index.ts`. That stand-in has drifted from the installed SDK in two
ways, neither visible to a green fixture suite:

- **Missing/foreign members (FLLWUP-11).** The stand-in's non-`on` members —
  `getSetting`, `env`, `setStatus`, `input`, `sessionId`, `readActiveBranch`,
  `isIdle`, `configDir`, `version`, `platform`, `arch` — have no counterpart on
  the installed `pi` SDK's `ExtensionAPI` (or its loader object); e.g.
  `pi.configDir()` would be a **TypeError at load** in a real host. `AGENTS.md`'s
  "Current state" marks the extension "Not yet loadable in a real `pi` host" and
  names FLLWUP-11/12 as the reconciliation gate — "Do not claim installability
  until they land."
- **Payload-shape drift (FLLWUP-12).** Each `forward()` handler's defensive
  narrowing must match the real SDK's event payload types; a handler narrowing
  on fields the real payload does not carry drops live events silently (the
  FLLWUP-5 probe-4 misroute class).

The theme: a stand-in that diverges from the real SDK is a latent production
defect even when every fixture is green. This epic closes that gap before any
installability claim.

Delivered by children FLLWUP-11 and FLLWUP-12; this card tracks the set and is
not actionable on its own.

## Acceptance

Observed as met when FLLWUP-11 and FLLWUP-12 are both `Done`: every stand-in
non-`on` member is verified against the installed SDK (typed against the real
signature, or removed), every `forward()` handler's narrowing matches the real
event payload shapes with fixtures feeding real-shaped payloads,
`bunx tsc --noEmit` exits 0, and `bun test` is green. The extension's load
against the installed SDK (or its type surface where runtime loading is not
testable in-repo) raises no missing-member error.