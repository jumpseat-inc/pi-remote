---
title: "EV-6 — Design position: Remote input injection"
date: 2026-08-31
seat: designer
epic: EPIC-1
card: EV-6
files-grounded:
  - docs/PI-SPEC.md §5.4, §7.3
  - src/transport.ts (InboundEnvelope carries deviceId)
  - src/translate.ts (PiEvent → AG-UI mapping; pi.human_input, user_input)
  - src/history.ts (replay determinism; deterministic promptId already in translate.ts:483)
  - pi SDK: agent-session.js (sendUserMessage, prompt, emitInput, isStreaming, _queueSteer/_queueFollowUp)
  - pi SDK: extensions/runner.js (emitInput source:"extension", wrapUIPromptContext, noOpUIContext)
  - test/translate.test.ts (promptId deterministic; CUSTOM {pi,data})
wiki-state: empty (ingest flow not run); grounded in source files and prior card history (EV-4, EV-3, EV-1)
---

# EV-6 — Design position: Remote input injection

## Position (short)

EV-6's user-visible work is two experiences. On the **host**, an injected remote
prompt lands in the JSONL looking exactly like a typed one — the
replay-correctness invariant, and the only thing that makes EV-5's "replay =
ground truth" hold. On the **remote client**, a `pi.human_input` frame
received while the session is waiting on a host UI prompt can be answered, and
the answer carries the `deviceId` of the answering device so the audit trail
is real.

The smallest viable shape is a thin, I/O-free `inject.ts` that exposes one
seam per responsibility: a `injectUserMessage({ content, deliverAs })` that
calls `pi.sendUserMessage(content, { deliverAs })` and returns nothing to the
wire; and a `resolveHumanInput({ promptId, text, deviceId })` that either
resolves the pending host prompt directly (when the host UI is wrapped and
lets us) or falls back to `sendUserMessage(text, { deliverAs: "steer" })` so
the message is **never dropped**. The fall-back is the product choice; dropping
is the design failure.

## Gulf closed

Gulf of Evaluation for the remote user on two moments:

1. **The moment a prompt is typed on the remote.** The host-side transcript
   shows the same `user` role entry it would show for typing. Anything else
   invites the misconception "I typed this; the host sees something else" and
   breaks trust.
2. **The moment a `pi.human_input` frame arrives on the remote.** The user
   must perceive "this is a pending approval waiting for me" and have a clear
   path to act — including when the host mode refuses direct resolution and
   the answer will arrive as a steer.

Gulf of Execution is closed by the static seam: there is exactly one way to
inject (the SDK's `sendUserMessage`), and exactly one way to attempt
resolution (the host's wrapped UI prompt promise). EV-6 does not invent a
second channel.

## Principle + evidence

### Replay-correctness = no transformation (the load-bearing principle)

`docs/PI-SPEC.md` §4 row "user input (from a client) → `TEXT_MESSAGE_START` (role
`user`)" and §5.4: "Remote input must be indistinguishable from typed input in
the session log — the extension does not filter or transform its own injections
(`action: "continue"`)."

`src/translate.ts:506-514` maps the live `user_input` PiEvent to the same
`TEXT_MESSAGE_START/CONTENT/END` trio the JSONL replay path emits. Anything
the injector produces that deviates from `pi.sendUserMessage`'s native
pipeline is a divergence between live and replay.

`agent-session.js` confirms the pipeline:

- `sendUserMessage(content, options)` calls `prompt(text, { source: "extension", streamingBehavior: deliverAs, images })`.
- `prompt()` calls `_extensionRunner.emitInput(text, images, "extension", streamingBehavior)` before any queueing.

`runner.js:974` (`emitInput`) walks registered handlers; if our extension
returned `action: "handled"` the message is consumed (no user message
produced); if it returned `action: "transform"` the text is mutated. Either
return value breaks the invariant.

**Therefore: EV-6 must not register an `input` extension handler** — the
static-grep test is the cleanest assertion.

### `deliverAs` is what pi actually does

Verified in `agent-session.js`:

- `isStreaming === false` → `_runAgentPrompt` starts a new turn (no `deliverAs`).
- `isStreaming === true && deliverAs === "followUp"` → `_queueFollowUp` → `agent.followUp(...)` → `_followUpMessages`.
- `isStreaming === true && deliverAs === "steer"` → `_queueSteer` → `agent.steer(...)` → `_steeringMessages`.
- `isStreaming === true && !deliverAs` → throws ("Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.").

EV-6 must derive `deliverAs` from the inbound frame's mode hint (or default
based on `ctx.isStreaming()`) and pass it as `options.deliverAs`. There is no
second seam in the SDK.

### `promptId` is the only durable correlation

`src/translate.ts:481-485` (already shipped in EV-4) emits
`promptId: fnv1a(${promptKind}\0${prompt})` for every `ui.confirm`. The
fixture at `test/translate.test.ts:218-237` asserts the same `promptId`
across runs (replay determinism).

EV-6's `resolveHumanInput` MUST key on `promptId`, not on prompt text, so a
replay that re-raises an identical approval matches a previously-buffered
answer.

### deviceId is opaque and already on the envelope

`src/transport.ts:84` (`InboundEnvelope.deviceId?`) — the sending deviceId is
already on the envelope by the time `inject.ts` sees it. EV-6 must read it
from `InboundEnvelope.deviceId` (not from the AG-UI frame), and propagate it
as a structured field on the resolution — never smuggled into `text`.

### Resolving the host UI prompt is conditional

`runner.js:88` (`noOpUIContext`) is the default when no host UI is bound;
`runner.js:269` (`setUIContext`) wraps the host UI's `confirm/input/select/editor/custom`
promises through `withUIPrompt` so the runner can track active prompts.

The host mode (interactive vs print vs RPC) is what determines whether a
pending `confirm` promise can be reached by an extension. EV-6's resolver must
detect "no pending prompt I can resolve" (no matching `promptId`, or the
wrapped UI promise already settled) and fall back to `sendUserMessage(..., {
deliverAs: "steer" })`. **The fallback is the spec-mandated answer** (§5.4
row 4: "otherwise surfaced as a steering message"); dropping is a regression.

## Interaction questions raised (not ruled)

### How does the remote know a prompt is pending?

The remote receives a `CUSTOM` `pi.human_input` frame with `value.data.promptId`.
Presence of the frame is the signal — but the remote has no signal that the
host has *finished waiting*. EV-6 must define a host-side resolution event:

**Proposal (designer, not yet a ruling):** emit `CUSTOM` `pi.human_input.resolved`
with `{ promptId, deviceId, ts }` from the host whenever a pending UI prompt
returns. This requires an EV-4 extension of the PiEvent surface
(`ui_prompt_end` carrying `promptId, resolvedBy: deviceId`) — flagging forward
dependency on EV-4 / EV-8.

Without this signal, the remote stays "pending" forever — Gulf of Evaluation
failure: user thinks their action is in flight when the host has long since
moved on.

### Multiple devices racing to answer

The card does not fix a winner. Smallest defensible position:

- **First deviceId to answer wins**, the others see a `pi.human_input.resolved`
  carrying `winnerDeviceId` and treat their own answer as **stale**.
- A stale answer should be surfaced as a brief notice ("already answered by
  `<winnerDeviceId>`"), not delivered — delivering it would inject a second
  user message into a session that has already moved on. That is a **slip**
  (right intention, wrong time) and confuses Gulf of Evaluation: the remote
  user thinks they decided; the host shows someone else decided.

Server-side arbitration is the relay's concern (per §9, 1:N fan-out with the
extension as single producer of `seq`); EV-6 is responsible for ensuring the
extension behaves deterministically regardless of arrival order.

### Steer landing while already steering

`pi.sendUserMessage(content, { deliverAs: "steer" })` while `isStreaming`
appends to `_steeringMessages` (`agent-session.js:861-867`). Two steers in
flight become two queued steering messages. The remote client should render
"queued" feedback (SDK already emits `queue_update` events with
`{ steering: [...], followUp: [...] }`).

EV-6 does not need to do anything here; the wire-side reflects what the SDK
queues. The design hazard is the *server* merging distinct devices' messages
under one delta; that is a server concern, not EV-6.

### Reply when direct resolution isn't supported

Spec §5.4 row 4: "resolved via the matching pending UI prompt when the mode
supports it; otherwise surfaced as a steering message." That fallback is the
*card's* commitment — a reply must never be dropped because the host UI does
not expose a resolution seam.

**Proposal:** the injector detects "no pending prompt I can resolve" and
routes via `sendUserMessage(..., { deliverAs: "steer" })`. The remote client
should see a `CUSTOM` `pi.human_input.fallback_to_steer` so the user knows
their answer reached the session as a steer, not as a confirmation of the
original prompt.

## Falsifiable predictions (hypotheses for Skeptic smokes)

| # | Hypothesis | Smoke (pure seam, never a gate assertion) | Falsified by |
|---|---|---|---|
| H1 | Transcript indistinguishability: an injected remote prompt produces a JSONL record identical in effect to a typed one | Stub `pi.sendUserMessage`; call `injectUserMessage({ content:"x", mode: undefined })` while idle; assert call args = `{ content:"x", options: { source:"extension" } }`; assert no `input` extension handler is registered in the file | `source` ≠ "extension"; any `input` handler present |
| H2 | Mode derivation: `deliverAs` is passed through and routed to the right SDK queue | Stub `AgentSession` with `isStreaming` true/false; call twice; assert steering vs follow-up arrays | A "steer" landing in follow-ups or vice versa; a "followUp" dropped when `isStreaming===false` |
| H3 | Human-input resolution carries deviceId | Stub the resolver; call `resolveHumanInput({ promptId, text, deviceId:"d1" })`; assert the resolution callback receives `deviceId` structurally (not inside `text`) | `deviceId` absent or smuggled into `text` |
| H4 | Fallback is not a drop | Stub `sendUserMessage`; supply unknown `promptId`; assert exactly one `sendUserMessage` call with `deliverAs: "steer"` | No call made (drop); text was modified |
| H5 | Remote sees resolution feedback | Live translation pipeline emits `CUSTOM` `pi.human_input.resolved` with `{ promptId, deviceId }` from a new `ui_prompt_end` PiEvent | Frame missing on prompt return; frame lacks `deviceId` |
| H6 | Stale answers surfaced, not delivered | Stub resolver returns `{ resolved: false, reason: "already_resolved", winnerDeviceId }`; assert `sendUserMessage` was NOT called; assert resolution path emits `CUSTOM` `pi.human_input.stale` | Stale answer injected as user message |
| H7 | Purity: no socket/timer/random | Static grep: `inject.ts` contains no `WebSocket`, no `setTimeout`, no `crypto.randomUUID` | Any forbidden import |

## Preferences (ranked last)

- The `deviceId` should be propagated as a **structured field** alongside the
  user message rather than smuggled into the `text` content. Smuggling in
  text breaks "what the user typed" = "what is in the JSONL" and weakens H1.
- The injector surface should be **one function per inbound responsibility**
  (`injectUserMessage`, `resolveHumanInput`) rather than a router that
  dispatches on frame type. Single-function contracts are sharper to test.
- The remote client should render the approval as a **modal** (one decision
  at a time, blocking further input) rather than an inline affordance, because
  two devices seeing the same approval must not both believe they are the
  decider.
- The host-side "who answered?" surface should appear in the JSONL as a
  `custom_message` entry of kind `human_input_resolution` carrying
  `{ promptId, deviceId, ts }`. A first-class entry makes the audit grep clean
  and keeps the `user` message entries strictly about user-typed text.

## Notes for the implementing seat

1. The injector must not register an `input` extension handler — the H1 grep
   gate is the place to assert this.
2. `promptId` is the only durable correlation between a `pi.human_input` frame
   and a resolution; do not key off prompt text (pi's `ui_prompt` schema lacks
   it; replay determinism requires the hash).
3. The host's `wrapUIPromptContext` wraps an already-existing UI; EV-6's
   resolution is *only possible* when the host UI was registered with a
   context that exposes the resolution promise to extensions. If the host is
   in RPC or print mode, the `pi.human_input` frame is informational and the
   fallback (steer) is the only path. EV-8 wires which UI context is in
   effect; if EV-8's choice blocks direct resolution, EV-6's fallback must be
   the product-accepted answer, not a degraded one.
4. Forward dependency flagged: H5 (`pi.human_input.resolved`) requires EV-4
   to extend its PiEvent surface with `ui_prompt_end` carrying `promptId` and
   resolving deviceId. This is a cross-card coordination point; do not block
   EV-6 on it (EV-6 ships with the fallback path; H5 is the ideal, the
   fallback is the floor).