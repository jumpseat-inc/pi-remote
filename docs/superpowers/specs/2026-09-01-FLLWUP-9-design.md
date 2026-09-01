# FLLWUP-9 design — Replace the local ExtensionAPI stand-in's `on()` with the real SDK typed event union

Card: `council/cards/FLLWUP-9.md` · Epic: EPIC-1 · Date: 2026-09-01
Basis: full-council deliberation (owner + principal, 2 rounds), Skeptic verification
(all claims closed, no open objections), consolidator synthesis.

## Goal

The local `ExtensionAPI` stand-in (`index.ts:44-65`) declares
`on(event: string, handler)` — permissive. The real pi SDK's `ExtensionAPI.on`
(`/home/tista/.nvm/versions/node/v24.17.0/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:906-942`)
is an exhaustive set of 36 literal-name overloads with no string-generic
overload. The permissive local type hides that an over-broad
`on(event: string, …)` call is a compile error at the real type level. This
card makes the event-name whitelist compile-time real.

## Ground truth (verified by the Skeptic on this tree)

- SDK `ExtensionAPI.on` overloads carry exactly these 36 event-name literals:
  `project_trust, resources_discover, session_start, session_info_changed,
  session_before_switch, session_before_fork, session_before_compact,
  session_compact, session_compact_failed, session_shutdown,
  session_before_tree, session_tree, context, before_provider_request,
  before_provider_headers, after_provider_response, before_agent_start,
  agent_start, agent_end, agent_settled, ui_prompt_start, ui_prompt_end,
  turn_start, turn_end, message_start, message_update, message_end,
  tool_execution_start, tool_execution_update, tool_execution_end,
  model_select, thinking_level_select, tool_call, tool_result, user_bash, input`.
  `ui.confirm` appears nowhere in that file (`grep -c 'ui\.confirm'` = 0).
- Current baseline: `bunx tsc --noEmit` exit 0; `bun test` **172 pass / 0 fail**.
  (The "155 tests" figure in earlier run context is stale; so is "seven
  manually-constructed subscriptions" — the actual count is **ten** `deps.on`
  subscriptions in `createRemoteController` plus one direct
  `pi.on("session_shutdown")` in the default export.)
- The `deps.on("ui.confirm", …)` registration (`index.ts:610`) is
  **load-bearing for the test suite**: the human_input raise/response/resolved
  flow is driven through `h.emit("ui.confirm", …)`
  (`test/index.test.ts:548, 574, 580, 642, 659, 684`). Deleting it fails
  exactly 5 tests. It must be preserved.
- In production the SDK never emits `ui.confirm`; registering a listener for
  it is a no-op today. The design below changes no runtime behavior.

## Design

### 1. Vendor the SDK event-name union — `src/pi-sdk-on.ts` (new file)

```ts
// Vendored from @earendil-works/pi-coding-agent, dist/core/extensions/types.d.ts
// (ExtensionAPI.on overload set, the 36 literal event names; no string-generic
// overload). Provenance per FLLWUP-9; re-diff this list on SDK upgrades.
export type PiSDKOnEvent =
  | "project_trust" | "resources_discover"
  | "session_start" | "session_info_changed" | "session_before_switch"
  | "session_before_fork" | "session_before_compact" | "session_compact"
  | "session_compact_failed" | "session_shutdown" | "session_before_tree"
  | "session_tree" | "context" | "before_provider_request"
  | "before_provider_headers" | "after_provider_response" | "before_agent_start"
  | "agent_start" | "agent_end" | "agent_settled"
  | "ui_prompt_start" | "ui_prompt_end" | "turn_start" | "turn_end"
  | "message_start" | "message_update" | "message_end"
  | "tool_execution_start" | "tool_execution_update" | "tool_execution_end"
  | "model_select" | "thinking_level_select"
  | "tool_call" | "tool_result" | "user_bash" | "input";

/** Handler shape for pi SDK events. Payloads stay unknown by design:
 * handlers validate fields manually (FLLWUP-5 S-O2 discipline) and never
 * trust SDK payload shapes. */
export type PiEventHandler = (event: unknown, ctx: unknown) => void | Promise<void>;
```

Plain union, not a generic-constrained parameter and not 36 verbatim
overloads. Both alternatives compile, but plain union is simpler, mirrors the
SDK's literal-overload shape, and yields the clearest error messages.

`PiSDKOnEvent` is **pure**: it contains no `"ui.confirm"`. The synthetic name
lives only in `translate.ts`'s `PiEvent` union and in the deps-side union
below — never in the vendored SDK surface.

### 2. Retype the local `ExtensionAPI` stand-in's `on()`

In `index.ts`, the stand-in's `on` becomes:

```ts
on(event: PiSDKOnEvent, handler: PiEventHandler): void;
```

Nothing else in the stand-in changes in this card (its other members are a
separately-filed defect — see Follow-ups).

### 3. Extend only the deps seam for the synthetic fixture event

`RemoteControllerDeps.on` becomes:

```ts
on(event: DepsOnEvent, handler: PiEventHandler): void;
// with, exported from src/pi-sdk-on.ts:
/** pi-remote's own subscription seam. "ui.confirm" is synthetic and
 * fixture-only: the installed SDK has no such event (FLLWUP-5 probe 8);
 * FLLWUP-8 folds it into the ui_prompt_start raise path. */
export type DepsOnEvent = PiSDKOnEvent | "ui.confirm";
```

The existing `deps.on("ui.confirm", …)` registration at `index.ts:610` stays,
unchanged, and its handler body stays unchanged.

### 4. The guard bridge (mandatory, not stylistic)

The default export's `on` key in the `createRemoteController` call
(`index.ts:667`) becomes:

```ts
on: (event, handler) => {
  if (event === "ui.confirm") return; // fixture-only seam — never forwarded to the SDK
  pi.on(event, handler);
},
```

The guard narrows `DepsOnEvent` to `PiSDKOnEvent` in the fall-through branch,
so `pi.on(event, handler)` typechecks against the pure stand-in with **no
cast**. The un-guarded form `on: (event, handler) => pi.on(event, handler)`
does NOT compile (verified: TS2345, `DepsOnEvent` not assignable to
`PiSDKOnEvent`). Runtime behavior is unchanged: previously a listener for an
event that never fires was forwarded to `pi.on`; now it is simply not
forwarded.

### 5. The negative probe (acceptance: over-broad string calls are compile errors)

In a tsc-included file (put it in `src/pi-sdk-on.ts`), inside a function that
is **never invoked** (zero runtime footprint):

```ts
/** Type-only negative probe (FLLWUP-9). Never call this function.
 * If `DepsOnEvent`/`PiSDKOnEvent` is ever widened back to `string`, tsc
 * reports TS2578 (unused '@ts-expect-error' directive) and the gate fails. */
export function fllwup9TypeProbe(deps: { on: (event: DepsOnEvent, handler: PiEventHandler) => void }): void {
  const s: string = "agent_start";
  // @ts-expect-error over-broad string event must be rejected by the vendored union
  deps.on(s, () => {});
}
```

Mechanics (verified both directions by the Skeptic): with the unions literal,
the directive is consumed and `bunx tsc --noEmit` exits 0; if either union is
widened to `string`, the directive goes unused → TS2578 → non-zero exit. A
plain over-broad call without the directive is TS2345.

### 6. What does NOT change

- Handler bodies: all ten `deps.on(...)` subscriptions and
  `pi.on("session_shutdown")` keep their bodies; handler parameters remain
  cast-from-`unknown` narrowing (S-O2 manual-construction discipline
  composes untouched).
- The test harness's fake `on` (`test/index.test.ts`, string-keyed) typechecks
  contextually against the new signatures; no fixture changes.
- No runtime behavior changes anywhere.

## Acceptance (as amended by deliberation — factual refinements only)

1. `index.ts`'s `ExtensionAPI.on` and `RemoteControllerDeps.on` use the
   vendored union(s); `src/pi-sdk-on.ts` carries the 36 SDK literals verbatim
   with provenance; `PiSDKOnEvent` contains no `"ui.confirm"`.
2. An over-broad `on(event: string, …)` call anywhere is a
   `bunx tsc --noEmit` error — proven permanently by the negative probe (5).
3. The live subscription set typechecks: `agent_start, agent_settled,
   turn_start, turn_end, message_start, message_update, message_end,
   tool_result, ui_prompt_end, session_shutdown` against the SDK union, plus
   `ui.confirm` as the deps-only fixture seam (not forwarded to `pi.on`).
4. Gates: `bunx tsc --noEmit` exit 0; `bun test` full suite green
   (baseline 172).

## Follow-up cards to file (not this card's scope)

- **S-O5**: the stand-in's twelve non-`on` members (`getSetting, env,
  setStatus, input, sessionId, readActiveBranch, isIdle, configDir, version,
  platform, arch`) do not exist on the real SDK's `ExtensionAPI` or on the
  loader's runtime object; loaded by the installed SDK, `pi.configDir()` at
  `index.ts:646` is a TypeError at load. Must also model the real
  `ExtensionHandler<E, R> = (event, ctx) => Promise<R | void> | R | void`
  return shape or `tool_call`/`input` interception stays silently impossible.
- **F-2**: real SDK event payload shapes vs the fields handlers defensively
  narrow (e.g. real `MessageStartEvent` is `{ type: "message_start"; message:
  AgentMessage }` — the `messageId`/`role`/`events`/`content` narrowing may
  not match real payloads; the live path could silently drop real events).
