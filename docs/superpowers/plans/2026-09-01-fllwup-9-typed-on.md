# Plan — FLLWUP-9: vendor the real SDK typed `on()` event union

Spec: `docs/superpowers/specs/2026-09-01-FLLWUP-9-design.md` (settled; not reopened)

## Steps

1. Create `src/pi-sdk-on.ts`:
   - `PiSDKOnEvent` — the 36 SDK literal event names verbatim (verified
     1:1 against the installed SDK `types.d.ts` `ExtensionAPI.on` overload
     set; `diff` clean, no `ui.confirm`, no string-generic overload).
   - `PiEventHandler = (event: unknown, ctx: unknown) => void | Promise<void>`.
   - `DepsOnEvent = PiSDKOnEvent | "ui.confirm"` (fixture-only seam).
   - Negative probe `fllwup9TypeProbe` (never invoked) with
     `// @ts-expect-error` on the over-broad string call.
2. `index.ts`:
   - Stand-in `ExtensionAPI.on` → `on(event: PiSDKOnEvent, handler: PiEventHandler): void;`
   - `RemoteControllerDeps.on` → `on(event: DepsOnEvent, handler: PiEventHandler): void;`
   - Default-export bridge (index.ts:667) → guard form with
     `if (event === "ui.confirm") return;` before `pi.on(event, handler)`.
   - No handler bodies, fixtures, or runtime behavior change.
3. Gates (in order, in the worktree):
   1. `bunx tsc --noEmit` → exit 0.
   2. `bun test` → 172 pass / 0 fail.
   3. Negative probe proof: directive present → tsc 0 (consumed, no
      TS2578); directive removed → TS2345 at probe line; restore.
   4. Gate integrity proof: inject known type error → tsc fails; restore → tsc passes.
4. Conventional commits; push branch; open PR (base main); do not merge.
