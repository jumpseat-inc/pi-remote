---
id: FLLWUP-8
title: "Wire the ui_prompt_start raise path end-to-end (runtime-observable acceptance for FLLWUP-5 contract b)"
state: Deliberating
owner: null
epic: EPIC-1
goal: Wire deps.on ui_prompt_start with manual PiEvent construction and registerPrompt on the canonical SDK payload so FLLWUP-5's pi.human_input.resolved becomes runtime-observable end to end
---

## Step 1 — path classification

- Full council (not mechanical): cross-seam (index.ts live-path wiring + translate.ts
  pure mapper) and spec-ambiguous/design-judgment — the orchestrator's Phase-1 record
  explicitly delegates the payload re-mapping fork to this deliberation: the SDK's
  `ui_prompt_start` carries `{type, reason:"ui_prompt", kind:UIPromptKind, title?}`
  while the synthetic seam expects `{event:"ui.confirm", promptKind, prompt}`; whether
  to add a backward-compatible PiEvent variant for the live shape or re-map into the
  existing synthetic shape is a design fork, as is whether the raised frame's data
  carries the SDK's `kind` verbatim.
- Surface-touching: yes — the remote client's approval UI begins receiving live
  prompts (the raise path becomes runtime-observable; same user-visible surface
  FLLWUP-5 seated `designer` for). `designer` seated as third generator in steps 2–3.
- Binding context carried in (not open for relitigation): manual PiEvent construction
  per FLLWUP-5 S-O2, never `ev as PiEvent`; dispatch names ruled in FLLWUP-3/EV-2 are
  stable keys (pi.human_input, pi.human_input.closed, pi.human_input.resolved,
  pi.human_input.stale, pi.human_input.fallback_to_steer — existing names may not be
  relitigated); steward R3 Side B (EV-6): wiring `deps.on("ui_prompt_start")` is
  OBSERVATION — the host already receives the prompt — not host-UI sponsorship, and
  the steering fallback is the permanent live resolution path; FLLWUP-9's typed
  `on()` union is live (`src/pi-sdk-on.ts`, `PiSDKOnEvent` includes `ui_prompt_start`
  per SDK types.d.ts:927) and any new subscription MUST typecheck against it; the
  `ui.confirm` synthetic seam is fixture-only (guard bridge returns early) and
  load-bearing for 5 tests (FLLWUP-9 deletion probe); the raise stamps
  (promptId, occurrence) onto the wire via `injector.registerPrompt({promptId, kind,
  prompt}) → {occurrence}` (EV-8 pattern, index.ts forward() ui.confirm special case);
  FLLWUP-5 contract (b) is fixture-green and this card's acceptance re-opens it to
  runtime-observable; J-REPLAY (FLLWUP-5 PO ruling): replay need not be
  self-sufficient — resolved surfaces only in the live stream after resync; gates =
  `bunx tsc --noEmit` exit 0 + `bun test` full suite green (172 baseline; add fixtures
  for the live raise path); no Mongo, no boot gate; FLLWUP-11/12 are explicitly NOT
  this card's scope; the FLLWUP-3 §4 runtime-unreachability caveat is scoped to the
  four FLLWUP-3 families only — wiring ui_prompt_start does NOT make those live, so
  the spec amendment in this PR covers only what this PR actually falsifies (the
  FLLWUP-5 §5.4 "fixture-green today, runtime-observable once the raise path lands
  (FLLWUP-8)" sentence becomes false on this PR and must be amended in the same PR).
- Facilitator-verified SDK evidence (grounding, not opinion): installed SDK
  `dist/core/extensions/types.d.ts:563-570` — `UIPromptKind = "select" | "confirm" |
  "input" | "editor" | "custom"`; `UIPromptStartEvent { type:"ui_prompt_start";
  reason:"ui_prompt"; kind:UIPromptKind; title?:string }` (UIPromptEndEvent identical
  shape, :572-577); emitted from `runner.js:270-300` `withUIPrompt` — depth-guarded,
  only the outermost prompt emits, `title` omitted when absent (`...(title ? {title}
  : {})`); typed `on("ui_prompt_start", ExtensionHandler<UIPromptStartEvent>)` at
  types.d.ts:927. `registerPrompt` is NOT an SDK symbol — it is the injector's own
  method (`src/inject.ts:66-69,179`): `registerPrompt(input: {promptId: string; kind:
  string; prompt: string}): {occurrence: number}`. Current translate.ts mapping:
  `ui.confirm` → CUSTOM `pi.human_input` data `{promptKind, prompt, schemaVersion:1,
  promptId: fnv1a(promptKind + "\u0000" + prompt)}` (translate.ts:525-539);
  `ui_prompt_end` → CUSTOM `pi.human_input.closed` (translate.ts:541-549).

## Intent

Filed from the binding FLLWUP-5 product-owner ruling (2026-08-31, item 5,
`vault/raw/2026-08-31-po-fllwup5-ruling.md`) and pre-confirmed by the
orchestrator under this canonical id. FLLWUP-5 shipped contracts (a) and (b)
fixture-scoped: the lifecycle layer emits `pi.human_input.resolved` on a
tracked resolution, but the raise path is dead in production — the installed
pi SDK has no `ui.confirm` event, `ExtensionAPI.on` is an exhaustively typed
interface, and no `deps.on("ui_prompt_start")` exists (FLLWUP-5 Skeptic probe
8), so `registerPrompt` is never called live and every live answer is
unknown → untracked → no resolved frame. This card wires the raise so the
remote approval flow is end-to-end runtime-observable.

Per the ruling's scope, the raise wiring is: (a) a `deps.on("ui_prompt_start", …)`
subscription; (b) manual construction of a `{event:"ui.confirm"}` PiEvent from
the SDK payload — note the SDK `ui_prompt_start` payload carries `{kind, title?}`
(`UIPromptKind: "select" | "confirm" | "input" | "editor" | "custom"`), NOT
`{promptKind, prompt}`, so the mapper needs a re-mapping or a
backward-compatible PiEvent variant; (c) wiring `registerPrompt` into the
host's response to `ui_prompt_start`; (d) updating `forward`'s `ui.confirm`
handler to handle both the synthetic and the (now live) path.

## Acceptance

Remote approval flow is end-to-end runtime-observable: a host that receives a
`ui_prompt_start` raises a `pi.human_input` CUSTOM frame with
`(promptId, occurrence)`, the host that resolves it emits
`pi.human_input.resolved` live, and a reconnecting client sees the resolved
frame in the live stream after replay. When this lands, FLLWUP-5's acceptance
(b) re-opens from fixture-green to runtime-observable. Gates: `bunx tsc
--noEmit` exit 0; `bun test` full suite green (155 baseline grows).
## Binding ruling rider (FLLWUP-3 general rule, product-owner — binding)

The dispatch names ruled in FLLWUP-3 and its consolidation are stable keys
(EV-2 Item 2) — this card may not relitigate them. Every new subscription uses
manual PiEvent construction per FLLWUP-5 S-O2, never `ev as PiEvent`. This
card's acceptance re-opens from fixture-green to runtime-observable as already
stated, and the FLLWUP-3 spec amendment's runtime-unreachability caveat
(scoped to the four new families only, per O-1) must be amended again in the
same PR that makes it false.
