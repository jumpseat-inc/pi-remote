---
id: FLLWUP-9
title: "Replace the local ExtensionAPI stand-in with the real SDK typed on()"
state: In Review
owner: null
epic: EPIC-1
goal: Replace the local ExtensionAPI stand-in in index.ts with the real pi SDK on() type so over-broad string event subscriptions become compile-time errors
---

## Intent

Filed from the binding FLLWUP-5 product-owner ruling (2026-08-31, item 7,
`vault/raw/2026-08-31-po-fllwup5-ruling.md`) and pre-confirmed by the
orchestrator under this canonical id. The local `ExtensionAPI` stand-in at
`index.ts:43-65` declares `on(event: string, handler)` — permissive — while
the real `pi` SDK's `ExtensionAPI.on` is an exhaustively typed overload set
with no string-generic overload (FLLWUP-5 Skeptic probe 8). The `pi.on(event,
handler)` bridge at `index.ts:614` passes a generic string to a typed
overloaded `on()` — a compile-time error at the real type level, hidden by the
local type. This is a type-honesty defect (distinct from the S-O2 data-flow
defect FLLWUP-5 fixed by manual construction across the seven subscriptions).

The right fix: (1) vendor the real `ExtensionAPI.on` overload set (or its
type union) from the installed pi SDK
(`pi-coding-agent/dist/core/extensions/types.d.ts`); (2) replace the local
`ExtensionAPI` declaration; (3) update `createRemoteController`'s
`RemoteControllerDeps.on` to match; (4) verify tsc catches any future
over-broad `on(event: string, …)` call at the real type level. FLLWUP-5 ships
with both manual construction AND the existing permissive local type;
this card tightens the type to catch a future regression of the cast.

## Acceptance

`index.ts`'s `ExtensionAPI` declaration and `RemoteControllerDeps.on` reflect
the real SDK's typed exhaustive event union; an over-broad `on(event: string,
…)` call anywhere in the codebase is a `bunx tsc --noEmit` error; the live
subscription set (agent_start, agent_settled, turn_start, turn_end,
message_start, message_update, message_end, tool_result, ui.confirm as wired,
ui_prompt_end, session_shutdown) still typechecks against
the vendored union. Gates: `bunx tsc --noEmit` exit 0; `bun test` full suite
green.
## Deliberation synthesis (2026-09-01, full council: owner + principal, 2 rounds, skeptic, consolidator)

Settled by test, no open objections. The flagged synthetic-event question resolves as a
**split union**: `PiSDKOnEvent` (36 real SDK literals, pure, vendored into
`src/pi-sdk-on.ts`) for the local `ExtensionAPI` stand-in's `on()`;
`DepsOnEvent = PiSDKOnEvent | "ui.confirm"` for `RemoteControllerDeps.on` only;
guard bridge `on: (event, handler) => { if (event === "ui.confirm") return; pi.on(event, handler); }`
(cast-free; narrowing verified — the un-guarded form fails tsc, TS2345). The
`ui.confirm` registration is load-bearing for 5 tests (deletion probe → exactly
those 5 fail) and is not forwarded to `pi.on` in production (no behavior change:
pi never emits it). Negative `@ts-expect-error` probe in a never-invoked function
(plain-union form; generic variant compiles too, plain chosen). Follow-up cards
to file: S-O5 (twelve phantom non-on members absent from the real SDK — runtime
TypeError at load; must also model ExtensionHandler's return shape) and F-2
(real SDK payload shapes vs handlers' defensive narrowing). Standing rulings
applied: steward's binding build order (FLLWUP-8 lands immediately after this
card — J-1 moot); card face acceptance's live set stands with `ui.confirm` as
deps-only fixture seam (acceptance wording refinement recorded in the spec).
Actual gate ground truth: 172 tests baseline (not 155), ten `deps.on`
subscriptions.

## Binding ruling rider (FLLWUP-3 general rule, product-owner — binding)

The dispatch names ruled in FLLWUP-3 and its consolidation are stable keys
(EV-2 Item 2) — this card may not relitigate them. The vendored typed `on()`
union reflects the real SDK whitelist: until the SDK forwards a family, that
family stays unwired regardless of the mapper, and this card is not license to
add dead subscriptions the compiler will now correctly reject.
