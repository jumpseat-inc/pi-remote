---
id: FLLWUP-8
title: "Wire the ui_prompt_start raise path end-to-end (runtime-observable acceptance for FLLWUP-5 contract b)"
state: Ready
owner: null
epic: EPIC-1
goal: Wire deps.on ui_prompt_start with manual PiEvent construction and registerPrompt on the canonical SDK payload so FLLWUP-5's pi.human_input.resolved becomes runtime-observable end to end
---

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
