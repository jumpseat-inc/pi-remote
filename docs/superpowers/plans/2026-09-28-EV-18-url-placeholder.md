# EV-18 — URL Placeholder Pass-Through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forward the resolved control-plane URL as the attended `/rc:login` prompt's host `input` placeholder argument (the documented second parameter), without touching any copy.

**Architecture:** Three seams change: the `RemoteControllerDeps.inputPrompt` dependency widens to `(prompt: string, placeholder?: string) => Promise<string | undefined>`; the attended URL prompt call site passes `resolved` as the second argument; the entry wiring forwards both arguments to `ctx.ui.input`. The vendored `PiExtensionContext["ui"]["input"]` declaration is reconciled to the installed SDK's real three-param signature (`types.d.ts:75`). All copy stays byte-identical.

**Tech Stack:** TypeScript (Bun runtime), `bun:test`, dependency-injected `ExtensionAPI` stand-in harness.

**Spec:** `docs/superpowers/specs/2026-09-28-EV-18-design.md` (read from the run's local main repo path — the spec commit has not landed on `origin/main`; the worktree is cut from `origin/main` per the council convention).

## Global Constraints

- Title literal byte-unchanged: `Control-plane server URL [${resolved}]:\nPress Enter to enroll this host against ${resolved}, or type a different URL to override:` (FLLWUP-41; no copy key added/changed/removed; `test/copy.test.ts`'s 21-key count unaffected).
- Dep signature exactly `(prompt: string, placeholder?: string) => Promise<string | undefined>`; second parameter named `placeholder`. The dep stays two-param; the JSDoc annotates the real SDK three-param signature (`input(title, placeholder?, opts?: ExtensionUIDialogOptions)`).
- Vendored declaration: `input(title: string, placeholder?: string, opts?: { signal?: AbortSignal; timeout?: number }): Promise<string | undefined>` — inline structural opts (like the sibling `confirm`), **no** named `ExtensionUIDialogOptions` import; provenance cites installed `@earendil-works/pi-coding-agent@0.87.1` `dist/core/extensions/types.d.ts:75`.
- Replacement-confirm prompt (`index.ts:~705`) keeps exactly one argument — no placeholder.
- No change to empty-submit / typed-override / Escape-cancel behavior; no `src/copy.ts` change (its boundary comment cites the literal structurally and remains accurate).
- Designer P3 observation obligation: the entry-wiring forward test keeps passing with two-arg calls after the vendored declaration widens to three-param — it is not an arity probe.
- Gates: `bunx tsc --noEmit` exit 0; `bun test` green (baseline 332 pass / 7 skip; the only expected non-pass is the Windows-gated credential-ACL skip on non-Windows runners).

## Review Focus

- A malformed/whitespace-only typed URL is trimmed before enrollment — the typed-override pin feeds a padded string (`"  https://typed.example  "`) and asserts the persisted `serverUrl` is the trimmed value.
- The placeholder must equal the *resolved* tier value on every tier (env → setting → credential → default), not the harness default — the four-tier matrix pins each tier independently.
- The entry wiring must forward `undefined` (not `""` or a stale string) when no placeholder exists — the replacement-confirm pin asserts the captured second argument is exactly `undefined`.
- Whole-literal title equality (`.toBe()`, not `toContain`) — a `startsWith` guard could let copy drift slip past.
- Env-var leakage between tests: the entry-wiring test sets `PI_CODING_AGENT_DIR` / `PI_REMOTE_SERVER_URL` and must restore them in `finally` so the shared-process suite stays deterministic.

---

### Task 1: Red tests — placeholder capture (TDD red)

**Files:**
- Modify: `test/index.test.ts:151` (widen `HarnessOptions.inputPrompt`)
- Modify: `test/index.test.ts:253` (`confirmReplacement: "confirmReplacement" in opts ? opts.confirmReplacement : async () => true` — lets the replacement pin exercise `index.ts`'s inline inputPrompt-based confirm)
- Modify: `test/index.test.ts:~1866-1888` (tier matrix)
- Modify: `test/index.test.ts` (new tests in the EV-15/EV-18 describe blocks)

Steps:
- [ ] Widen `HarnessOptions.inputPrompt` to `(p: string, placeholder?: string) => Promise<string | undefined>` (spec 6f; existing no-op stubs stay assignable).
- [ ] Rewrite the four-tier matrix to capture `(title, placeholder)` pairs — closure declares `placeholder?`; assert per tier: `placeholder === expected` AND full title `.toBe()` the exact keyless literal (spec 6a + 6b).
- [ ] Add entry-wiring forward test (spec 6c, red today): fake `pi` whose `registerCommand` trap captures the `rc:login` handler; fake ctx with `ui.input` recording `(title, placeholder)`; `PI_CODING_AGENT_DIR` → fresh temp dir, `PI_REMOTE_SERVER_URL` = chosen tier (env tier), saved/restored in `finally`; invoke the captured handler with `("", ctx)`; `ui.input` returns `undefined` (Escape) → early return, no driver; assert title contains `[https://env.example]` and `placeholder === "https://env.example"`.
- [ ] Add typed-override pin (spec 6d): fresh host, `inputPrompt` returns `"  https://typed.example  "`; discovery/token mocked like T2/A1; assert persisted credential `serverUrl === "https://typed.example"` (trimmed) and the discovery fetch went to the trimmed URL.
- [ ] Add replacement-confirm pin (spec 6e): existing credential (harness default) + `confirmReplacement: undefined` explicitly; `inputPrompt` returns `""` on the URL call then `undefined` on the confirm call → cancelled, no HTTP; assert second captured call is `("Press Enter to replace the existing credential, or Escape to keep it.", undefined)` and first-call placeholder is the resolved tier URL.
- [ ] Run `bun test test/index.test.ts` — observe the matrix placeholder and entry-wiring tests fail for the right reason (placeholder `undefined` today); the typed-override and replacement pins may pass already (they pin unchanged behavior).
- [ ] Commit: `test(index): pin the input placeholder capture across tiers and entry wiring (EV-18, red)`

### Task 2: Green — widen the dep, pass the placeholder, forward both args

**Files:**
- Modify: `index.ts:~107` (dep signature + JSDoc)
- Modify: `index.ts:~672` (add `resolved` as second argument; template untouched)
- Modify: `index.ts:~973` (`inputPrompt: (prompt, placeholder) => requireCtx().ui.input(prompt, placeholder)`)

Steps:
- [ ] Widen the dep exactly as constrained; JSDoc cites the real three-param SDK signature and notes pi-remote never supplies `opts`.
- [ ] Pass `resolved` as the second argument at the attended URL prompt; the template literal stays byte-identical.
- [ ] Forward both arguments at the entry wiring.
- [ ] Run `bun test test/index.test.ts` — all Task-1 reds now green.
- [ ] Commit: `feat(index): pass the resolved URL as the attended login prompt placeholder (EV-18)`

### Task 3: Reconcile the vendored `ui.input` declaration + vendored-signature pin

**Files:**
- Modify: `src/pi-sdk-on.ts:31-32`
- Create: `test/pi-sdk-input-signature.test.ts` (three-arg call against `PiExtensionContext["ui"]["input"]` compiles — TS2554 red at base; plus a runtime three-arg smoke)

Steps:
- [ ] Replace the factually false two-param comment with the three-param declaration: inline structural opts, provenance `types.d.ts:75`, cite the EPIC-6/FLLWUP-39 declare rule route (a).
- [ ] Add the compile-pin test (three-arg call, incl. an opts object with `timeout`).
- [ ] Run `bun test test/pi-sdk-input-signature.test.ts` and `bunx tsc --noEmit`.
- [ ] Commit: `fix(pi-sdk): reconcile vendored ui.input with the real three-param signature (EV-18)`

### Task 4: Doc sync

**Files:**
- Modify: `docs/PI-SPEC.md` §7.2 (~line 346) — one clause noting the placeholder pass-through.
- Modify: `docs/PI-SPEC.md` §8 `/rc:login` row (~line 423) — one clause noting the placeholder pass-through.

Steps:
- [ ] Add the clause in both places (no other prose changes).
- [ ] Commit: `docs(pi-spec): note the attended login prompt's placeholder pass-through (EV-18)`

### Task 5: Gates, push, PR

Steps:
- [ ] `bunx tsc --noEmit` — exit 0.
- [ ] `bun test` — full suite green (332+ pass / 7 skip baseline; Windows-ACL skip expected on Linux).
- [ ] Push `owner/EV-18-url-placeholder`; open PR against `main` naming both residuals (installed-host placeholder-discard; future-host double/triple render) and stating `login.urlPrompt` is not a landed key and EV-18 mints no key.
