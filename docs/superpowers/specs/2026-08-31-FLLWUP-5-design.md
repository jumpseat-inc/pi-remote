---
type: spec
card: FLLWUP-5
epic: EPIC-1
title: "Emit pi.human_input.resolved host-side completion event"
created: 2026-08-31
status: settled
---

# FLLWUP-5 design — `pi.human_input.resolved` host-side completion

This spec writes up the FLLWUP-5 design as settled by the Council's capped
deliberation (steps 2–6) and the binding product-owner ruling of 2026-08-31
(`vault/raw/2026-08-31-po-fllwup5-ruling.md`). It is the sole handoff to the
owner. Nothing in steps 2–6 is reopened; the rulings resolve what the
deliberation left open, and this document folds them in.

An owner reading only this file must implement one design, not two. Where the
deliberation settled a thing, that settlement is stated without alternatives.

## Goal (unchanged)

A remote device that resolves an approval prompt receives a CUSTOM
`pi.human_input.resolved` completion frame `{promptId, occurrence, deviceId,
ts}` confirming its resolution was applied, emitted via an added
`ui_prompt_end` surface in `translate.ts` and wiring in the lifecycle layer.

## Scope (binding — card split per ruling Item 5)

IN SCOPE for FLLWUP-5:

- **Contract (a)** — `ui_prompt_end` PiEvent + pure mapping
  (`pi.human_input.closed`), manual construction.
- **Contract (b)** — lifecycle emission of `pi.human_input.resolved`
  `{promptId, occurrence, deviceId, ts}` from the captured `InjectResult`,
  on `resolved` and `steered_fallback`-with-`tracked:true`.
- **S-O3** — `InjectResult.steered_fallback` gains `tracked: boolean`;
  plus the `occurrence` field necessary to satisfy the J-FIELDSET wire shape
  (see §4 below).
- **S-O2** — manual construction across all **seven** `forward(ev as PiEvent)`
  subscriptions in `index.ts`'s `deps.on(...)` block (the six existing call
  sites + the new `ui_prompt_end`).
- §4/§5.4-adjacent spec amendment on the PR (facilitator-authored,
  evidence-cited, fixture-green per ruling Item 2).

OUT OF SCOPE for FLLWUP-5 (own follow-up cards, filed at step 13 as
FLLWUP-8 / FLLWUP-9):

- The **raise path** (`ui_prompt_start` wiring, `registerPrompt` wired to a
  live SDK payload) — FLLWUP-8. FLLWUP-5 stays fixture-scoped; contract (b)
  is fixture-green today, runtime-observable only after FLLWUP-8 lands.
- The **typed-on bridge** (replacing the local `ExtensionAPI.on(event:
  string)` stand-in with the real SDK's typed exhaustive `on()`) — FLLWUP-9.
  Until then the local permissive type remains; FLLWUP-5's manual
  construction is the defense in depth that keeps the seven live-path
  subscriptions honest despite the type hiding the cast.

## 1. Contract (a) — `ui_prompt_end` PiEvent → `pi.human_input.closed`

### 1.1 PiEvent union (`src/translate.ts`)

Add a local `UIPromptKind` type and a `ui_prompt_end` variant to `PiEvent`:

```ts
export type UIPromptKind = "select" | "confirm" | "input" | "editor" | "custom";
```

```ts
| { event: "ui_prompt_end"; kind: UIPromptKind; title?: string }
```

`UIPromptKind` matches the installed pi SDK's `UIPromptKind`
(`pi-coding-agent/dist/core/extensions/types.d.ts` line 563). The repo has
no SDK dependency; the type is declared locally so `translate.ts` stays pure
and self-contained.

### 1.2 Pure mapping (`translateLive`)

Add a `case "ui_prompt_end"` to `translateLive` that emits exactly:

```ts
frames.push({
  type: "CUSTOM",
  name: "pi.human_input.closed",
  value: { pi: "ui_prompt_end", data: { kind: input.kind, title: input.title, schemaVersion: 1 } },
});
```

- This is an **informational passive mirror** — `ui_prompt_end` carries only
  `{kind, title?}` and cannot be correlated to a `promptId` (schema gap:
  kind ≠ promptKind, title ≠ prompt; plus the fold cannot mint a `ts`). It is
  a distinct `CUSTOM` name (`pi.human_input.closed`), never merged with the
  lifecycle `pi.human_input.resolved`. §4 name is the sole dispatch key; the
  two names are distinct, no collision.
- The fold carries only `kind, title` — no `ts`, no `deviceId`, no `promptId`.
- **Purity stays green**: this case adds no clock, no entropy, no I/O.
  G-11/G-12 static purity guards remain satisfied.

## 2. Contract (b) — lifecycle emission of `pi.human_input.resolved`

### 2.1 Capture the InjectResult (`src/index.ts`)

Currently `onInbound: (env) => void injector.handle(env)` discards the
`InjectResult`. Change the wiring so the result is captured and dispatched:

```ts
onInbound: (env: InboundEnvelope) => {
  void injector.handle(env).then((result) => {
    if (result.kind === "resolved") {
      emitResolved(result.promptId, result.occurrence, result.deviceId);
    } else if (result.kind === "steered_fallback" && result.tracked) {
      emitResolved(result.promptId, result.occurrence, result.deviceId);
    }
    // ignored / injected / stale / steered_fallback-with-tracked:false → no resolved
  });
},
```

`emitResolved(promptId, occurrence, deviceId)` sends on the transport handle:

```ts
transportRef.handle?.send({
  type: "CUSTOM",
  name: "pi.human_input.resolved",
  value: { pi: "pi.human_input.resolved", data: { promptId, occurrence, deviceId, ts: now() } },
});
```

Rules (all binding):

- **Emit only** for `InjectResult.kind === "resolved"` and for
  `kind === "steered_fallback"` **with `tracked === true`**. Never for
  `steered_fallback` with `tracked === false` (untracked — a prompt this host
  never raised, a phantom ack), never for `stale` (already surfaced via
  `pi.human_input.stale`), never for `ignored` or `injected`.
- `resolved` always implies tracked (it only fires for a registry entry whose
  `resolvePendingPrompt` returned true), so it needs no `tracked` flag.
- **deviceId** comes from the `InjectResult`, which recorded it from the
  inbound envelope — never injected into free text (EV-6 invariant).
- **ts** is from the injected `deps.now` (the lifecycle layer's clock, not the
  fold).

### 2.2 Wire shape (binding — ruling Item 1, J-FIELDSET)

`value.data` on `pi.human_input.resolved` is exactly:

```ts
{ promptId, occurrence, deviceId, ts }
```

- **No `kind`** — withdrawn across all three seats; a fixture-only value
  (`kind:"won"`) no production frame ever takes would be a lie about the
  contract. deviceId already answers the only production question (a client
  whose deviceId matches knows it won; otherwise steered).
- **`occurrence` is required on the wire** — the raise stamps
  (promptId, occurrence); a close keyed only on promptId is indistinguishable
  for a promptId raised twice. Reversibility: adding `kind` later is additive
  (non-breaking); dropping `occurrence` later would break compound-key
  consumers (one-way).

## 3. Contract (b) prerequisite — `InjectResult` carries what the emission needs

### 3.1 `tracked: boolean` on steered_fallback (S-O3)

`src/inject.ts` — `InjectResult.steered_fallback` gains `tracked: boolean`:

```ts
| { kind: "steered_fallback"; promptId: string; occurrence: number; text: string;
    direct: false; deviceId?: string; reason: "mode"; tracked: boolean }
```

- `tracked === true` for a fallback on an EV-6-tracked prompt (live-entry
  fallback); `false` for an unknown-to-this-host prompt (unknown-entry
  fallback). This is how `index.ts` distinguishes the permanent live path
  from a phantom ack. Skeptic probe 3 confirmed the flag is absent today —
  it is planned prerequisite work, in scope.

### 3.2 `occurrence: number` on resolved and steered_fallback

Skeptic probe 1 confirmed `handleApprovalResponse` reads `d.occurrence` only
as a registry lookup key and drops it from the returned `InjectResult`. To
satisfy the J-FIELDSET wire shape from a lifecycle-layer emission, the
occurrence the resolution targeted must now ride the result, so both
variants gain `occurrence: number`:

```ts
| { kind: "resolved"; promptId: string; occurrence: number; direct: true; deviceId?: string }
| { kind: "steered_fallback"; promptId: string; occurrence: number; text: string; ...
```

Both `resolved` and `steered_fallback` are returned from `handleApprovalResponse`,
which has `d.occurrence` in scope; thread it through.

- `fallback()` (the shared steering-fallback helper) gains the `occurrence`
  and `tracked` it must carry: the unknown-entry call passes the occurrence
  the client sent and `tracked:false`; the live-entry call passes
  `d.occurrence` and `tracked:true`.
- `stale` and `ignored` do **not** carry occurrence (they never emit
  `resolved`).
- The R2 loud-once `announceOnce` path is unchanged.

## 4. S-O2 fold-in — manual construction across all seven subscriptions

`src/index.ts`'s `deps.on(...)` block. The pattern is uniform: a handler does
**not** pass the raw SDK event into the fold via `forward(ev as PiEvent)`; it
constructs the `PiEvent` the fold expects (types at `src/translate.ts`
lines 127–143) by reading the fields it needs off the event and passing only
those, in an explicit literal. This mirrors `agent_start`
(`index.ts:556`, already `forward({ event: "agent_start" })`).

The seven subscriptions (binding list), each converted from `forward(ev as
PiEvent)` to manual construction:

1. `message_start` → `forward({ event: "message_start", messageId, role })`
2. `message_update` → `forward({ event: "message_update", messageId, events })`
3. `message_end` → `forward({ event: "message_end", messageId })`
4. `tool_result` → `forward({ event: "tool_result", messageId, toolCallId, content })`
5. `ui.confirm` → `forward({ event: "ui.confirm", promptKind, prompt })`
6. `user_input` → `forward({ event: "user_input", messageId, text })`
7. `ui_prompt_end` (new, contract (a)) → `forward({ event: "ui_prompt_end", kind, title })`

Rules:

- No `ev as PiEvent` cast survives in `index.ts`'s `deps.on(...)` block after
  this card. (The two already-manual subscriptions — `agent_start`,
  `agent_settled` — stay as they are; `turn_start`/`turn_end` are already
  literal constructions.)
- `forward` itself is unchanged (including its `ui.confirm` special-case for
  the raise/registerPrompt stamp — preserved because `forward` is untouched).
- Each handler reads the fields it needs off the event it receives. In the
  repo test harness the events are already PiEvent-shaped
  (`{ event: ..., messageId, ... }`); the handler must still extract them into
  an explicit literal rather than casting the whole object. Where the real SDK
  payload differs in shape, the handler maps to the PiEvent field that the
  fold consumes.
- Scope is zero-judgment: the PiEvent variants are already specified; this is
  the mechanical replacement the ruling mandates. The acceptance criteria are
  unchanged by the cast fix.

The cast was confirmed worse than a silent drop (probe 4): an SDK
`{type:"ui_prompt_end", kind:"confirm"}` payload passing through the cast
moved `translate()`'s `"kind" in input` test, misrouted to `translateJsonl`,
and produced a wrong `pi.session.info_change` frame via the JsonlEntry kind
collision. Manual construction removes that class entirely and is the
defense-in-depth that keeps the seven subscriptions honest until
FLLWUP-typed-bridge (FLLWUP-9) tightens the type.

## 5. Acceptance (rewritten — binding, ruling Item 2)

The card's acceptance criterion for contract (b) is **fixture-green**, not
runtime-observable, until FLLWUP-raise (FLLWUP-8) ships. The PR carries this
facilitator-authored amendment (per the EV-1 Q3 governance precedent; probe 8
cited as evidence — the installed SDK has no `ui.confirm` event, `on()` is
exhaustively typed, and no `deps.on("ui_prompt_start")` exists, so the raise
path is dead in production):

> The lifecycle wiring emits CUSTOM `pi.human_input.resolved` with
> `{promptId, occurrence, deviceId, ts}` from the captured `InjectResult`
> when a resolution (direct or steering-fallback-with-`tracked:true`) is
> applied to a prompt EV-6 tracked. The fixture path is green today; the
> runtime path is gated on FLLWUP-raise (a follow-up card that wires
> `ui_prompt_start` into the lifecycle layer). The acceptance criterion is
> fixture-green, not runtime-observable, until FLLWUP-raise ships.

No spec change to PI-SPEC §4: the §4 row documents the contract, not runtime
reachability (§5.4-row note on `ui_prompt_end`/`pi.human_input.closed` and
`pi.human_input.resolved` — see §6).

## 6. Spec amendment on the PR

Riding the FLLWUP-5 PR (evidence-cited, per the standing precedent):

- A `§5.4`-adjacent note pinning the `ui_prompt_end` → `pi.human_input.closed`
  informational mapping (`{kind, title, schemaVersion:1}`, a passive mirror
  that cannot correlate to a promptId) and the lifecycle
  `pi.human_input.resolved` `{promptId, occurrence, deviceId, ts}` frame —
  emitted on `resolved` / tracked-`steered_fallback`, never untracked or
  stale, deviceId from envelope, ts from host clock, fixture-green until
  FLLWUP-raise.
- The §4 mapping table already has the `ui.confirm` / approval-style prompt
  row; no structural §4 table edit is required.

## Test plan (fixtures)

The owner adds fixtures covering:

- **Pure fold (contract (a))**: `translate({event:"ui_prompt_end", kind, title}, state)`
  → emits `pi.human_input.closed {pi:"ui_prompt_end", data:{kind, title,
  schemaVersion:1}}`; distinct from `pi.human_input.resolved`; no
  ts/deviceId/promptId on it; G-11 guard still passes.
- **Tracked flag (S-O3)**: `handleApprovalResponse` for a live-entry
  steered fallback returns `tracked:true`; an unknown-entry fallback returns
  `tracked:false`; `occurrence` round-trips on both.
- **Contract (b) lifecycle**: with the controller live,
  - direct resolution (fixture seam, `resolvePendingPrompt:()=>true`) →
    emits `pi.human_input.resolved {promptId, occurrence, deviceId, ts}`;
  - steered_fallback-with-`tracked:true` → emits the resolved frame;
  - steered_fallback-with-`tracked:false` (untracked) → NO resolved frame;
  - stale → NO resolved frame (only `pi.human_input.stale`).
  - Assert the resolved `value.data` is exactly `{promptId, occurrence,
    deviceId, ts}` (strict — any extra `kind` key fails).
- **Seven manual-construction sites (S-O2)**: each of the seven emissions
  still produces the frames the cast *intended* — the fold outputs are
  unchanged for `message_start/update/end`, `tool_result`, `ui.confirm`,
  `user_input`, and the new `ui_prompt_end`.

## Gates

- `bunx tsc --noEmit` exit 0.
- `bun test` exit 0, full suite green (146 baseline + new fixtures).
- No Mongo, no boot gate for this card.

## Non-goals (closed by ruling)

- No `kind` field on the resolved frame (fixture-only value would lie).
- No replay self-sufficiency for the resolved frame (ruling Item 3: replay is
  a snapshot; the resolved frame is lifecycle-emitted and surfaces in the
  live stream after resync, same as every other lifecycle frame).
- No `ui_prompt_start` raise wiring in this card (FLLWUP-8).
- No typed-on type tightening in this card (FLLWUP-9); the local permissive
  type stays and manual construction is the mitigation.
