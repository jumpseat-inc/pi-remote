---
id: FLLWUP-3
title: "Map EV-4's unmapped live pi events (queue_update, bash_execution_update, auto_retry_*)"
state: Deliberating
owner: null
epic: EPIC-1
goal: translate.ts maps the remaining live pi events that EV-4's §4 table did not cover — queue_update, bash_execution_update, auto_retry_* — and decides the AG-UI representation of live tool-progress (partialResult), extending the EV-4 mapper without changing its pure fold shape.
---

## Intent

Filed from EV-4's step 13. EV-4 implemented the §4 table rows and the JSONL
entry kinds the spec documents; several live pi events sit outside §4's table
and were deliberately left unmapped (owner round-1 flag; design spec §6
non-goal): `queue_update`, `bash_execution_update`, `auto_retry_*`. These are
live `pi.on()` events a remote user may reasonably want to see (bash output
upload progress, retry state), but §4 defines no AG-UI representation and
EV-4's scope is the §4 table. Separately, live tool-progress (`partialResult`)
has no AG-UI event; EV-4 dropped it because its acceptance requires no
tool-progress frame, with the agreed future representation deferred as
`CUSTOM pi.tool.progress`. This card decides and lands both.

User-visible surface — the remote client's perception of ongoing bash
uploads, retries, and tool progress; today these are silent beyond what the
§4 rows emit.

## Deliberation record

### Step 1 — path classification

- Full council (not mechanical): cross-seam (translate.ts pure mapper + index.ts live-path wiring if the deliberation adopts it) and spec-ambiguous/design-judgment — the card explicitly delegates the exact CUSTOM category assignment to this deliberation; the AG-UI representation of live tool-progress (partialResult) is open (current state: folded in `CUSTOM pi.tool.update` data; EV-4 design spec non-goal deferred a dedicated `CUSTOM pi.tool.progress` follow-up — this card decides); the `auto_retry_*` family boundary (does it include the adjacent `summarization_retry_*` variants?) is a scope call; and the runtime reachability of these events from an extension (see grounding below) shapes what the delivery can claim.
- Surface-touching: yes — the remote client's perception of ongoing bash upload output, queued messages, retries, and tool progress; today these are silent beyond what the §4 rows emit. `designer` seated as third generator in steps 2–3.
- Binding context carried in (not open for relitigation): `translate(input, state)` stays a pure fold with the FLLWUP-5 `entryId`-based live/JSONL discriminator; CUSTOM shape `{type:"CUSTOM", name:"pi.<category>", value:{pi, data}}` with `name` the sole dispatch key; index.ts subscriptions use manual PiEvent construction (FLLWUP-5 S-O2 pattern — any new subscription constructs the PiEvent the fold expects explicitly, never `ev as PiEvent`); purity guards G-11/G-12 (no I/O, no sockets, no entropy) and side-effect-free import stay green; any §4-adjacent spec sentence rides the PR as a facilitator-authored evidence-cited amendment (EV-1 Q3 / EV-4 Q1 precedent); live tool-progress (partialResult) surfaces as `CUSTOM pi.tool.progress` only if the deliberation adopts it, never smuggled into `TOOL_CALL_ARGS`; `user_input` is gone from the codebase and `ui.confirm` deadness is fenced to FLLWUP-8 — neither is re-added here; gates = `bunx tsc --noEmit` exit 0 + `bun test` exit 0, baseline 155 green (verified by facilitator at run start), fixtures per newly mapped event; no Mongo, no boot gate.
- Grounding: `vault/wiki/index.md` is a stub catalog (no module pages) — semantics grounded in docs/PI-SPEC.md §4/§5 and the installed pi SDK source (as prior cards did). Facilitator-verified SDK facts, passed to the seats as evidence: `AgentSessionEvent` payloads at `pi-coding-agent/dist/core/agent-session.d.ts` lines 46–103 — `queue_update {steering: readonly string[], followUp: readonly string[]}`, `bash_execution_update {id?: string, delta: string}`, `auto_retry_start {attempt, maxAttempts, delayMs, errorMessage}`, `auto_retry_end {success, attempt, finalError?}`, plus the adjacent `summarization_retry_scheduled {attempt, maxAttempts, delayMs, errorMessage}`, `summarization_retry_attempt_start {source:"branchSummary"} | {source:"compaction", reason}`, `summarization_retry_finished {}`. These live on the internal session event bus; the extension-facing `ExtensionAPI.on()` is a typed exhaustive whitelist (`dist/core/extensions/types.d.ts` ~905–941) that does NOT include them, and the runtime session→extension forwarder (`dist/core/agent-session.js` ~470–555) whitelists only agent/turn/message/tool_execution events — so queue_update, bash_execution_update, and auto_retry_* are not bridgeable from an extension in the installed SDK (same class of finding as FLLWUP-5 probe-8: `ui.confirm` absent from the SDK surface). Replay side already maps JSONL `bash_execution` → `CUSTOM pi.tool.bash_execution`. translate.ts today folds `partialResult` into `pi.tool.update` data; index.ts currently has NO `tool_execution_*` subscriptions. The card's proposed `pi.tool.*` / `pi.session.*` shapes are proposals only.

## Acceptance

- `queue_update`, `bash_execution_update`, and each `auto_retry_*` variant map
  to a defined AG-UI frame through the unchanged `translate(input, state)`
  signature — proposed shape: `CUSTOM` `pi.tool.*` / `pi.session.*` per the
  deliberation's CUSTOM conventions (`{type:"CUSTOM", name:"pi.<category>",
  value:{pi:<raw>, data:<semantic>}}`, name the sole dispatch key). The exact
  category assignment is a design decision for this card's deliberation.
- Live tool-progress (`partialResult`) surfaces as `CUSTOM pi.tool.progress`
  (if the deliberation adopts it), never smuggled into `TOOL_CALL_ARGS`.
- No I/O, no socket references added; the purity guard (G-11/G-12) stays
  green; module import remains side-effect-free.
- `bunx tsc --noEmit` exit 0 and `bun test` exit 0 with fixtures covering
  each newly mapped event.
- Any §4 (or §4-adjacent) representation added rides the same prose-sync path
  the EV-1 Q3 / EV-4 Q1 rulings established (facilitator-authored spec
  amendment alongside the implementation, evidence-cited).
