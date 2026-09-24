# FLLWUP-35: Fold-Bookkeeping Probe for Dropped message_start — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, single implementer — this is a single-task card). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a regression probe that makes a dropped `message_start` observable as a test failure instead of being silently masked by translate.ts's `message_update` mid-join fallback.

**Architecture:** The fold's emitted frames for a dropped start are byte-identical to a legitimate mid-join — no pure frame assertion can catch the masking (information-theoretically identical inputs). The probe therefore asserts on the fold's *bookkeeping observability*: a `message_update` arriving with no `message_start` bookkeeping entry must open a **marked** entry (`midJoin: true`), so the fallback path is recorded rather than silently substituted. Shape chosen: **red-at-base probe + minimal instrumentation** — at base `OpenMessageState` carries no marker, so the probe fails against unmodified production (genuine red, no defect injection needed for the decisive assertion; a defect-injection run is additionally recorded as cross-evidence). The PR carries the minimal instrumentation that turns the probe green: one new field on the exported `OpenMessageState` interface, set at the three construction sites in `src/translate.ts`. No frame changes, no wire-format change, no behavior change; `messageFrameRoleLocal` and its static pairing test (test/translate.test.ts:448) are untouched.

**Tech Stack:** Bun + `bun:test`, TypeScript strict; pure fold (`src/translate.ts`), no I/O, no module-level mutable state (G-11/G-12).

**Spec:** Council card FLLWUP-35 (EPIC-5), quoted verbatim in the tasking turn — intent, acceptance, and card-specific run context (probe shape choice + evidence, `messageFrameRoleLocal` lockstep pin, product-only diff, Conventional Commits, gates).

## Global Constraints

- Gates, in full: `bunx tsc --noEmit` exit 0 AND `bun test` all-pass (only expected non-pass: the Windows-gated credential-ACL skip on non-Windows). No threshold lowering, no suppressed findings.
- PR diff product-only: changes under `src/` and `test/` only — no `council/` paths, no `vault/`, no `AGENTS.md`. The plan file stays **uncommitted** in the worktree if (and only if) repo history shows plans do not ride PRs; check `git log origin/main -- docs/superpowers/plans` first and follow the established convention.
- Tests follow the existing pattern in test/translate.test.ts: pure-logic probes against the real fold, no mocks, no module-level mutable state.
- `messageFrameRoleLocal` stays in lockstep with pi-sdk-events.ts's minting rule (static pairing test must stay green, untouched).
- Conventional Commits; scope `translate`.
- Work only inside the dedicated worktree `/home/tista/codes/pi-remote-fllwup-35`; the main worktree's branch state is immutable (R-CONV-1). Branch `owner/fllwup-35-fold-probe` was cut from `origin/main` (9393151).

## Review Focus

- **Dropped start for a non-mint-shaped id** (e.g. `msg-42`, prefix not `assistant`/`user`) — the fallback silently defaults the role to `"assistant"`; a reasonable person expects that substitution to be *recorded*, not invisible. → Pinned by Task 1 Step 1's probe (marked mid-join entry, `midJoin` true).
- **False positive on the legitimate start→update flow** — the probe must not flag start-opened bookkeeping. → Pinned by Task 1 Step 1's no-false-positive test (`midJoin` false).
- **Behavior neutrality** — the instrumentation must not change any emitted frame (FLLWUP-12's mid-join contract stays intact). → Pinned by Task 1 Step 1's frame-equality test on the fallback path.
- **Pairing-test blast radius** — `messageFrameRoleLocal` is untouched; the static pairing test must stay green. → Covered by the full `bun test` gate.

---

### Task 1: Probe (red) → instrumentation (green) → gates → commit → PR

**Files:**
- Modify: `test/translate.test.ts` (append one describe block at end of file)
- Modify: `src/translate.ts` (`OpenMessageState` interface ~line 191; `message_start` case ~line 407; `message_update` fallback ~line 418; JSONL construction ~line 308)
- Create (uncommitted or committed per convention check): `docs/superpowers/plans/2026-09-24-fllwup-35-fold-probe.md`

**Interfaces:**
- Consumes: `translate`, `createState`, `PiEvent`, `AgUiFrame`, `TranslateState.openMessages`, `OpenMessageState` — all already exported from `src/translate`.
- Produces: `OpenMessageState.midJoin: boolean` (new required field); probe describe block `FLLWUP-35 probe`.

- [ ] **Step 0 (pre-flight):** grep `openMessages` across `test/` and `src/` for any deep state-equality assertions that a new `OpenMessageState` field would break; read CLAUDE.md; check the plans-ride-PRs convention via `git log --oneline origin/main -- docs/superpowers/plans | head`.

- [ ] **Step 1 (RED): append the probe to test/translate.test.ts** — reads go through a structural view (`as unknown as { midJoin?: boolean }`) so the file compiles against base and fails at runtime:

```typescript
// ---------------------------------------------------------------------------
// FLLWUP-35 probe — a dropped message_start must not be silently masked by
// the message_update mid-join fallback (openMessages.get(...) ?? {
// role: messageFrameRoleLocal(...) ?? "assistant" }). The fallback continues
// the fold on back-derived/defaulted role bookkeeping, so the loss is
// unobservable in the emitted frames. The probe pins the observability
// contract: a fallback-opened entry is marked midJoin, so a dropped start
// is recorded as a detectable test failure instead of a silent substitution.
// ---------------------------------------------------------------------------
describe("FLLWUP-35 probe: a dropped message_start is observable, not masked by the message_update fallback", () => {
  test("a message_update with no message_start bookkeeping opens a marked mid-join entry (drop is recorded, not substituted)", () => {
    let state = createState({ sessionId: "s1", runId: "r1" });
    const r = translate(
      { event: "message_update", messageId: "user-1", events: [{ kind: "text", delta: "hello" }] },
      state
    );
    const book = r.state.openMessages.get("user-1") as unknown as { midJoin?: boolean; role: string } | undefined;
    expect(book).toBeDefined();
    expect(book?.midJoin).toBe(true); // RED at base: the fallback entry is unmarked
    expect(book?.role).toBe("user");  // back-derivation still recovers the role (behavior unchanged)
  });

  test("a start-opened entry is not marked mid-join (no false positive on the legitimate flow)", () => {
    let state = createState({ sessionId: "s1", runId: "r1" });
    const r1 = translate({ event: "message_start", messageId: "assistant-1", role: "assistant" }, state);
    const r2 = translate(
      { event: "message_update", messageId: "assistant-1", events: [{ kind: "text", delta: "hi" }] },
      r1.state
    );
    const book = r2.state.openMessages.get("assistant-1") as unknown as { midJoin?: boolean; role: string } | undefined;
    expect(book).toBeDefined();
    expect(book?.midJoin).toBe(false);
    expect(book?.role).toBe("assistant");
  });

  test("emitted frames for a dropped start are unchanged — the probe adds observability, not behavior", () => {
    const frames = runSequence(
      [{ event: "message_update", messageId: "assistant-1", events: [{ kind: "text", delta: "hello" }] }],
      { sessionId: "s1", runId: "r1" }
    );
    expect(frames).toEqual([
      { type: "TEXT_MESSAGE_START", messageId: "assistant-1", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "assistant-1", delta: "hello" },
    ]);
  });
});
```

- [ ] **Step 2 (verify RED):** `bun test test/translate.test.ts` — expect exactly the first probe test failing (`expect(book?.midJoin).toBe(true)` received `undefined`); record verbatim output. Also record a defect-injection cross-check: temporarily neuter `case "message_start":` to `break;` in src/translate.ts, re-run, observe both dropped-start-relevant tests red, then `git restore src/translate.ts`.

- [ ] **Step 3 (GREEN, minimal instrumentation):** in `src/translate.ts`:
  - Add to `OpenMessageState`: `/** FLLWUP-35: true when this entry was opened by the message_update mid-join fallback rather than a message_start — makes a dropped start observable instead of silently masked. */ midJoin: boolean;`
  - `message_start` case: `midJoin: false`.
  - `message_update` fallback literal: `midJoin: true`.
  - JSONL construction (~line 308): `midJoin: false` (replay entries are whole records, never mid-joins).
  - Drop the structural casts from the probe (field now typed).

- [ ] **Step 4 (verify GREEN):** `bunx tsc --noEmit` → exit 0; `bun test` → all-pass (record verbatim, including the expected Windows-ACL skip if present).

- [ ] **Step 5 (commit, Conventional Commits):**
  1. `test(translate): add FLLWUP-35 fold-bookkeeping probe for dropped message_start` (probe with casts, red at base — recorded demonstration)
  2. `feat(translate): mark fallback-opened message bookkeeping so dropped starts are observable` (instrumentation + cast removal, green)
  
  PR head = commit 2 = green.

- [ ] **Step 6 (ship):** `git push -u origin owner/fllwup-35-fold-probe`; `gh pr create` against `main` with: chosen shape + why, red-at-base evidence (verbatim), gate outputs, files changed, head SHA. Report PR number, branch, head SHA; end turn. No CI polling.

## Self-Review

- **Spec coverage:** probe fails on the dropped-start case (red at base, verbatim recorded) — Task 1 Steps 1–2; PR leaves `bun test` green via minimal instrumentation — Steps 3–4; `messageFrameRoleLocal`/pairing untouched — Step 3 scope; product-only diff — files list; shape choice + evidence in plan/PR — Steps 5–6. ✔
- **Placeholder scan:** every step carries exact code/commands; none. ✔
- **Type consistency:** only pre-existing exported names plus the one new `OpenMessageState.midJoin: boolean`. ✔
- **Review Focus:** each line maps to a probe test in Step 1. ✔
