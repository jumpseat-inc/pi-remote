---
id: FLLWUP-3
title: "Map EV-4's unmapped live pi events (queue_update, bash_execution_update, auto_retry_*)"
state: In Review
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

### Step 4 — skeptic dispatch attempts (runner 3, 2026-09-01) — BOTH DIED ON PROVIDER ERRORS, step 4 remains OPEN

Two consecutive skeptic dispatches, both killed by provider connection errors, neither recorded any result on this card:

- **job-2.1** (20-min window): ran 28 turns actively verifying claims (last visible finding, verbatim: "5 frames from 1 event — noting that. Now probing the `partialResult` typing against the real SDK payload."), then died on provider error `Request timed out.` Turns flat at 28 across two consecutive wait windows — dead, not slow. Cancelled per dispatch discipline.
- **job-2.2** (re-dispatch, same input + resume fragment above): died at 8.9 min / turn 8 on provider error `Request timed out.` (state=done, stopReason=error). No deliverable.

Per dispatch discipline (a seat that produces no output across its window and one re-dispatch is a halt; no third dispatch), the run halts here. NO skeptic objections or test results are recorded from these attempts — the resumed runner must re-run step 4 from a fresh skeptic dispatch. The "5 frames from 1 event" fragment suggests the dead instance may have found a fan-out anomaly (possibly the O2 fixture's `tool_execution_update` producing more frames than expected under some probe); treat it as an unverified lead, not a result.

### Step 4 resume (runner 4, 2026-09-01) — fresh skeptic dispatched

Orchestrator probed the provider directly: both the skeptic's model and the other seats' models respond normally — the two step-4 deaths were transient. No deliberation content is redone; steps 1–3 stand as recorded above (round 3 FINAL, cap reached). A FRESH skeptic is dispatched with the full deliberation record (the card file itself). One unverified lead from the dead job-2.1's log fragment — "5 frames from 1 event" (possibly a fan-out anomaly around the O2 fixture's `tool_execution_update`) — is handed to the skeptic as an open question to settle or leave open with a named test, NOT as a finding.

### Step 4 resume (runner 4, 2026-09-01) — skeptic dispatch log (SUPERSEDED by the step-4 closure above; provider instability was later repaired by commit 788792b)

- **job-3.1** (20-min window): ran 15 turns / 11.5m, died on provider error `Request timed out.` (state=done, stopReason=error). No output recorded. Re-dispatched once per dispatch discipline.
- **job-3.2** (re-dispatch, same input): ran 18 turns / 20.4m to its full window, died on provider error `Request timed out.` (state=timeout, stopReason=error). No output recorded; job cancelled.

Per dispatch discipline AND the standing resume instruction ("if the skeptic dies on provider errors across its window and one re-dispatch, that is a HALT"), the run HALTS here at step 4. FOUR skeptic dispatches have now died on provider timeouts across two containers (job-2.1, job-2.2, job-3.1, job-3.2) while owner/principal/designer dispatches succeed — the instability is specific to the skeptic seat's model/usage pattern, not the provider as a whole. NO skeptic objections or test results are recorded from any attempt; step 4 remains OPEN. A resumed runner must dispatch a fresh skeptic with the full deliberation record (this card) — or the orchestrator must first repair the skeptic seat's provider path (e.g. model change per the `d786c77` precedent that fixed the owner seat). The "5 frames from 1 event" lead remains UNVERIFIED — an open question for the fresh skeptic, not a finding.

### Step 4 — skeptic results (runner 5, 2026-09-01; job-1.1 hung/cancelled, job-1.2 settled — step 4 CLOSED)

Environment: skeptic seat model repaired upstream (commit 788792b, now `deepseek-v4-flash-0731` thinking high). job-1.1 ran 10 turns, completed its probes, then hung mid-gate on a provider call (turns flat, no child processes) — cancelled per dispatch discipline; re-dispatched once as job-1.2 with the same input plus a resume note. **job-1.2 settled in 24.5m / 19 turns.** Skeptic verdict verbatim below.

- **O-1 — closed-RED:** the round-3 record's "key verified fact" that `tool_execution_update` has no producer is FALSE on its producer half. `extensions/types.d.ts:935` has a typed `on(event: "tool_execution_update", ...)` overload and `agent-session.js:537-546` forwards `{toolCallId, toolName, args, partialResult}` to extensions. `tool_execution_update` IS bridgeable at runtime; the only "no consumer" half holds (root `index.ts:585-615` has no `tool_execution_*` subscription — dead-wiring grep exit 1). Consequence: the split changes the frame shape of a **live-capable** event, not a dead one; the spec-amendment runtime-unreachability caveat must be scoped to the four new families only (`queue_update`, `bash_execution_update`, `auto_retry_*`, `summarization_retry_*`), never covering `pi.tool.update`/`pi.tool.progress`. The split decision itself survives — O-1 falsifies the record's factual basis and the caveat's planned scope, not the mapping.
- **O-2 — closed-green:** SDK payload shapes for all mapped events match the majority tables verbatim (`agent-session.d.ts:46-103` read directly).
- **O-3 — closed-green:** the four new families ARE unreachable via `ExtensionAPI.on()` (35 typed `on()` names grepped, none of queue/bash/retry; forwarder whitelist = agent/turn/message/tool_execution) — the precise boundary making O-1's correction scoped, not wholesale.
- **O-4 — closed-green (OPEN QUESTION SETTLED):** no "5 frames from 1 event" anomaly exists in the `tool_execution` lane. Enumeration probe: current fold → 1 frame per `tool_execution_update{both}`; O2 → 3; settled split → max 2/update, O2 → 4. The only 1-event→5-frame shape in the codebase is `message_update` with events `[thinking, text]` (5 frames: REASONING_START/CONTENT/END + TEXT_START/CONTENT — probe-verified). The dead job-2.1 fragment most plausibly conflated the message lane. No fan-out anomaly; no finding.
- **O-5 — open-UNTESTED (design gap, owner must close):** the settled conditional-emission matrix has no "neither field present" case — `{event:"tool_execution_update", toolCallId:"t"}` emits 0 frames silently (mimic probe demonstrated), reintroducing the `default: break` silent-drop trap class inside the split case. SDK's own `ToolExecutionUpdateEvent` types both fields non-optional so practical risk is low, but the union accepts the neither-case. Settling test for the owner: fixture asserting the neither-case emits exactly 0 frames (pinned as intended), or tighten the union.
- **O-6 — closed-green:** no sub-category `startsWith` prefix dispatch exists in the codebase (only category-level `"pi.tool."`, `"pi."`); long-bash-name decision stands as taste, not falsified.
- **O-7 — closed-green:** baseline gates confirmed — `bunx tsc --noEmit` exit 0; `bun test` 155 pass / 0 fail / 869 expect, exit 0, purity guards included. (Failure-injection not rerun: dispatch was read-only; guards' failure capability attested by EV-4 record.)
- **O-8 — closed-green:** dead-wiring grep (all seven names) exit 1; `as PiEvent` in index.ts exit 1; `summarization_retry` in translate.ts exit 1. Today's state is exactly "nothing wired, nothing mapped."
- **O-9 — closed-green:** `SessionEntry` union has no `tool_execution_*` kind (`replay-adapter.ts:21-38`); replay-asymmetry structurally impossible; JSONL `bash_execution` → `pi.tool.bash_execution` unchanged.
- **O-10 — closed-green:** O2 fixture mechanics — 3→4 update is real and `startsWith("pi.tool.")` (line 183) survives it (all four split names satisfy the prefix).

Net: all mapping decisions survive with closed-green support. Two items ride into implementation: (a) O-1's caveat-scope correction + record correction (facilitator applies here; spec amendment scoped accordingly); (b) O-5's neither-case pinning fixture added to the owner's settled fixture list.

### Step 5 — consolidator synthesis (runner 5, 2026-09-01; job-1.3, verbatim)

## FLLWUP-3 — Consolidation Report

### Agreed Design

All three seats converged on the following as a shared baseline (verbatim from the round-3 FINAL mapping tables, reconciled across owner/principal/designer):

| PiEvent | CUSTOM `name` | `value.pi` | `value.data` |
|---|---|---|---|
| `queue_update` | `pi.session.queue_update` | `"queue_update"` | `{ steering, followUp }` verbatim |
| `bash_execution_update` | *see Open Judgment J-1* | `"bash_execution_update"` | `{ id?, delta }` verbatim |
| `auto_retry_start` | `pi.session.retry_start` | `"auto_retry_start"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `auto_retry_end` | `pi.session.retry_end` | `"auto_retry_end"` | `{ success, attempt, finalError? }` verbatim |
| `tool_execution_update` (args present) | `pi.tool.update` | `"tool_execution_update"` | `{ toolCallId, args }` |
| `tool_execution_update` (partialResult present) | `pi.tool.progress` | `"tool_execution_update"` | `{ toolCallId, partialResult }` |
| JSONL `bash_execution` (replay, unchanged) | `pi.tool.bash_execution` | passthrough | unchanged |

**Unanimously agreed structural decisions (all three seats, no dissent in round 3):**
- Mapper-only, no `index.ts` wiring; manual PiEvent construction per FLLWUP-5 S-O2 when SDK bridge lands.
- Conditional-emission split: emit `pi.tool.update` only when `args !== undefined`; emit `pi.tool.progress` only when `partialResult !== undefined`; when both present, emit `update` then `progress` in that order; `partialResult: ""` is present and emits.
- `toolCallId` on both split frames.
- O2 fixture (`test/translate.test.ts:170-185`) updated from 3→4 frames in the same commit; `startsWith("pi.tool.")` survives for both names.
- `summarization_retry_*` in scope (majority owner+designer IN, 2-1; principal OUT as minority — recorded majority holds).
- Purity gates: `bunx tsc --noEmit` exit 0; `bun test` exit 0 (155 baseline + new fixtures); G-11/G-12 grep guards green.
- Spec amendment carries runtime-unreachability caveat; per O-1's correction, caveat scoped to four new families only (`queue_update`, `bash_execution_update`, `auto_retry_*`, `summarization_retry_*`), never covering `pi.tool.update`/`pi.tool.progress`.
- Dead-wiring grep over all new event names in `index.ts` exits 1.

**Settled disputes (each closed by a specific test result or unanimous convergence):**

- **S-1.** SDK payload shapes match majority tables verbatim — closed by O-2 (closed-green): `agent-session.d.ts:46-103` read directly.
- **S-2.** Four new families unreachable via `ExtensionAPI.on()` — closed by O-3 (closed-green): 35 typed `on()` names grepped, none match; forwarder whitelist confirmed.
- **S-3.** `tool_execution_update` IS bridgeable at runtime (record correction) — closed by O-1 (closed-red): typed `on("tool_execution_update")` overload at `extensions/types.d.ts:935`; forwarder at `agent-session.js:537-546`. Consequence settled: spec caveat scoped to the four new families only, excluding `pi.tool.update`/`pi.tool.progress`. The split decision survives.
- **S-4.** No fan-out anomaly ("5 frames from 1 event") — closed by O-4 (closed-green): the only 1-event→5-frame shape is `message_update` with `[thinking, text]` events; the dead fragment conflated the message lane.
- **S-5.** Baseline gates confirmed — closed by O-7 (closed-green): tsc exit 0; bun test 155/0/869; purity guards included.
- **S-6.** Today's state: nothing wired, nothing mapped — closed by O-8 (closed-green): all three greps exit 1.
- **S-7.** Replay-asymmetry structurally impossible — closed by O-9 (closed-green): no `tool_execution_*` kind in `SessionEntry`.
- **S-8.** No sub-category startsWith prefix dispatch exists — closed by O-6 (closed-green): only category-level idioms. Prefix-collision argument speculative as a codebase property.
- **S-9.** O2 fixture mechanics: 3→4 real — closed by O-10 (closed-green): `startsWith("pi.tool.")` survives all four split names.
- **S-10.** Retry names `pi.session.retry_start`/`pi.session.retry_end` — settled by unanimity in round 3 (all three seats hold; owner explicitly conceded); `value.pi` carries raw names so no information lost.

**Open judgment — for product-owner, escalating to steward:**

- **J-1. Bash name: `pi.tool.bash_execution_update` (long) vs `pi.tool.bash_update` (short).** Recorded majority 2-1 for LONG (owner+principal; designer minority for short). Positions: long = SDK taxonomy fidelity, live/replay distinction reads off `_update` suffix against JSONL `pi.tool.bash_execution`, maintainer greppability, prefix collision hypothetical (O-6); short = first-time-reader test, dispatch key carries the client-perceived concept. No test settles naming taste. Routes to product-owner. Either ruling pairs with a doc-comment serving the losing concern.
- **J-2. `summarization_retry_*` scope: IN vs OUT.** Recorded majority 2-1 for IN (owner+designer; principal minority OUT). IN: the card's intent explicitly delegates the family-boundary call to this deliberation; `CustomFrame.value.data` typed `unknown` verbatim passthrough needs zero normalization; deferral costs a trivial card. OUT: union payload needs its own fixtures; one-name-vs-two-names sub-question unresolved; folding in muddies a homogeneous `retry_*` contract for zero user-visible gain (all dead at runtime). No test settles scope preference. Routes to product-owner. If IN, J-3 must also be settled; if OUT, a scoped follow-up card is filed.
- **J-3. `summarization_retry_attempt_start` naming: one name vs two by `source`.** No majority (owner: one name, union verbatim, consistent with `queue_update` snapshot fidelity; designer: two names `summary_retry_branch`/`summary_retry_compaction`, dispatch-key clarity; principal: no lean recorded). 1-1-0 split. No test settles naming taste. Routes to product-owner (moot if J-2 resolves OUT).

**Spec conventions — ride as stated contract, no PO routing needed:**

- **C-1. `partialResult: ""` semantics.** Empty string is present and emits a `pi.tool.progress` frame; pinned in fixture. Unanimous. Stated convention.
- **C-2. `queue_update` null-state UX.** Snapshot-faithful; no separate `queue_drained` event (SDK doesn't emit one); client filters at its layer. Unanimous. Stated convention.
- **C-3. Doc-comment future-split trigger — MOOT** (the split landed; owner flagged the trigger text obsolete in round 3). The designer's surviving alternative is carried into implementation: the doc-comment at the split case site records the **conditional-emission rule and the H2/H7 rationale**. Settled consequence of the split, not a new judgment call.
- **C-4. `bash_execution_update` buffering at the client layer.** Out of mapper scope; mapper preserves SDK delta order; `pi.tool.end` signals completion. Unanimous.

**Open objections:**

- **O-5 — open-UNTESTED (design gap, owner must close during implementation):** the conditional-emission matrix has no neither-field case; `{event:"tool_execution_update", toolCallId:"t"}` emits 0 frames silently. Closes by: owner adds a fixture asserting the neither-case emits exactly 0 frames (pinned as intended), OR tightens the union/transform to reject the neither-case at the type level. Implementation work, not a deliberation question; must not be skipped.
- **O-1 consequence — settled by O-1's closed-red result, implementation required:** spec amendment caveat scoped to the four new families only, explicitly excluding `pi.tool.update`/`pi.tool.progress`. Rides with the implementation.

**Handoff status:** blocked pending J-1, J-2, and (if IN) J-3 rulings — fixture names cannot lock until the bash name is pinned and summarization scope confirmed. Once ruled, remaining work is mechanical from the settled design.

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

### Step 3 — bounded exchange

#### Round 2 (owner job-1.1, principal job-1.2, designer job-1.3 — all settled)

**Round outcome (facilitator record).** Positions CROSSED, did not converge: the principal conceded to designer's round-1 (split, summarization_retry in-scope, short bash name); the designer conceded to principal's round-1 (no split, summarization out, long bash name); the owner (first position, saw only round-1 material) endorsed principal's round-1 verbatim (raw names, summarization out, no split). Every disputed point is live with a 2-vs-1 shape: split (2 no-split: owner+designer vs 1 split: principal); summarization (2 out vs 1 in); bash name (2 long vs 1 short); retry name (2 short `pi.session.retry_*` vs 1 raw `pi.session.auto_retry_*`). Majority is recorded as a fact, not a decision — round 3 (final under the cap) is dispatched with each seat seeing the other two round-2 positions. Principal's round-2 also surfaced a concrete mechanical finding: the split breaks the existing O2 fixture (`test/translate.test.ts:170-185`, 3 frames → 4) and the PiEvent's independently-optional `args?`/`partialResult?` fields mean designer's H2 "exactly two frames" over-claims (conditional emission required).

**owner (job-1.1, verbatim).**

Verification done. Facts confirmed against the working tree: `translate.ts:452–461` folds `partialResult` into `pi.tool.update` data alongside `args`; `translate.ts:531–533` is the silent `default: break` guard; `index.ts` has live subs only for `agent_*`, `turn_*`, `message_*`, `tool_result`, `ui.confirm`, `ui_prompt_end` — no `tool_execution_*`, no queue/retry/bash-delta subs — and its local `ExtensionAPI.on` is the permissive `on(event: string, ...)` (index.ts:46), so a dead subscription would compile. Replay maps JSONL `bash_execution` → `pi.tool.bash_execution` (translate.ts:324–326). One precedent note both seats glossed: `session_info_changed` → `pi.session.info_change` shows the codebase does *not* follow a strict raw-name rule, so naming for new events is a fresh call, not an inherited one.

Position follows.

## owner position — FLLWUP-3, round 2

### (a) Approach

Both seats agree on the load-bearing facts (unreachable via `ExtensionAPI.on()`, mapper-only fixture-green delivery, manual PiEvent construction, purity guards) — the disagreements are two naming/scope calls and one representation call. I hold with **principal** on all three: raw-name CUSTOM names for the new events, `summarization_retry_*` routed out as a named follow-up, and `partialResult` kept folded — but I adopt **designer's** non-collapse fixture (H3) and her framing that the family-boundary call itself is in scope (the call is "out", which satisfies it). The deciding criterion throughout: these events cannot fire at runtime in the installed SDK, so every expansion of scope here is contract surface we must maintain forever in exchange for zero observable behavior today.

### (b) Proposed mapping table

| PiEvent | CUSTOM `name` | `value.data` | Note |
|---|---|---|---|
| `queue_update` | `pi.session.queue_update` | `{ steering, followUp }` | Both seats agree. Snapshot, not delta. |
| `bash_execution_update` | `pi.tool.bash_execution_update` | `{ id?, delta }` | Raw SDK name; distinct from JSONL `pi.tool.bash_execution`. |
| `auto_retry_start` | `pi.session.auto_retry_start` | `{ attempt, maxAttempts, delayMs, errorMessage }` | Raw name; symmetric with the end frame. |
| `auto_retry_end` | `pi.session.auto_retry_end` | `{ success, attempt, finalError? }` | |
| `summarization_retry_*` | — (not mapped) | — | Out of scope; routed as follow-up (see (c) #2). |
| `tool_execution_update` (partialResult) | unchanged: `pi.tool.update` | `{ toolCallId, args?, partialResult? }` | No split; no `pi.tool.progress` frame. |

### (c) Tradeoffs — concessions and holds

1. **Naming — HOLD against designer, with her objection answered.** Designer shortens (`pi.tool.bash_update`, `pi.session.retry_start/end`); I keep raw SDK names. Her tradeoff #2 (bash-specific name, not widening `pi.tool.update`) argues against a position principal doesn't hold — `pi.tool.bash_execution_update` is already bash-specific, so that point doesn't discriminate. My deciding argument is maintenance: when the SDK bridge lands, a maintainer reading `agent-session.d.ts` greps the exact SDK event name and finds the mapping with zero translation table in their head. Designer's retry scheme is also asymmetric — it *drops* the `auto_` qualifier from the generic family but *keeps* a qualifier for `summary_retry_*`; the moment the summary family lands, `retry_start` vs `summary_retry_start` forces a client to know which qualifier means "generic" rather than reading the name. Raw names make the later family `pi.session.summarization_retry_*` by the same rule. I concede the `info_change` precedent shows raw names aren't a codebase-wide rule — this is a stated convention for *new* events, not a claimed invariant.
2. **`summarization_retry_*` boundary — HOLD with principal, but the call is made.** Designer's point that the follow-up card's "only purpose is the family-boundary call" is true but not disqualifying: this deliberation *makes* the boundary call (answer: out), which is what the card demands. Principal's scope argument is decisive on the merits: the acceptance text names "each `auto_retry_*` variant"; the summary family carries a union payload (`{source:"branchSummary"} | {source:"compaction", reason}`) needing its own fixtures; and since neither family is runtime-reachable, inclusion buys nothing user-visible now. Cost of deferral: one trivial card. Cost of inclusion: larger diff, re-worded acceptance mid-deliberation, twice the dead-contract surface.
3. **partialResult — HOLD with principal against designer's split.** Three reasons, in weight order: (i) *Scope* — the card's goal is mapping **unmapped** events; `partialResult` is already mapped and tested; splitting changes the data shape of an existing documented CUSTOM name mid-epic for zero runtime gain (verified: `index.ts` has no `tool_execution_*` subscription, so neither shape is live). (ii) *Wire cost* — the SDK delivers `{args, partialResult}` as one event on a potentially high-frequency stream (bash/long tool output); designer's fan-out doubles frame volume per update and invents an ordering guarantee (her H7) the client must now rely on. (iii) *Discrimination cost is low* — `data.partialResult === undefined` is typed field inspection on a two-field payload, not payload archaeology. Designer's dispatch-key ideal is right in principle, but the binding context explicitly makes `pi.tool.progress` conditional on deliberation adoption, and the trigger for adopting it (SDK decoupling partialResult from args) does not exist. I concede her H3 non-collapse fixture regardless — it's good hygiene under either scheme.
4. **Accepted by everyone:** mapper-only, no `index.ts` wiring, honest fixture-green acceptance claim, spec amendment carrying the runtime-unreachability caveat, manual PiEvent construction (FLLWUP-5 S-O2), no `TOOL_CALL_ARGS` smuggling.

### (d) Falsifiable testable claims

1. **Per-event single-frame fixture (settles the `default: break` silent-drop).** For each of the four new variants: `translate(<event>, freshState)` emits **exactly one** `CUSTOM` frame whose `name`, `value.pi`, and `value.data` equal the table. Fails today (variants don't exist in the union); the only guard against `translate.ts:531`.
2. **partialResult lock (settles decision 2 against the split).** `translate({event:"tool_execution_update", toolCallId:"t1", args:{cmd:"ls"}, partialResult:"a\n"}, freshState)` emits **exactly one** frame — not two — named `pi.tool.update` with `value.data === {toolCallId, args, partialResult}`; output contains no `TOOL_CALL_ARGS` and no `pi.tool.progress`. This is the direct falsifier of designer's H2/H7: if anyone implements the split, this test goes red.
3. **Dead-wiring grep gate (makes "mapper-only" runnable).** `grep -nE 'deps\.on\("(queue_update|bash_execution_update|auto_retry_start|auto_retry_end)"' index.ts` exits 1. Necessary because index.ts:46's permissive `on(event: string)` means the compiler will *not* catch a dead subscription.
4. **Out-of-scope grep gate (settles the family boundary).** `grep -n 'summarization_retry' src/translate.ts` exits 1 — mechanical proof the summary family didn't get folded in.
5. **Live/replay non-collapse (adopted from designer H3).** A JSONL `bash_execution` entry produces `pi.tool.bash_execution` and never `pi.tool.bash_execution_update`; a live `bash_execution_update` produces `pi.tool.bash_execution_update` and never `pi.tool.bash_execution`. Two fixtures, cross-asserting the negative.
6. **Gates.** G-11/G-12 purity greps green; `bunx tsc --noEmit` exit 0; `bun test` exit 0 at 155 + all new fixtures; determinism: new-event sequence translated twice → byte-identical frames.

### (e) Residuals to route

- **SDK bridge card** (typed `on` overloads + `_emitExtensionEvent` forwarder additions) — the actual runtime blocker; FLLWUP-9 class. The spec amendment must state unreachability in one evidence-cited sentence.
- **`summarization_retry_*` follow-up card** — mapper rows only, same pattern/deadness; include the union-payload fixture design there.
- **partialResult revisit trigger** — if a future SDK decouples `partialResult` into an independent delta stream, reopen `pi.tool.progress`. No test settles it today; recorded, not solved.
- **Category-prefix taste** (`pi.session.*` vs a future `pi.run.*` for retries) — unroutable by test; keep `pi.session.*` consistent with existing status rows; PO decides only if the client contract ever cares.
- **Permissive `deps.on` type** (index.ts:46) — the grep gate guards this card, but tightening that signature is FLLWUP-9-adjacent hygiene worth a line on that card.

Deliberation only — no files touched, no mutating commands run.

**principal (job-1.2, verbatim).**

## (a) What changed in my position — three concessions

1. **partialResult split — I concede the split.** The designer's dispatch-key-clarity argument is correct, and it's confirmed by the codebase's own convention: `model_select` → `pi.session.model_change`, `session_info_changed` → `pi.session.info_change`, `session_compact` → `pi.context.compaction` (`src/translate.ts:519-536`). This mapper renames to the *client-perceived concept*, not the raw event name. Folding `partialResult` into `pi.tool.update.data` was status quo, not a design. I concede to two frames, **with one refinement** (below).

2. **`summarization_retry_*` in scope — I concede.** My round-1 "union payload" objection dissolves on inspection: `value.data` is typed `unknown` and the fold passes it through verbatim (`CustomFrame` at `src/translate.ts:74`), so `{source:"branchSummary"} | {source:"compaction", reason}` needs zero normalization. The designer is right that a follow-up whose only purpose is the family-boundary call is overhead — and the family-boundary call *is* what this card delegated.

3. **Bash naming — I concede `pi.tool.bash_update`.** There is a concrete correctness argument I missed in round 1: my `pi.tool.bash_execution_update` makes the replay name `pi.tool.bash_execution` a **strict prefix** of the live name. A client doing `name.startsWith("pi.tool.bash_execution")` to catch replays would silently also catch live deltas. The designer's `pi.tool.bash_update` shares only `pi.tool.bash_` with the replay name — no prefix collision. Right call.

## (b) What I hold, and why

**One refinement to the split — conditional emission.** The `PiEvent` union marks both fields optional: `{ event: "tool_execution_update"; toolCallId: string; args?: unknown; partialResult?: string }` (`src/translate.ts:138`). The designer's H2 asserts "exactly one `pi.tool.update` + one `pi.tool.progress` per update" — that over-claims and would emit `pi.tool.progress {partialResult: undefined}` for a config-only update. Hold: emit `pi.tool.update` only when `args !== undefined`, emit `pi.tool.progress` only when `partialResult !== undefined`, order update-then-progress when both present.

**Both split frames must carry `toolCallId`.** The designer's H2 says progress clients key on `toolCallId`, but its table never says the progress frame *contains* it. It must: `pi.tool.progress.data === { toolCallId, partialResult }`, and `pi.tool.update.data === { toolCallId, args }`.

**The existing O2 fixture breaks and nobody's flagged it.** `test/translate.test.ts:170-185` feeds `start → update{args,partialResult} → end` and asserts `frames.map(f => f.type)` equals exactly `["CUSTOM","CUSTOM","CUSTOM"]` — three frames for three inputs. With the split, `update` fans out and the sequence becomes four frames. This test **must be updated as part of the split**, or `bun test` goes red. The design seat cannot see this from the design-doc vantage; it's exactly the kind of seam detail that sinks an otherwise sound decision.

**The real seam risk remains `default: break` at `src/translate.ts:531`.** Adding a `PiEvent` variant without a matching `case` silently emits zero frames. My round-1 claim #1 (one fixture per new event asserting the exact frame) is the only guard. This is the blind spot the import/data vantage has: the fold *looks* complete while silently dropping.

**Mapper-only, no `index.ts` wiring, runtime caveat in spec.** Unchanged — confirmed again that `index.ts:581-615` has zero `tool_execution_*` subscriptions and the SDK whitelist won't deliver any of these events. Both seats already agree; keep it.

**Blind spots, named separately:**
- *Design seat* cannot see that its H2 contradicts the optional-field types, and that the split breaks the existing 3-frame O2 fixture — both are in `translate.ts`/`test/translate.test.ts`, which the design-doc vantage doesn't read.
- *Import/data seat* (my round-1 vantage) cannot see that "already folded" is status-quo defense, not design — the rename convention it lives next to argues *for* the split.
- *Wiring seat* cannot see that subscriptions added without fold cases produce zero frames (`default: break`), and that the SDK whitelist means "live" is a lie without an SDK bridge.

## (c) Converged mapping table (as I now see it)

| PiEvent / entry | CUSTOM `name` | `value.data` |
|---|---|---|
| `queue_update` | `pi.session.queue_update` | `{ steering, followUp }` verbatim |
| `bash_execution_update` | `pi.tool.bash_update` | `{ id?, delta }` verbatim |
| `auto_retry_start` | `pi.session.retry_start` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `auto_retry_end` | `pi.session.retry_end` | `{ success, attempt, finalError? }` verbatim |
| `summarization_retry_scheduled` | `pi.session.summary_retry_scheduled` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `summarization_retry_attempt_start` | `pi.session.summary_retry_attempt_start` | `{ source }` union verbatim |
| `summarization_retry_finished` | `pi.session.summary_retry_finished` | `{}` |
| `tool_execution_update` (args present) | `pi.tool.update` | `{ toolCallId, args }` |
| `tool_execution_update` (partialResult present) | `pi.tool.progress` | `{ toolCallId, partialResult }` — emitted *after* `pi.tool.update` when both present |
| JSONL `bash_execution` (replay, unchanged) | `pi.tool.bash_execution` | passthrough (`src/translate.ts:324-325`) |

Retry naming note: I adopt the designer's `pi.session.retry_start/end` (dropping `auto_`) over my `auto_retry_*` — settled by the rename convention, not by test.

## H1–H9 classification

- **H1** — already covered by my round-1 claim #1 (per-event exact-name/value fixture).
- **H2** — **needs a new test, and correction**: conditional emission (not "exactly two frames always"), `toolCallId` asserted on both frames. Also requires updating the existing O2 fixture (`test/translate.test.ts:170-185`).
- **H3** — **needs a new test** for the live side; the JSONL side is already pinned by the existing test at `test/translate.test.ts:379`. Endorse the falsifier as stated.
- **H4** — covered by claim #1's pattern; the `auto_retry_*` fixtures still need to be written. Endorse.
- **H5** — **needs a new test** (now in scope); assert verbatim union passthrough.
- **H6** — already covered by my round-1 claim #4 (G-11/G-12 greps, `tsc`, `bun test`).
- **H7** — **the new test that settles disagreement #1** (see below). Endorse.
- **H8** — untestable at the mapper layer (prose/spec-artifact check); route to the consolidator as an acceptance item.
- **H9** — untestable now (this card adds no subscriptions); my round-1 grep gate (claim #3: no `deps.on("queue_update|bash_execution_update|auto_retry_*")` in `index.ts`) is the runnable proxy today. H9 proper belongs to the future SDK-bridge card.

**Settling test for disagreement #1:** feed `{ event:"tool_execution_update", toolCallId:"c", args:{cmd:"ls"}, partialResult:"a\n" }` → frames array is exactly `[ {CUSTOM, name:"pi.tool.update", value:{pi:"tool_execution_update", data:{toolCallId:"c", args:{cmd:"ls"}}}}, {CUSTOM, name:"pi.tool.progress", value:{pi:"tool_execution_update", data:{toolCallId:"c", partialResult:"a\n"}}} ]` in that order; plus `args`-only → one `pi.tool.update` and zero `pi.tool.progress`; `partialResult`-only → one `pi.tool.progress` and zero `pi.tool.update`.

## (d) Remaining open items for the consolidator

1. **Update the O2 fixture** (`test/translate.test.ts:170-185`) in the same commit as the split — 3 frames becomes 4. Not optional.
2. **Spec amendment sentence (H8)** must carry the runtime-unreachability caveat in the same paragraph as the new mappings — evidence-cited, per EV-1 Q3 / EV-4 Q1.
3. **`pi.session.retry_*` vs `pi.session.auto_retry_*`** — I adopt the designer's shorter form per convention, but this is taste, not test. PO tie-break only if the client contract cares about the literal prefix; otherwise `retry_start/retry_end` stands.
4. **`partialResult:""` semantics** (designer residual #4) — under conditional emission, empty string *is* present and emits a `pi.tool.progress` frame. State that explicitly in the fixture so the empty-delta behavior is pinned, not accidental.
5. **Reframe, stated**: the card is not "map the unmapped events" (invites live wiring) and not my round-1 "extend union, fixture-green, keep folding" (too conservative). It is: *settle the client-perceived dispatch contract for three currently-dead event families AND split the one live event's two fields into distinct dispatch keys — fixture-green, with the runtime caveat carried in spec and the `default: break` silent-drop guard covered by a fixture per event.* The proposed design is now sound; the remaining risk is entirely in the two mechanical details the design seat can't see: the optional-field emission rule and the broken O2 fixture.

**designer (job-1.3, verbatim).**

Three verifications ground my round-2 reasoning:

1. The principal's claim that `partialResult` is **already folded into the existing `pi.tool.update` data** (not dropped) is correct. `translate.ts:452-458` shows `data: { toolCallId, args, partialResult }`.
2. The PiEvent union signature (line 138) is `tool_execution_update` carrying `{toolCallId, args?, partialResult?}` — both fields are independently optional on the **same event**. That is what the principal means by "atomicity."
3. The `summarization_retry_attempt_start` payload is genuinely a discriminated union (`{source:"branchSummary"} | {source:"compaction", reason}`) — confirmed in the facilitator's binding context, and that union shape matters for the mapper contract.

Three falsifiers the principal did NOT supply, but which I can derive now, that my round-1 predictions were already covering: H2 (split produces exactly one `pi.tool.update` and one `pi.tool.progress`) — this overlaps with principal's claim 2 in form. H5 covers summarization retries — overlaps with the boundary question. H6 (purity) — overlaps with principal's claim 4.

Now I can write the round-2 position.

# FLLWUP-3 — designer round-2 position

**Card context.** Round-1 produced the principal's mapper-only, fixture-green, atomicity-preserved framing and my split-second, three-namespace, summarization-retry-in framing. Owner enters round 2 concurrently; I cannot react to it here. The two live disagreements are the `partialResult` split, the `summarization_retry_*` scope, and the bash naming third leg.

I read the code at `translate.ts:452-458` to ground the atomicity argument: the current case does emit `{toolCallId, args, partialResult}` together as one frame. The PiEvent union at line 138 gives `tool_execution_update` as a single variant with `args?` and `partialResult?` independently optional on the *same* event. That is the principal's atomicity evidence; it holds against the codebase as it stands today.

I also read `brainstorming/SKILL.md` per the superpowers bootstrap. It is process guidance for creative work; not a refactoring decision on this round. The seat's deliverable here is a position, not a plan.

**(a) What changed in my position — explicit concessions.**

**Concession 1 (the load-bearing one). On the `partialResult` split, I concede the atomicity argument for today and offer a comprehension-level test as the honest boundary. The principal is right that `_emitExtensionEvent` forwards `{toolCallId, toolName, args, partialResult}` as a single event, and the current code folds them at `translate.ts:458`. Splitting that single SDK payload into two CUSTOM frames risks two real failure modes I had under-weighted:**

- **Drift.** Today's PiEvent is a union with `args?` and `partialResult?` independently optional. A `_subtle_ bug in any client or replay-side renames one field on a single path_ would present as "I am getting `pi.tool.progress` but never `pi.tool.end`" or the symmetric complaint, and the mapper would still type-check. The folded shape is the simplest contract for *the event as the SDK emits it*; the split forces the mapper to be the translator, not the mirror, and translation is where silent-drop traps live. The principal's `default: break` at `translate.ts:531-532` is the load-bearing instance of that trap class — the more translation the mapper does, the more cases it must keep green in the switch.
- **Replay-determinism asymmetry.** Replay determinism is a recorded seat concern in FLLWUP-5 and in my own round-1 H6. A replay that constructs `tool_execution_update {args, partialResult}` and a live payload that arrives the same way are *mechanically the same input*. Mapping them to two frames in live and one in replay (or vice versa) is a divergence the mapper can introduce silently; folding keeps the symmetric contract. I withdraw my H7 prediction's force as a correctness gate and downgrade it to a taste question for the client.

**What I hold, from inside that concession.** *The mapper mirrors the SDK payload atomically today.* That is a fact, not a design choice. The design choice the principal is actually making is **"atomicity is a property of today, not a property of the contract"** — and on that I keep the round-1 view: when the SDK eventually emits `partialResult` as an independent delta stream decoupled from args (the principal's residual §3), the split becomes correct *retrospectively*, and the cost of doing it retrospectively is a client-side reshape of the same dispatcher. The atomicity contract is correct for the installed SDK; the *contract durability* is the open question, and no mapper-layer test settles it.

To avoid pretending the seat has settled what the seat cannot settle, I propose the consolidator accepts one comprehension-level test in the spec acceptance: the mapper doc-comment at line 452-458 records *"if a future SDK decouples `partialResult` from `args` on this event, revisit this fold and split into `pi.tool.update {args}` + `pi.tool.progress {partialResult}` per the FLLWUP-3 designer round-1 H2/H7 rationale"*. That is the smallest artifact that carries the round-1 argument forward without burning owner-budget on a split today. The principal's grep gate (`grep deps.on "queue_update"...` exits 1) is independently useful and I support it; that gate is about runtime claim honesty, not about the partialResult question.

**Concession 2 (smaller). On `summarization_retry_*` scope, I concede the family's separate follow-up. The principal's argument that folding a union-typed payload (`{source:"branchSummary"} | {source:"compaction", reason}`) into the same acceptance as `auto_retry_*` muddies the contract is correct.** A client reading `pi.session.retry_*` would expect a homogeneous payload shape; the union type forces a discriminator in the data. The cleanest move is: `auto_retry_*` lands here, `summarization_retry_*` files as a follow-up card whose acceptance names the union payload explicitly, with two semantic-conventions decisions the consolidator should bundle: (i) do the two `source` arms keep the same `pi.session.summary_retry_start` name and differ only in `data`, or do they earn distinct names (`pi.session.summary_retry_branch` / `pi.session.summary_retry_compaction`)? My taste — distinct names — but it is taste, not principle. I withdraw my H5 prediction's claim that all three belong in FLLWUP-3 and amend it to "the three belong in a *named, scoped* follow-up card", which preserves the gating argument without taking owner time on a side family.

**Concession 3 (naming). On the bash third leg: the principal proposes `pi.tool.bash_execution_update` (raw SDK-event fidelity) vs my `pi.tool.bash_update` (ergonomic). On re-examination, the principal is right.** Two reasons, ranked by consequence to a first-time reader:

- **The dispatch-name contract is `name` as the sole key. Fidelity is the principled default** unless a shorter name clearly reads better. `bash_update` is shorter, but reading `pi.tool.bash_update` cold and not knowing the SDK event name, a reader has to guess what "update" updates. `pi.tool.bash_execution_update` reads as "the bash tool's execution-lane update frame" once a reader knows there is a `pi.tool.bash_execution` replay cousin. The longer name carries the SDK's own taxonomy; the client that already speaks the SDK dialects maps on first contact. This is the naming equivalent of *knowledge in the world beats knowledge in the head*.
- **Parity with the JSONL replay cousin.** `pi.tool.bash_execution` is the existing JSONL replay name; `pi.tool.bash_execution_update` makes the live/replay distinction read off the suffix (`_update`), which the client uses to subscribe by lane. My round-1 reasoning under-weighted this.

I concede the name to `pi.tool.bash_execution_update` and withdraw my `pi.tool.bash_update` position.

**(b) What I hold and why.**

- **The other three names as proposed.** `pi.session.queue_update` (session-shape question), `pi.session.retry_start`, `pi.session.retry_end` (session status, sibling of `info_change`/`model_change`/`thinking_level_change`). The principal's framing is identical to mine on all three; no disagreement, no further argument.
- **The truthfulness frame.** "Mapper fixture-green, runtime-observable only when the SDK bridge lands" — same as FLLWUP-5 §5.4. The principal and I converge here; the owner's first round-2 position (incoming) should not change it.
- **The acceptance claim shape.** The card's acceptance says "any newly mapped event" is fixture-green. I endorse that; I oppose any PR that claims a live runtime surface for these events.
- **The grep gate for `deps.on`** — principal's claim 3 — is correct and cheap to add; I support it without reservation.

**(c) Converged mapping table as I now see it.**

| PiEvent | CUSTOM `name` (sole dispatch key) | `value.pi` | `value.data` |
|---|---|---|---|
| `queue_update` | `pi.session.queue_update` | `"queue_update"` | `{ steering: string[], followUp: string[] }` |
| `bash_execution_update` | `pi.tool.bash_execution_update` | `"bash_execution_update"` | `{ id?: string, delta: string }` |
| `auto_retry_start` | `pi.session.retry_start` | `"auto_retry_start"` | `{ attempt, maxAttempts, delayMs, errorMessage }` |
| `auto_retry_end` | `pi.session.retry_end` | `"auto_retry_end"` | `{ success, attempt, finalError? }` |
| `tool_execution_update` (today) | `pi.tool.update` — atomic, with `{toolCallId, args, partialResult}` preserved together | `"tool_execution_update"` | `{ toolCallId, args?, partialResult? }` |

The summarization-retry rows are **out of FLLWUP-3** by concession 2, and I name them here only so the consolidator has the routing:

| (follow-up card) | | | |
|---|---|---|---|
| `summarization_retry_scheduled` | `pi.session.summary_retry_scheduled` | `"summarization_retry_scheduled"` | `{ attempt, maxAttempts, delayMs, errorMessage }` |
| `summarization_retry_attempt_start` | `pi.session.summary_retry_start` (or split by `source` — consolidator call) | `"summarization_retry_attempt_start"` | `{ source:"branchSummary" } \| { source:"compaction", reason }` |
| `summarization_retry_finished` | `pi.session.summary_retry_finished` | `"summarization_retry_finished"` | `{}` |

The mapper fan-out for `tool_execution_update` collapses back to one frame; no split. Purity stays green: no clock, no entropy, no I/O. Fixtures are per-row. The mapper doc-comment at `translate.ts:452-458` carries the *retrospective-split trigger condition* I proposed above, so the round-1 H2/H7 reasoning is preserved as design history rather than burned as code today.

**(d) H1–H9 status — what survives, what is amended, what the principal already covered.**

- H1 name routing — survives for the three names we agreed on; reverses for `pi.tool.progress` because the split is conceded.
- H2 identity stability — withdrawn as a correctness gate; downgraded to a doc-comment note about the future-SDK-split trigger condition.
- H3 bash live/replay distinction — survives with amended name (`pi.tool.bash_execution_update` instead of `pi.tool.bash_update`).
- H4 retry-state surface — survives unchanged; the principal's table agrees verbatim.
- H5 summarization namespace — withdrawn from FLLWUP-3 by concession 2; reroutes to the follow-up card with the consolidator-level "one name or two" question noted.
- H6 fold purity — survives; principal claim 4 covers it; reinforce with a doc-comment.
- H7 ordering prediction — withdrawn with H2.
- H8 runtime-caveat honesty — survives, restated exactly.
- H9 subscription-fidelity (S-O2 manual construction at the eventual bridge site) — survives; not in conflict with the mapper-only claim because no new `index.ts` subscriptions land in FLLWUP-3.

The principal's testable claims cover what my H6 covered, what my H4 covered in form, and the new grep gate (their claim 3) is independent. H8 corresponds to the spec-sentence rider, which is already in the card's acceptance ("Any §4-adjacent representation added rides the same prose-sync path the EV-1 Q3 / EV-4 Q1 rulings established"). No contradiction with the principal's claims; the principal's `default: break` finding at `translate.ts:531-532` is the seam risk they own and they own it well — my H6 runs alongside it, not against it.

**(e) Open items for the consolidator — design disputes no test can settle.**

1. **The `partialResult` doc-comment trigger condition.** I want the mapper comment at `translate.ts:452-458` to record the retrospective-split trigger ("if the SDK decouples `partialResult` from `args`, revisit the fold"). The principal will likely accept this; if they object, the dispute is wording-only, not mapper shape. **No test settles this.**
2. **`summarization_retry_attempt_start` — one name or two by `source`?** A reader can decode `data.source` cheaply; a reader can also subscribe to two distinct names. The cheaper move is one name plus a discriminator in `data`; the more dispatch-clear move is two names. This is a taste call the consolidator should make — not a correctness question. **No test settles this.**
3. **`bash_execution_update` buffering at the client layer** (my round-1 residual 5): preserved, untouched, and explicitly out of mapper scope. **No test settles this; client-side decision.**
4. **`partialResult: ""` semantics** (round-1 residual 4): the faithful-emit policy survives. It is a client-side filter decision and is noted for the spec. **No test settles this.**
5. **`queue_update` null-state UX** (round-1 residual 3): snapshot-faithful, client filters. Unchanged. **No test settles this.**

**Predictions that survive in their original phrasing:** H1 (modified to the three names we agreed on), H3 (amended name), H4, H6, H8, H9.

**Predictions withdrawn or amended to taste:** H2 (withdrawn as gate, preserved as doc-comment), H5 (withdrawn from FLLWUP-3, preserved as a follow-up card brief), H7 (withdrawn with H2).

**Predictions already covered by the principal:** H6 (purity) — covered by principal claim 4. H8 (spec caveat rider) — covered by the card's acceptance and the principal's mapper-only framing. H4 (retry-state surface) — independently re-stated by the principal in their table; my version is the same answer with the same fields.

End of round-2 designer position. Owner position lands concurrently; I have not yet seen it, so this position does not pretend to settle the implementation-budget half of the question.

#### Round 3 — FINAL (owner job-1.4, principal job-1.5, designer job-1.6; cap reached)

**Round outcome (facilitator record).** Cap of 3 rounds reached. Converged: retry names — all three seats hold `pi.session.retry_start` / `pi.session.retry_end` (value.pi carries the raw `auto_retry_*`; rename convention per translate.ts:519–536). Still 2-vs-1, majorities recorded as facts not decisions: **partialResult split** — owner+designer FOR the split (with principal's round-2 refinements: conditional emission, toolCallId on both frames, O2 fixture update 3→4 in-commit); principal AGAINST (rename convention is 1:1 renames, not 1:2 fan-out; doc-comment future-split trigger instead). **summarization_retry_* scope** — owner+designer IN (verbatim union passthrough, zero normalization; distinct `summary_retry_*` names keep the retry_* contract homogeneous); principal OUT (boundary call answered "out"; follow-up trivial). **Bash name** — owner+principal LONG `pi.tool.bash_execution_update` (prefix-collision argument is speculation: no sub-category startsWith dispatch exists in the codebase, verified; family legibility with the JSONL replay cousin); designer SHORT `pi.tool.bash_update` (first-time-reader test; prefix-collision property real as a code property). Per council.md step 3, the three non-converged points carry to the consolidator as open items, ultimately product-owner.

Key verified facts established in round 3 (owner, against the working tree): `CustomFrame.value.data` is typed `unknown` verbatim passthrough (translate.ts:88–92); the `SessionEntry` union has NO `tool_execution_update` kind — it is live-only, so the replay-asymmetry scenario is structurally impossible; the O2 fixture (test/translate.test.ts:171–188) asserts `["CUSTOM","CUSTOM","CUSTOM"]` and uses `f.name.startsWith("pi.tool.")` (line 183); the only prefix-dispatch idioms in the codebase are category-level (`"pi.tool."`, `"pi."`).

**owner (job-1.4, verbatim).**

## FLLWUP-3 — owner FINAL position (round 3)

### (a) Final position on each point

**1. partialResult split — CONCEDE to principal: SPLIT, with his three refinements.**

My round-2 scope argument was "changes the data shape of an existing documented CUSTOM name mid-epic." Verification dissolves it: `tool_execution_update` has **no producer and no consumer** — `index.ts` has zero `tool_execution_*` subscriptions (facilitator-grounded, re-confirmed) and the `SessionEntry` union has no such kind, so `pi.tool.update` with folded `partialResult` is a contract nothing can observe today. It has one fixture. "Already folded" was status-quo defense, exactly as principal named it in round 2 — and he was right about my blind spot.

The affirmative case now stands alone and wins: the binding context makes `name` the **sole dispatch key**, and a progress-only client must today subscribe `pi.tool.update` and field-inspect `data.partialResult` — the payload archaeology the doctrine exists to prevent. The card's own intent paragraph records `pi.tool.progress` as "the agreed future representation" this card decides *and lands*. Designer's two remaining objections don't hold: her replay-determinism worry requires the same input shape in both lanes, and the mapper structurally cannot produce that asymmetry — `tool_execution_update` is a live-only `PiEvent` variant; replay entries go through a different union and branch. Her drift concern is real but generic, and principal's conditional-emission fixture matrix (both / args-only / partialResult-only / `""`-only) closes exactly that trap surface. Her doc-comment rider survives in amended form: it should record the **conditional-emission rule and the H2/H7 rationale** at the case site — but the "revisit and split" trigger text is now obsolete, because the split landed. Flagging that consequence since she hasn't seen it.

**2. `summarization_retry_*` scope — CONCEDE to principal: IN.**

Verified: `CustomFrame.value.data` is typed `unknown` and passed verbatim (translate.ts:88–92), so the union payload needs zero normalization — my round-2 hold rested on principal's round-1 normalization objection, which he himself retracted. The card intent explicitly delegates "does the family include the adjacent `summarization_retry_*` variants?" to this deliberation; answering "in" settles the delegated call. Designer's "heterogeneous payloads muddy `pi.session.retry_*`" argument dissolves under her own naming — the summary family gets distinct `summary_retry_*` names, so no client reading `retry_*` ever sees the union. Cost of inclusion: three mechanically identical rows plus three fixtures. Cost of exclusion: a follow-up card whose only purpose is re-asking the question this card was delegated to answer. On the sub-call designer routed to the consolidator (one name per event vs two names split by `source`): one name per SDK event with the union passed verbatim — mechanical, faithful, and consistent with `queue_update` snapshot fidelity.

**3. Bash name — HOLD: `pi.tool.bash_execution_update` (with designer, against principal).**

The task asks me to weigh the prefix-collision argument honestly: it is a **hypothetical client**. Verified fact: the codebase's only `startsWith` idioms are category-level (`"pi.tool."`, `"pi."`), which match identically under both candidate names. A collision requires a client that (a) filters by `startsWith("pi.tool.bash_execution")` — a name with zero suffix variants, for which equality is the natural filter — and (b) wants replays *only*, excluding the live deltas of the same bash-execution lane. A client using the prefix almost certainly wants the lane as a whole, for whom the superset match is correct behavior. I find no plausible motive for the buggy combination.

What *does* discriminate: family legibility. `pi.tool.bash_execution` is an existing documented contract (translate.ts:324–326); making the live name a pure suffix-extension of it means a client who knows the replay name discovers the live sibling by natural extension, and live-vs-replay reads off the `_update` suffix. `pi.tool.bash_update` breaks that family. I also retract my own round-2 maintenance argument for the long name as non-discriminating: `value.pi` carries the raw SDK event name under either scheme, so grepping the SDK name finds the mapping regardless — I was defending a position with an argument that proved too much.

**4. Retry names — CONCEDE to both: `pi.session.retry_start` / `pi.session.retry_end`.**

Two seats independently converged; my round-2 asymmetry argument doesn't survive the concession on point 2: under raw names, `auto_retry_*` and `summarization_retry_*` share no usable prefix either, so raw fidelity buys no subscription capability that the short form loses — and `value.pi` preserves `auto_retry_start` verbatim in the payload. The rename convention is established codebase practice (model_select→`model_change`, session_info_changed→`info_change`, translate.ts:519–536), and `auto_` is SDK-internal jargon for what the client perceives as "session is retrying."

### (b) FINAL mapping table

| PiEvent / entry | CUSTOM `name` (sole dispatch key) | `value.pi` | `value.data` |
|---|---|---|---|
| `queue_update` | `pi.session.queue_update` | `"queue_update"` | `{ steering, followUp }` verbatim — snapshot, not delta |
| `bash_execution_update` | `pi.tool.bash_execution_update` | `"bash_execution_update"` | `{ id?, delta }` verbatim |
| `auto_retry_start` | `pi.session.retry_start` | `"auto_retry_start"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `auto_retry_end` | `pi.session.retry_end` | `"auto_retry_end"` | `{ success, attempt, finalError? }` verbatim |
| `summarization_retry_scheduled` | `pi.session.summary_retry_scheduled` | `"summarization_retry_scheduled"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `summarization_retry_attempt_start` | `pi.session.summary_retry_attempt_start` | `"summarization_retry_attempt_start"` | `{ source:"branchSummary" } \| { source:"compaction", reason }` verbatim |
| `summarization_retry_finished` | `pi.session.summary_retry_finished` | `"summarization_retry_finished"` | `{}` |
| `tool_execution_update`, `args` present | `pi.tool.update` | `"tool_execution_update"` | `{ toolCallId, args }` |
| `tool_execution_update`, `partialResult` present | `pi.tool.progress` | `"tool_execution_update"` | `{ toolCallId, partialResult }` — emitted **after** `pi.tool.update` when both present; `""` is present and emits |
| JSONL `bash_execution` (replay, unchanged) | `pi.tool.bash_execution` | `"bash_execution"` | passthrough (translate.ts:324–326) |

All seven new variants: mapper-only, no `index.ts` wiring, manual PiEvent construction per FLLWUP-5 S-O2 when the bridge lands, runtime-unreachability caveat in the spec amendment.

**Settling test set (revised):** (1) per-event exact-frame fixtures for all seven variants — the only guard against the `default: break` silent drop at translate.ts:533; (2) conditional-emission matrix — both fields → exactly `[pi.tool.update, pi.tool.progress]` in order with `toolCallId` on both; args-only → one update, zero progress; partialResult-only → one progress, zero update; `partialResult:""` → progress emitted (pinned, not accidental); (3) O2 fixture updated 3→4 frames in the same commit, `startsWith("pi.tool.")` still green for both names; (4) dead-wiring grep over all seven event names in `index.ts` exits 1; (5) live/replay non-collapse (designer H3, amended name); (6) purity greps + `bunx tsc --noEmit` + `bun test` at 155 + new fixtures + byte-identical double-run.

### (c) Concessions and holds

- **Concede:** split (to principal — his refinements are adopted verbatim: conditional emission, `toolCallId` on both frames, O2 fixture update in-commit); `summarization_retry_*` IN (to principal); retry names `pi.session.retry_start/end` (to both).
- **Hold:** bash name `pi.tool.bash_execution_update` (with designer). Majority 2–1; principal's prefix-collision argument is the one of his three concessions I find unsupported — it requires a hypothetical client whose motive contradicts its own filter, against the verified fact that no sub-category prefix dispatch exists in this codebase.
- **Outcome:** all four points carry majorities (split: principal+owner; summarization IN: principal+owner; long bash name: designer+owner; short retry names: all three). Nothing requires a product-owner ruling except the already-recorded taste residuals (doc-comment wording; `summary_retry_attempt_start` one-name call, on which I've stated my lean above). I have no further position; ready for consolidation.

**principal (job-1.5, verbatim).**

### Final position on the four points

**1. partialResult split — CONCEDE (no split).** My round-2 split argument leaned on the rename convention (`model_select → pi.session.model_change`, `session_info_changed → pi.session.info_change`). On inspection that convention is uniformly **1:1 single-frame renames**; the split is a **1:2 fan-out**, a different operation the convention does not support. The mapper's strongest property today is that it mirrors the SDK payload atomically — one event in, one frame out. Owner's scope argument (partialResult is already mapped and tested; the card is about *unmapped* events) and designer's silent-drop-trap + replay-symmetry argument are both correct, and the O2 fixture break (3→4) is the seam-level evidence of the cost. I adopt designer's **doc-comment future-split trigger** at `translate.ts:452` as the honest boundary: record "if a future SDK decouples `partialResult` from `args`, revisit this fold and split per the round-1 H2/H7 rationale."

**2. `summarization_retry_*` scope — CONCEDE (out).** Answering the family-boundary call with "out" satisfies the card's delegation. The union payload (`{source:"branchSummary"} | {source:"compaction", reason}`) needs its own fixtures, and the one-name-vs-two-names-by-`source` question is an unresolved taste that would block this card's convergence. Folding it in muddies a homogeneous `retry_*` contract for zero user-visible gain (all dead at runtime today). The follow-up is trivial; file it.

**3. Bash name — CONCEDE (`pi.tool.bash_execution_update`).** Honest weigh of my own round-2 prefix-collision argument: **it is speculation, not a contract risk.** The binding contract makes `name` the sole dispatch key — exact-match equality. A `startsWith("pi.tool.bash_execution")` client is off-contract, and no name choice is prefix-safe in general (every name is a prefix of some longer future name). I withdraw the prefix argument. The long name carries the SDK taxonomy and reads the live/replay distinction off the `_update` suffix against the existing JSONL `pi.tool.bash_execution`.

**4. Retry names — HOLD (`pi.session.retry_start/end`).** With point 2 conceded out, this card contains exactly **one** retry family. `retry_start/retry_end` is unambiguous in this card's scope, and `value.pi` carries the raw `auto_retry_start/end` either way, so no information is lost under the short names. Owner's asymmetry argument depends on how the *future* summarization follow-up is named — that card makes its own call and is free to pick `summary_retry_*` without colliding with `retry_*` under exact-match dispatch. The codebase precedent (which owner himself conceded) — `session_info_changed → pi.session.info_change` — shows the mapper renames to client concept, not raw SDK name. This is taste, not test; I hold it, but flag it as the single open-judgment item.

### Final mapping table

| PiEvent / entry | CUSTOM `name` | `value.data` |
|---|---|---|
| `queue_update` | `pi.session.queue_update` | `{ steering, followUp }` verbatim |
| `bash_execution_update` | `pi.tool.bash_execution_update` | `{ id?, delta }` verbatim |
| `auto_retry_start` | `pi.session.retry_start` | `{ attempt, maxAttempts, delayMs, errorMessage }` |
| `auto_retry_end` | `pi.session.retry_end` | `{ success, attempt, finalError? }` |
| `tool_execution_update` (unchanged) | `pi.tool.update` | `{ toolCallId, args?, partialResult? }` + doc-comment future-split trigger |
| JSONL `bash_execution` (replay, unchanged) | `pi.tool.bash_execution` | passthrough (`translate.ts:324–325`) |
| `summarization_retry_*` | — out of scope | routed as follow-up |

### Concede / hold

- **Concede:** (1) no partialResult split; (2) summarization_retry_* out; (3) bash name `pi.tool.bash_execution_update`.
- **Hold for consolidator/PO:** (4) retry names — I and the designer hold `pi.session.retry_start/end`; owner holds `pi.session.auto_retry_start/end`. The per-event fixture pins whichever the PO rules; it cannot settle the taste.

### Testable claims

1. **Per-event silent-drop guard:** for each of the four new variants, `translate(<event>, freshState)` emits exactly one `CUSTOM` frame with exact `name`/`value.pi`/`value.data`. Fails today; the only guard against `default: break`.
2. **No-split lock:** `translate({event:"tool_execution_update", toolCallId, args:{cmd:"ls"}, partialResult:"a\n"})` emits exactly one `pi.tool.update` with `data === {toolCallId, args, partialResult}` and **no** `pi.tool.progress` frame; the existing O2 fixture (3 frames) stays green unchanged.
3. **Dead-wiring gate:** `grep -nE 'deps\.on\("(queue_update|bash_execution_update|auto_retry_start|auto_retry_end)"' index.ts` exits 1.
4. **Scope gate:** `grep -n 'summarization_retry' src/translate.ts` exits 1.
5. **Live/replay non-collapse:** JSONL `bash_execution` → `pi.tool.bash_execution`, never `pi.tool.bash_execution_update`; live `bash_execution_update` → `pi.tool.bash_execution_update`, never `pi.tool.bash_execution`. Two fixtures cross-asserting the negative.
6. **Gates:** G-11/G-12 purity greps green; `bunx tsc --noEmit` exit 0; `bun test` exit 0 (155 + new fixtures); determinism: new-event sequence translated twice → byte-identical frames.

**designer (job-1.6, verbatim).**

# FLLWUP-3 — designer round-3 (FINAL) position

## Where the seats are going into this round

I conceded three points in round 2 (no-split, summarization out, long bash name). Round 2 produced crossed positions, not convergence: **owner** held my round-2 position verbatim (no-split / summarization OUT / long bash / raw retry names with a new asymmetry argument); **principal** flipped to the split / summarization IN / short bash name with the prefix-collision argument; **me** held no-split / summarization OUT / long bash name. Every disputed point is 2-vs-1 with me in the majority on three. Majority is recorded as a fact, not a decision. I honor one principle this round: every principal refinement that survives my own code-read is a concession I owe explicitly.

I re-verified three load-bearing facts before locking the final:
1. `src/translate.ts:452-458` — folded shape `{toolCallId, args, partialResult}` (confirmed).
2. `src/translate.ts:138` — `tool_execution_update` has independently-optional `args?: unknown; partialResult?: string` (confirmed — principal's conditional-emission refinement is correct as written; my round-1 H2 over-claimed).
3. `test/translate.test.ts:170-185` — O2 fixture asserts exactly 3 frames for `start → update{args,partialResult} → end` (confirmed — principal's mechanical finding that the fixture breaks under the split is accurate, and it is exactly the seam detail the design-doc vantage does not see).
4. `src/translate.ts:519-536` — rename convention (`model_select → model_change`, `thinking_level_select → thinking_level_change`, `session_info_changed → info_change`, `session_compact → context.compaction`) confirmed: the mapper renames to client-perceived concept, *not* "mirrors the SDK payload." My round-1 frame was false as a codebase-wide rule. I owe that concession explicitly.

## Point 1 — `partialResult` split: **I FLIP to the SPLIT.**

Principal's refinements — conditional emission (only when the field is present), `toolCallId` on both frames, O2 fixture update in the same commit — all verified against the union signature and the O2 fixture. My round-2 atomicity argument collapses on inspection: the `default: break` risk is symmetric across all new `case`s, not asymmetric between folded and split. The replay-determinism argument doesn't actually favor the fold — live and replay both fan identically under either shape. The doc-comment retrospective-trigger remains as design history. The rename-convention evidence removes my strongest plank — the convention is rename-to-concept (`info_change`, `model_change`), not mirror-the-payload. The `info_change` example I leaned on was an instance of the very convention that now supports the split.

## Point 2 — `summarization_retry_*` scope: **I FLIP to IN-SCOPE.**

Principal's verbatim-passthrough argument dissolves the mapper-difficulty half of my objection (typed `unknown` at `translate.ts:74`; the mapper does no normalization work). My objection was always about the *client* contract, not the mapper — but the design-call (one name or two by `source`?) belongs in this card, not a follow-up. Same mapper pattern as the other `pi.session.*` rows; consolidator picks the discriminator design.

## Point 3 — Bash name: **I FLIP to `pi.tool.bash_update` (principal's).**

The prefix-collision property is real as a *code property* (`pi.tool.bash_execution` is a strict prefix of `pi.tool.bash_execution_update`) even though no client does `startsWith` today. Two readings of "knowledge in the world": reading-A (my round-2) is "the SDK's own taxonomy is the knowledge" — wins on maintainer discoverability; reading-B (principal's) is "the dispatch key carries the client-perceived concept" — wins on first-time-reader test. The design seat's tiebreaker is the first-time-reader test; the maintainer test is owner-seat's territory, and the owner can keep the SDK name discoverable via a doc-comment or a spec name table at lower cost than the prefix collision risks.

## Point 4 — Retry names: **I HOLD `pi.session.retry_start/end`.**

Owner's asymmetry point is true (dropping `auto_` while keeping `summary_` is asymmetric *if the convention is applied inconsistently*) but not load-bearing — applying the rename convention consistently to both families avoids the asymmetry without raw names. `retry_*` is the generic family; `summary_retry_*` is the summarization-specific family; neither qualifier is "generic" once the convention is applied. `session_info_changed → info_change` is precedent: drop the SDK-internal verb, name the client-perceived concept. `auto_retry_start → retry_start` is the same rule. Owner's argument requires keeping `auto_` *and* keeping `summary_` to remain symmetric; that is a defense of raw names, not a defense of symmetry.

## Final mapping table

| PiEvent | CUSTOM `name` | `value.pi` | `value.data` |
|---|---|---|---|
| `queue_update` | `pi.session.queue_update` | `"queue_update"` | `{ steering, followUp }` verbatim |
| `bash_execution_update` | `pi.tool.bash_update` | `"bash_execution_update"` | `{ id?, delta }` verbatim |
| `auto_retry_start` | `pi.session.retry_start` | `"auto_retry_start"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `auto_retry_end` | `pi.session.retry_end` | `"auto_retry_end"` | `{ success, attempt, finalError? }` verbatim |
| `summarization_retry_scheduled` | `pi.session.summary_retry_scheduled` | `"summarization_retry_scheduled"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `summarization_retry_attempt_start` | `pi.session.summary_retry_start` *(or split by `source` — consolidator call)* | `"summarization_retry_attempt_start"` | union `{source:"branchSummary"} \| {source:"compaction", reason}` verbatim |
| `summarization_retry_finished` | `pi.session.summary_retry_finished` | `"summarization_retry_finished"` | `{}` |
| `tool_execution_update` (args present) | `pi.tool.update` | `"tool_execution_update"` | `{ toolCallId, args }` |
| `tool_execution_update` (partialResult present) | `pi.tool.progress` | `"tool_execution_update"` | `{ toolCallId, partialResult }` |
| JSONL `bash_execution` (replay, unchanged) | `pi.tool.bash_execution` | n/a | passthrough (`src/translate.ts:324-325`) |

Ordering: when both `args` and `partialResult` are present, emit `pi.tool.update` first, then `pi.tool.progress`.

## Concessions and holds

**Conceded (this round, out of round-2):**
- Point 1: split — adopted with conditional emission, toolCallId on both frames, O2 fixture update.
- Point 2: summarization in-scope — adopted; consolidator picks the discriminator design.
- Point 3: `pi.tool.bash_update` — adopted; prefix-collision property is real even if hypothetical.

**Held for the consolidator / PO:**
- Point 4: `pi.session.retry_start/end` — owner is the only minority. Consolidator tiebreaks. Argument above.

**Tiebreakers no test settles (route to consolidator):**
- `summarization_retry_attempt_start` — one name or two by `source`? My taste is two names; principal's likely taste is one with discriminator.
- `partialResult: ""` semantics — under conditional emission, empty string emits a frame. Pin in fixture.
- `queue_update` null-state UX — snapshot-faithful; client filters.
- `bash_execution_update` buffering — client-layer decision; mapper preserves order.

## H1–H9 status in FINAL form

| Prediction | Status |
|---|---|
| H1 name routing | Survives, names amended to principal's |
| H2 identity stability | **Reversed** — split adopted; "exactly two frames" over-claimed; corrected version: "when both fields present, one `pi.tool.update` then one `pi.tool.progress`, both keyed on toolCallId; when only one present, exactly one frame" |
| H3 bash live/replay distinction | Survives with name `pi.tool.bash_update` |
| H4 retry-state surface | Survives, `pi.session.retry_start/end` |
| H5 summarization namespace | Survives, in scope as `pi.session.summary_retry_*` |
| H6 fold purity | Survives; G-11/G-12 + tsc + bun test |
| H7 ordering prediction | Survives in amended form — `pi.tool.update` first, then `pi.tool.progress` |
| H8 runtime-caveat honesty | Survives, restated |
| H9 subscription-fidelity (S-O2) | Survives; no new subscriptions in FLLWUP-3 |

No H predictions withdrawn outright in round3. H2 and H7 shift from "correctness gates" (round-1 force) to "pinning tests" (round-3 force); H1 and H3 amend names; H4/H5/H6/H8/H9 survive unchanged.

## Reading note for the consolidator

All four 2-vs-1 disagreements have low implementation cost (one string, one new conditional `case` + one fixture update). The seat disagreement is design, not budget. The two positions where the owner is the minority — split and summarization-in — are also the two positions where my round-2 position (which I have now flipped) was the principal's round-2 minority. The consolidator should weigh implementation cost (low), rename-convention alignment (split + retry names), and owner-seat scope-discipline argument (out-of-scope) in that order. Full position artifact at `vault/raw/2026-09-02-design-fllwup-3-final.md`.

### Step 6 — rulings (resumed runner 6, 2026-09-01; product-owner seat, binding)

The three open-judgment items from the step-5 synthesis (J-1, J-2, J-3) were escalated by the previous runner's report; the orchestrator dispatched `product-owner`, which ruled on all three (no steward deferral). Deliberation is CLOSED — nothing ruled is reopened. Rulings appended verbatim below and treated as binding.

--- RULINGS BEGIN ---

## FLLWUP-3 rulings — product-owner seat (binding)

**J-1 — bash live-delta dispatch name: RULED LONG — pi.tool.bash_execution_update.** The live/replay distinction must be readable without a translation table in the reader's head: JSONL replay emits pi.tool.bash_execution, live deltas emit pi.tool.bash_execution_update, and the _update suffix IS the distinction, consistent with how the SDK itself names the pair. When the SDK bridge lands (FLLWUP-8/9 class work), a maintainer greps the exact SDK event name and finds the mapping. Skeptic O-6 closed-green removed the only structural argument against the long name (no sub-category prefix dispatch exists to collide). The designer's first-time-reader concern is served at lower cost by the already-agreed doc-comment at the case site.

**J-2 — summarization_retry_* scope: RULED IN.** The card's Intent explicitly delegates this boundary call to the deliberation, so inclusion requires no goal change and is a legitimate fold-in. CustomFrame.value.data is typed unknown with verbatim passthrough (translate.ts:88-92), so the union payload costs zero normalization; the four families share one mapper pattern and one runtime-deadness caveat (O-3 closed-green); the principal's "zero user-visible gain" objection applies identically to auto_retry_* itself, so it cannot discriminate between the families. Fixtures for the union payload are ordinary implementation work under the settled per-event single-frame fixture pattern.

**J-3 — RULED TWO NAMES — pi.session.summary_retry_branch / pi.session.summary_retry_compaction, keyed on data.source.** This card already settled the governing doctrine for a payload-variant event in round 3, unanimously: tool_execution_update fans into pi.tool.update vs pi.tool.progress by payload content rather than forcing clients to discriminate fields under one key. name is the sole dispatch key (EV-4 Q1), so the key must carry the client-perceived concept; a branch-summary retry and a compaction retry are different concepts to a client (only one carries a reason). No information is lost: value.pi carries the raw event name and value.data passes the union verbatim. The fold inspects data.source to choose the name — deterministic, fixture-pinned, same class as the settled conditional-emission split.

**General rule for FLLWUP-8 / FLLWUP-9:** The names ruled here and in the FLLWUP-3 consolidation are stable keys (EV-2 Item 2) — neither backlog card may relitigate them. When the SDK bridge work lands: (a) every new subscription for the four families uses manual PiEvent construction per FLLWUP-5 S-O2, never ev as PiEvent; (b) each mapping's acceptance re-opens from fixture-green to runtime-observable, the same re-open pattern FLLWUP-8 already carries, and the FLLWUP-3 spec amendment's runtime-unreachability caveat (scoped per O-1 to the four new families only) must be amended again in the same PR that makes it false; (c) FLLWUP-9's vendored typed on() union reflects the real SDK whitelist — until the SDK forwards a family, that family stays unwired regardless of the mapper, and FLLWUP-9 is not license to add dead subscriptions.

O-5 (neither-field case) remains an implementation-time closure for the owner as recorded, and the O-1 caveat scoping is binding on the spec amendment.

--- RULINGS END ---

### Step 7 — design spec written (runner 6, 2026-09-01)

Spec committed at `docs/superpowers/specs/2026-09-01-FLLWUP-3-design.md`, folding the three rulings, O-1's caveat scoping (S-3), O-5's implementation-time closure, and the FLLWUP-8/9 general rule into the settled round-3 design. Card set `In Progress`; proceeding to step 8 (owner implementation dispatch).

### Step 8 — owner implementation (runner 6, 2026-09-01; job-4.1, settled 9.6m / 22 turns)

Owner implemented in isolated worktree `.worktrees/flluwp-3-live-events` (branch `flluwp-3-live-events` off main `0ade5bb`). PR **#14** open, head SHA `36e348335845ebdcdbe676964071be851d289e94` (facilitator-verified via `gh pr view`). Commits: `9c570d7` feat(translate) — union + fold cases + fixtures + plan; `36e3483` docs — verbatim §7 PI-SPEC amendment. TDD: fixtures first, red confirmed 14 fail/30 pass, then green. Owner-observed gates: tsc exit 0; bun test 172 pass / 0 fail / 941 expect (155 baseline + 17 new); dead-wiring grep exit 1; `as PiEvent` grep exit 1; purity guards green; determinism byte-identical. index.ts untouched. Card set `In Review` from the observed PR artifact.
