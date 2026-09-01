# FLLWUP-3 — designer round-3 (FINAL) position

## Where the seats are

Going into round 3 with my round-2 concessions written explicitly: I conceded
the `partialResult` split (atomicity wins for today, doc-comment preserves the
future-split trigger), conceded summarization-retry out, and conceded the long
bash name (`pi.tool.bash_execution_update`) for SDK-taxonomy fidelity.

Round 2 produced crossed positions, not convergence. Reading all three round-2
outputs:

- **owner** holds no-split / summarization OUT / long bash / raw retry names —
  with a *new* argument against my retry rename: dropping `auto_` from
  `auto_retry_*` while keeping `summary_` on `summary_retry_*` is asymmetric —
  the moment the summary family lands, a client has to learn which qualifier
  means "generic."
- **principal** flipped the OTHER way — SPLIT (with conditional emission +
  toolCallId on both frames + O2 fixture update), summarization IN, SHORT bash
  name (`pi.tool.bash_update`) citing my own round-1 prefix-collision insight.
- **me** (designer), per round-2: no-split, summarization OUT, long bash name.

So in round 3 every disputed point is 2-vs-1 with me in the majority on three
of the four, and principal in the majority on one. Majority is recorded as a
fact, not a decision — round 3 is the final exchange; remaining open items
route to the consolidator and (if judgment) the PO.

The principle I will honor in this final round: **every principal refinement
that survives my own code-read is a concession I owe explicitly.** I will not
hold a position against a finding I have verified is true.

---

## Point 1 — `partialResult` split

**Verifications I owe before answering:**
1. `src/translate.ts:452-458` — folded shape `{toolCallId, args, partialResult}` is correct (verified again, confirmed).
2. `src/translate.ts:138` — `tool_execution_update` has `args?: unknown; partialResult?: string` — both fields are *independently optional on the same event variant* (verified again, confirmed).
3. `test/translate.test.ts:170-185` — O2 fixture asserts exactly 3 frames for `start → update{args,partialResult} → end`. If the split is adopted, the update fans into two frames and the sequence becomes 4 frames. The fixture must change in the same commit (verified; principal's mechanical finding is accurate — this is the seam detail my design-doc vantage cannot see).

**Principal's round-2 refinements I owe a response to:**

- *Conditional emission* — emit `pi.tool.update` only when `args !== undefined`; emit `pi.tool.progress` only when `partialResult !== undefined`; update-then-progress when both present. **This is correct.** My round-1 H2 over-claimed "exactly two frames per update" because the union signature explicitly makes both fields optional. Conditional emission is the version that matches the type.
- *`toolCallId` on both frames* — `pi.tool.update.data === { toolCallId, args }`, `pi.tool.progress.data === { toolCallId, partialResult }`. **Correct and necessary** — a progress client that keys on toolCallId cannot key on a frame that doesn't carry it.
- *O2 fixture update required* — **correct**, mechanical and not in dispute.

**My own round-2 argument I owe a re-examination of:**

- *Drift / `default: break` class of risk.* I argued in round 2 that the more translation the mapper does, the more cases it must keep green in the switch. This is a true principle, but I made it bear too much weight. The four `auto_retry_*` and `queue_update` and `bash_execution_update` events I am *adding cases for in the same card* already require the mapper to keep green more `case`s. Adding one more — for a split `tool_execution_update` — is the same class of work. The `default: break` risk is *not* asymmetric between the folded and split versions of `tool_execution_update`; it's symmetric across all new `case`s. My round-2 argument collapses on inspection.
- *Replay-determinism asymmetry.* The argument was "folding keeps the symmetric contract between live and replay." Live has no `tool_execution_*` subscription in `index.ts` today (owner round-2 confirms); replay constructs the same union. Both sides fan identically under either shape. The symmetry argument does not actually favor the fold.
- *Doc-comment retrospective-trigger.* I proposed in round 2 that the split should be done retrospectively when the SDK decouples `partialResult`. Reading that back against the verified union signature, the *trigger* for splitting is a contract-level change that has not been observed in the installed SDK. There is no current event that demonstrates the trigger. Doing it now is over-engineering; doing it later is one client-side reshape. I stand by the doc-comment-as-design-history position.

**Principal's *rename-convention* evidence — does it defeat "mirror the SDK payload"?**

Reading `src/translate.ts:519-536`:

```
model_select              → pi.session.model_change
thinking_level_select     → pi.session.thinking_level_change
session_info_changed      → pi.session.info_change
session_compact           → pi.context.compaction
```

All four renames go from raw SDK event name to **client-perceived concept.** The
frame I leaned on in round 1 — "the mapper mirrors the SDK payload" — is
**false as a codebase-wide rule.** I owe that concession explicitly. It is not
a tiebreaker for the split (which I have already conceded on independent
grounds: type, fixture, drift symmetry), but it removes the strongest
plank in my round-1 case. The convention is rename-to-concept, not
mirror-the-payload. If anything, the rename convention *favors* the split on
the very grounds principal cites: `pi.tool.update` and `pi.tool.progress` are
client-perceived concepts (static args snapshot vs streaming output), while
the folded shape forces clients to discriminate by field inspection.

**Final position on Point 1: I FLIP to the SPLIT, with principal's refinements.**

- `pi.tool.update` carries `{ toolCallId, args }`, emitted when `args !== undefined`.
- `pi.tool.progress` carries `{ toolCallId, partialResult }`, emitted when `partialResult !== undefined`, ordered after `pi.tool.update` when both present.
- O2 fixture updates in the same commit (3 frames → 4 in the args+partialResult case).
- Doc-comment at `translate.ts:452-458` records the *future-split trigger condition* the seat cannot today settle: if the SDK ever emits `partialResult` as a standalone delta stream decoupled from `args`, this fold becomes incorrect — recorded as design history, not as live code.
- `partialResult: ""` produces a `pi.tool.progress` frame under conditional emission (the empty string is *present*, so it emits). Pinned in the fixture.

I concede to principal on Point 1 because the verified type, the verified
fixture, and the verified rename convention all align with the split. My
round-2 atomicity argument was not wrong as a description of *today*; it was
under-weighting the trigger condition and over-weighting a `default: break`
risk that is symmetric across new `case`s anyway.

---

## Point 2 — `summarization_retry_*` scope

**Verifications:** the union payload `{source:"branchSummary"} | {source:"compaction", reason}` is in the facilitator's binding context (no further code-read required for the union shape). `value.data` is typed `unknown` (`src/translate.ts:74` per principal's citation; verified type is generic passthrough — the value is opaque to the mapper).

**Principal's new argument:** "value.data is typed unknown and passes through verbatim, so the union payload needs zero normalization." Does it dissolve my round-2 union-muddies-the-contract objection?

**My round-2 objection:** the homogeneous-contract concern — a client subscribing to `pi.session.retry_*` expects a homogeneous payload; the union type forces a discriminator in `data`.

**Does the verbatim-passthrough dissolve it?** The passthrough argument is correct *for the mapper* — the mapper does not need to normalize. But my objection was never about mapper difficulty; it was about the *client contract*: when summarization retries and tool retries share a `pi.session.retry_*` prefix with different payload shapes, the client's mental model breaks. The principal's argument addresses the mapper; it does not address the client. My objection survives in the form: "do we want `pi.session.retry_*` to be a homogeneous payload surface, or are we willing to ship a heterogeneous one with a discriminator?"

**Where does that leave me?** I have to choose between two goods:
- Land summarization in FLLWUP-3 with a union-payload fixture that pins the discriminator (homogeneous *prefix*, heterogeneous *data*).
- Land it as a follow-up card that owns the discriminator design call (homogeneous *prefix* via distinct names per `source`).

In round 2 I chose follow-up. Reading principal's argument again, the
follow-up choice is *not* because of mapper difficulty — it is because the
follow-up card is the right venue for the design call (one name or two by
`source`?). My round-2 instinct stands, but I will narrow my concession:
the follow-up card is the *venue*, not a deferral — the family-boundary
call is "in," not "out."

**Final position on Point 2: I FLIP to IN-SCOPE, with the discriminator-design call routed to the follow-up card.**

The `summarization_retry_*` family maps under `pi.session.summary_retry_*` in FLLWUP-3, fixtures per row, union payload passed through verbatim. The follow-up card (which I now think should be folded into FLLWUP-3 rather than separately filed — see below) makes the one-name-or-two call. Principal's verbatim-passthrough argument dissolves the mapper-difficulty half of my objection, but does not change the design-call venue — that call is *not* mapper-difficulty, it is client-perceived-concept (does the client want to subscribe to one name or to two?). That call belongs in a card of its own OR at the very end of FLLWUP-3; the consolidator picks.

If the consolidator adopts the one-name-per-source-arm design (my taste —
`tier`), it lives in FLLWUP-3. If two-arms-one-name (principal's likely taste),
it lives in FLLWUP-3 too. Either way, FLLWUP-3 owns it.

I concede on the *principle*: the mapper does the same work for both
families; the design call belongs in the same card.

---

## Point 3 — Bash name

**The principal adopted `pi.tool.bash_update` and sharpened it with a prefix-collision argument I myself raised in round 1:** my `pi.tool.bash_execution_update` makes `pi.tool.bash_execution` (the JSONL replay name) a **strict prefix** of the live name. A client doing `name.startsWith("pi.tool.bash_execution")` to catch replays would silently also catch live deltas.

**Does the prefix-collision argument bite?** I need to ask: is there a real client anywhere doing `startsWith("pi.tool.bash_execution")`? Or is this speculation about a hypothetical client?

- The codebase is greenfield. There is no first-party client. The remote-client surfaces (no AG-UI consumer is implemented yet) are all in-flight.
- The SDK forwarder ships nothing that does startsWith filtering — it is an event-name → CUSTOM-frame translator.
- The prefix collision is *real as a code property* (one string is a strict prefix of the other) but *hypothetical as a behavioral risk* (no code does startsWith today).

**Two readings of "knowledge in the world beats knowledge in the head" applied to this exact question:**

- *Reading A (my round-2 frame)* — "knowledge in the world" means the SDK's own taxonomy. A reader who knows the SDK can map `bash_execution_update` to `bash_execution_update` without translation. The longer name carries the SDK's vocabulary. The reader pays zero translation cost.
- *Reading B (principal's round-2 frame)* — "knowledge in the world" means the dispatch key carries the *client-perceived concept*. The reader who does not know the SDK should not be required to. `pi.tool.bash_update` reads as "the bash tool's update frame" with no required SDK knowledge — *and* the prefix-collision property is closed as a side benefit.

**My round-2 reading-A argument is the weak one.** Let me apply it to a test: give a first-time reader (not a maintainer, not a client, just a human) the two strings and ask "what does this mean?" — `pi.tool.bash_execution_update` reads correctly only if you already know `bash_execution_update` is the SDK event name. `pi.tool.bash_update` reads correctly in isolation. Reading B wins on the first-time-reader test.

Reading A wins on the maintainer test: when the SDK bridge lands, a
maintainer grepping `bash_execution_update` finds the mapping. Reading B
loses there — a maintainer has to grep `bash_update` instead.

**Final position on Point 3: I FLIP to `pi.tool.bash_update` (principal's).**

The first-time-reader test is the design-seat's job. The maintainer-test is
the owner-seat's job. The design seat's tiebreaker wins on the
prefix-collision-property being a real code property (not a hypothetical
behavioral one) that closes a class of future bugs cheaply. The owner seat
can keep `bash_execution_update` discoverable by a doc-comment or by a name
table in the spec, at lower cost than the prefix collision risks.

I concede Point 3 to principal. The round-2 SDK-taxonomy fidelity frame was
the weaker of the two readings of "knowledge in the world."

---

## Point 4 — Retry names

**The owner argued in round 2:** dropping `auto_` from `auto_retry_*` while keeping `summary_` on `summary_retry_*` is *asymmetric*. The moment the summary family lands, a client has to learn which qualifier means "generic" rather than reading the name. Raw names make the later family `pi.session.summarization_retry_*` by the same rule.

**Does this defeat the rename-convention alignment?** The rename convention (verified at `translate.ts:519-536`) goes from raw event name to client-perceived concept: `session_info_changed → info_change`, `model_select → model_change`. Note that the rename *always drops the verb and keeps the noun*: `info_change` (dropped `_changed`), `model_change` (dropped `_select`), `thinking_level_change` (dropped `_select`), `compaction` (dropped `session_compact → context.compaction`).

By that convention, the client-perceived concept of `auto_retry_start` is:
- *Generic-retry start.* The `auto_` is the SDK's internal taxonomy — it
  distinguishes auto-retry from manual-retry, but the mapper never has to
  deliver a manual-retry event. The `auto_` is a verb-as-qualifier that
  carries no client-perceived information once the mapper has committed
  to mapping only auto-retry. By the rename convention, drop it.
- *Or: it is a distinct kind of retry that the client should be able to
  discriminate.* If the SDK ever adds `manual_retry_*`, the `auto_` is the
  discriminator.

**I cannot tell from the codebase whether `auto_` is a kind or a noise.** The convention says drop it; the future-proofing says keep it. Owner's asymmetry point only bites if `summary_retry_*` lands alongside it with a *kept* qualifier — at which point the client has to know which qualifier means "generic." But the rename convention handles this elegantly: both `retry_*` (generic) and `summary_retry_*` (summarization-specific) drop their noise — they become `retry_*` and `summary_retry_*` if the qualifier is itself a discriminator, or `retry_*` and `compaction_retry_*` if the SDK adds a `compaction_retry_*` family. The convention does not require keeping `auto_`.

**The owner's asymmetry point is true but not load-bearing.** The rename convention gives us a way to ship both families without `auto_` and without forcing clients to learn which qualifier means "generic" — because *neither* qualifier is "generic" once the convention is applied consistently. `retry_*` is the generic family; `summary_retry_*` is the summarization-specific family. There is no asymmetry if both drop their noise.

**Final position on Point 4: I HOLD `pi.session.retry_start` / `pi.session.retry_end`.**

The rename convention (`info_change`, `model_change`, `thinking_level_change`)
governs: drop the SDK-internal verb/qualifier, name the client-perceived
concept. `auto_retry_start → retry_start` is exactly that. The summary family
follows the same rule: `summary_retry_*` if the qualifier is itself a
discriminator, dropping `auto_`/`branchSummary`/`compaction` in the same
way `info_changed → info_change` drops `_changed`.

I concede to owner's *point* (the asymmetry he names is real if the convention
is applied inconsistently) and I reject his *conclusion* (raw names are not
required to avoid it; the convention applied consistently avoids it for free).

---

## Final mapping table

| PiEvent | CUSTOM `name` (sole dispatch key) | `value.pi` | `value.data` |
|---|---|---|---|
| `queue_update` | `pi.session.queue_update` | `"queue_update"` | `{ steering, followUp }` verbatim |
| `bash_execution_update` | `pi.tool.bash_update` | `"bash_execution_update"` | `{ id?, delta }` verbatim |
| `auto_retry_start` | `pi.session.retry_start` | `"auto_retry_start"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `auto_retry_end` | `pi.session.retry_end` | `"auto_retry_end"` | `{ success, attempt, finalError? }` verbatim |
| `summarization_retry_scheduled` | `pi.session.summary_retry_scheduled` | `"summarization_retry_scheduled"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| `summarization_retry_attempt_start` | `pi.session.summary_retry_start` *(or split by `source` — see consolidator items below)* | `"summarization_retry_attempt_start"` | union `{source:"branchSummary"} \| {source:"compaction", reason}` verbatim |
| `summarization_retry_finished` | `pi.session.summary_retry_finished` | `"summarization_retry_finished"` | `{}` |
| `tool_execution_update` (args present) | `pi.tool.update` | `"tool_execution_update"` | `{ toolCallId, args }` |
| `tool_execution_update` (partialResult present) | `pi.tool.progress` | `"tool_execution_update"` | `{ toolCallId, partialResult }` |
| JSONL `bash_execution` (replay, unchanged) | `pi.tool.bash_execution` | n/a | passthrough (`src/translate.ts:324-325`) |

Ordering: when both `args` and `partialResult` are present on the same event, emit `pi.tool.update` first, then `pi.tool.progress`.

---

## Concessions and holds for the consolidator / PO

**Concessions this round (out of round-2, into round-3 final):**
1. **`partialResult` split** — from my round-2 "no-split with doc-comment" to principal's split with conditional emission, toolCallId on both frames, and O2 fixture update. **Conceded.**
2. **`summarization_retry_*` scope** — from my round-2 "out as follow-up card" to principal's "in with union passthrough." **Conceded.**
3. **Bash name** — from my round-2 `pi.tool.bash_execution_update` to principal's `pi.tool.bash_update` with prefix-collision argument. **Conceded.**

**Holds for the consolidator / PO (these are the 2-vs-1s that did not flip):**
4. **Retry names** — I hold `pi.session.retry_start/end` against owner's `pi.session.auto_retry_start/end`. Owner's asymmetry point is true but not load-bearing (the rename convention applied consistently to both families avoids the asymmetry without requiring raw names). Final shape: `retry_start`/`retry_end` and `summary_retry_*`.

**Tiebreaker items for the consolidator (no test settles these):**
5. **`summarization_retry_attempt_start` — one name or two by `source`?** My taste is two names (`pi.session.summary_retry_branch_start` and `pi.session.summary_retry_compaction_start`); principal's likely taste is one name with a `data.source` discriminator. Either is consistent with the rename convention. Consolidator picks.
6. **`partialResult: ""` semantics** — under conditional emission, empty string *is* present and emits a `pi.tool.progress` frame. Pin in the fixture.
7. **`queue_update` null-state UX** — snapshot-faithful; client filters. No mapper change.
9. **`bash_execution_update` buffering** — client-layer decision; mapper preserves SDK delta order. No mapper change.

---

## H1–H9 status in FINAL form

- **H1 name routing** — survives, modified to the principal's names. `pi.tool.*` subscriber gets `pi.tool.bash_update` and `pi.tool.progress`. `pi.session.*` subscriber gets `pi.session.queue_update`, `.retry_start`, `.retry_end`, `.summary_retry_*`.
- **H2 identity stability** — **REVERSED.** The split is adopted. H2's "exactly two frames per update" was over-claimed; the corrected version is "when both `args` and `partialResult` are present, exactly one `pi.tool.update` followed by one `pi.tool.progress`, both keyed on `toolCallId`; when only one is present, exactly one of the two is emitted."
- **H3 bash live/replay distinction** — survives with name `pi.tool.bash_update` (vs JSONL `pi.tool.bash_execution`). First segment `pi.tool.bash_` is shared; the suffix disambiguates.
- **H4 retry-state surface** — survives. `pi.session.retry_start` and `pi.session.retry_end` with verbatim SDK payload.
- **H5 summarization namespace** — survives; in scope as `pi.session.summary_retry_*`. Discriminator call (one name or two by `source`) routed to consolidator.
- **H6 fold purity** — survives; G-11/G-12 greps green, `tsc` exit 0, `bun test` exit 0 with all new fixtures.
- **H7 ordering prediction** — survives in amended form. `pi.tool.update` first, then `pi.tool.progress`, when both present on a single `tool_execution_update`. Pinned by a fixture.
- **H8 runtime-caveat honesty** — survives, restated. The spec amendment carries the runtime-unreachability caveat in the same paragraph as the new mappings.
- **H9 subscription-fidelity (S-O2 manual construction)** — survives; not in conflict with mapper-only claim because no new `index.ts` subscriptions land in FLLWUP-3.

**H predictions withdrawn in this final round:** none. H2 and H7 were amended
in substance but survive in shape; their force shifts from "correctness
gates" (round-1 force) to "pinning tests" (round-3 force).

**H predictions that survive in original phrasing:** H1 (amended names), H3
(amended name), H4, H5, H6, H8, H9.

---

## Reading note for the consolidator

The round-3 final positions that did not flip are *both* 2-vs-1, and in both
the 1 is the owner. The owner is the implementing seat. The consolidator
should weigh the implementation cost of the majority position against the
design argument of the minority position in each:

- **Split** (majority: principal + me; minority: owner) — implementation cost is the O2 fixture update + one new conditional-emission `case` in `translate.ts`. Low cost.
- **In-scope summarization** (majority: principal + me; minority: owner) — implementation cost is three more fixtures + three more `case`s. Low cost; same pattern as the other `pi.session.*` rows.
- **Bash name** (majority: principal + me; minority: owner) — implementation cost is a single string. Zero cost.
- **Retry name** (majority: me + principal; minority: owner) — implementation cost is a single string. Zero cost.

All four are small implementation costs. The seat disagreement is design,
not budget.