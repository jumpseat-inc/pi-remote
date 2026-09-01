# FLLWUP-3 — Design: Map EV-4's unmapped live pi events

Card: `council/cards/FLLWUP-3.md` · Epic: EPIC-1 · Status: settled design (steps 2–6 closed; three product-owner rulings applied)

## 1. Goal

Extend the EV-4 pure fold in `src/translate.ts` so the remaining live pi events
map to defined AG-UI `CUSTOM` frames — `queue_update`,
`bash_execution_update`, `auto_retry_*`, and (ruled in) the adjacent
`summarization_retry_*` family — and land the decided AG-UI representation of
live tool-progress (`partialResult`) as the conditional split into
`pi.tool.update` / `pi.tool.progress`. The fold shape, signature, and purity
constraints are unchanged.

**Delivery honesty (settled, all seats):** mapper-only, fixture-green. No
`index.ts` wiring. These four families are unreachable via
`ExtensionAPI.on()` in the installed SDK (Skeptic O-3 closed-green), so the
acceptance claims the contract, never a live runtime surface. Runtime
observability is gated on the SDK bridge (FLLWUP-8/9 class) and re-opens per
the general rule in §8.

## 2. Binding context (non-negotiable, carried from the card)

- `translate(input, state)` stays a pure fold with the FLLWUP-5
  `entryId`-based live/JSONL discriminator. No I/O, no sockets, no entropy;
  side-effect-free import; purity guards G-11/G-12 stay green.
- `CUSTOM` shape `{ type: "CUSTOM", name: "pi.<category>",
  value: { pi: <raw-event-name>, data: <semantic payload> } }`; `name` is the
  sole dispatch key; `value.pi` carries the raw SDK event name;
  `value.data` is verbatim SDK payload passthrough (`CustomFrame.value.data`
  is typed `unknown` — zero normalization).
- New `index.ts` subscriptions never land in this card. When the SDK bridge
  lands, every new subscription uses manual PiEvent construction (FLLWUP-5
  S-O2), never `ev as PiEvent`.
- Gates: `bunx tsc --noEmit` exit 0; `bun test` exit 0 (155 baseline + new
  fixtures). No Mongo, no boot gate.
- The JSONL replay name `pi.tool.bash_execution` (`translate.ts:324–326`) is
  unchanged.

## 3. Final mapping table (rulings applied)

| # | Input (live PiEvent variant) | CUSTOM `name` | `value.pi` | `value.data` |
|---|---|---|---|---|
| 1 | `queue_update` | `pi.session.queue_update` | `"queue_update"` | `{ steering, followUp }` verbatim — snapshot, not delta |
| 2 | `bash_execution_update` | `pi.tool.bash_execution_update` (J-1) | `"bash_execution_update"` | `{ id?, delta }` verbatim |
| 3 | `auto_retry_start` | `pi.session.retry_start` | `"auto_retry_start"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| 4 | `auto_retry_end` | `pi.session.retry_end` | `"auto_retry_end"` | `{ success, attempt, finalError? }` verbatim |
| 5 | `summarization_retry_scheduled` | `pi.session.summary_retry_scheduled` | `"summarization_retry_scheduled"` | `{ attempt, maxAttempts, delayMs, errorMessage }` verbatim |
| 6a | `summarization_retry_attempt_start`, `data.source === "branchSummary"` | `pi.session.summary_retry_branch` (J-3) | `"summarization_retry_attempt_start"` | union verbatim |
| 6b | `summarization_retry_attempt_start`, `data.source === "compaction"` | `pi.session.summary_retry_compaction` (J-3) | `"summarization_retry_attempt_start"` | union verbatim |
| 6c | `summarization_retry_attempt_start`, `source` neither value / missing | *no frame emitted* (pinned, see §5 item 8) | — | — |
| 7 | `summarization_retry_finished` | `pi.session.summary_retry_finished` | `"summarization_retry_finished"` | `{}` verbatim |
| 8 | `tool_execution_update`, `args !== undefined` | `pi.tool.update` | `"tool_execution_update"` | `{ toolCallId, args }` |
| 9 | `tool_execution_update`, `partialResult !== undefined` | `pi.tool.progress` | `"tool_execution_update"` | `{ toolCallId, partialResult }` — emitted **after** `pi.tool.update` when both present; `""` is present and emits |
| 10 | JSONL `bash_execution` (replay, unchanged) | `pi.tool.bash_execution` | passthrough | unchanged (`translate.ts:324–326`) |

Ruling provenance: J-1 rules the long bash name; J-2 rules
`summarization_retry_*` in scope; J-3 rules two names for
`summarization_retry_attempt_start`, keyed on `data.source`; the retry family
names `pi.session.retry_start` / `pi.session.retry_end` were settled by
unanimity in round 3. Rows 8–9 are the settled conditional-emission split.
Rows 2 and 8–9 are runtime-bridgeable today (`tool_execution_update` has a
typed `on()` overload and a forwarder — O-1 closed-red); rows 1 and 3–7 are
not (O-3 closed-green).

SDK payload shapes (Skeptic O-2 closed-green,
`pi-coding-agent/dist/core/agent-session.d.ts:46–103`):

- `queue_update { steering: readonly string[], followUp: readonly string[] }`
- `bash_execution_update { id?: string, delta: string }`
- `auto_retry_start { attempt, maxAttempts, delayMs, errorMessage }`
- `auto_retry_end { success, attempt, finalError? }`
- `summarization_retry_scheduled { attempt, maxAttempts, delayMs, errorMessage }`
- `summarization_retry_attempt_start { source: "branchSummary" } | { source: "compaction", reason }`
- `summarization_retry_finished {}`

## 4. `tool_execution_update` conditional-emission matrix

The `PiEvent` variant carries independently-optional
`args?: unknown; partialResult?: string` (`translate.ts:138`). Emission:

| `args` | `partialResult` | frames emitted (in order) |
|---|---|---|
| present | present | `pi.tool.update` then `pi.tool.progress`, both carrying `toolCallId` |
| present | absent | exactly one `pi.tool.update` |
| absent | present (including `""`) | exactly one `pi.tool.progress` |
| absent | absent | **exactly zero frames** (O-5 — see §5 item 7) |

Presence means `!== undefined`; `partialResult: ""` is present and emits.

## 5. Fixtures and gates (complete list — all required)

1. **Per-event single-frame fixtures** for every new variant: rows 1–5 and 7,
   plus **two** fixtures for `summarization_retry_attempt_start` (branch and
   compaction arms, rows 6a/6b). Each asserts the exact `name`, `value.pi`,
   and `value.data`. This is the only guard against the `default: break`
   silent drop at the fold's exhaustiveness guard.
2. **Conditional-emission matrix fixtures** (§4): both-fields → exactly
   `[pi.tool.update, pi.tool.progress]` in that order, `toolCallId` on both;
   args-only → one update, zero progress; partialResult-only → one progress,
   zero update; `partialResult: ""` → progress emitted (pinned, not
   accidental).
3. **O2 fixture update in the same commit**:
   `test/translate.test.ts` O2 (start → update{args,partialResult} → end)
   changes from 3 asserted frames to 4; its `startsWith("pi.tool.")`
   assertions stay green for both split names.
4. **Live/replay non-collapse fixtures** (designer H3): a JSONL
   `bash_execution` entry produces `pi.tool.bash_execution` and never
   `pi.tool.bash_execution_update`; a live `bash_execution_update` produces
   `pi.tool.bash_execution_update` and never `pi.tool.bash_execution`.
5. **Dead-wiring grep gate** (runnable "mapper-only" proof):
   `grep -nE 'deps\.on\("(queue_update|bash_execution_update|auto_retry_start|auto_retry_end|summarization_retry_scheduled|summarization_retry_attempt_start|summarization_retry_finished)"' index.ts`
   exits 1. Also: `grep -n "as PiEvent" index.ts` exits 1 (unchanged state).
6. **Purity guards**: G-11/G-12 greps green; no new imports in
   `translate.ts`.
7. **O-5 neither-field closure (implementation-time, owner's call as
   recorded):** either pin a fixture asserting the neither-field case emits
   exactly 0 frames (intended), or tighten the union/transform so the
   neither-case is unrepresentable at the type level — in which case the
   tsc gate subsumes the fixture. Either closure is acceptable; skipping it
   is not.
8. **Row 6c pin (implementation convention, same class as O-5):** a
   `summarization_retry_attempt_start` payload whose `source` is neither
   `branchSummary` nor `compaction` emits exactly 0 frames, pinned by
   fixture. (The SDK union has only those two arms; 6c keeps the fold total
   and deterministic without inventing a third name no ruling created.)
9. **Gates**: `bunx tsc --noEmit` exit 0; `bun test` exit 0 (155 baseline +
   all new fixtures); determinism: translating a sequence containing every
   new event twice yields byte-identical frames.

## 6. Doc-comments required (in the same PR)

- **At the `tool_execution_update` split case site:** record the
  conditional-emission rule and the H2/H7 rationale (progress clients key on
  `toolCallId`; the dispatch key carries the lifecycle question so no client
  field-inspects to discriminate).
- **At the `bash_execution_update` case site (J-1's losing-concern
  service):** note the JSONL replay cousin `pi.tool.bash_execution` and that
  the `_update` suffix IS the live/replay distinction, consistent with the
  SDK's own naming of the pair.

## 7. Spec amendment (rides the PR; text authored here per EV-1 Q3 / EV-4 Q1)

In `docs/PI-SPEC.md` §4's table, add below the existing
`model_select, thinking_level_select, session_info_changed` row:

```
| `queue_update` | `CUSTOM` (`pi.session.queue_update`) | queue snapshot (`{steering, followUp}`), not a delta; client diffs snapshots — no SDK `queue_drained` event exists |
| `bash_execution_update` | `CUSTOM` (`pi.tool.bash_execution_update`) | live bash output delta (`{id?, delta}`); the `_update` suffix is the live/replay distinction against the JSONL replay name `pi.tool.bash_execution` |
| `auto_retry_start` / `auto_retry_end` | `CUSTOM` (`pi.session.retry_start` / `pi.session.retry_end`) | retry state (`attempt`, `maxAttempts`, `delayMs`, `errorMessage` / `success`, `finalError?`); raw SDK names ride in `value.pi` |
| `summarization_retry_scheduled` / `_attempt_start` / `_finished` | `CUSTOM` (`pi.session.summary_retry_scheduled` / `summary_retry_branch` or `summary_retry_compaction` / `summary_retry_finished`) | `attempt_start` fans out on `data.source`: `branchSummary` → `summary_retry_branch`, `compaction` → `summary_retry_compaction`; payload passes through verbatim |
| `tool_execution_update` (refined) | `CUSTOM` (`pi.tool.update` + `pi.tool.progress`) | conditional split by payload: `args` present → `pi.tool.update {toolCallId, args}`; `partialResult` present → `pi.tool.progress {toolCallId, partialResult}`, emitted after `update` when both carry; empty-string `partialResult` emits |
```

Immediately after the table's closing paragraph (`pi concepts AG-UI cannot
express…`), add one evidence-cited caveat paragraph:

> The `queue_update`, `bash_execution_update`, `auto_retry_*`, and
> `summarization_retry_*` families are **not runtime-observable** in the
> installed pi SDK: `ExtensionAPI.on()` is a typed whitelist that does not
> include them (`dist/core/extensions/types.d.ts` ~905–941) and the runtime
> session→extension forwarder whitelists only agent/turn/message/
> tool_execution events (`dist/core/agent-session.js` ~470–555). Their
> mapper rows are contract-green, not live; wiring lands with the SDK bridge
> (FLLWUP-8/9), and this caveat is amended again in the same PR that makes
> it false. This caveat does **not** cover `pi.tool.update` /
> `pi.tool.progress`: `tool_execution_update` is bridgeable today (typed
> `on("tool_execution_update")` overload; forwarder at
> `agent-session.js:537–546`).

## 8. Out of scope / non-goals

- No `index.ts` subscriptions for any family in this card (dead-wiring gate
  enforces it).
- The names in §3 are **stable keys** (product-owner general rule):
  FLLWUP-8 and FLLWUP-9 may not relitigate them. When the SDK bridge lands:
  (a) every new subscription for the four families uses manual PiEvent
  construction (FLLWUP-5 S-O2), never `ev as PiEvent`; (b) each mapping's
  acceptance re-opens from fixture-green to runtime-observable (FLLWUP-8's
  existing re-open pattern), and the §7 caveat is amended in the same PR
  that makes it false; (c) FLLWUP-9's vendored typed `on()` union reflects
  the real SDK whitelist — until the SDK forwards a family, that family
  stays unwired regardless of the mapper; FLLWUP-9 is not license to add
  dead subscriptions.
- `user_input` and `ui.confirm` deadness remain fenced to FLLWUP-8; neither
  is touched here.
- Client-layer concerns (queue null-state filtering, bash delta buffering)
  are out of mapper scope; the mapper preserves SDK payload order verbatim.

## 9. Acceptance checklist

- [ ] All row-1–7 variants + row 6a/6b fan-out map per §3 through the
      unchanged `translate(input, state)` signature.
- [ ] `partialResult` surfaces as `CUSTOM pi.tool.progress` per §4, never
      smuggled into `TOOL_CALL_ARGS` (no `TOOL_CALL_ARGS` frame appears in
      any new-fixture output).
- [ ] All §5 fixtures and gates pass; 155-baseline stays green.
- [ ] Purity guards green; import side-effect-free.
- [ ] §7 spec amendment applied verbatim (table rows + caveat paragraph).
- [ ] §6 doc-comments present at both case sites.
- [ ] No dead `index.ts` wiring (grep gate exit 1).
