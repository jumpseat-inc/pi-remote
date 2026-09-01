---
id: FLLWUP-9
title: "Replace the local ExtensionAPI stand-in with the real SDK typed on()"
state: Backlog
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
user_input as wired, ui_prompt_end, session_shutdown) still typechecks against
the vendored union. Gates: `bunx tsc --noEmit` exit 0; `bun test` full suite
green.
## Binding ruling rider (FLLWUP-3 general rule, product-owner — binding)

The dispatch names ruled in FLLWUP-3 and its consolidation are stable keys
(EV-2 Item 2) — this card may not relitigate them. The vendored typed `on()`
union reflects the real SDK whitelist: until the SDK forwards a family, that
family stays unwired regardless of the mapper, and this card is not license to
add dead subscriptions the compiler will now correctly reject.
