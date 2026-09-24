---
id: FLLWUP-12
title: "Reconcile handler payload narrowing with real SDK event payloads"
state: Done
owner: owner/fllwup-12-reconcile-payload-narrowing (PR #39, merged 524bc90)
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
- Step 9 skeptic, verify cycle 1 of 3 (job-15.2): **BLOCK** — one
  **closed-red** objection. The corrected handlers' narrowing fields all exist
  on the real payloads (field-level audit clean, 11/11), gates green at head
  (tsc 0; 266/1/0), R-TYPE-1/R-PAYLOAD-1 conformance confirmed, PR hygiene
  clean, defect-injection proved the suite non-vacuous — but the
  message-family messageId derivation (WeakMap keyed on the `message` object's
  identity) fails under the installed engine's actual emission semantics:
  streamAssistantResponse spread-copies a fresh object per message_start /
  message_update emission, so the wedge test (engine-verbatim semantics) wired
  `TEXT_MESSAGE_START(msg-11)`, `TEXT_MESSAGE_START(msg-12)`, zero END — the
  same silent-misroute class this card exists to close, relocated to unstable
  object identity. Owner fixtures share one object across all three events,
  encoding the false premise. Card returned to In Progress; the specific red
  item handed back to the owner (fix cycle 1). Step-13 candidates noted by the
  skeptic: engine-style fixture premise-testing; translate.ts message_update
  fallback masking dropped starts; plan's emission-site-authority citation.
- Step 9 fix cycle 1 (job-15.3): delivered. Head pushed `e1ef9c1..e502add`
  (`e502add9bf637aa57f216699b61e65a39fd69c3b`), PR #39 updated. Fix: the
  WeakMap identity-keyed `messageKey` deleted; AG-UI messageId for the
  message family now derived from payload-intrinsic `(role, timestamp)`
  (`${role}:${timestamp}`, `agentMessageId` in src/pi-sdk-events.ts) —
  grounded in the installed engine (agent-loop.js spread-copies per
  start/update, accumulated finalMessage at end; role/timestamp copied
  verbatim onto every emission and identical across one logical message).
  Documented bound: two same-role messages sharing a timestamp fold into one
  AG-UI message (merged framing, not a drop). No new divergence under
  R-PAYLOAD-1. Skeptic's step-13 candidate (engine-style wedge fixture)
  folded in: TDD red at e1ef9c1 (`waitFor timeout`, probe shows two STARTs
  distinct ids zero END) → green at e502add (1 START / 2 CONTENT / 1 END,
  one id). Gates re-run: tsc exit 0; `bun test` 270 pass / 1 Windows-gated
  skip / 0 fail.
- Step 9 skeptic re-verification, verify cycle 2 of 3 (job-15.4): **PASS, no
  open objections** — cycle-1 closed-red empirically settled green at head
  (transplanted wedge red at e1ef9c1 → closed-green at e502add; defect
  injection into `agentMessageId` → wedge red, restored byte-for-byte →
  green, gate proven non-vacuous). `(role, timestamp)` verified present
  verbatim on every emission (types.d.ts:658–672; agent-loop.js:284/295-299/
  309; anthropic-messages.js:339/355; assistant-message-frame.js:29/40).
  No-ghost-END preserved; collision bound probed live (2 starts / 2 contents
  / 2 ends / shared id — merged framing, zero content loss); R-TYPE-1
  provenance refs verified against installed SDK; package.json byte-identical
  base→head, SDK-free; ui.confirm byte-identical to base; cumulative diff
  d36c6c9..e502add zero council/run-record paths. Gates observed: tsc exit 0;
  270 pass / 1 skip / 0 fail. Step-13 candidates noted (decoder duplication
  pinned by static pairing test; vendored PiTextContent omits optional
  textSignature; millisecond timestamp-collision exposure unreachable in
  sequential emission). Verify-cycle count: 2 of 3.
- Step 10 judge (job-15.5): **PASS.** Basis: 4 handlers corrected (object-identity
  keys → payload-intrinsic `(role, timestamp)` derivation; tool_result on
  toolCallId/content with the documented R-PAYLOAD-1 divergence), 7 already
  honest, no live event in the eleven silently dropped by field mismatch;
  gates confirmed; package.json byte-identical, SDK not a dependency. Human
  merge gate (step 11) substituted per R-MERGE-1: deterministic merge check
  executed by this runner.
- Step 11/12: all five merge criteria held (mode Verify): (1) owner gates
  green in full at head e502add (tsc exit 0; bun test 270 pass / 1
  Windows-gated skip / 0 fail, observed by owner and skeptic independently);
  (2) `gh pr checks 39` keyed on workflow=="gates": state SUCCESS on both
  jobs, runs pinned to headSha e502add9bf637aa57f216699b61e65a39fd69c3b;
  (3) no blocking Skeptic objection (verify cycle 2 PASS, zero open
  objections); (4) judge verdict PASS (job-15.5); (5) no Needs Human state,
  no outstanding ruling. Merged PR #39 as squash
  **524bc90e0e49d838ed331a7ef17a22ead627c82d** with
  `--match-head-commit e502add…` held (ordinary merge; R-ADMIN-1 unused —
  main unprotected). CI green on the merged SHA (gates runs on 524bc90,
  conclusion success). Card Done on card+board from that observed artifact.
  Step-12 record commit pushed to main under R-PUSH-1 (run-scoped).
  Local main fast-forward-unable (diverged by the run's record commits) →
  documented union reconcile via `git merge origin/main` (ort, no conflicts,
  conflict-marker sweep clean, validate clean).
