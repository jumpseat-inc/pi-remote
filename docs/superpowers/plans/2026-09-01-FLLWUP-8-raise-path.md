# FLLWUP-8 Implementation Plan — Wire the ui_prompt_start raise path end-to-end

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FLLWUP-5's `pi.human_input.resolved` runtime-observable: a live SDK `ui_prompt_start` raises a CUSTOM `pi.human_input` frame stamped with `(promptId, occurrence)`, so a remote answer matches a pending entry and `pi.human_input.resolved` fires live.

**Architecture:** New PiEvent variant `{event:"ui_prompt_start"; kind: UIPromptKind; title?: string}` in `src/translate.ts` mapped to a CUSTOM `pi.human_input` frame with exactly four data keys (`kind, title, schemaVersion:1, promptId`); `index.ts` gains a `deps.on("ui_prompt_start")` subscription mirroring the existing `ui_prompt_end` handler (isUIPromptKind guard with coercion to `"custom"`, manual validation, never `ev as PiEvent`); `forward()`'s `ui.confirm` special case collapses into a general post-translate stamp that registers any `pi.human_input` frame carrying a string `data.promptId`. `inject.ts`, `pi-sdk-on.ts`, the guard bridge, and the 5 synthetic `ui.confirm` fixtures are untouched.

**Tech Stack:** Bun + TypeScript, bun:test, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-FLLWUP-8-design.md` (settled by council deliberation; not reopened). Card: `council/cards/FLLWUP-8.md`.

## Global Constraints

- Work ONLY in the worktree `/home/tista/codes/pi-remote/.worktrees/flluwp-8-raise` (branch `flluwp-8-raise`). Never commit on `main`.
- Manual PiEvent construction at the new subscription — never `ev as PiEvent` (card-face binding rider).
- Existing dispatch names are stable keys: `pi.human_input`, `pi.human_input.closed`, `pi.human_input.resolved`, `pi.human_input.stale`, `pi.human_input.fallback_to_steer` — not relitigated.
- The 5 synthetic `ui.confirm` fixtures and the guard bridge (`if (event === "ui.confirm") return;` at index.ts:669) stay byte-untouched.
- `src/pi-sdk-on.ts` unchanged. `src/inject.ts` unchanged.
- PI-SPEC §4 FLLWUP-3 runtime-unreachability caveat (scoped to `queue_update`, `bash_execution_update`, `auto_retry_*`, `summarization_retry_*`) must NOT change.
- The raise data shape is exactly `{kind, title, schemaVersion:1, promptId}` — no `prompt`, no `promptKind`, no aliases (§3.2).
- Skeptic O9 resolution (binding): bogus kind → coerced `"custom"` frame + registration (mirroring `ui_prompt_end` semantics). Owner round-1 claim 4 ("bogus → no frame, no registration") is DROPPED — do not implement a drop.
- Gates: `bunx tsc --noEmit` exit 0; `bun test` full suite green (172-test baseline + new fixtures). No Mongo, no boot gate.
- Conventional Commits (scopes: `transport`, `translate`, `history`, `inject`, `tunnel`, or none).
- Offline raises are silent by construction (`forward` early-returns without a transport) — do not add registration before the transport check.

---

## File Structure

- Modify `src/translate.ts` — add the `ui_prompt_start` PiEvent variant (beside `ui_prompt_end` at :142) and one mapper case (beside `ui.confirm` at :525).
- Modify `index.ts` — add the `ui_prompt_start` subscription (beside `ui_prompt_end` at :616) and collapse `forward()`'s special case (index.ts:398-425) into a general stamp.
- Modify `test/translate.test.ts` — mapper fixtures (part of T4, T7, T10).
- Modify `test/index.test.ts` — live e2e fixtures T1, T2, T3, T5.
- Modify `docs/PI-SPEC.md` — §5.4 amendment only (§4 caveat untouched).
- Create `docs/superpowers/plans/2026-09-01-FLLWUP-8-raise-path.md` — this plan.

---

### Task 1: Mapper — PiEvent variant + mapper case (TDD)

**Files:**
- Test: `test/translate.test.ts`
- Modify: `src/translate.ts:141-142` (union), `src/translate.ts:525-549` (mapper cases)

**Interfaces:**
- Consumes: existing `UIPromptKind` (translate.ts:127), `fnv1a` (translate.ts:225, unexported), `runSequence` helper in the test file.
- Produces: `PiEvent` member `{ event: "ui_prompt_start"; kind: UIPromptKind; title?: string }`; translate case emitting `{ type: "CUSTOM", name: "pi.human_input", value: { pi: "ui_prompt_start", data: { kind, title, schemaVersion: 1, promptId } } }`.

- [ ] **Step 1: Write the failing mapper tests** — append to `test/translate.test.ts` (place inside the existing top-level describe or a new one):

```ts
// FLLWUP-8: test-local FNV-1a replica (fnv1a is unexported in src/translate.ts).
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

describe("FLLWUP-8: ui_prompt_start raise mapping", () => {
  test("confirm raise → CUSTOM pi.human_input, four data keys, no prompt/promptKind", () => {
    const frames = runSequence(
      [{ event: "ui_prompt_start", kind: "confirm", title: "Allow rm -rf?" }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toHaveLength(1);
    const f = frames[0] as { type: string; name: string; value: { pi: string; data: Record<string, unknown> } };
    expect(f.type).toBe("CUSTOM");
    expect(f.name).toBe("pi.human_input");
    expect(f.value.pi).toBe("ui_prompt_start");
    expect(f.value.data).toEqual({
      kind: "confirm",
      title: "Allow rm -rf?",
      schemaVersion: 1,
      promptId: fnv1a("confirm\u0000Allow rm -rf?"),
    });
    expect(Object.keys(f.value.data).sort()).toEqual(["kind", "promptId", "schemaVersion", "title"]);
    expect("prompt" in f.value.data).toBe(false);
    expect("promptKind" in f.value.data).toBe(false);
  });

  test("title absent → title undefined, promptId is the kind-only constant (T4)", () => {
    const frames = runSequence([{ event: "ui_prompt_start", kind: "input" }], { sessionId: "s1", runId: "r1" });
    const f = frames[0] as { value: { data: Record<string, unknown> } };
    expect("title" in f.value.data).toBe(true); // key present, value undefined
    expect(f.value.data.title).toBeUndefined();
    expect(f.value.data.promptId).toBe(fnv1a("input\u0000"));
  });

  test("pure + deterministic: two runs byte-identical (G-11/G-12 stay green)", () => {
    const a = runSequence([{ event: "ui_prompt_start", kind: "custom" }], { sessionId: "s1", runId: "r1" });
    const b = runSequence([{ event: "ui_prompt_start", kind: "custom" }], { sessionId: "s1", runId: "r1" });
    expect(a).toEqual(b);
    const f = a[0] as { value: { data: Record<string, unknown> } };
    expect(f.value.data.promptId).toBe(fnv1a("custom\u0000"));
  });

  test("raise data = close data + promptId (T10 close/raise symmetry)", () => {
    const raise = runSequence([{ event: "ui_prompt_start", kind: "confirm", title: "T" }], { sessionId: "s1", runId: "r1" });
    const close = runSequence([{ event: "ui_prompt_end", kind: "confirm", title: "T" }], { sessionId: "s1", runId: "r1" });
    const r = (raise[0] as { value: { data: Record<string, unknown> } }).value.data;
    const c = (close[0] as { value: { data: Record<string, unknown> } }).value.data;
    const { promptId, ...raiseCore } = r;
    expect(promptId).toEqual(expect.any(String));
    expect(raiseCore).toEqual(c); // {kind, title, schemaVersion:1} identical
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `bun test test/translate.test.ts`
  Expected: FAIL — the `ui_prompt_start` PiEvent variant does not exist (type error + no frames emitted / `frames[0]` undefined).

- [ ] **Step 3: Minimal implementation in `src/translate.ts`**

  Add to the union (right after the `ui_prompt_end` member at :142):

  ```ts
    | { event: "ui_prompt_start"; kind: UIPromptKind; title?: string }
  ```

  Add the mapper case right after `case "ui.confirm"`'s break (~line 540), before `case "ui_prompt_end"`:

  ```ts
      case "ui_prompt_start":
        // FLLWUP-8 — live raise: mirrors the ui_prompt_end close shape ({kind, title, schemaVersion:1})
        // plus promptId. No `prompt`, no `promptKind` — the SDK event carries no prompt body (skeptic F1),
        // and no live client ever consumed the synthetic ui.confirm raise shape. Pure: no clock, no entropy.
        frames.push({
          type: "CUSTOM",
          name: "pi.human_input",
          value: {
            pi: "ui_prompt_start",
            data: {
              kind: input.kind,
              title: input.title,
              schemaVersion: 1,
              promptId: fnv1a(`${input.kind}\u0000${input.title ?? ""}`),
            },
          },
        });
        break;
  ```

- [ ] **Step 4: Run tests to verify they pass** — `bun test test/translate.test.ts`
  Expected: PASS (all new + existing translate fixtures).

- [ ] **Step 5: Commit**

  ```bash
  git add src/translate.ts test/translate.test.ts
  git commit -m "feat(translate): map ui_prompt_start to the pi.human_input raise frame"
  ```

---

### Task 2: Live wiring — subscription + forward() collapse (TDD e2e)

**Files:**
- Test: `test/index.test.ts`
- Modify: `index.ts:398-425` (forward), `index.ts:616-624` (subscription block)

**Interfaces:**
- Consumes: Task 1's PiEvent variant and mapper case; `isUIPromptKind` (index.ts:394); `injector.registerPrompt({promptId, kind, prompt}) → {occurrence}` (inject.ts:179, body reads only promptId).
- Produces: live raise path — `deps.on("ui_prompt_start")` forwards a validated PiEvent; `forward()` stamps `occurrence` onto any CUSTOM `pi.human_input` frame with a string `data.promptId`.

- [ ] **Step 1: Write the failing e2e fixtures** — add to `test/index.test.ts` as a new describe, reusing the harness (`makeHarness`, `h.emit`, `h.relay`, `h.waitFor`, `lastSet`, `LIVE_SENTENCE`) and the `pi.human_input.response` broadcast envelope pattern from the FLLWUP-5 describe (answer frame: `{type:"CUSTOM", name:"pi.human_input.response", value:{pi:"ui.confirm", data:{promptId, occurrence, response}}}`):

```ts
describe("FLLWUP-8: ui_prompt_start live raise path", () => {
  function raisesOf(h: Harness) {
    return h.relay.received.filter(
      (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input"
    );
  }
  function resolvedOf(h: Harness) {
    return h.relay.received.filter(
      (e) => e.frame?.type === "CUSTOM" && (e.frame as { name?: string }).name === "pi.human_input.resolved"
    );
  }
  function fnv1a(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
  }
  async function answer(h: Harness, promptId: string, occurrence: number, deviceId: string, response = "yes") {
    h.relay.broadcast({
      v: 1, seq: 100, ack: 0, deviceId,
      frame: {
        type: "CUSTOM",
        name: "pi.human_input.response",
        value: { pi: "ui.confirm", data: { promptId, occurrence, response } },
      },
    });
  }

  test("T1: live SDK raise → exactly one stamped pi.human_input frame", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    await h.waitFor(() => raisesOf(h).length === 1);
    const f = raisesOf(h)[0]!.frame as { value: { pi: string; data: Record<string, unknown> } };
    expect(f.value.pi).toBe("ui_prompt_start");
    expect(f.value.data.kind).toBe("confirm"); // verbatim
    expect(f.value.data.title).toBe("Allow rm -rf?");
    expect(f.value.data.schemaVersion).toBe(1);
    expect(f.value.data.promptId).toBe(fnv1a("confirm\u0000Allow rm -rf?"));
    expect(f.value.data.occurrence).toBe(1);
    expect(Object.keys(f.value.data).sort()).toEqual(["kind", "occurrence", "promptId", "schemaVersion", "title"]);
    expect("prompt" in f.value.data).toBe(false);
    h.relay.stop();
  });

  test("T2: resolved e2e — remote answer after live raise emits pi.human_input.resolved (FLLWUP-5 (b) red→green)", async () => {
    const h = await makeHarness(); // production default resolvePendingPrompt: () => false
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    await h.waitFor(() => raisesOf(h).length === 1);
    const promptId = (raisesOf(h)[0]!.frame as { value: { data: { promptId: string } } }).value.data.promptId;
    await answer(h, promptId, 1, "dev-live");
    await h.waitFor(() => resolvedOf(h).length === 1);
    const frame = resolvedOf(h)[0]!.frame as { value: { pi: string; data: Record<string, unknown> } };
    expect(frame.value.pi).toBe("pi.human_input.resolved");
    expect(frame.value.data).toEqual({ promptId, occurrence: 1, deviceId: "dev-live", ts: 0 });
    h.relay.stop();
  });

  test("T3: occurrence counter — two identical raises → 1 then 2", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "confirm", title: "Allow rm -rf?" });
    await h.waitFor(() => raisesOf(h).length === 2);
    const occ = raisesOf(h).map(
      (e) => (e.frame as { value: { data: { occurrence: number } } }).value.data.occurrence
    );
    expect(occ).toEqual([1, 2]);
    h.relay.stop();
  });

  test("T5: bogus kind → mirroring coercion: kind coerced to custom, registration fires", async () => {
    const h = await makeHarness();
    await h.runCommand("rc");
    await h.waitFor(() => lastSet(h.setStatus) === LIVE_SENTENCE);
    h.emit("ui_prompt_start", { type: "ui_prompt_start", reason: "ui_prompt", kind: "bogus" });
    await h.waitFor(() => raisesOf(h).length === 1);
    const f = raisesOf(h)[0]!.frame as { value: { data: Record<string, unknown> } };
    expect(f.value.data.kind).toBe("custom");
    expect(f.value.data.occurrence).toBe(1);
    // registration fired: answering the coerced promptId resolves (tracked), not phantom
    const promptId = fnv1a("custom\u0000");
    await answer(h, promptId, 1, "dev-bogus");
    await h.waitFor(() => resolvedOf(h).length === 1);
    h.relay.stop();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `bun test test/index.test.ts`
  Expected: FAIL — T1/T2/T3/T5 hang or fail: no subscription for `ui_prompt_start` (frames never raised) and even a manual forward would be unstamped.

- [ ] **Step 3: Implement — subscription in `index.ts`** (add directly after the `deps.on("ui_prompt_end", …)` handler, mirroring it exactly):

  ```ts
    deps.on("ui_prompt_start", (ev) => {
      const e = ev as { kind?: unknown; title?: unknown } | null | undefined;
      if (!e) return;
      forward({
        event: "ui_prompt_start",
        kind: isUIPromptKind(e.kind) ? e.kind : "custom",
        title: typeof e.title === "string" ? e.title : undefined,
      });
    });
  ```

- [ ] **Step 4: Implement — collapse `forward()`** (replace the whole function body at index.ts:398-425; the `ui.confirm` special-case branch is deleted, the general post-translate stamp takes over):

  ```ts
    function forward(input: PiEvent): void {
      if (!transportRef.handle) return;
      ensureLiveState();
      const { frames, state } = translate(input, liveState!);
      liveState = state;
      for (const f of frames) {
        if (f.type === "CUSTOM" && f.name === "pi.human_input") {
          const data = (f.value.data ?? {}) as { promptId?: unknown; kind?: unknown; promptKind?: unknown; title?: unknown; prompt?: unknown };
          const promptId = data.promptId;
          if (typeof promptId === "string") {
            // FLLWUP-8: one raise path, one (promptId, occurrence) stamping site, one registerPrompt call site.
            // The promptKind/prompt fallback reads exist solely so the 5 synthetic ui.confirm fixtures keep
            // flowing through this same stamp (their frames carry promptKind/prompt; live frames carry kind/title).
            const { occurrence } = injector.registerPrompt({
              promptId,
              kind: typeof data.kind === "string" ? data.kind : typeof data.promptKind === "string" ? data.promptKind : "",
              prompt: typeof data.title === "string" ? data.title : typeof data.prompt === "string" ? data.prompt : "",
            });
            f.value.data = { ...data, occurrence };
          }
        }
        transportRef.handle.send(f as unknown as AgUiFrameLike);
      }
    }
  ```

  Notes:
  - The `if (!transportRef.handle) return;` guard stays first (offline raises silent — O10).
  - The `deps.on("ui.confirm", …)` subscription and the guard bridge stay byte-untouched.
  - Zero matches of `input.event === "ui.confirm"` must remain in `forward()` (T11 grep).

- [ ] **Step 5: Run tests to verify they pass** — `bun test test/index.test.ts`
  Expected: PASS — new fixtures + all 5 existing `ui.confirm` fixtures (T6) + all FLLWUP-5 resolved fixtures green.

- [ ] **Step 6: T11 grep proof** — `grep -n 'input.event === "ui.confirm"' index.ts`
  Expected: 0 matches. Also `grep -c 'registerPrompt(' index.ts` → exactly 1 call site inside `forward()`.

- [ ] **Step 7: Commit**

  ```bash
  git add index.ts test/index.test.ts
  git commit -m "feat(index): wire ui_prompt_start raise and collapse forward() to a general stamp"
  ```

---

### Task 3: PI-SPEC §5.4 amendment (same-PR rider)

**Files:**
- Modify: `docs/PI-SPEC.md` (~line 227 area, §5.4 pi.human_input paragraph)

**Interfaces:** none (docs only). §4 FLLWUP-3 caveat (lines ~108-117) untouched.

- [ ] **Step 1: Amend the falsified sentence.** Replace the §5.4 text ending "…it is fixture-green today, runtime-observable once the raise path lands (FLLWUP-8)." with a sentence stating the raise path is wired and FLLWUP-5 contract (b) is runtime-observable as of FLLWUP-8.
- [ ] **Step 2: Add the one-line (kind,title)-bucket note** (same paragraph or immediately after): on the live raise path `promptId` is a bucket hash over `(kind, title)`; `occurrence` is the true discriminator and the counter restarts per session — `promptId` alone is never a global identity.
- [ ] **Step 3: Add the prompt-body fidelity-loss caveat:** the installed SDK discards the message body — `select`/`editor`/`custom` prompts carry only `kind` + `title?` on the wire; for `custom` there is no title at all.
- [ ] **Step 4: Add the `value.pi` provenance note:** the client must not dispatch on `value.pi` (`"ui_prompt_start"`); the CUSTOM `name` is the sole dispatch key.
- [ ] **Step 5: T9 grep proofs:**
  - `grep -n "fixture-green today" docs/PI-SPEC.md` → 0 matches.
  - `grep -n "runtime-unreachability" docs/PI-SPEC.md` (or read lines ~108-117) → §4 caveat unchanged.
- [ ] **Step 6: Commit**

  ```bash
  git add docs/PI-SPEC.md
  git commit -m "docs(spec): amend FLLWUP-5 §5.4 — raise path wired, contract (b) runtime-observable"
  ```

---

### Task 4: Gates in full

- [ ] **Step 1: Typecheck** — `bunx tsc --noEmit` → exit 0.
- [ ] **Step 2: Full test suite** — `bun test` → full suite green: 172 baseline + new fixtures (4 mapper + 4 e2e), 0 fail.
- [ ] **Step 3: T12 — FLLWUP-9 negative probe proof** — in `src/pi-sdk-on.ts`, temporarily remove the `// @ts-expect-error` directive at `fllwup9TypeProbe`, run `bunx tsc --noEmit` → must FAIL (TS2578 unused directive was consumed / TS2345 on widen), restore the directive, re-run → exit 0. This proves the probe stays red-on-widen and the directive is still consumed.
- [ ] **Step 4: T9/T11 final greps** — "fixture-green today" 0 matches in PI-SPEC; `input.event === "ui.confirm"` 0 matches in index.ts; `grep -n "ui.confirm" index.ts` still shows the `deps.on("ui.confirm", …)` subscription and the guard bridge (untouched).
- [ ] **Step 5: Baseline integrity** — `git diff main --stat` shows only: `src/translate.ts`, `index.ts`, `test/translate.test.ts`, `test/index.test.ts`, `docs/PI-SPEC.md`, and the plan file. `src/pi-sdk-on.ts` and `src/inject.ts` absent from the diff.

### Task 5: Push + PR

- [ ] **Step 1:** `git push -u origin flluwp-8-raise`
- [ ] **Step 2:** `gh pr create --base main --head flluwp-8-raise` with a summary of the change (variant + mapper case, subscription mirroring ui_prompt_end, forward() collapse, PI-SPEC §5.4 amendment) and the gate results (tsc exit 0; bun test pass/fail/expect counts).
- [ ] Do NOT merge; do NOT wait on CI. Report branch, PR number, head SHA, gate outputs.
