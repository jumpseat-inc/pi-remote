# Construction-layer grounding for emission-semantics claims

**FLLWUP-36** — make grounding emission-semantics claims in the event
constructing layer a systematic, repeatable check, not per-clause prose.

## Why

Claims about what the pi engine *emits* must be verified against the layer
that **constructs** the event, not only the pass-through emitter's payload
shape. FLLWUP-12's first verify cycle blessed an identity-keyed `messageId`
because the pass-through fixtures shared one object across emissions; the
construction layer (agent-loop.js `streamAssistantResponse`) actually emits
`message: { ...partialMessage }` — a **fresh spread-copy per emission** — so
identity never survives an event, and the identity-keyed key minted a fresh
key per emission (two `TEXT_MESSAGE_START` frames, zero END). See the wiki
page **Emission-Semantics Fidelity** for the worked example.

## The check

Two artifacts, one property. Both live in-repo; neither makes the SDK a
dependency (R-TYPE-1).

1. **The probe** — `test/construction-grounding.test.ts` (scripted, preferred).
   It locates the installed pi SDK on the local disk (three anchors:
   `PI_REMOTE_TEST_SDK_ROOT` override → realpath of `pi` on PATH walked up to
   its package.json → the global node_modules layout next to the bun/npm bin
   dir), imports the real construction layer (`runAgentLoop` from
   pi-agent-core, `AssistantMessageEventStream` from pi-ai), drives it with a
   synthetic provider feed shaped like anthropic-messages.js's emission
   discipline (one shared accumulator; every inner event carries
   `partial: output`; terminal `done` carrying the same object), and asserts
   the semantics on the emitted AgentEvents:
   - **A1** — `message_start`/`message_update` emissions are fresh copies;
     object identity never survives an emission.
   - **A2** — `message_end` carries the accumulated final message itself.
   - **A3** — `${role}:${timestamp}` partitions all emissions into exactly
     the logical messages streamed (stable within, distinct across).
   - **A4** — the repo's derivation helper `agentMessageId`
     (src/pi-sdk-events.ts) is stable within a stream, distinct across.
   - **A5** — content anchors in the three construct-layer files
     (agent-loop.js, anthropic-messages.js, assistant-message-frame.js) still
     hold, pinning the probe to those files across SDK upgrades.

   Run it: `bun test test/construction-grounding.test.ts`.
   Where the SDK is not installed (CI's ubuntu gates job has none), the suite
   skips honestly with a printed reason; it is re-runnable on any disk with
   the SDK via the same command. Assertions A1–A4 execute the installed
   engine; A5 re-reads the construct-layer sources on every run.

2. **The procedure** — for claims the probe does not cover (a semantics the
   feed cannot trigger, or a new emission family the probe does not yet
   assert). Steps, in order:

   1. **Name the emission site.** Identify the construct-layer file and
      function that constructs the event — `agent-loop.js`
      (`streamAssistantResponse`, `declareToolChanges`), the provider adapter
      (anthropic-messages.js), or the frame encoder
      (assistant-message-frame.js). Never ground a claim in the extension's
      pass-through handler alone.
   2. **Read the emission statement.** Is the payload copied (`{ ...msg }`,
      `cloneX(...)`, `structuredClone`), mutated in place, or passed by
      reference? Is it emitted once or per delta?
   3. **Derive the identity/partition consequence.** From the emission
      statement, derive what survives across emissions: object identity
      (never, for spread-copy emissions), payload-intrinsic fields (only
      those the copying preserves verbatim), and which fields are set once
      on the accumulator (role, timestamp in anthropic-messages.js).
   4. **Extend the probe when mechanizable.** If the claim is repeatable
      against the real layer, add an assertion to
      `test/construction-grounding.test.ts` (feed shape + emitted-event
      assertion), not prose in a card. If it cannot be mechanized (e.g. a
      one-off against a live provider), record the file, the emission
      statement, and the derived consequence in the card record — the
      three-part citation format below.
   5. **Cite in the three-part format.** Any emission-semantics claim in a
      card record cites: (file:line-range, the emission statement, the
      derived consequence). Example from FLLWUP-12: "agent-loop.js:284,
      `message: { ...partialMessage }` per message_start/update, therefore
      object identity never survives an emission; derive keys from
      payload-intrinsics only."

## Boundaries

- The probe asserts the agent-loop construction layer's semantics with a
  synthetic feed — it does not execute a live provider stream, and it does
  not pin the SDK's line numbers (anchors are content-anchored; line numbers
  in citations are advisory).
- The probe covers the assistant message family (`message_start/update/end`).
  The tool-result family (`declareToolChanges`, agent-loop.js ~249/~635) and
  `turn_*` events are not yet asserted; ground claims about them via the
  documented procedure until the probe grows coverage.
- The probe's feed pins pi-ai's emission discipline (shared accumulator,
  `partial: output` on every inner event). If a future SDK changes that
  discipline, A5 goes red and the feed must be re-derived from the new
  adapter source before the semantic assertions can be trusted again.

## Non-vacuity

The probes are red-capable: on a counterfactual construction layer that
emits direct references (the premise the pass-through view alone would
bless), A1 fails (distinct identities 1 of 3); under the FLLWUP-12
identity-keyed derivation fed the real fresh-copy emission shape, A4 fails
(keys `identity:0..3`, not one stable key). Verified 2026-09-24.
