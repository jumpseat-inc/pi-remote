# Principal — round 1 (job-21.2, step 2 independent first pass)

Grounding: `src/login.ts` (`runAttendedLogin` :454; settle/cbPromise/settled :470–472; loopback settle :491–493; timer settle :563–567; await+clearTimeout :568–569; ctl.cancelled early-out :572–573; dead branch :575–576; `cancel()` :916–918; facade print :900–902; copy byte-exact at :201); SDK `types.d.ts:73` + `signal?: AbortSignal` at :39; installed TUI implementation (`showExtensionConfirm` → `showExtensionSelector`, interactive-mode.js:2073-2076, abort path :2044-2047 resolves `undefined`); RPC implementation (rpc-mode.js:64-85, `onAbort = () => { cleanup(); resolve(defaultValue) }`); `index.ts` `RemoteControllerDeps` (:88–127; members `setStatus`, `print`, `inputPrompt`; `requireCtx` only in the `export default function (pi)` closure ~:1000+).

## Cross-seam reading — what the contract is *right now*

`runAttendedLogin` holds a single-shot callback resolver: `settle`/`cbPromise`/`settled` at :470-472; the loopback server settles at :491-493; the timeout timer settles at :563-567; the driver then `await cbPromise; clearTimeout(timer)` (:568-569). The `ctl.cancelled` early-out is :572-573; the `cb.type === "cancelled"` branch at :575-576 is dead because **nothing ever calls `settle({type:"cancelled"})`** — the only setters pass `result` (code/mismatch) or `{type:"timeout"}`. `createLoginCommand`'s `cancel()` is :916-918 and only flips the boolean; the facade prints `login.cancelled` exactly once at :900-902; the copy string is byte-exact at :201.

**SDK side — the fact the settled block's wording hides.** `ctx.ui.confirm(title, message, opts)` is `types.d.ts:73`, `signal?: AbortSignal` at :39. But the installed implementation resolves the abort as an **ordinary `false`, not a rejection and not a pending promise**:
- TUI: `showExtensionConfirm` → `showExtensionSelector` (`interactive-mode.js:2073-2076`); the selector's abort path is `onAbort = () => { hideExtensionSelector(); resolve(undefined) }` (:2044-2047), so `confirm` returns `undefined !== "Yes"` → `false`.
- RPC: `confirm: … createDialogPromise(opts, false, …)` with `onAbort = () => { cleanup(); resolve(defaultValue) }` (`rpc-mode.js:64-85`) → `false`.

So "re-armed on `false` until the signal aborts" is **not** implementable by inspecting the resolved value: an abort *is* a `false`.

**Wiring side (`index.ts`).** `createLoginCommand` is constructed inside `createRemoteController` (in `rcLoginCommand`), which receives only `RemoteControllerDeps` (:88-127) whose UI-ish members are `setStatus`, `print`, `inputPrompt`. `requireCtx` exists **only** in the `export default function (pi)` closure (~:1000+). The settled implementation `requireCtx().ui.confirm(...)` therefore has no call site at the layer where the dep must be built.

## Blind spots

- **From inside the driver/pipeline (`src/login.ts`):** you cannot see that abort collapses to `false`, so the re-arm loop looks trivially correct; and you cannot see that `createRemoteController` has no `ctx`, so the settled `requireCtx().ui.confirm(...)` sentence can't land where the driver is built.
- **From inside the command surface (`index.ts`):** you cannot see the driver's shared `settle`/`settled`/timer tri-state, so adding `waitForCancel` looks like a one-line passthrough; the double-settle, dialog-leak, and timer-leak invariants are invisible from that side.
- **From inside the tests:** the `waitForCancel` seam sits on `runAttendedLogin`, but the single `login.cancelled` print lives in the facade (:900-902). A test that drives `runAttendedLogin` directly can assert `{kind:"cancelled"}` but its "printed exactly once" assertion is **vacuous** (zero prints). Acceptance 1 must drive `createLoginCommand().run("attended")`, not the raw driver.

## Reframe (not a re-litigation of the affordance or copy)

The settled affordance and copy are sound; I hold them. The reframe is that the card frames this as *adding a dep*, but the binding block actually imposes **three seams it does not name**, and one of them is a live spin bug if implemented from the sentence alone:

1. **One guarded finisher.** Every settle path (server callback :491-493, timer :563-567, confirm-cancel, `cancel()`) must route through a single `finish(result)` that sets `settled`, resolves, `controller.abort()`, and `clearTimeout(timer)`. This is the only shape that closes double-settle, dialog leak, and timer leak simultaneously; leaving the server/timer paths on the raw `settle()` while only the cancel path aborts leaves the dialog visible after a successful callback.
2. **The re-arm guard is mandatory, not incidental.** Because abort resolves `false` (both modes above), the loop must test `controller.signal.aborted || settled` *after* the `await` and break — otherwise abort → `false` → re-arm → already-aborted signal resolves `false` again → **infinite microtask spin**.
3. **`cancel()` needs a wake seam.** A shared `{cancelled: boolean}` cannot wake an awaited promise. Either widen `ctl` with an `onCancel` hook the driver installs, or pass an `AbortController` from the facade into `runAttendedLogin`. Additionally, production wiring requires a new `RemoteControllerDeps` member (e.g. `uiConfirm`) threaded from the `export default` closure's `requireCtx()` — the settled `requireCtx().ui.confirm(...)` sentence cannot be placed at the `createLoginCommand` call site.

## Testable claims

- **Abort-spin (falsifiable, red on the naive loop):** inject `waitForCancel` returning `false`; drive a browser callback to win; assert the run resolves and the `waitForCancel` call count stops increasing after abort. A `while(true)` re-arm loop hangs/explodes this test.
- **Single settle:** with the timer and the server callback arriving adjacent, assert exactly one token POST and one printed outcome line.
- **Cancel line once, through the facade:** `logs.filter(l => l.includes("Sign-in cancelled")).length === 1` from `createLoginCommand().run("attended")` with `waitForCancel` resolving `true` (a raw-driver test cannot make this claim).
- **Timing distinguishes cancel from timeout (Acceptance 2/3):** small `redirectTimeoutMs` (e.g. 200 ms), `waitForCancel` resolves `true` in a microtask; assert `Date.now() - start < redirectTimeoutMs`, outcome `cancelled`, and that the `redirectTimeout` line never printed.
- **Zero endpoints after signal (Acceptance 1):** after cancel, `loginEndpointRequestLog` contains no token-endpoint or device-endpoint POST.
- **No credential (Acceptance 4):** `readCredential({configDir})` is null (or the pre-existing credential is byte-unchanged).
- **`cancel()` wakes and clears (Acceptance 5):** call `command.cancel()` mid-attended-wait; assert `{kind:"cancelled"}` and, after `2 × redirectTimeoutMs`, that the `redirectTimeout` line never printed (timer cleared).

## Open items — not mine to decide

- **`waitForCancel` rejection semantics** (a thrown `confirm`): unsettled by the block. Recommend the loop treats it as "no cancel" (re-arm) rather than terminal, with an explicit test; but this is a ruling, not mine.
- **Who calls `cancel()` in production?** The binding block says `cancel()` must wake the wait, but nothing wires a real interrupt (SIGINT) to it. If no production caller exists, `cancel()`'s wake path is test-only and Acceptance 5's "wired to the surface" is satisfied solely by the confirm dialog — say so explicitly rather than implying a second surface.
- **The `RemoteControllerDeps` member name/shape** for the `ui.confirm` plumbing (implementation detail; touches `test/index.test.ts` stand-ins).

## Position

The settled design is architecturally sound — I hold the confirm affordance, the re-arm contract, the dep signature, and the copy verbatim. My disagreement is narrow and concrete: **the settled block's implementation sentence under-specifies the seam and contains a latent infinite-spin bug under the installed SDK's actual abort semantics.** Implement with a single guarded `finish()` (settle + abort + clearTimeout), a re-arm loop that breaks on `signal.aborted || settled` after every `await` (because abort resolves `false` in both TUI and RPC), an explicit wake hook on `ctl` for `cancel()`, and a new `RemoteControllerDeps` member to thread `requireCtx().ui.confirm` from the `export default` closure — and drive Acceptance 1's print assertion through the facade, never the raw driver.
