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

### Step 2 — independent first pass (round 1; owner jobs-42.1+42.4 FAILED, principal job-42.2, designer job-42.3)

**owner (jobs-42.1, 42.4 — NO POSITION, seat halted).** Dispatch log: job-42.1 dispatched with the card + binding context (15-min window); ran 20 turns verifying SDK reachability (`AgentSession.subscribe()` internal bus; `_emitExtensionEvent` whitelist) then timed out mid-baseline-verification with no position. Cancelled; re-dispatched once with identical input as job-42.4 per dispatch discipline. job-42.4 ran 10 turns, reported "All facts verified against the installed SDK. Final grain-check on the exact lines I'll cite" — then produced NO further output; turns stuck at 10 with identical reported text across two consecutive wait windows (15.0m and 15.3m). Cancelled. Per council.md dispatch discipline (a seat that fails to settle after one re-dispatch → HALT, never a third dispatch, never proceeding past a seat that has not produced its output), and because the owner seat is also the step-8 implementation seat, the run halts. This seat definition (`council/agents/owner.md`, model `openrouter/deepseek/deepseek-v4-flash-0731:high`) resolves and runs but does not emit its bounded output. Principal + designer positions below are complete and durable for the resumed run; the deliberation proceeds from them with a working owner.

**principal (job-42.2, verbatim).**

**Approach (cross-seam reading first)**

- `src/translate.ts:452–458` — `tool_execution_update` already emits `CUSTOM pi.tool.update` with `data: { toolCallId, args, partialResult }`. So partialResult is **not dropped**; it already has a home. The EV-4 non-goal's "later would be a `pi.tool.progress` follow-up" was written before the code folded it here.
- `src/translate.ts:531–532` — `translateLive` ends in `default: break // exhaustive guard`. Any new `PiEvent` variant that gets added to the union but misses a `case` **silently emits zero frames**. That is the real seam risk, not the mapping itself.
- `index.ts:581–615` — the live subscriptions are all literal/manual construction today, and none of `queue_update`/`bash_execution_update`/`auto_retry_*` exist.
- SDK `dist/core/extensions/types.d.ts` (~905–941) — `ExtensionAPI.on()` has no `queue_update`, `bash_execution_update`, `auto_retry_*`, or `summarization_retry_*` overload. SDK `dist/core/agent-session.js` `_emitExtensionEvent` (~470–555) forwards only `agent_start/end`, `turn_*`, `message_*`, `tool_execution_*`. So these events are **unreachable through `pi.on()` in the installed SDK**, confirmed in source, not by assumption.
- `src/replay-adapter.ts` — the `SessionEntry.type` union has no `queue_update`/`auto_retry_*`; JSONL has `bash_execution` only (`test/translate.test.ts:379` already labels that row "FLLWUP-3 deferred").

Given that, my position: **mapper-only, fixture-green, nothing wired in `index.ts`.** Add the `PiEvent` variants and explicit `case`s; keep `partialResult` folded in `pi.tool.update` (no `pi.tool.progress` split); keep `summarization_retry_*` out of scope as a separate follow-up; amend §4 with the new rows plus a runtime-unreachability note, and add a grep gate that `index.ts` gains no dead `deps.on` for these names.

Proposed mapping (name = sole dispatch key, `value.pi` = raw event name):

| PiEvent | `name` | `value.data` |
|---|---|---|
| `queue_update` | `pi.session.queue_update` | `{ steering, followUp }` |
| `bash_execution_update` | `pi.tool.bash_execution_update` | `{ id, delta }` (id optional) |
| `auto_retry_start` | `pi.session.auto_retry_start` | `{ attempt, maxAttempts, delayMs, errorMessage }` |
| `auto_retry_end` | `pi.session.auto_retry_end` | `{ success, attempt, finalError }` |

Retries go under `pi.session.*` (they are client-side status, same as `info_change`/`model_change`), not a new `pi.run.*` category. `bash_execution_update` is `pi.tool.*` because its replay cousin `pi.tool.bash_execution` already lives there; the two names are deliberately distinct because they carry different shapes (full entry vs streaming delta).

**Tradeoffs accepted**

- **Mapper-only, not live.** Acceptance can honestly claim fixture-green, never runtime-observable. The alternative — adding `deps.on("queue_update")` etc. — compiles against the local permissive `on(event: string)` type but can never fire in the installed SDK. That is dead code plus a false "live" claim, the exact lie FLLWUP-5 ruled against for fixture-only `kind` fields. So: no `index.ts` wiring, and the acceptance says so explicitly.
- **No `pi.tool.progress` split.** `partialResult` arrives on the same `tool_execution_update` payload as `args` (SDK `_emitExtensionEvent` forwards `{ toolCallId, toolName, args, partialResult }` as one event). Splitting one event into two CUSTOM frames would either duplicate `partialResult` or drop it from `pi.tool.update` — both worse than keeping atomicity. The "never smuggled into `TOOL_CALL_ARGS`" half of the acceptance is already true; lock it with a fixture.
- **`summarization_retry_*` out of scope.** The card's acceptance names "each `auto_retry_*` variant"; `summarization_retry_*` are a distinct family with a union payload (`{source:"branchSummary"} | {source:"compaction", reason}`). They share the identical mapper pattern and the identical deadness, so the follow-up is trivial, but folding them in now muddies the acceptance claim. Separate follow-up.

**Blind spots (named separately)**

- The **import/data vantage** (whoever edits `translate.ts`) cannot see from inside the fold that `index.ts`'s subscriptions and the SDK whitelist are what decide whether a mapping ever fires. A "complete" mapper here can look live while being dead.
- The **wiring vantage** (whoever edits `index.ts`) cannot see from inside the render path that the fold's `default: break` at `translate.ts:531` silently drops any variant added without a `case`. Adding a subscription without a switch case produces zero frames and no error — the two edits must land together, which is precisely the seam.
- The **replay vantage** (`replay-adapter.ts`/`history.ts`) cannot see that these are live-only lifecycle events; the risk there is someone "completing" the picture by inventing JSONL `SessionEntry.type`s for them. They have no JSONL counterpart and must not gain one.

**Testable claims**

1. Per new event, a fixture asserts `translate(input, state)` emits **exactly one** `CUSTOM` frame with the exact `name`/`value.pi`/`value.data` from the table. This fails today (variants don't exist), and it is the only guard against the `default: break` silent-drop at `translate.ts:531`.
2. `translate({ event:"tool_execution_update", toolCallId, args, partialResult })` emits exactly one `CUSTOM pi.tool.update` with `data === { toolCallId, args, partialResult }`, and the output contains **no** `TOOL_CALL_ARGS` and **no** frame named `pi.tool.progress`. This locks the partialResult decision.
3. Grep gate: `grep -nE 'deps\.on\("(queue_update|bash_execution_update|auto_retry_start|auto_retry_end)"' index.ts` exits 1 (no matches). This makes "mapper-only, nothing wired" runnable rather than prose.
4. G-11/G-12 purity guards stay green (no clock/entropy/I-O, no socket/session/transport imports in `translate.ts`); `bunx tsc --noEmit` exit 0; `bun test` exit 0 with the new fixtures on top of the 155 baseline.
5. Replay determinism run including the new events: same sequence twice → byte-identical frames. (Trivially passing for stateless CUSTOM rows, but it pins that no hidden state entered the fold.)

**Residuals you'd route**

- **SDK bridge follow-up** (typed-on bridge + `_emitExtensionEvent` forwarder additions for `queue_update`/`bash_execution_update`/`auto_retry_*`) — the actual blocker for runtime observability. Same class as FLLWUP-9. No amount of this card's work changes it; the spec amendment must say so in one evidence-cited sentence.
- **`summarization_retry_*` follow-up** — mapper rows only, same convention, same deadness; file it, don't fold it in.
- **Client tool-UI contract** — `pi.tool.update.data.partialResult` is a snapshot `string?` in the installed SDK. If a future SDK turns `partialResult` into an independent delta stream decoupled from args, the `pi.tool.progress` split becomes worth revisiting. No test settles that today; it's a future-shape judgment, not a correctness question.
- **`pi.session.*` vs a future `pi.run.*` category for retries** — a naming taste difference, no test settles it. I'd route to the PO only if the client contract cares about the category prefix; otherwise `pi.session.*` is consistent with the existing status rows.

Net reframe: the card title says "map the unmapped events," which invites live wiring. The correct frame is "extend the `PiEvent` union + CUSTOM rows, fixture-green, and document that runtime reachability is gated on an SDK bridge." The mapping is the easy 20%; the seam risk is the `default` silent-drop guard and the honesty of the acceptance claim.

**designer (job-42.3, verbatim; full doc also at vault/raw/2026-09-01-design-fllwup-3.md, a designer-written artifact).**

# FLLWUP-3 — designer position

## Approach (2–4 sentences)

The three new event families name different client questions and earn distinct CUSTOM names under the namespaces that match the perceived lane: `queue_update` → `pi.session.queue_update` (session intake snapshot), `bash_execution_update` → `pi.tool.bash_update` (bash-specific streaming, sibling of the existing JSONL `pi.tool.bash_execution`), and the `auto_retry_*` pair → `pi.session.retry_start` / `.retry_end`, with the adjacent `summarization_retry_*` family mirroring under `pi.session.summary_retry_*`. The `partialResult` design splits it out of the existing folded `pi.tool.update` payload into a dedicated `pi.tool.progress` frame (so `tool_execution_update {args, partialResult}` fans into one `pi.tool.update {args}` and one `pi.tool.progress {partialResult}`); the dispatch name then carries the lifecycle question ("is this streaming output or static config?") that the folded shape forces the client to answer by field inspection. The honest delivery claim mirrors FLLWUP-5 §5.4 — contract green today, runtime-observable only when the SDK bridge (FLLWUP-9 or a forwarder patch) lands — and the spec sentence on the PR names the runtime caveat explicitly.

## Tradeoffs accepted

1. **Two retry sub-prefixes** under `pi.session.*` (`retry_*` and `summary_retry_*`) rather than splitting summarization retries into `pi.context.*`. The client-perceived surface is "host is waiting," which is one concept; `pi.context.*` is reserved for one-shot host operations.
2. **Bash-specific name** (`pi.tool.bash_update`) rather than widening `pi.tool.update`. The SDK emits bash deltas on a distinct `AgentSessionEvent`, not the generic `tool_execution_*` lane; the generic name would lie about its generality, and the bash-specific name earns parity with the JSONL `pi.tool.bash_execution`.
3. **Two CUSTOM frames per `tool_execution_update`** when both `args` and `partialResult` are present. An extra frame per update buys dispatch-key clarity: progress consumers subscribe to one name; config consumers subscribe to another; no client inspects payloads to discriminate.
4. **`queue_update` is a snapshot, not a delta.** The SDK payload is `{steering, followUp}`; clients compute their own delta by diffing snapshots. The mapper cannot invent a delta the SDK never emits, and the dispatch name `pi.session.queue_update` (not `queue_changed`) signals that.
5. **Mapper fixture-green only; runtime-observable once the SDK bridge lands.** Same shape as FLLWUP-5 §5.4 acceptance. The §4 / §5.4-adjacent spec sentence names the caveat explicitly; the card claims the contract, not the delivery.

## Falsifiable predictions

- **H1 — Name-routing.** A `pi.tool.*` subscriber gets `pi.tool.bash_update` and `pi.tool.progress`; a `pi.session.*` subscriber gets `pi.session.queue_update`, `.retry_start`, `.retry_end`, `.summary_retry_*`. A pure-seam probe that feeds each new event variant to `translate()` and asserts the dispatch name closes this.
- **H2 — Identity stability across lane transitions.** Tool-progress clients key on `toolCallId`; `pi.tool.progress` arrives before `pi.tool.end`, which arrives before `TOOL_CALL_RESULT`. A CDP smoke that replays the SDK's `{args, partialResult}` payload sequence asserts the order and asserts each `tool_execution_update` produces exactly one `pi.tool.update` (args only) and one `pi.tool.progress` (partialResult only) — never a combined frame.
- **H3 — Bash live/replay distinction.** A live `bash_execution_update` maps to `pi.tool.bash_update`; a JSONL `bash_execution` entry maps to the existing `pi.tool.bash_execution`. Same first segment, distinct second segment — the names do not collapse, and the JSONL replay name is unchanged. Falsifier: a JSONL `bash_execution` entry must NOT produce `pi.tool.bash_update`, and a live `bash_execution_update` must NOT produce `pi.tool.bash_execution`.
- **H4 — Retry-state surface.** `auto_retry_start` → `pi.session.retry_start` with `{attempt, maxAttempts, delayMs, errorMessage}` preserved verbatim in `value.data`; `auto_retry_end` → `pi.session.retry_end` with `{success, attempt, finalError?}` preserved verbatim. No retry-progress frame is emitted during the delay; the client computes the wait from `delayMs`. Falsifier: feed `auto_retry_start` then `auto_retry_end {success:true}` and assert the two CUSTOM names, that the SDK payload fields are preserved, and that no third name appears between them.
- **H5 — Summarization-retry namespace.** All three `summarization_retry_*` events map under `pi.session.summary_retry_*` (not `pi.context.*`, not a flat `pi.session.retry_*` collision). A pure-seam probe feeds the three variants in sequence and asserts the three expected dispatch names in order.
- **H6 — Fold purity.** Translating the new variants adds no entropy, no clock reads, no I/O. G-11 / G-12 grep guards remain green; the new PiEvent variants and their fold cases introduce no new imports. Falsifier: rerun the purity greps against the patched `translate.ts` and confirm each guard returns 1 (zero matches for the forbidden patterns).
- **H7 — `partialResult` ordering.** When `tool_execution_update` carries both `args` and `partialResult`, the emitted frames are ordered `pi.tool.update` then `pi.tool.progress` in the same batch. A client that renders the static-args mirror first and the streaming pane second will not flicker. Falsifier: feed `tool_execution_update {args:{cmd:"ls"}, partialResult:"a\n"}` and assert the resulting `frames` array's order.
- **H8 — Runtime caveat carried on the spec.** The §4 / §5.4-adjacent spec sentence the PR carries explicitly states these events are not bridgeable from `ExtensionAPI.on()` in the installed SDK, with a follow-up card pending. Falsifier: read the merged spec; the caveat must appear in the same paragraph that documents the new mappings.
- **H9 — Manual construction at every new subscription.** When the SDK bridge lands, `index.ts` uses the FLLWUP-5 S-O2 pattern at every new subscription: `forward({ event: "queue_update", steering, followUp })`, never `ev as PiEvent`. Falsifier: `grep "as PiEvent" index.ts` returns no matches at any new site.

## Residuals to route

1. **SDK bridge card naming and scope.** The mapper work is independently valuable (fixture-green tests the contract end-to-end); delivery is gated on whether FLLWUP-9 (typed-on bridge) covers these events or whether a separate SDK forwarder-patch card is needed. Product-owner call.
2. **Summarization-retry family — in scope here or own card?** Mechanically identical to `auto_retry_*` (same PiEvent-variant-and-case pattern, same reachability caveat). My position is to land both in FLLWUP-3 to avoid a follow-up whose only purpose is the family-boundary call. The opposite position — summarization retries are host-internal and the client cannot act on them, so omit — is defensible. Either way consistent with the acceptance.
3. **`queue_update` null-state UX.** When `steering` and `followUp` are both empty, the mapper faithfully emits the snapshot; there is no separate `queue_drained` event (the SDK doesn't emit one). The client filters at its layer. Honest contract: the snapshot each time; the client decides what counts as "drained."
4. **`partialResult: ""` semantics.** Empty-string partialResult produces one `pi.tool.progress` frame per update even when the streaming output is empty. The mapper cannot distinguish "real empty delta" from "config-only update" — the SDK payload shape doesn't disambiguate. Surfacing for the consolidator; my lean is to emit faithfully and let the client filter.
5. **`bash_execution_update` buffering decision.** Whether the remote client renders the bash stream live or waits for completion is a client-layer decision; the mapper preserves the SDK's delta order and lets `pi.tool.end` signal completion. No mapper change needed; noted because the question will be asked.
6. **`auto_retry_*` vs `pi.session.info_change` overlap.** The SDK emits retry events on a dedicated channel with structured fields; the mapper can faithfully forward both `pi.session.info_change` and `pi.session.retry_*` without one overriding the other. Noted to head off "isn't info_change already covering this?": it isn't.

### Resumption record (runner 2, 2026-09-01)

Environment repaired per the HALT's stated precondition: repo commit `d786c77` ("chore: update council seat models") updated `.council.json` — owner seat is now `openrouter/z-ai/glm-5.3-flash` (thinking: high), a different model. Seat resolution verified: the packaged seat set resolves; owner dispatchability is tested empirically by the round-2 dispatch below. Per the resume instruction, the owner is NOT re-dispatched for round 1 — its first position enters at round 2 alongside principal's and designer's responses to the other positions. Resuming council.md step 3 at round 2 (exchange cap ≤3 rounds; 0 step-3 rounds consumed; step-2 first pass recorded above).

### Round outcome (facilitator record)

Three-generator first pass produced TWO complete positions (principal, designer) and the owner seat failed to produce any position across its initial dispatch and its single permitted re-dispatch (dispatch discipline: no third dispatch; do not proceed past a seat that has not produced its output). Deliberation is INTACT for the resumed run but cannot proceed inside this container: the owner is the step-8 implementation seat and has demonstrated it cannot emit bounded output — routing around it is forbidden, and proceeding would fail step 8. Run halts per dispatch discipline; the run's durable state (principal + designer positions verbatim above, owner failure log) is on this card and the board for a resumed runner. Also recorded for the resumed run: principal's proposed mapping table and grep gate; designer's H1–H9 predictions and residuals (SDK bridge follow-up; summarization_retry_* in-scope question; queue null-state, partialResult:"" semantics, bash buffering, retry/info_change overlap).

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
