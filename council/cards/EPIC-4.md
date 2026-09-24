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

## Run rulings — /features-deliver EPIC-4 (2026-09-24)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-TYPE-1 (FLLWUP-11)** — SDK type-surface strategy: the needed real SDK
  signatures are **vendored** into `src/` with provenance notes and a
  re-diff-on-upgrade discipline (extending FLLWUP-9's `pi-sdk-on.ts` pattern);
  the SDK is **not** added as a dependency. Each of the twelve non-`on`
  stand-in members is verified against the installed SDK — typed against its
  real signature where it exists, or removed with its usage re-homed to the
  real surface (`ctx.ui.setStatus`, `ctx.ui.input`, `ctx.isIdle()`,
  `ctx.sessionManager`, `ctx.cwd`) or a documented local capability
  (`process.env`, `node:os`, local config-dir resolution).
- **R-PAYLOAD-1 (FLLWUP-12)** — Handler narrowing is **corrected** to the real
  payload shape for all eleven live subscriptions. A documentation-only
  divergence is permitted only where the real payload genuinely lacks a field
  the emitted frame needs, and the justification must be recorded on the card.
  Fixtures feed real-shaped payloads.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-11 → FLLWUP-12.
- **R-PUSH-1 (run-wide)** — Run-scoped authorization: the step-12 record
  commit may be committed and pushed directly to `main` for this run only.
  Never extended to any later run.
- **R-ADMIN-1 (run-wide)** — Run-scoped authorization:
  `gh pr merge <PR> --squash --admin --match-head-commit <X>` may be used if a
  `main` ruleset blocks an ordinary merge. Unused while `main` is unprotected
  (observed: 0 rulesets, branch-protection API 404). Never extended to any
  later run.
- **R-MERGE-1 (run-wide)** — This run is unattended. The orchestrator (and the
  runner under the deterministic merge check) executes the merge check and the
  merge without pausing for human confirmation, including the first merge of
  the run.

**Recorded execution mode (orchestrator routing, EV-69):** both cards record
**Verify** — one owner, one skeptic, one judge; all five deterministic-merge
criteria with criterion 3 scoped to the single Verify skeptic dispatch. No
deliberation: R-TYPE-1 and R-PAYLOAD-1 settle the design forks, so the work is
implementation plus independent verification rather than spec derivation.