# FLLWUP-3 — design position (designer seat)

**Card:** Map EV-4's unmapped live pi events (queue_update, bash_execution_update,
auto_retry_*) and decide the AG-UI representation of live tool-progress
(partialResult).

**Seat:** designer. Grounded in `docs/PI-SPEC.md` §4/§5, `src/translate.ts`,
`index.ts`, `docs/superpowers/specs/2026-08-31-EV-4-design.md`,
`docs/superpowers/specs/2026-08-31-FLLWUP-5-design.md`,
`docs/superpowers/specs/2026-09-01-FLLWUP-6-design.md`, and the binding
precedents recorded in `council/cards/`.

`vault/wiki/index.md` is a stub catalog (no module pages) — semantics grounded
in the documents the prior cards grounded in. The SDK reachability finding
(extension-facing `ExtensionAPI.on()` does not bridge `queue_update`,
`bash_execution_update`, `auto_retry_*`, `summarization_retry_*`; same finding
class as FLLWUP-5 probe-8 for `ui.confirm`) is taken as facilitator-verified
evidence, per the card.

---

## Position (the position, then the worked-out answer)

**(1) Naming and perception.** Each of the three new event families names a
different question the remote client has, and each gets its own CUSTOM name
under the namespace that matches its question. `queue_update` answers
*"what is the agent about to do that I queued?"* — it is the session's pending
intake surface, the queue of text the user typed that the agent will process
next. It belongs under `pi.session.*` (a session-shape concern), named
`pi.session.queue_update`. `bash_execution_update` answers *"what output is
the bash tool streaming right now?"* — it is one tool's streaming output,
specifically the bash lane. It belongs under `pi.tool.*` alongside
`pi.tool.start` / `.update` / `.end`, named `pi.tool.bash_update` (sibling of
the existing JSONL replay frame `pi.tool.bash_execution`; the live and replay
lanes earn *distinct* names because they carry distinct shapes — replay
delivers a `bash_execution` entry as a complete snapshot via
`pi.tool.bash_execution`; the live stream delivers streaming `delta` strings
via `pi.tool.bash_update`). `auto_retry_*` answers *"the model call failed —
is the host retrying it, and how long until it gives up?"* — it is a session
status surface, *not* a tool surface. It belongs under `pi.session.*`, with
the start/end pair as two CUSTOM names: `pi.session.retry_start` (carrying
`{attempt, maxAttempts, delayMs, errorMessage}`) and
`pi.session.retry_end` (carrying `{success, attempt, finalError?}`). The
adjacent summarization-retry family (`summarization_retry_scheduled` /
`_attempt_start` / `_finished`) goes under `pi.session.*` as well, named to
mirror — `pi.session.summary_retry_scheduled`, `.summary_retry_start`,
`.summary_retry_finished` — so the dispatch names form a namespace the client
can read off at a glance.

The reason the boundary lands on **session vs tool** is the gulf a client
must close, not the gulf a server classifies. A `bash_execution_update` is
client-perceived as "the bash tool pane is filling with output" — that is a
tool progress question, and a client that keys on the `pi.tool.*` namespace
will already know to route the frame into its tool-progress lane (where the
existing `pi.tool.update` / `.end` / `.bash_execution` slots live). A
`queue_update` is client-perceived as "the agent has N messages lined up
after the current one" — that is a session-shape question, and a client that
keys on `pi.session.*` will already know to route into its session-status
sidebar (where `pi.session.model_change` / `.thinking_level_change` /
`.info_change` slots live). The auto-retry family is the trap: classifying
it under `pi.tool.*` because *retries look like tool recovery* would scatter
two session-status surfaces (the existing `pi.session.info_change` plus a new
retry frame) across two namespaces and force the client to subscribe to both
for the same conceptual view ("what is the host's current plan?"). It also
misleads a reader into thinking the retry targets a specific tool call when
it actually targets a model-level attempt.

**(2) `partialResult` design.** Adopt the dedicated `CUSTOM pi.tool.progress`
frame; do not keep `partialResult` folded into the existing
`pi.tool.update` `data` payload. The remote client's tool-progress UI needs
three things to render streaming tool output that the current folded shape
does not give it, and the missing things are not closable by a field rename.

The first is **identity stability across lane transitions**. Today a tool
call begins in the *generation lane* (`message_update.toolcall_start` →
`TOOL_CALL_START {toolCallId, toolCallName, parentMessageId}`), then enters
the *execution lane* (`tool_execution_start` → `CUSTOM pi.tool.start`,
`tool_execution_update` → `CUSTOM pi.tool.update {partialResult}`,
`tool_execution_end` → `CUSTOM pi.tool.end`, then `tool_result` →
`TOOL_CALL_RESULT`). The `toolCallId` is the only stable key across the
boundary, and the mapper already threads it. With `partialResult` folded
into `pi.tool.update`, a client that wants to render the progress pane in
its tool UI must: subscribe to `pi.tool.update`, discriminate by *whether
`partialResult` is present* (since `pi.tool.update` also carries `args`
updates), then route to the progress renderer. With a dedicated
`pi.tool.progress` frame, a client subscribes to the name, gets a uniform
shape, and the client-side discriminator is the *frame name*, not a *field
presence* — which is how the rest of the CUSTOM surface already works
(§4's settled design: `name` is the sole dispatch key). The folded shape
turns a dispatch-key contract into a payload-inspection contract, and
payload inspection is exactly what loses meaning the moment
`pi.tool.update` grows a new optional field.

The second is **terminal clarity**. With `partialResult` folded in, the
client must decide "is this update the last one, or should I keep a
streaming pane open?" by waiting for either a `pi.tool.end` or a
`pi.tool.update` whose `partialResult` field is empty. That requires the
client to remember "I saw an update with `partialResult: '...'` N seconds
ago; if the next update arrives, it is more output; if `pi.tool.end`
arrives, it is terminal." A dedicated `pi.tool.progress` frame carries the
lifecycle in the dispatch names: `pi.tool.progress` is a streaming update,
`pi.tool.end` is terminal (the existing shape), `TOOL_CALL_RESULT` is the
final result. The client does not have to ask "is this still streaming?" —
the dispatch key already says so. Splitting changes nothing about what
reconstruction requires (the client must still subscribe to all three names
and stitch them by `toolCallId`); what it changes is *which decision is
moved off the client and onto the dispatch contract*.

The third is **discoverability for a reader of §4**. Today
`pi.tool.update` carries both *configuration* updates (the SDK payload has
`{args, partialResult}` — `args` are static at execution time per EV-4
Skeptic probe 2, but the payload shape carries both) and *output* updates.
A reader looking at the table sees one CUSTOM name with two distinct
meanings, neither of which is obvious from the name. Splitting into
`pi.tool.update` (configuration / static-args mirror) and `pi.tool.progress`
(streaming output) makes the lane read like the lane behaves: configuration
is one-shot per call, progress is many. The split is the **signifier**, not
a redundancy.

**(3) Truthful delivery claim.** The mapper is fixture-green for the new
names today; the live path is *not* runtime-observable for these events in
the installed SDK. The honest claim, in the same shape FLLWUP-5 §5.4
acceptance took for `pi.human_input.resolved`, is: the mapper accepts the
events as inputs and produces well-formed frames; the events are *not
bridgeable* from the extension-facing `ExtensionAPI.on()` in the installed
SDK (the typed exhaustive whitelist excludes them, and the runtime
session→extension forwarder whitelists only agent/turn/message/tool_execution
events); a follow-up card (its own name, not FLLWUP-3) wires the typed-on
bridge or an alternate path that delivers these events to `pi.on()`
handlers, at which point the existing mapper begins producing these frames
on the wire without further mapping work. The §4 / §5.4-adjacent spec
sentence the card mandates rides the PR as a facilitator-authored
evidence-cited amendment (EV-1 Q3 / EV-4 Q1 / FLLWUP-5 §6 precedent),
naming both the *contract* (these events map to these names) and the
*runtime caveat* (not bridgeable in the installed SDK; follow-up card
pending). This is the same shape FLLWUP-5 took for the resolved frame —
contract (a) and (b) are settled; the raise is gated on FLLWUP-8. Here,
all three contracts are settled; the *delivery* is gated on a different
follow-up card (typed-on bridge / SDK forwarder patch). The card should
not promise the remote surface a feature whose wiring it does not own.

**(4) Naming conventions — what the new names obey.**

- The name is the sole dispatch key. The `value.pi` field is provenance
  (the raw pi event name), and the `value.data` field is the semantic
  payload (`value.pi` mirrors what the SDK called the event;
  `value.data` is what the client reads).
- All new names live under the established namespaces (`pi.session.*`,
  `pi.tool.*`) — no new top-level `pi.*` category is introduced.
- The `summarization_retry_*` adjacent family uses *longer* names
  (`pi.session.summary_retry_*`) rather than a separate
  `pi.session.compaction.*` namespace, because to the client the family is
  "retry state" — the same conceptual surface as `auto_retry_*`, just for
  a different host operation. The longer prefix distinguishes the two retry
  causes without splitting the namespace.
- The `value.data` payloads preserve the SDK payload fields verbatim
  (`steering: readonly string[]` becomes `value.data.steering: string[]`;
  `attempt, maxAttempts, delayMs, errorMessage` become those exact keys),
  so a client that knows the pi SDK recognizes the fields immediately, and
  a client that does not learns the shape from the dispatch name + data
  keys alone (knowledge-in-the-world).

**Practical shape:**

```
queue_update        → CUSTOM name="pi.session.queue_update"
                      value: { pi:"queue_update", data:{ steering: string[], followUp: string[] } }

bash_execution_update → CUSTOM name="pi.tool.bash_update"
                        value: { pi:"bash_execution_update", data:{ id?: string, delta: string } }

auto_retry_start    → CUSTOM name="pi.session.retry_start"
                      value: { pi:"auto_retry_start", data:{ attempt, maxAttempts, delayMs, errorMessage } }

auto_retry_end      → CUSTOM name="pi.session.retry_end"
                      value: { pi:"auto_retry_end", data:{ success, attempt, finalError? } }

tool_execution_update (partialResult present) →
                      split into:
                      CUSTOM name="pi.tool.update" data:{ toolCallId, args }  // static-args mirror
                      CUSTOM name="pi.tool.progress" data:{ toolCallId, partialResult }  // streaming output

summarization_retry_scheduled   → CUSTOM name="pi.session.summary_retry_scheduled"
                                  value:{ pi:"summarization_retry_scheduled",
                                          data:{ attempt, maxAttempts, delayMs, errorMessage } }
summarization_retry_attempt_start → CUSTOM name="pi.session.summary_retry_start"
                                    value:{ pi:"summarization_retry_attempt_start",
                                            data:{ source:"branchSummary" } | { source:"compaction", reason } }
summarization_retry_finished    → CUSTOM name="pi.session.summary_retry_finished"
                                  value:{ pi:"summarization_retry_finished", data:{} }
```

The fold shape is unchanged: each new event is a new `PiEvent` variant and a
new `case` in `translateLive`, and `partialResult` becomes a fan-out: one
input, two CUSTOM frames. Purity stays green — all payloads are
input-derived; no clock, no entropy, no I/O is introduced. The index.ts
wiring follows the FLLWUP-5 S-O2 pattern: manual construction in an
explicit literal (e.g. `forward({ event: "queue_update", steering, followUp })`),
never `ev as PiEvent`. None of the new events are bridged by the
installed SDK today, so the wiring is fixture-reachable only, and the
acceptance clause the card demands (truthful delivery claim) is written in
the FLLWUP-5 "fixture-green, runtime-observable once the bridge lands"
shape, not in a "live today" shape.

---

## Tradeoffs accepted

1. **Two retry namespaces that share a prefix.** The `auto_retry_*` and
   `summarization_retry_*` families both live under `pi.session.*` with a
   retry-flavored sub-name (`retry_*` and `summary_retry_*`). A client that
   wants a single "retry status" pane subscribes to both prefixes; a client
   that only cares about model-call retries subscribes to `retry_*` alone.
   The alternative — putting summarization retries under `pi.context.*` —
   was rejected because to the client the conceptual surface is "host is
   waiting before continuing," which is a session-state question, and
   `pi.context.*` already carries compaction (a host operation, but a
   one-shot, not a retry loop). Mixing the two would dilute the meaning of
   the `pi.context.*` namespace.

2. **`pi.tool.bash_update` rather than widening `pi.tool.update` to carry
   bash deltas.** The temptation was to add bash deltas to the existing
   `pi.tool.update` shape (it's already the execution lane's update
   frame). I rejected that because `pi.tool.update` is currently generic
   across tools, while `bash_execution_update` is bash-specific (the SDK
   source carries it as a distinct `AgentSessionEvent`, not part of the
   generic `tool_execution_*` set). Forcing it through `pi.tool.update`
   would make the name lie about its generality. The bash-specific name
   also earns parity with the existing JSONL replay name
   `pi.tool.bash_execution` — both names describe bash, distinct from the
   generic execution lane.

3. **Two CUSTOM frames per `tool_execution_update` when both `args` and
   `partialResult` are present.** The SDK payload `{args, partialResult}`
   can carry both (EV-4 Skeptic probe 2: today `args` is static and
   `partialResult` streams; the mapper is unchanged on the input side).
   Fanning the input into one `pi.tool.update` (with `args`) and one
   `pi.tool.progress` (with `partialResult`) costs an extra frame per
   update, but the dispatch clarity is worth it: a client that subscribes
   only to `pi.tool.progress` gets exactly the streaming output it cares
   about; a client that subscribes only to `pi.tool.update` gets the
   static-args mirror. Without the split, every client that wants progress
   must subscribe to `pi.tool.update` and inspect payloads.

4. **`queue_update` is not a "drained" event, only a "currently queued"
   snapshot.** The SDK payload is `{steering: readonly string[],
   followUp: readonly string[]}` — a current snapshot, not a delta. A
   client that wanted to animate "your message just landed in the queue"
   would need a delta; instead it gets "the queue currently contains
   these N messages." That's an honest design: the SDK never emits a
   delta, so the mapper cannot invent one. The client must compute its own
   delta by diffing snapshots, and the dispatch name
   `pi.session.queue_update` (not `queue_changed`) signals that.

5. **Mapper fixture-green only — runtime-observable once the SDK bridge
   lands.** The card's third question asks for a truthful delivery claim;
   the truthful answer is that the *contract* is green today and the
   *delivery* is not. This is the same shape FLLWUP-5 §5.4 took. The
   alternative — claiming these frames will be live — would be a lie
   about the installed SDK, exactly the kind of claim FLLWUP-5 step 13
   flagged as a forward-dependency hazard.

---

## Falsifiable predictions

Each prediction names a concrete observation that would falsify it. The
Skeptic may run these as out-of-band CDP / pure-seam probes; never as
gates.

- **H1 — Name-routing prediction.** A client that subscribes to the
  `pi.tool.*` namespace and ignores `pi.session.*` will receive
  `pi.tool.bash_update` and `pi.tool.progress` but will NOT receive
  `pi.session.queue_update`, `pi.session.retry_start`, or
  `pi.session.retry_end`. Falsifier: a smoke probe that routes a synthetic
  replay through `translate()` and asserts the dispatch names; if
  `queue_update` arrives under `pi.tool.*` the routing is wrong.

- **H2 — Identity stability prediction.** A client that keys tool-progress
  rendering on `toolCallId` will render `pi.tool.progress`, `pi.tool.end`,
  and `TOOL_CALL_RESULT` for the same tool call in the correct lifecycle
  order, and a missing `TOOL_CALL_RESULT` will not strand the progress pane
  open (the `pi.tool.end` arrival already signaled "execution done"). With
  the folded `partialResult` shape, a client must also discriminate on
  field presence (`partialResult` populated = streaming; absent = static
  args). Falsifier: a CDP smoke that feeds the new mapper with the SDK
  payload shape `tool_execution_update {args:{...}, partialResult:"line
  1\n"}` followed by another `tool_execution_update {args:{...},
  partialResult:"line 2\n"}` followed by `tool_execution_end {result:...}`
  followed by `tool_result`; asserts exactly one `pi.tool.update` (args only)
  per call and N `pi.tool.progress` frames; if the mapper emits one
  `pi.tool.update` per input carrying both `args` and `partialResult`,
  the split is not real.

- **H3 — Bash stream prediction.** A client subscribing to `pi.tool.*`
  receives `pi.tool.bash_update` frames with `value.data.delta` carrying
  the SDK payload's `delta` string verbatim, in the order the SDK emits
  them, and a JSONL replay of a `bash_execution` entry produces
  `pi.tool.bash_execution` (not `pi.tool.bash_update`). Falsifier: feed
  a synthetic `bash_execution_update {id:"b1", delta:"hello\n"}` through
  the mapper and assert exactly one
  `CUSTOM name:"pi.tool.bash_update" value:{pi:"bash_execution_update",
  data:{id:"b1", delta:"hello\n"}}`; feed a JSONL
  `bash_execution {entryId, data}` and assert the existing
  `pi.tool.bash_execution` shape; if the two names collapse or the replay
  name changes, the live/replay distinction is broken.

- **H4 — Retry-state prediction.** A client subscribing to `pi.session.*`
  receives `pi.session.retry_start {attempt:1, maxAttempts:3, delayMs:500,
  errorMessage:"..."}` followed eventually by
  `pi.session.retry_end {success:true, attempt:2}` (or `{success:false,
  attempt:3, finalError:"..."}`). The retry frames are silent during the
  delay — there is no `pi.session.retry_progress` frame, and the client
  must compute the wait from `delayMs` if it wants a countdown. Falsifier:
  feed a synthetic `auto_retry_start` then `auto_retry_end {success:true}`
  sequence and assert exactly those two CUSTOM names in that order, with
  the SDK payload fields preserved verbatim in `value.data`. If a
  retry-progress frame appears in between, the design has drifted beyond
  the SDK's surface.

- **H5 — Summarization-retry prediction.** A client receives the three
  summarization-retry frames under `pi.session.summary_retry_*` (not
  under `pi.context.*`, not under a flat `pi.session.*` with the same
  prefix as `auto_retry_*`). Falsifier: feed
  `summarization_retry_scheduled {attempt, maxAttempts, delayMs,
  errorMessage}` then
  `summarization_retry_attempt_start {source:"branchSummary"}` then
  `summarization_retry_finished {}`; assert exactly three CUSTOM names
  with the `summary_retry_*` sub-prefix; if any of them lands under
  `pi.context.*` the namespace split is wrong.

- **H6 — Fold-purity prediction.** Translating any of the new event
  variants adds zero frames to `state.eventOrdinal` beyond the one frame
  per variant (or two for `tool_execution_update` with both `args` and
  `partialResult`), and `state.openMessages` is unchanged. The pure fold
  signature holds, and G-11 (no `crypto.randomUUID` / `Date.now` /
  `Math.random` in `translate.ts`) and G-12 (no socket/transport/session
  imports) remain green. Falsifier: run the existing purity grep guards
  against the patched `translate.ts`; if either guard flips from 1 to 0,
  the mapper has gained entropy or a side-effecting import.

- **H7 — `partialResult` ordering prediction.** When the mapper receives
  `tool_execution_update {args, partialResult}`, the emitted
  `pi.tool.update {args}` precedes the emitted
  `pi.tool.progress {partialResult}` in the same frame batch. A client
  that renders the static-args mirror first and the streaming pane second
  will not flicker; a client that ignores `pi.tool.update` entirely and
  only consumes `pi.tool.progress` will see only streaming output.
  Falsifier: feed the mapper `tool_execution_update {args:{cmd:"ls"},
  partialResult:"a\nb\n"}` and assert the order is
  `pi.tool.update` then `pi.tool.progress` in the resulting `frames`
  array; if reversed, the client's two-pane rendering will flicker on
  every update.

- **H8 — Runtime-observability honesty.** The acceptance criterion for the
  new mappings is fixture-green today, and the §4 / §5.4-adjacent
  spec sentence the PR carries explicitly names the runtime caveat
  (events not bridgeable from `ExtensionAPI.on()` in the installed SDK,
  follow-up card pending). Falsifier: read the spec sentence on the
  merged PR; if it omits the runtime caveat, the truthful-delivery claim
  has been quietly dropped.

- **H9 — Subscription-fidelity prediction.** When the SDK bridge lands
  (a separate card), the index.ts wiring of the new events uses manual
  PiEvent construction (FLLWUP-5 S-O2 pattern), so `forward({ event:
  "queue_update", steering, followUp })` and similar are present, and no
  `ev as PiEvent` cast appears at any new subscription site. Falsifier:
  `grep "as PiEvent" index.ts` returns no matches across the new
  subscriptions; the FLLWUP-5 cast fix is defense-in-depth and any new
  subscription must follow the same pattern.

---

## Residuals to route

Items that no test settles; surfaced for the facilitator / product-owner
to route, not for this seat to decide.

1. **SDK bridge card naming and scope.** FLLWUP-3 makes the contract
   green; delivery is gated on a separate card that wires the new events
   into `ExtensionAPI.on()` (whether by typed-on bridge — FLLWUP-9 — or by
   an SDK-side forwarder patch that exposes the internal session event
   bus). The card name and scope are a product-owner / orchestrator
   judgment. This seat's claim: the mapper work is independently valuable
   (fixture-green tests the contract end-to-end), but the user-visible
   surface claim is bounded by the bridge landing.

2. **Summarization-retry family — in scope for FLLWUP-3 or its own card?**
   The card names `auto_retry_*` as the unmapped family and treats the
   adjacent `summarization_retry_*` events as a related-but-distinct
   family. The card's Step 1 says the family boundary is "a scope call."
   My position is to land both families in FLLWUP-3, because the dispatch
   names and the pure fold changes are mechanically identical to
   `auto_retry_*` and the spec's reachability caveat applies equally;
   splitting them adds a follow-up card whose only purpose is the
   family-boundary call. The opposite position — summarization retries
   are host-internal, not user-visible, so omit them — is defensible too,
   because a client cannot do anything with a "summary retry is pending"
   frame except display it. Either way is consistent with the
   acceptance; the seat does not have a strong preference, only an
   argument for not splitting what is mechanically one change.

3. **`bash_execution_update` ordering and buffering.** The SDK emits
   deltas as the bash tool runs. A remote client that renders the bash
   pane in real time must buffer the deltas until the bash tool ends
   (so it can decide whether to render the partial stream live, or wait
   for completion and render the final output). The mapper cannot help
   with this decision — it preserves the SDK's delta order. The
   question "should the mapper emit a `bash_update` flush marker when
   the bash tool ends?" is out of scope (the SDK doesn't emit one, and
   the client can already key on `pi.tool.end` from the existing
   execution-lane mapping). I note this only because it is the kind of
   decision that, if asked, would have to be answered at the client
   layer, not in the mapper.

4. **`queue_update` "is there anything queued?" null-state.** When the
   agent has caught up, the SDK emits `queue_update {steering:[],
   followUp:[]}`. The mapper faithfully emits
   `pi.session.queue_update {steering:[], followUp:[]}`. A client that
   only wants to render "messages queued" when the count > 0 will filter
   at its layer. There is no separate `queue_drained` event, and there
   should not be — the SDK would not emit it, and inventing it would
   diverge from the SDK surface. The honest contract is the snapshot
   each time; the client decides what counts as "drained."

5. **`partialResult` empty-string semantics.** A `tool_execution_update`
   with `partialResult: ""` — is that a real update (an empty stream
   delta) or a config-only update (only `args` matter)? The SDK payload
   shape doesn't disambiguate; the mapper cannot disambiguate either,
   and it must not invent a distinction. My position is to emit
   `pi.tool.progress {toolCallId, partialResult:""}` whenever
   `partialResult` is the empty string, and let the client filter. The
   alternative — skip empty partialResult — would lie about the SDK
   surface. The residual is small but real: a client that subscribes to
   `pi.tool.progress` will see one frame per update even when the
   streaming output is empty. This seat does not have a strong
   preference; surfacing it for the consolidator to note.

6. **`auto_retry_*` and the existing `pi.session.info_change` overlap.**
   The `session_info_changed` event already carries arbitrary session
   info; the SDK may emit retry state through it. With
   `pi.session.retry_start` / `.retry_end` as dedicated names, the
   client gets structured retry fields it can render directly; without
   them, the client must parse `pi.session.info_change.value.data.info`
   for retry-shaped payloads. The dedicated names are strictly more
   informative, and the SDK does emit both surfaces — so the mapper
   can faithfully forward both without one overriding the other. I
   note this only to head off the question "isn't `pi.session.info_change`
   already covering this?": it isn't, because the SDK emits retry
   events on a dedicated channel with structured fields, and the
   client deserves a structured surface for them.

---

## Closing

The position above names the smallest set of CUSTOM frames that give the
remote client a structured, dispatch-key-driven view of the three new event
families and the live tool-progress lane; it preserves the pure fold shape
and purity guards settled in EV-4 / FLLWUP-5; it follows the established
naming and wire-shape conventions (name = sole dispatch key;
`value:{pi,data}`); it accepts the FLLWUP-5 fixture-green / runtime-pending
caveat as the truthful delivery claim; and it lands predictions the Skeptic
can probe without using them as gates.

The card asks the designer seat for *what the remote client perceives*.
The perception this design argues for is: a session-status pane that
lights up when the host is queueing messages or about to retry, and a
tool pane that streams bash output and tool progress as it happens, both
keyed by stable dispatch names a client can subscribe to without
inspecting payloads. That perception closes the Gulf of Evaluation for
two live surfaces the host already implements but the remote user cannot
yet see.
