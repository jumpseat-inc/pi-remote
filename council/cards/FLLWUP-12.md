---
id: FLLWUP-12
title: "Reconcile handler payload narrowing with real SDK event payloads"
state: In Review
owner: owner/fllwup-12-reconcile-payload-narrowing (PR #39, head e1ef9c1)
epic: EPIC-4
goal: Every forward() handler's defensive narrowing matches the real SDK's actual event payload shapes, so no live event is silently dropped by a field mismatch between the stand-in's assumed shape and the real payload.
---

## Intent

Filed from FLLWUP-9's step 13 (deliberation finding F-2). Example: the real
SDK's `MessageStartEvent` is `{type:"message_start"; message: AgentMessage}` —
handlers narrowing on `messageId`/`events`/`content` fields that the real
payload does not carry would drop live events silently, exactly the failure
class FLLWUP-5's probe 4 exposed for the cast. FLLWUP-9 fixed the event-name
type honesty; this card fixes the payload-shape honesty. Pairs naturally with
FLLWUP-8's live-path work (which touches `forward` for the raise path) but is
a separate card per the runner's split.

## Acceptance

- Each of the eleven live subscriptions' handler narrowing is checked against
  the installed SDK's payload type for that event (dist types.d.ts is the
  authority) and corrected or documented where it differs.
- Fixtures feed real-shaped payloads (not stand-in-shaped) through
  translate.ts's live path with the expected frames emitted — the probe-4
  misroute class has a regression test per event family.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.

## Run rulings — /features-deliver EPIC-4 (2026-09-24)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-PAYLOAD-1 (this card)** — Handler narrowing is **corrected** to the real
  payload shape for all eleven live subscriptions. A documentation-only
  divergence is permitted only where the real payload genuinely lacks a field
  the emitted frame needs, and the justification must be recorded on the card.
  Fixtures feed real-shaped payloads.
- **R-TYPE-1 (FLLWUP-11)** — SDK type-surface strategy: the needed real SDK
  signatures are vendored into `src/` with provenance notes (extending
  FLLWUP-9's `pi-sdk-on.ts` pattern); the SDK is not added as a dependency.
  Each non-`on` stand-in member is typed against its real signature where it
  exists, or removed with its usage re-homed to the real surface or a
  documented local capability.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-11 → FLLWUP-12. This card
  runs second.
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

## Run record

- Runner took the card (mechanical path — narrowly-scoped, unambiguous,
  single-area change; no deliberation). Routing note: `council_route` is not
  available to this container's tool set; the recorded mode **Verify** from
  the dispatch input is applied as authoritative and not re-recorded.
- Surface-touching bit: **false** (handler narrowing and fixtures only — no
  visible surface, copy, empty state, or error state a person reads).
- Step 8 (job-15.1): delivered. Branch `owner/fllwup-12-reconcile-payload-narrowing`
  (base origin/main d36c6c9), **PR #39**, head
  `e1ef9c16349e7ff3226903db74a80cd7872edb76`. Owner-reported gates:
  `bunx tsc --noEmit` exit 0; `bun test` 266 pass / 1 Windows-gated skip / 0
  fail. All eleven subscriptions reconciled per R-PAYLOAD-1: message_start /
  message_update / message_end / tool_result corrected to the real payload
  shapes (the four handlers that narrowed on fields the real payloads do not
  carry — every real payload of those families was silently dropped before);
  agent_start / agent_settled / turn_start / turn_end and ui_prompt_start /
  ui_prompt_end verified already-honest, unchanged; the synthetic `ui.confirm`
  seam untouched (not one of the eleven). New `src/pi-sdk-events.ts` vendors
  the real payload interfaces + derivation helpers (R-TYPE-1: vendored
  signatures, SDK not added as a dependency). Fixtures converted to
  real-shaped payloads; 7-test FLLWUP-12 regression suite (red at base
  28 pass/8 fail → 36 pass/0 fail at head); translate.ts normalized surface
  unchanged, pinned by probe test. **One documentation-only divergence under
  R-PAYLOAD-1's permission:** `tool_result → TOOL_CALL_RESULT` sets
  `messageId = ev.toolCallId` — the real ToolResultEvent genuinely carries no
  message id, the AG-UI frame requires one; justification: the tool call's own
  stable SDK-supplied id doubles as the messageId (live twin of the replay
  path's entry-id-as-messageId decision, src/replay-adapter.ts). Recorded on
  the card per the ruling.
- Step 8→9 routing recheck: `council_route` unavailable in this container's
  tool set; recorded mode **Verify** applied as authoritative, no re-route.
  In Review set from the observed artifact: PR #39 OPEN, head e1ef9c1,
  base d36c6c9 (verified via gh pr view).
