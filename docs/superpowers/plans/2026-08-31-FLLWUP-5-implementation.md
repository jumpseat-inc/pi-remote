# FLLWUP-5 — `pi.human_input.resolved` Host-Side Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit the CUSTOM `pi.human_input.resolved` completion frame `{promptId, occurrence, deviceId, ts}` from the lifecycle layer when an EV-6-tracked prompt resolution (direct or steering-fallback) is applied, add the `ui_prompt_end` → `pi.human_input.closed` pure fold mapping, thread `tracked`/`occurrence` through `InjectResult`, and replace all seven `forward(ev as PiEvent)` casts with manual PiEvent construction.

**Architecture:** Three coordinated seams, per the settled design: (a) `src/translate.ts` gains a `ui_prompt_end` PiEvent variant and a pure `translateLive` case emitting `pi.human_input.closed` (informational passive mirror — no ts/deviceId/promptId); (b) `src/inject.ts` threads `occurrence` (both `resolved` and `steered_fallback`) and `tracked` (steered_fallback only: true when the prompt is a live registry entry, false for unknown-entry phantoms) through `handleApprovalResponse` and the shared `fallback()` helper; (c) `index.ts` captures the `InjectResult` in `onInbound`, emits `pi.human_input.resolved` for `resolved` / tracked-`steered_fallback` only, and converts all seven `deps.on(...)` subscriptions from `forward(ev as PiEvent)` to explicit literal construction. `forward()` itself is untouched (its `ui.confirm` registerPrompt raise-stamp special-case is preserved). TDD per task: fixtures first, watched fail, minimal implementation, watched pass.

**Tech Stack:** Bun, TypeScript (strict), `bunx tsc --noEmit`, `bun test` (Bun-native, no Mongo).

**Spec:** `docs/superpowers/specs/2026-08-31-FLLWUP-5-design.md` — the settled design, sole authority. Also `council/cards/FLLWUP-5.md` (step-6 rulings; J-FIELDSET / J-ACCEPT / S-O1 / S-O2 / S-O3 all binding and folded into the spec) and `docs/PI-SPEC.md` §4/§5.4 (wire contract context).

## Global Constraints

Verbatim binding rules from the spec (do not relax):

- Wire shape of `pi.human_input.resolved` `value.data` is EXACTLY `{ promptId, occurrence, deviceId, ts }` — **no `kind`** (ruling Item 1; a fixture-only value no production frame takes would lie; any extra key fails the strict deep-equal fixture).
- **Emit only** for `InjectResult.kind === "resolved"` and for `kind === "steered_fallback"` **with `tracked === true`**. Never untracked fallback, never `stale` (already surfaced via `pi.human_input.stale`), never `ignored` / `injected`. `resolved` always implies tracked (fixture seam `resolvePendingPrompt:()=>true`).
- **deviceId** comes from the `InjectResult` (recorded from the inbound envelope) — never injected into free text (EV-6 invariant). **ts** comes from the injected `deps.now` (the lifecycle layer's clock, not the fold's).
- `steered_fallback` gains `tracked: boolean` (live-entry → `true`, unknown-entry → `false`) and BOTH `resolved` and `steered_fallback` gain `occurrence: number` (thread `d.occurrence` / client-sent occurrence). `stale` and `ignored` carry NEITHER.
- Contract (a) fold frame is exactly: `CUSTOM` name `pi.human_input.closed`, `value { pi: "ui_prompt_end", data: { kind, title, schemaVersion: 1 } }`. No ts/deviceId/promptId on it. Distinct dispatch name — never merged with `pi.human_input.resolved`.
- `UIPromptKind` is the closed 5-value union `"select" | "confirm" | "input" | "editor" | "custom"`. Unknown SDK kind degrades to `"custom"` (defensive, keeps the union closed).
- S-O2: all seven subscriptions (`message_start`, `message_update`, `message_end`, `tool_result`, `ui.confirm`, `user_input`, NEW `ui_prompt_end`) construct the PiEvent manually; **no `ev as PiEvent` cast survives in `index.ts`** after this card. `forward()` unchanged — its `ui.confirm` registerPrompt special-case is preserved.
- Purity guards stay green: the fold adds no clock/entropy/I-O (G-11/G-12 static guards in `test/translate.test.ts` must keep passing).
- Gates (this card — NO Mongo, NO boot, NO import smoke): `bunx tsc --noEmit` exit 0; `bun test` exit 0, full suite green (146-pass baseline + new fixtures). A failing gate is a hard stop-and-fix; never lower a threshold, never silence a finding.
- Commits: Conventional Commits; scopes per repo precedent — `inject`, `translate`, `index`, `docs` (AGENTS.md lists transport/translate/history/inject/tunnel; `index` used by EV-8 for the entry point; `docs` for PI-SPEC).

---

### Task 1: `InjectResult` gains `occurrence` + `tracked` (S-O3 / §3.1–3.2)

**Files:**
- Modify: `src/inject.ts` (InjectResult union ~line 35–41; `fallback()` helper; `handleApprovalResponse` returns)
- Modify: `test/inject.test.ts` (update 6 existing `toEqual` result assertions; add the S-O3/occurrence fixture)

**Interfaces:**
- Consumes: existing `InjectDeps`, `registerPrompt`, `handle` — unchanged.
- Produces: `InjectResult` union:
  ```ts
  export type InjectResult =
    | { kind: "ignored" }
    | { kind: "injected"; deliverAs?: DeliverAs }
    | { kind: "resolved"; promptId: string; occurrence: number; direct: true; deviceId?: string }
    | { kind: "steered_fallback"; promptId: string; occurrence: number; text: string; direct: false; deviceId?: string; reason: "mode"; tracked: boolean }
    | { kind: "stale"; promptId: string; deviceId?: string };
  ```
- `fallback(promptId, occurrence, response, deviceId, tracked): InjectResult` — shared steering helper, returns `tracked`/`occurrence` on the result. `handleApprovalResponse` passes `tracked:false` for unknown-entry, `tracked:true` for live-entry, and `occurrence` (client-sent for unknown; `d.occurrence` for live — same value, registry-keyed).

- [ ] **Step 1: Update the existing strict `toEqual` assertions in `test/inject.test.ts` to the new shapes (they are the red fixtures)**

  In "R1: registerPrompt scopes by (promptId, occurrence); resolving one occurrence leaves the other live":
  ```ts
  expect(r2).toEqual({ kind: "resolved", promptId: "p1", occurrence: 2, direct: true, deviceId: "d1" });
  ...
  expect(r1).toEqual({ kind: "resolved", promptId: "p1", occurrence: 1, direct: true, deviceId: "d3" });
  ```
  In "live → resolved (fixture seam, R3): direct:true, no sendUserMessage, no R2 notice":
  ```ts
  expect(r).toEqual({ kind: "resolved", promptId: "p1", occurrence: 1, direct: true, deviceId: "dev1" });
  ```
  In "live → steering fallback idle (R3 production default): never dropped, reason mode":
  ```ts
  expect(r).toEqual({ kind: "steered_fallback", promptId: "p1", occurrence: 1, text: "yes", direct: false, deviceId: "dev1", reason: "mode", tracked: true });
  ```
  In "already-resolved (stale) is surfaced, NOT delivered, and triggers no R2 notice":
  ```ts
  expect(first).toEqual({ kind: "resolved", promptId: "p1", occurrence: 1, direct: true, deviceId: "win1" });
  ```
  In "unknown promptId → steering fallback (never dropped), reason mode, R2 notice on first":
  ```ts
  expect(r).toEqual({ kind: "steered_fallback", promptId: "unknown-prompt", occurrence: 1, text: "yes", direct: false, deviceId: "dev1", reason: "mode", tracked: false });
  ```

- [ ] **Step 2: Add the new S-O3 / occurrence fixture to `test/inject.test.ts`** (inside `describe("EV-6 approval resolution")`):

  ```ts
  test("FLLWUP-5 S-O3: live-entry fallback tracked:true, unknown-entry tracked:false, occurrence round-trips on both; stale carries no occurrence", async () => {
    const { deps } = fakeDeps({ streaming: false });
    const inj = createInjector(deps);
    // unknown entry: a prompt this host never raised — occurrence is the client's, tracked:false
    const unknown = await inj.handle(env("dev-u", responseFrame({ promptId: "ghost", occurrence: 3, response: "hi" })));
    expect(unknown).toEqual({
      kind: "steered_fallback", promptId: "ghost", occurrence: 3, text: "hi",
      direct: false, deviceId: "dev-u", reason: "mode", tracked: false,
    });
    // live entry: registered prompt resolved via steering fallback — tracked:true, occurrence from the registry key
    inj.registerPrompt({ promptId: "p1", kind: "confirm", prompt: "P?" });
    const live = await inj.handle(env("dev-l", responseFrame({ promptId: "p1", occurrence: 1, response: "yes" })));
    expect(live).toEqual({
      kind: "steered_fallback", promptId: "p1", occurrence: 1, text: "yes",
      direct: false, deviceId: "dev-l", reason: "mode", tracked: true,
    });
    // direct resolution (fixture seam) also carries occurrence
    const direct = fakeDeps({ resolvePendingPrompt: () => true });
    const inj2 = createInjector(direct.deps);
    inj2.registerPrompt({ promptId: "p2", kind: "confirm", prompt: "Q?" });
    const resolved = await inj2.handle(env("dev-r", responseFrame({ promptId: "p2", occurrence: 1, response: "ok" })));
    expect(resolved).toEqual({ kind: "resolved", promptId: "p2", occurrence: 1, direct: true, deviceId: "dev-r" });
    // stale does NOT carry occurrence
    const stale = await inj2.handle(env("dev-s", responseFrame({ promptId: "p2", occurrence: 1, response: "late" })));
    expect(stale).toEqual({ kind: "stale", promptId: "p2", deviceId: "dev-s" });
  });
  ```

- [ ] **Step 3: Run the inject suite and verify it FAILS for the expected reason**

  Run: `bun test test/inject.test.ts`
  Expected: the untouched `InjectResult` lacks `occurrence`/`tracked`, so the strict `toEqual` assertions fail on extra/missing keys ("resolved"/"steered_fallback" mismatch). Failure must be the missing fields, NOT a syntax/type error.

- [ ] **Step 4: Implement `src/inject.ts` — extend the union and thread the fields**

  ```ts
  export type InjectResult =
    | { kind: "ignored" }
    | { kind: "injected"; deliverAs?: DeliverAs }
    | { kind: "resolved"; promptId: string; occurrence: number; direct: true; deviceId?: string }
    | { kind: "steered_fallback"; promptId: string; occurrence: number; text: string; direct: false; deviceId?: string; reason: "mode"; tracked: boolean }
    | { kind: "stale"; promptId: string; deviceId?: string };
  ```

  Update the `fallback()` helper (signature + returned literal):
  ```ts
  /** Steering fallback, never dropped: sendUserMessage then the R2 loud-once notice. */
  function fallback(
    promptId: string,
    occurrence: number,
    response: string,
    deviceId: string | undefined,
    tracked: boolean
  ): InjectResult {
    const deliverAs = deps.isStreaming() ? "steer" : undefined;
    void deps.sendUserMessage(response, { deliverAs }).catch(() => {});
    announceOnce(promptId);
    return { kind: "steered_fallback", promptId, occurrence, text: response, direct: false, deviceId, reason: "mode", tracked };
  }
  ```

  Update the three `handleApprovalResponse` return sites:
  ```ts
  if (!entry) {
    // Unknown (promptId/occurrence) — belongs to another extension or never observed.
    // Steering fallback, never dropped (R3 permanent). Untracked: a prompt this host never raised.
    return fallback(promptId, occurrence, response, deviceId, false);
  }
  ...
  if (direct === true) {
    // Only reachable through the fixture seam in tests (R3) — production always falls back.
    return { kind: "resolved", promptId, occurrence, direct: true, deviceId };
  }
  return fallback(promptId, occurrence, response, deviceId, true);
  ```
  (`stale` return stays `{ kind: "stale", promptId, deviceId }` — no occurrence. The `direct` resolution returns the same `d.occurrence` the registry was keyed on.)

- [ ] **Step 5: Run the inject suite and verify it PASSES**

  Run: `bun test test/inject.test.ts`
  Expected: all EV-6 tests + the new FLLWUP-5 S-O3 test pass.

- [ ] **Step 6: Commit**

  ```bash
  git add src/inject.ts test/inject.test.ts
  git commit -m "feat(inject): thread tracked + occurrence through InjectResult (FLLWUP-5 S-O3)"
  ```

---

### Task 2: Contract (a) — `ui_prompt_end` PiEvent → `pi.human_input.closed` (pure fold)

**Files:**
- Modify: `src/translate.ts` (PiEvent union; `translateLive` switch)
- Modify: `test/translate.test.ts` (new fixtures)

**Interfaces:**
- Consumes: existing `translate(input, state)` dispatch — the `"kind" in input` test must not catch `ui_prompt_end` (it has no `kind` field; the fold switch keys on `input.event`).
- Produces: `export type UIPromptKind = "select" | "confirm" | "input" | "editor" | "custom";` and `PiEvent` variant `{ event: "ui_prompt_end"; kind: UIPromptKind; title?: string }`; `translateLive` case `"ui_prompt_end"` emitting `CUSTOM` `pi.human_input.closed` with `value: { pi: "ui_prompt_end", data: { kind: input.kind, title: input.title, schemaVersion: 1 } }`.

- [ ] **Step 1: Add the red fixtures to `test/translate.test.ts`** (top-level `describe("EV-4 ...")` already imports `translate`, `createState`, types):

  ```ts
  test("FLLWUP-5 (a): ui_prompt_end → CUSTOM pi.human_input.closed, informational mirror, no ts/deviceId/promptId (G-11 stays green)", () => {
    const mk = () =>
      runSequence([{ event: "ui_prompt_end", kind: "confirm", title: "Allow rm -rf?" }], { sessionId: "s1", runId: "r1" });
    const frames = mk();
    const c = frames[0] as { type: "CUSTOM"; name: string; value: { pi: string; data: Record<string, unknown> } };
    expect(frames).toHaveLength(1);
    expect(c.type).toBe("CUSTOM");
    expect(c.name).toBe("pi.human_input.closed");
    expect(c.name).not.toBe("pi.human_input.resolved"); // distinct dispatch key — never merged
    expect(c.value.pi).toBe("ui_prompt_end");
    expect(c.value.data).toEqual({ kind: "confirm", title: "Allow rm -rf?", schemaVersion: 1 });
    // the fold carries ONLY kind/title/schemaVersion — no ts, no deviceId, no promptId
    expect(Object.keys(c.value.data).sort()).toEqual(["kind", "schemaVersion", "title"]);
    (["ts", "deviceId", "promptId"] as const).forEach((k) => {
      expect(k in c.value.data).toBe(false);
    });
    // pure: deterministic across replay
    expect(JSON.stringify(frames)).toBe(JSON.stringify(mk()));
  });

  test("FLLWUP-5 (a): title optional; all five UIPromptKind values map; unknown kind falls to custom", () => {
    const noTitle = runSequence([{ event: "ui_prompt_end", kind: "input" }], { sessionId: "s1", runId: "r1" });
    const d1 = (noTitle[0] as { value: { data: Record<string, unknown> } }).value.data;
    expect(d1.kind).toBe("input");
    expect(d1.schemaVersion).toBe(1);
    expect(d1.title).toBeUndefined();
    const custom = runSequence([{ event: "ui_prompt_end", kind: "custom" }], { sessionId: "s1", runId: "r1" });
    expect((custom[0] as { value: { data: { kind: string } } }).value.data.kind).toBe("custom");
  });
  ```

- [ ] **Step 2: Run `bun test test/translate.test.ts` and verify the new fixtures FAIL** (first test errors with "name is undefined" / mismatch because there is no `ui_prompt_end` case — falls to the exhaustive default emitting 0 frames, so `frames[0]` is undefined).

- [ ] **Step 3: Implement `src/translate.ts`**

  Add the local type above the `PiEvent` union:
  ```ts
  /** Closed 5-value union matching the installed pi SDK's UIPromptKind (types.d.ts:563). Local — the repo has no SDK dependency. */
  export type UIPromptKind = "select" | "confirm" | "input" | "editor" | "custom";
  ```

  Add the variant to `PiEvent` (next to `ui.confirm`):
  ```ts
  | { event: "ui_prompt_end"; kind: UIPromptKind; title?: string }
  ```

  Add the case in `translateLive` (after the `ui.confirm` case):
  ```ts
  case "ui_prompt_end":
    // FLLWUP-5 spec §1.2 — informational passive mirror: carries only {kind, title};
    // cannot be correlated to a promptId (schema gap), never merged with the
    // lifecycle pi.human_input.resolved frame. Pure: no clock, no entropy.
    frames.push({
      type: "CUSTOM",
      name: "pi.human_input.closed",
      value: { pi: "ui_prompt_end", data: { kind: input.kind, title: input.title, schemaVersion: 1 } },
    });
    break;
  ```

  **Discriminator fix (required by the spec's own fixture):** `translate()`
  currently dispatches on `"kind" in input` — but the new `ui_prompt_end`
  PiEvent legitimately carries `kind`, so `translate({event:"ui_prompt_end", kind,
  title}, state)` (the spec Test-plan fixture) would collide with the JsonlEntry
  discriminator and misroute to `translateJsonl`, emitting a WRONG
  `pi.session.info_change` frame (probe-4 kind-collision, reproduced at the fold
  level). Every `JsonlEntry` carries `entryId`; no `PiEvent` does — so switch the
  discriminator, behavior-identical for all existing inputs:
  ```ts
  export function translate(input: Input, state: TranslateState): FoldResult {
    // FLLWUP-5 contract (a): JsonlEntry is discriminated by `entryId` (every JSONL
    // entry carries it); PiEvent is discriminated by `event`. `kind` is NOT a safe
    // discriminator: the ui_prompt_end PiEvent legitimately carries a `kind` field,
    // and `"kind" in input` would misroute it to translateJsonl (probe-4
    // kind-collision → wrong pi.session.info_change frame).
    if ("entryId" in input) {
      return translateJsonl(input, state);
    }
    return translateLive(input, state);
  }
  ```

- [ ] **Step 4: Run the translate suite and verify it PASSES (new fixtures + existing G-11/G-12 purity guards)**

  Run: `bun test test/translate.test.ts`
  Expected: 0 fail; G-11 ("no crypto.randomUUID / Date.now / Math.random") and G-12 ("no runtime imports") guards still green.

- [ ] **Step 5: Commit**

  ```bash
  git add src/translate.ts test/translate.test.ts
  git commit -m "feat(translate): add ui_prompt_end → pi.human_input.closed fold mapping (FLLWUP-5 contract a)"
  ```

---

### Task 3: Contract (b) — capture the `InjectResult`, emit `pi.human_input.resolved` (lifecycle)

**Files:**
- Modify: `index.ts` (`startDial`'s `onInbound`; new `emitResolved` helper near `forward()`)
- Modify: `test/index.test.ts` (harness gains a `resolvePendingPrompt` option; new contract-(b) describe block)

**Interfaces:**
- Consumes: Task 1's `InjectResult` (needs `occurrence` on `resolved`/`steered_fallback`, `tracked` on `steered_fallback`); `transportRef.handle?.send`; `now` (injected `deps.now ?? Date.now`, already in scope).
- Produces: `emitResolved(promptId: string, occurrence: number, deviceId: string | undefined): void` — sends `{ type: "CUSTOM", name: "pi.human_input.resolved", value: { pi: "pi.human_input.resolved", data: { promptId, occurrence, deviceId, ts: now() } } }` on `transportRef.handle`. Emission rule: `resolved` OR `steered_fallback`-with-`tracked:true`; never untracked/stale/ignored/injected.

- [ ] **Step 1: Extend the test harness in `test/index.test.ts`** — add the fixture seam option. In `HarnessOptions` add:
  ```ts
  /** FLLWUP-5 contract (b) fixture seam: direct-resolution path (production default is () => false). */
  resolvePendingPrompt?: (promptId: string, result: unknown, deviceId?: string) => boolean | Promise<boolean>;
  ```
  In `makeHarness`, change the deps construction line `resolvePendingPrompt: () => false,` to:
  ```ts
  resolvePendingPrompt: opts.resolvePendingPrompt ?? (() => false),
  ```

- [ ] **Step 2: Add the red contract-(b) fixtures to `test/index.test.ts`** (new top-level describe; helpers mirror the existing relay/received patterns; `lastSet`/`LIVE_SENTENCE` already defined):

  ```ts
  describe("FLLWUP-5 contract (b): pi.human_input.resolved lifecycle emission", () => {
    function promptIdOf(h: Harness): string {
      const f = h.relay.received.find(
        (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"
      )!;
      return (f.frame as { value: { data: { promptId: string } } }).value.data.promptId;
    }
    function resolvedOf(h: Harness) {
      return h.relay.received.filter(
        (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input.resolved"
      );
    }
    async function answer(h: Harness, promptId: string, occurrence: number, deviceId: string, response = "yes") {
      h.relay.broadcast({
        v: 1,
        seq: 100,
        ack: 0,
        deviceId,
        frame: {
          type: "CUSTOM",
          name: "pi.human_input.response",
          value: { pi: "ui.confirm", data: { promptId, occurrence, response } },
        },
      });
    }

    test("direct resolution (fixture seam) → resolved with EXACTLY {promptId, occurrence, deviceId, ts}", async () => {
      const h = await makeHarness({ resolvePendingPrompt: () => true });
      await h.runCommand("rc");
      await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
      h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "Allow rm -rf?" }); // raise + register
      await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"));
      const promptId = promptIdOf(h);
      await answer(h, promptId, 1, "dev-win");
      await h.waitFor(() => resolvedOf(h).length === 1);
      const frame = resolvedOf(h)[0]!.frame as { value: { pi: string; data: Record<string, unknown> } };
      expect(frame.value.pi).toBe("pi.human_input.resolved");
      // strict wire shape: value.data is exactly these four fields — any extra key (e.g. kind) fails
      expect(frame.value.data).toEqual({ promptId, occurrence: 1, deviceId: "dev-win", ts: 0 });
      expect(Object.keys(frame.value.data).sort()).toEqual(["deviceId", "occurrence", "promptId", "ts"]);
      h.relay.stop();
    });

    test("tracked steering fallback (production default) → resolved emitted", async () => {
      const h = await makeHarness(); // resolvePendingPrompt: () => false
      await h.runCommand("rc");
      await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
      h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "Allow rm -rf?" });
      await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"));
      const promptId = promptIdOf(h);
      await answer(h, promptId, 1, "dev-fb");
      await h.waitFor(() => resolvedOf(h).length === 1);
      const data = (resolvedOf(h)[0]!.frame as { value: { data: Record<string, unknown> } }).value.data;
      expect(data).toEqual({ promptId, occurrence: 1, deviceId: "dev-fb", ts: 0 });
      h.relay.stop();
    });

    test("untracked steering fallback (unknown promptId) → NO resolved frame (phantom ack)", async () => {
      const h = await makeHarness();
      await h.runCommand("rc");
      await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
      await answer(h, "ghost-prompt", 1, "dev-phantom"); // never raised by this host
      await h.waitFor(() => h.sendUserMessages.length > 0); // steered, never dropped
      await new Promise((r) => setTimeout(r, 30)); // let any emission land
      expect(resolvedOf(h)).toHaveLength(0);
      h.relay.stop();
    });

    test("stale → NO resolved frame (only pi.human_input.stale)", async () => {
      const h = await makeHarness({ resolvePendingPrompt: () => true });
      await h.runCommand("rc");
      await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
      h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "Allow rm -rf?" });
      await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"));
      const promptId = promptIdOf(h);
      await answer(h, promptId, 1, "dev-first");
      await h.waitFor(() => resolvedOf(h).length === 1);
      await answer(h, promptId, 1, "dev-loser", "late no"); // same (promptId, occurrence) → stale
      await h.waitFor(() => h.relay.received.some((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input.stale"));
      await new Promise((r) => setTimeout(r, 30));
      expect(resolvedOf(h)).toHaveLength(1); // exactly one resolved, no second
      h.relay.stop();
    });
  });
  ```

- [ ] **Step 3: Run `bun test test/index.test.ts` and verify the new fixtures FAIL** — expected: no `pi.human_input.resolved` frame is ever emitted (onInbound discards the result today), so the `resolvedOf(...).length === 1` waits time out / first test fails on 0 frames. (The harness-option addition alone must not break existing tests: `opts.resolvePendingPrompt ?? (() => false)` preserves the default.)

- [ ] **Step 4: Implement `index.ts` — capture the result and emit**

  Add the helper (function declarations hoist within the controller closure; place it just before `startDial` for locality):
  ```ts
  /** FLLWUP-5 contract (b): host-side completion frame for a tracked prompt resolution.
   *  deviceId comes from the InjectResult (envelope-derived, never free text);
   *  ts from the injected lifecycle clock (deps.now), not the fold. */
  function emitResolved(promptId: string, occurrence: number, deviceId: string | undefined): void {
    transportRef.handle?.send({
      type: "CUSTOM",
      name: "pi.human_input.resolved",
      value: { pi: "pi.human_input.resolved", data: { promptId, occurrence, deviceId, ts: now() } },
    });
  }
  ```

  Replace `onInbound` in `startDial`:
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
  (`injector.handle` NEVER throws — its `handle()` wraps everything in try/catch returning `ignored` — so no rejection handler is required; the spec's binding snippet has none.)

- [ ] **Step 5: Run `bun test test/index.test.ts` and verify it PASSES** — all four new fixtures green AND the pre-existing EV-8 suite (registration, occurrence stamp, runId, rc/rc:off/shutdown races) unaffected.

- [ ] **Step 6: Commit**

  ```bash
  git add index.ts test/index.test.ts
  git commit -m "feat(index): emit pi.human_input.resolved from captured InjectResult (FLLWUP-5 contract b)"
  ```

---

### Task 4: S-O2 — manual PiEvent construction across all seven `deps.on(...)` subscriptions

**Files:**
- Modify: `index.ts` (import line; the `deps.on(...)` wiring block; small `isUIPromptKind` guard helper)
- Modify: `test/index.test.ts` (static-guard fixture + seven-site fold-output fixture)

**Interfaces:**
- Consumes: Task 2's `UIPromptKind`; existing `forward(input: PiEvent)` — UNCHANGED, including its `ui.confirm` registerPrompt special-case (preserved; the raise stamp `{...data, occurrence}` must still fire).
- Produces: seven `deps.on` handlers that read fields off the raw SDK event and construct explicit `PiEvent` literals. No `ev as PiEvent` cast anywhere in `index.ts`.

- [ ] **Step 1: Add the red fixtures to `test/index.test.ts`**

  ```ts
  describe("FLLWUP-5 S-O2: manual PiEvent construction (no ev as PiEvent cast)", () => {
    test("static guard: no `as PiEvent` cast survives in index.ts", async () => {
      const src = await Bun.file(new URL("../index.ts", import.meta.url)).text();
      expect(src).not.toMatch(/as PiEvent/);
    });

    test("all seven subscriptions produce the intended fold output; ui_prompt_end survives the real SDK shape", async () => {
      const h = await makeHarness();
      await h.runCommand("rc");
      await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
      const customs = (name: string) =>
        h.relay.received.filter((e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === name);
      const types = () => h.relay.received.map((e) => e.frame?.type);

      // 1+2+3: message_start / message_update / message_end → TEXT_MESSAGE_START/CONTENT/END
      h.emit("message_start", { event: "message_start", messageId: "m1", role: "assistant" });
      h.emit("message_update", { event: "message_update", messageId: "m1", events: [{ kind: "text", delta: "hello" }] });
      h.emit("message_end", { event: "message_end", messageId: "m1" });
      await h.waitFor(() => types().includes("TEXT_MESSAGE_END"));
      expect(types()).toContain("TEXT_MESSAGE_START");
      expect(types()).toContain("TEXT_MESSAGE_CONTENT");
      expect(types()).toContain("TEXT_MESSAGE_END");

      // 4: tool_result → TOOL_CALL_RESULT
      h.emit("tool_result", { event: "tool_result", messageId: "m2", toolCallId: "call_1", content: [{ type: "text", text: "out" }] });
      await h.waitFor(() => types().includes("TOOL_CALL_RESULT"));
      const tc = h.relay.received.find((e) => e.frame?.type === "TOOL_CALL_RESULT")!.frame as { content: string };
      expect(tc.content).toBe("out");

      // 5: ui.confirm → CUSTOM pi.human_input with the raise stamp preserved
      h.emit("ui.confirm", { event: "ui.confirm", promptKind: "approve", prompt: "P?" });
      await h.waitFor(() => customs("pi.human_input").length === 1);
      const cf = customs("pi.human_input")[0]!.frame as { value: { data: { promptKind: string; prompt: string; occurrence?: number } } };
      expect(cf.value.data.promptKind).toBe("approve");
      expect(cf.value.data.prompt).toBe("P?");
      expect(cf.value.data.occurrence).toBe(1); // forward's registerPrompt special-case untouched

      // 6: user_input → TEXT_MESSAGE_* role user
      const userStartBefore = types().filter((t) => t === "TEXT_MESSAGE_START").length;
      h.emit("user_input", { event: "user_input", messageId: "m3", text: "hi" });
      await h.waitFor(() => types().filter((t) => t === "TEXT_MESSAGE_START").length === userStartBefore + 1);
      const us = h.relay.received.filter((e) => e.frame?.type === "TEXT_MESSAGE_START").at(-1)!.frame as { role?: string };
      expect(us.role).toBe("user");

      // 7: ui_prompt_end — feed the REAL SDK payload shape (type:, not event:) — the probe-4 hazard
      h.emit("ui_prompt_end", { type: "ui_prompt_end", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
      await h.waitFor(() => customs("pi.human_input.closed").length === 1);
      const closed = customs("pi.human_input.closed")[0]!.frame as { value: { pi: string; data: { kind: string; title: string } } };
      expect(closed.value.pi).toBe("ui_prompt_end");
      expect(closed.value.data.kind).toBe("confirm");
      expect(closed.value.data.title).toBe("Allow rm -rf?");

      h.relay.stop();
    });
  });
  ```

- [ ] **Step 2: Run `bun test test/index.test.ts`** — the static guard FAILS (six `as PiEvent` casts exist today); the seven-site test FAILS because the real SDK-shaped `ui_prompt_end` payload, passed through the cast, reaches `translate()` with `kind` present → misroutes to `translateJsonl` and never produces `pi.human_input.closed` (probe-4 reproduction — the wait times out).

- [ ] **Step 3: Implement `index.ts`**

  Extend the translate import:
  ```ts
  import { createState, translate, type AssistantMessageEvent, type PiEvent, type ToolResultContentBlock, type TranslateState, type UIPromptKind } from "./src/translate";
  ```

  Add the guard helper near `forward()`:
  ```ts
  const UI_PROMPT_KINDS = new Set<string>(["select", "confirm", "input", "editor", "custom"]);
  function isUIPromptKind(k: unknown): k is UIPromptKind {
    return typeof k === "string" && UI_PROMPT_KINDS.has(k);
  }
  ```

  Replace the six cast subscriptions with manual construction and add the seventh. Each handler reads only the fields it needs off the raw SDK event and passes them as an explicit literal — never the whole event object:
  ```ts
  deps.on("message_start", (ev) => {
    const e = ev as { messageId?: unknown; role?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || (e.role !== "assistant" && e.role !== "user")) return;
    forward({ event: "message_start", messageId: e.messageId, role: e.role });
  });
  deps.on("message_update", (ev) => {
    const e = ev as { messageId?: unknown; events?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || !Array.isArray(e.events)) return;
    forward({ event: "message_update", messageId: e.messageId, events: e.events as AssistantMessageEvent[] });
  });
  deps.on("message_end", (ev) => {
    const e = ev as { messageId?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string") return;
    forward({ event: "message_end", messageId: e.messageId });
  });
  deps.on("tool_result", (ev) => {
    const e = ev as { messageId?: unknown; toolCallId?: unknown; content?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || typeof e.toolCallId !== "string" || !Array.isArray(e.content)) return;
    forward({ event: "tool_result", messageId: e.messageId, toolCallId: e.toolCallId, content: e.content as ToolResultContentBlock[] });
  });
  deps.on("ui.confirm", (ev) => {
    const e = ev as { promptKind?: unknown; prompt?: unknown } | null | undefined;
    if (!e || typeof e.promptKind !== "string" || typeof e.prompt !== "string") return;
    forward({ event: "ui.confirm", promptKind: e.promptKind, prompt: e.prompt });
  });
  deps.on("user_input", (ev) => {
    const e = ev as { messageId?: unknown; text?: unknown } | null | undefined;
    if (!e || typeof e.messageId !== "string" || typeof e.text !== "string") return;
    forward({ event: "user_input", messageId: e.messageId, text: e.text });
  });
  deps.on("ui_prompt_end", (ev) => {
    const e = ev as { kind?: unknown; title?: unknown } | null | undefined;
    if (!e) return;
    forward({
      event: "ui_prompt_end",
      kind: isUIPromptKind(e.kind) ? e.kind : "custom",
      title: typeof e.title === "string" ? e.title : undefined,
    });
  });
  ```
  `agent_start` / `agent_settled` / `turn_start` / `turn_end` stay as they are (already manual).

- [ ] **Step 4: Run `bun test test/index.test.ts` and verify it PASSES** — static guard green; the seven-site fixture green (critical: the real SDK-shaped `ui_prompt_end` now maps to `pi.human_input.closed` instead of misrouting to `translateJsonl`); all pre-existing EV-8 harness tests still green (their emits were already PiEvent-shaped, field extraction is lossless).

- [ ] **Step 5: Commit**

  ```bash
  git add index.ts test/index.test.ts
  git commit -m "fix(index): manual PiEvent construction across all seven subscriptions (FLLWUP-5 S-O2)"
  ```

---

### Task 5: PI-SPEC §5.4-adjacent spec amendment

**Files:**
- Modify: `docs/PI-SPEC.md` (one new paragraph, inserted after the "Permanent steering fallback (R3)" paragraph in §5.4 — i.e. after the sentence ending "permanent behavior, not a stopgap.", before `## 6.`)

- [ ] **Step 1: Insert the amendment (verbatim per spec §6; no structural §4 table edit required)**

  ```markdown
  **Human-input completion (FLLWUP-5).** When a resolution is applied to a
  prompt EV-6 tracked, the extension emits a single CUSTOM
  `pi.human_input.resolved` frame, `value.data: { promptId, occurrence,
  deviceId, ts }` — `promptId`/`occurrence` the compound key the raise
  established, `deviceId` the resolving device from the inbound envelope
  (never free text), `ts` the host clock at emission. It is emitted for a
  direct resolution and for a tracked steering fallback, and never for an
  untracked fallback (a prompt this host never raised — a phantom ack) or
  for a stale answer (already surfaced via `pi.human_input.stale`). The
  raise-side `ui_prompt_end` mapping is an informational passive mirror:
  `CUSTOM` `pi.human_input.closed`, `value.data: { kind, title,
  schemaVersion: 1 }`, a distinct dispatch name that cannot be correlated
  to a promptId and is never merged with `pi.human_input.resolved`. The
  resolved frame is lifecycle-emitted (no JSONL entry kind) and surfaces in
  the live stream after resync; it is fixture-green today, runtime-observable
  once the raise path lands (FLLWUP-8).
  ```

- [ ] **Step 2: Verify no structural §4 change crept in** — `git diff docs/PI-SPEC.md` shows one added paragraph only.

- [ ] **Step 3: Commit**

  ```bash
  git add docs/PI-SPEC.md
  git commit -m "docs: pin ui_prompt_end/pi.human_input.resolved frames in PI-SPEC §5.4 (FLLWUP-5)"
  ```

---

### Task 6: Gates, push, PR (with amended acceptance)

**Files:** none (verification + git/GitHub).

- [ ] **Step 1: Gate 1 — `bunx tsc --noEmit`**

  Run: `bunx tsc --noEmit`; expected exit 0, no output. **Hard stop-and-fix if non-zero.**

- [ ] **Step 2: Gate 2 — `bun test`**

  Run: `bun test`; expected `147+ pass / 0 fail` (146 baseline + new fixtures). Record the real output tail (counts + exit). **Hard stop-and-fix if any test fails.** (No Mongo, no boot, no import smoke for this card.)

- [ ] **Step 3: Confirm clean tree + review the diff**

  ```bash
  git status --short
  git log --oneline -7
  ```

- [ ] **Step 4: Push the branch**

  ```bash
  git push -u origin flluwp-5-resolved
  ```

- [ ] **Step 5: Open the PR against `main`** — `gh pr create` with a body that carries:
  1. The **amended acceptance text verbatim from spec §5** (the quoted block: "The lifecycle wiring emits CUSTOM `pi.human_input.resolved` with `{promptId, occurrence, deviceId, ts}` from the captured `InjectResult` when a resolution (direct or steering-fallback-with-`tracked:true`) is applied to a prompt EV-6 tracked. The fixture path is green today; the runtime path is gated on FLLWUP-raise (a follow-up card that wires `ui_prompt_start` into the lifecycle layer). The acceptance criterion is fixture-green, not runtime-observable, until FLLWUP-raise ships."), with the probe-8 evidence note (installed SDK has no `ui.confirm` event; `on()` is exhaustively typed; no `deps.on("ui_prompt_start")` → raise path dead until FLLWUP-8).
  2. The **spec §6 amendment note** (the §5.4-adjacent pin: `ui_prompt_end → pi.human_input.closed` informational mapping + lifecycle `pi.human_input.resolved` frame, emitted on resolved / tracked-steered_fallback, never untracked or stale, deviceId from envelope, ts from host clock, fixture-green until FLLWUP-raise; no structural §4 table edit).
  3. Fixture coverage summary (the spec's Test plan: pure fold; tracked flag; occurrence round-trip; contract-(b) lifecycle incl. strict deep-equal; seven manual-construction sites) and the real gate output (tsc exit, bun test counts).

- [ ] **Step 6: Report** — branch name, PR number+URL, head SHA, and the REAL `bunx tsc --noEmit` + `bun test` output (exit codes + pass/fail counts), not claims.

---

## Self-review (writing-plans skill checklist)

**Spec coverage:** §1.1 (UIPromptKind + variant) → Task 2; §1.2 (pure case + exact frame) → Task 2 (plus the `"entryId" in input` discriminator fix the spec's own Test-plan fixture requires — `kind` is no longer a safe JsonlEntry discriminator once `ui_prompt_end` carries it; behavior-identical for every existing input); §2.1 (onInbound capture, emission rules, emitResolved with deps.now) → Task 3; §2.2 (strict 4-field wire shape, no kind) → Task 3 fixture (`toEqual` + keys assertion); §3.1 (tracked on steered_fallback) → Task 1; §3.2 (occurrence on resolved+steered_fallback, stale/ignored without) → Task 1; §4 (seven-site manual construction, forward unchanged, registerPrompt special-case preserved) → Task 4; §5 (amended acceptance) → Task 6 PR body; §6 (spec amendment) → Task 5; Test plan → Task 1 (S-O3/occurrence), Task 2 (pure fold), Task 3 (lifecycle + strict deep-equal), Task 4 (seven sites + static guard); Gates → Task 6. G-11/G-12 purity → Task 2 Step 4 verifies the existing guards still pass.

**Placeholder scan:** every code step carries the exact code; no "TBD"/"add error handling"/"similar to Task N".

**Type consistency:** `fallback(promptId, occurrence, response, deviceId, tracked)` — used identically in Task 1 Step 4; `emitResolved(promptId, occurrence, deviceId)` — defined and called identically in Task 3; `forward({ event: "ui_prompt_end", kind, title })` — Task 4 handler passes `UIPromptKind` (Task 2) via `isUIPromptKind` narrowing; `AssistantMessageEvent`/`ToolResultContentBlock` imported in Task 4 come from `src/translate.ts` (defined there today).