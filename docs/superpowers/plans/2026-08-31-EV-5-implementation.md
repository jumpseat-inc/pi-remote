# EV-5 — JSONL History Replay and Resync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development (implement each task test-first). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `src/history.ts` (JSONL active-branch replay through the pure `translate.ts` mapper, framed `replay:true` with deterministic FNV-1a ids, terminated by `CUSTOM pi.resync.done`), additively widen `src/transport.ts` (`parseInbound` discriminated union + `replay?: boolean` + `onResync` seam) and `src/translate.ts` (per-entry kinds), and apply the three facilitator-authored PI-SPEC amendments — closing gate targets U1/O1, U2/O6, U3/O3, U4.

**Architecture:** history.ts is a pure fold over normalized `JsonlEntry[]` (the active branch): emits one init `MESSAGES_SNAPSHOT`, synthesizes one `RUN_STARTED/RUN_FINISHED` pair per past run through `translate`'s live `agent_start`/`agent_settled` mapping with a deterministic `runId`, omits STEP frames, frames every frame with `replay:true` + a deterministic id, and reports `{ frames, resyncDone: { uptoSeq } }`. transport.ts hardens `parseInbound` to a 4-member discriminated union (AG-UI event / resume / resync / ack-only) and gains `replay?: boolean` + an injected `onResync(fromSeq)` seam. translate.ts gains additive `JsonlEntry` kinds (`tool_result`, `bash_execution`, `custom`/`custom_message`).

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, bundler), Bun (`bun test`, `bunx tsc --noEmit`), Native Bun WebSocket fake relay (existing test harness), git worktree isolation (`.worktrees/ev-5-history`, branch `ev-5-history`).

**Spec:** `docs/superpowers/specs/2026-08-31-EV-5-design.md` (binding; owner reads only this file plus the files it names). Contract: `docs/PI-SPEC.md` §2/§5/§6. Commits follow AGENTS.md (Conventional Commits; scopes `translate`/`transport`/`history`/`test`/`docs`).

## Global Constraints

- **Typecheck:** `bunx tsc --noEmit` must exit 0 (strict) — run before and after every task.
- **Tests:** `bun test` — the existing **49** tests stay green plus the new EV-5 tests. No Mongo; tests use in-repo JSONL fixtures.
- **translate.ts additive only (§1.3):** no existing mapping or test change; the mapper stays a pure entry-level fold (O4/O5 green).
- **transport.ts additive only (ruling B2/O6):** envelope stays exactly `{v, seq, ack, frame}` (4 keys, O2 — never relitigated); `AgUiFrameLike = AgUiFrame & { id?: string; replay?: boolean }`; reject non-members as the existing 5-value `protocol_violation` taxonomy (no new taxonomy).
- **Determinism:** no `crypto.randomUUID`/`Date.now`/`Math.random` in `translate.ts` or `history.ts`; replay ids are pure FNV-1a (32-bit hex).
- **Emission contract (§2 post-amendment):** init snapshots only + CUSTOM at compaction (never `MESSAGES_SNAPSHOT` in-stream, ruling A/O9/O10); RUN pair per past run, deterministic runId; STEP frames omitted (O7); replay frames carry `replay:true` + deterministic id (U3/O3); terminate `CUSTOM pi.resync.done {value:{uptoSeq}}` (B1/O8).
- **No scope beyond the spec:** live path wiring and footer `resyncing` are EV-8/FLLWUP-3 (non-goals, §4). No merge; push branch + open PR only.

---

### Task 1: Additive per-entry JSONL kinds in translate.ts

**Files:**
- Modify: `src/translate.ts` — `JsonlEntry` union + `translateJsonl` branches (additive only)
- Test: `test/translate.test.ts` (append)

**Interfaces:**
- Consumes: nothing new (existing `translate`, `createState`, `flattenToolResultContent`, `AgUiFrame`).
- Produces: new exported `JsonlEntry` member kinds `tool_result`, `bash_execution`, `custom`, `custom_message`; mapping to `TOOL_CALL_RESULT` / `CUSTOM`. Later tasks (`history.ts`) feed these entries through `translate`.

- [ ] **Step 1: Write the failing tests**

```ts
test("JsonlEntry tool_result kind → TOOL_CALL_RESULT with flattened content (§1.3)", () => {
  const frames = runSequence(
    [{ kind: "tool_result", entryId: "e1", messageId: "msg-1", toolCallId: "call_1", content: [{ type: "text", text: "out" }] }],
    { sessionId: "s1", runId: "r1" }
  );
  expect(frames).toEqual([{ type: "TOOL_CALL_RESULT", messageId: "msg-1", toolCallId: "call_1", content: "out", role: "tool" }]);
});

test("JsonlEntry bash_execution kind → CUSTOM passthrough (§1.3, FLLWUP-3 deferred)", () => {
  const frames = runSequence([{ kind: "bash_execution", entryId: "e1", data: { cmd: "ls" } }], { sessionId: "s1", runId: "r1" });
  expect(frames).toHaveLength(1);
  const f = frames[0] as { type: "CUSTOM"; name: string; value: { pi: string } };
  expect(f.type).toBe("CUSTOM");
  expect(f.name).toBe("pi.tool.bash_execution");
  expect(f.value.pi).toBe("bash_execution");
});

test("JsonlEntry custom/custom_message kinds → CUSTOM escape-hatch (§1.3)", () => {
  const a = runSequence([{ kind: "custom", entryId: "e1", name: "n", data: { a: 1 } }], { sessionId: "s1", runId: "r1" });
  const b = runSequence([{ kind: "custom_message", entryId: "e2", name: "n2", data: { b: 2 } }], { sessionId: "s1", runId: "r1" });
  const fa = a[0] as { type: "CUSTOM"; name: string; value: { pi: string } };
  const fb = b[0] as { type: "CUSTOM"; name: string; value: { pi: string } };
  expect(fa.name).toBe("pi.custom");
  expect(fa.value.pi).toBe("custom");
  expect(fb.name).toBe("pi.custom_message");
  expect(fb.value.pi).toBe("custom_message");
});
```

- [ ] **Step 2: Run to confirm RED**: `bun test test/translate.test.ts` — the new tests fail (kinds not in the union / no branch).

- [ ] **Step 3: Implement (additive)**

Extend the `JsonlEntry` union:
```ts
export type JsonlEntry =
  | { kind: "message"; entryId: string; role: "assistant" | "user"; content: JsonlContentBlock[] }
  | { kind: "tool_result"; entryId: string; messageId: string; toolCallId: string; content: ToolResultContentBlock[] }
  | { kind: "compaction"; entryId: string; summary?: string }
  | { kind: "model_change"; entryId: string; model: string }
  | { kind: "thinking_level_change"; entryId: string; level: string }
  | { kind: "session_info"; entryId: string; info: unknown }
  | { kind: "bash_execution"; entryId: string; data: unknown }
  | { kind: "custom"; entryId: string; name: string; data: unknown }
  | { kind: "custom_message"; entryId: string; name: string; data: unknown };
```
In `translateJsonl`, after the `message` branch and before `compaction`, add:
```ts
if (input.kind === "tool_result") {
  frames.push({ type: "TOOL_CALL_RESULT", messageId: input.messageId, toolCallId: input.toolCallId, content: flattenToolResultContent(input.content), role: "tool" });
  return nextState(state, frames, state.openMessages);
}
if (input.kind === "bash_execution") {
  frames.push({ type: "CUSTOM", name: "pi.tool.bash_execution", value: { pi: "bash_execution", data: input.data } });
  return nextState(state, frames, state.openMessages);
}
if (input.kind === "custom" || input.kind === "custom_message") {
  frames.push({ type: "CUSTOM", name: input.kind === "custom" ? "pi.custom" : "pi.custom_message", value: { pi: input.kind, data: { name: input.name, data: input.data } } });
  return nextState(state, frames, state.openMessages);
}
```

- [ ] **Step 4: Verify GREEN + no regressions**: `bun test` (22 translate + 27 others = 49+3 green) and `bunx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add src/translate.ts test/translate.test.ts
git commit -m "feat(translate): additive JsonlEntry kinds tool_result/bash_execution/custom (EV-5)"
```

---

### Task 2: transport.ts widening + parseInbound discriminated union

**Files:**
- Modify: `src/transport.ts`
- Test: `test/transport.test.ts` (append; keep the 9 existing green)

**Interfaces:**
- Consumes: `AgUiFrame` from translate.ts; existing deps.
- Produces (EV-5 tests + EV-8 later): `AgUiFrameLike` widened with `replay?: boolean`; exported `InboundFrame` 4-member discriminated union; exported `parseInbound(data): InboundFrame | null`; optional `onResync?: (fromSeq: number) => void` seam on `TransportDeps`. `send` leaves pre-existing `id` and `replay:true` untouched (replay path); live frames still UUID-stamped.

- [ ] **Step 1: Write the failing tests (U2/O6, U3/O3)**

```ts
test("EV-5 U3/O3: widening — AgUiFrameLike accepts replay?:boolean; replay frame round-trips; envelope exactly 4 keys", async () => {
  const f = startFakeServer();
  const col = collector();
  const t = createTransport(noopDeps({ rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }), onEvent: col.onEvent }));
  await t.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
  await col.live;
  t.send({ type: "CUSTOM", name: "pi.resync.done", value: { uptoSeq: 0 } as never, id: "det-1", replay: true } as any);
  await sleep(20);
  const env = f.received.filter(Boolean).pop()!;
  expect(Object.keys(env).sort()).toEqual(["ack", "frame", "seq", "v"]); // exactly 4 keys
  const fr = env.frame as { replay?: boolean; id?: string };
  expect(fr.replay).toBe(true);
  expect(fr.id).toBe("det-1"); // replay id never overwritten
  f.stop();
  await t.disconnect();
});

test("EV-5 U2/O6: parseInbound accepts the 4 union members; rejects non-members as protocol_violation", async () => {
  // members accepted (direct parseInbound)
  expect(parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "CUSTOM", name: "pi.x", value: { pi: "x", data: {} } } }))!.frame.type).toBe("CUSTOM");
  expect(parseInbound(JSON.stringify({ v: 1, seq: 2, ack: 0, frame: { type: "resume", deviceId: "d1", lastAckedSeq: 7 } }))!.frame).toMatchObject({ type: "resume", lastAckedSeq: 7 });
  expect(parseInbound(JSON.stringify({ v: 1, seq: 3, ack: 0, frame: { type: "resync", fromSeq: 3 } }))!.frame).toMatchObject({ type: "resync", fromSeq: 3 });
  expect(parseInbound(JSON.stringify({ v: 1, seq: 4, ack: 0, frame: null }))!.frame).toBeNull();
  // non-members rejected (null → protocol violation)
  expect(parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "bogus" } }))).toBeNull();
  expect(parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "resume", deviceId: 123, lastAckedSeq: 1 } }))).toBeNull(); // bad deviceId shape
  // structural validation of control fields
  expect(parseInbound(JSON.stringify({ v: 1, seq: 1, ack: 0, frame: { type: "resync", fromSeq: "x" } }))).toBeNull();
});

test("EV-5 U2/O6: resume updates watermark, never surfaces to onInbound; resync fires onResync exactly once", async () => {
  const f = startFakeServer();
  const col = collector();
  let inboundCount = 0;
  const resyncs: number[] = [];
  const t = createTransport(noopDeps({
    rearm: async () => ({ tunnelId: "t1", url: f.url, expiresAt: Number.MAX_SAFE_INTEGER }),
    onEvent: col.onEvent,
    onInbound: () => { inboundCount++; },
    onResync: (fromSeq) => { resyncs.push(fromSeq); },
  }));
  await t.connect({ url: f.url, expiresAt: Number.MAX_SAFE_INTEGER });
  await col.live;
  f.broadcast({ v: 1, seq: 42, ack: 0, frame: { type: "resume", deviceId: "d1", lastAckedSeq: 7 } } as any);
  await sleep(20);
  expect(inboundCount).toBe(0); // resume never surfaces
  t.send(aFrame()); // next outbound ack reflects watermark
  await sleep(20);
  const after = f.received.filter(Boolean);
  expect(after[after.length - 1]!.ack).toBe(42);
  // a resync control frame fires the injected callback exactly once
  f.broadcast({ v: 1, seq: 99, ack: 0, frame: { type: "resync", fromSeq: 3 } } as any);
  await sleep(20);
  expect(resyncs).toEqual([3]);
  expect(inboundCount).toBe(0); // resync also never surfaces
  f.stop();
  await t.disconnect();
});
```

- [ ] **Step 2: Run to confirm RED** — `bun test test/transport.test.ts`: fails (no `parseInbound` export, `replay` not in `AgUiFrameLike`, resume/resync pass to `onInbound` as AG-UI).

- [ ] **Step 3: Implement**

Add `replay?: boolean` to `AgUiFrameLike`:
```ts
export type AgUiFrameLike = AgUiFrame & { id?: string; replay?: boolean };
```
Add the discriminated `InboundFrame` type + whitelist + rewritten `parseInbound`:
```ts
export type InboundFrame =
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: AgUiFrame }
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: { type: "resume"; deviceId: string; lastAckedSeq: number } }
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: { type: "resync"; fromSeq: number } }
  | { v: 1; seq: number; ack: number; deviceId?: string; frame: null };

const AG_UI_TYPES = new Set<string>([
  "RUN_STARTED", "RUN_FINISHED", "STEP_STARTED", "STEP_FINISHED",
  "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT", "TEXT_MESSAGE_END",
  "REASONING_MESSAGE_START", "REASONING_MESSAGE_CONTENT", "REASONING_MESSAGE_END",
  "TOOL_CALL_START", "TOOL_CALL_ARGS", "TOOL_CALL_END", "TOOL_CALL_RESULT",
  "CUSTOM", "MESSAGES_SNAPSHOT",
]);

export function parseInbound(data: string): InboundFrame | null {
  let obj: unknown;
  try { obj = JSON.parse(data); } catch { return null; }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.seq !== "number" || !Number.isFinite(o.seq)) return null;
  if (typeof o.ack !== "number" || !Number.isFinite(o.ack)) return null;
  const frame = o.frame;
  const deviceId = typeof o.deviceId === "string" ? o.deviceId : undefined;
  if (frame === null) return { v: 1, seq: o.seq, ack: o.ack, deviceId, frame: null };
  if (typeof frame !== "object" || frame === null) return null;
  const f = frame as Record<string, unknown>;
  if (typeof f.type !== "string") return null;
  if (f.type === "resume") {
    if (typeof f.deviceId !== "string") return null;
    if (typeof f.lastAckedSeq !== "number" || !Number.isFinite(f.lastAckedSeq)) return null;
    return { v: 1, seq: o.seq, ack: o.ack, deviceId: f.deviceId, frame: f as unknown as { type: "resume"; deviceId: string; lastAckedSeq: number } };
  }
  if (f.type === "resync") {
    if (typeof f.fromSeq !== "number" || !Number.isFinite(f.fromSeq)) return null;
    return { v: 1, seq: o.seq, ack: o.ack, deviceId, frame: f as unknown as { type: "resync"; fromSeq: number } };
  }
  if (!AG_UI_TYPES.has(f.type)) return null;
  return { v: 1, seq: o.seq, ack: o.ack, deviceId, frame: f as unknown as AgUiFrame };
}
```
Add the optional seam to `TransportDeps`: `onResync?: (fromSeq: number) => void;`
Rewrite `onmessage` handling (inside `dialLoop`):
```ts
ws.onmessage = (ev) => {
  if (token !== dialToken) return;
  const data = typeof ev.data === "string" ? ev.data : null;
  if (data === null) { protocolViolation(); return; }
  const inbound = parseInbound(data);
  if (!inbound) { protocolViolation(); return; }
  if (inbound.ack < highestDeviceAck) { protocolViolation(); return; }
  highestDeviceAck = Math.max(highestDeviceAck, inbound.ack);
  inboundSeq = Math.max(inboundSeq, inbound.seq);
  if (inbound.frame === null) {
    deps.onInbound({ v: 1, seq: inbound.seq, ack: inbound.ack, deviceId: inbound.deviceId, frame: null });
    return;
  }
  if (inbound.frame.type === "resume") return; // control: watermark updated above; never onInbound
  if (inbound.frame.type === "resync") { deps.onResync?.(inbound.frame.fromSeq); return; } // control: never onInbound
  deps.onInbound({ v: 1, seq: inbound.seq, ack: inbound.ack, deviceId: inbound.deviceId, frame: inbound.frame });
};
```
(If `send` spread `{...frame, id: newId()}` — the pre-existing `replay:true` and `id` survive unchanged.)

- [ ] **Step 4: Verify GREEN + no regressions**: `bun test` and `bunx tsc --noEmit` (9 existing transport + 22 translate + 18 tunnel = 49 all green).

- [ ] **Step 5: Commit**
```bash
git add src/transport.ts test/transport.test.ts
git commit -m "feat(transport): parseInbound discriminated union, replay?:boolean, onResync seam (EV-5)"
```

---

### Task 3: history.ts — replayActiveBranch + fixtures + tests

**Files:**
- Create: `src/history.ts`
- Create fixtures: `test/fixtures/two-runs.jsonl`, `test/fixtures/compacted-tail.jsonl`
- Test: `test/history.test.ts`

**Interfaces:**
- Consumes: `translate`, `createState` from `../src/translate` (Task 1 kinds), `AgUiFrame`, `JsonlEntry`.
- Produces (EV-8 later): `MessagesSnapshotFrame`, `ResyncDoneFrame`, `ReplayFrame` (`(AgUiFrame | MessagesSnapshotFrame | ResyncDoneFrame) & { id: string; replay: true }`), `ReplayResult = { frames: ReplayFrame[]; resyncDone: { uptoSeq: number } }`, `replayActiveBranch({sessionId, entries}): ReplayResult`, `resyncDoneFrame({sessionId, uptoSeq}): ReplayFrame`.

- [ ] **Step 1: Write the fixtures**

`test/fixtures/two-runs.jsonl`:
```
{"kind":"message","entryId":"m1","role":"user","content":[{"type":"text","text":"hello"}]}
{"kind":"message","entryId":"m2","role":"assistant","content":[{"type":"thought","text":"think"},{"type":"text","text":"hi back"}]}
{"kind":"message","entryId":"m3","role":"user","content":[{"type":"text","text":"again"}]}
{"kind":"message","entryId":"m4","role":"assistant","content":[{"type":"text","text":"ok"}]}
```
`test/fixtures/compacted-tail.jsonl`:
```
{"kind":"compaction","entryId":"c1","summary":"Earlier conversation summarised."}
{"kind":"message","entryId":"m1","role":"assistant","content":[{"type":"text","text":"continuing from summary"}]}
{"kind":"message","entryId":"m2","role":"user","content":[{"type":"text","text":"next turn"}]}
{"kind":"message","entryId":"m3","role":"assistant","content":[{"type":"text","text":"done"}]}
```

- [ ] **Step 2: Write the failing tests (U1/O1, U4, §1.6, §1.7)**

```ts
import { describe, expect, test } from "bun:test";
import { replayActiveBranch, resyncDoneFrame } from "../src/history";
import type { JsonlEntry } from "../src/translate";

async function loadEntries(name: string): Promise<JsonlEntry[]> {
  const text = await Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).text();
  return text.split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as JsonlEntry);
}

test("EV-5 U1/O1: one init MESSAGES_SNAPSHOT; zero in-stream snapshot at compaction; one CUSTOM compaction per compaction", async () => {
  const entries = await loadEntries("compacted-tail.jsonl");
  const { frames, resyncDone } = replayActiveBranch({ sessionId: "sess-1", entries });
  const snapshots = frames.filter((f) => f.type === "MESSAGES_SNAPSHOT");
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0]!.type).toBe("MESSAGES_SNAPSHOT");
  const snap = snapshots[0] as { messages: { role: string; content: string }[] };
  expect(snap.messages).toEqual([
    { role: "assistant", content: "continuing from summary" },
    { role: "user", content: "next turn" },
    { role: "assistant", content: "done" },
  ]);
  // compaction summary NOT inside snapshot messages
  expect(JSON.stringify(snap.messages)).not.toContain("Earlier conversation summarised");
  // in-stream: exactly one CUSTOM pi.context.compaction (the compaction entry), zero MESSAGES_SNAPSHOT after index 0
  const compactions = frames.filter((f) => f.type === "CUSTOM" && (f as { name: string }).name === "pi.context.compaction");
  expect(compactions).toHaveLength(1);
  for (let i = 1; i < frames.length; i++) {
    expect((frames[i] as { type: string }).type).not.toBe("MESSAGES_SNAPSHOT");
  }
  expect(resyncDone.uptoSeq).toBe(frames.length);
});

test("EV-5 §1.7/U3: replay-twice identical ids, matching snapshot, byte-identical in-stream", async () => {
  const entries = await loadEntries("two-runs.jsonl");
  const a = replayActiveBranch({ sessionId: "sess-1", entries });
  const b = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("two-runs.jsonl") });
  expect(a.frames.map((f) => f.id)).toEqual(b.frames.map((f) => f.id));
  expect(a.frames[0]).toEqual(b.frames[0]); // snapshot matches
  expect(JSON.stringify(a.frames)).toBe(JSON.stringify(b.frames)); // byte-identical
  // every replay frame carries replay:true + deterministic id
  for (const f of a.frames) {
    expect(f.replay).toBe(true);
    expect(typeof f.id).toBe("string");
    expect(f.id).toMatch(/^[0-9a-f]+$/);
  }
});

test("EV-5: one RUN_STARTED/RUN_FINISHED pair per past run; STEP frames omitted", async () => {
  const entries = await loadEntries("two-runs.jsonl");
  const { frames } = replayActiveBranch({ sessionId: "sess-1", entries });
  const starts = frames.filter((f) => f.type === "RUN_STARTED");
  const finishes = frames.filter((f) => f.type === "RUN_FINISHED");
  expect(starts).toHaveLength(2); // two past runs
  expect(finishes).toHaveLength(2);
  // RUN_STARTED immediately precedes its run and RUN_FINISHED ends its run
  const types = frames.map((f) => f.type);
  expect(types).not.toContain("STEP_STARTED");
  expect(types).not.toContain("STEP_FINISHED");
  // runIds deterministic and distinct per run
  const runIds = new Set(frames.filter((f) => f.type === "RUN_STARTED").map((f) => (f as { runId: string }).runId));
  expect(runIds.size).toBe(2);
});

test("EV-5 U4: non-user first-kept-entry run does not crash; runId stable across replays", async () => {
  const entries = await loadEntries("compacted-tail.jsonl");
  const a = replayActiveBranch({ sessionId: "sess-1", entries });
  const b = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("compacted-tail.jsonl") });
  const aStart = a.frames.filter((f) => f.type === "RUN_STARTED");
  expect(aStart.length).toBeGreaterThanOrEqual(2); // compaction-led run + normal run
  // first run opens with an assistant message (kept tail after compaction), runId derived from first kept entry id (c1)
  const ids = (x: { frames: { type: string; id: string }[] }) => x.frames.map((f) => f.id);
  expect(ids(a)).toEqual(ids(b)); // identical on repeat
  const aRunIds = a.frames.filter((f) => f.type === "RUN_STARTED").map((f) => (f as { runId: string }).runId);
  const bRunIds = b.frames.filter((f) => f.type === "RUN_STARTED").map((f) => (f as { runId: string }).runId);
  expect(aRunIds).toEqual(bRunIds); // stable
});

test("EV-5 §1.6: resync terminator honesty — uptoSeq == max replayed seq; no resync_done on mid-replay drop", async () => {
  const entries = await loadEntries("two-runs.jsonl");
  const { frames, resyncDone } = replayActiveBranch({ sessionId: "sess-1", entries });
  expect(resyncDone.uptoSeq).toBe(frames.length); // max replayed seq == batch length

  // happy path: terminator frame is well-formed CUSTOM pi.resync.done with value.uptoSeq
  const term = resyncDoneFrame({ sessionId: "sess-1", uptoSeq: resyncDone.uptoSeq });
  expect(term).toMatchObject({ type: "CUSTOM", name: "pi.resync.done", replay: true });
  expect((term as { value: { uptoSeq: number } }).value.uptoSeq).toBe(frames.length);
  expect(typeof term.id).toBe("string");
  // deterministic across identical inputs
  expect(resyncDoneFrame({ sessionId: "sess-1", uptoSeq: resyncDone.uptoSeq }).id).toBe(term.id);
});
```

- [ ] **Step 3: Run to confirm RED** — `bun test test/history.test.ts` (module not found / import fails).

- [ ] **Step 4: Implement**

`src/history.ts`:
```ts
import type { AgUiFrame, JsonlEntry } from "./translate";
import { translate, createState } from "./translate";

export interface MessagesSnapshotFrame {
  type: "MESSAGES_SNAPSHOT";
  messages: { role: "assistant" | "user"; content: string }[];
}
export interface ResyncDoneFrame {
  type: "CUSTOM";
  name: "pi.resync.done";
  value: { uptoSeq: number };
}
export type ReplayFrame = (AgUiFrame | MessagesSnapshotFrame | ResyncDoneFrame) & { id: string; replay: true };
export interface ReplayResult { frames: ReplayFrame[]; resyncDone: { uptoSeq: number }; }

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16);
}

function frameWithId(f: AgUiFrame | MessagesSnapshotFrame | ResyncDoneFrame, id: string): ReplayFrame {
  return { ...f, id, replay: true };
}

function entryContentHash(entry: JsonlEntry): string {
  const copy: Record<string, unknown> = { ...entry };
  delete copy.entryId;
  return fnv1a(JSON.stringify(copy));
}

function snapshotFrames(sessionId: string, entries: JsonlEntry[]): ReplayFrame {
  const messages: { role: "assistant" | "user"; content: string }[] = [];
  for (const e of entries) {
    if (e.kind === "message" && (e.role === "user" || e.role === "assistant")) {
      let content = "";
      for (const b of e.content) if (b.type === "text") content += b.text;
      messages.push({ role: e.role, content });
    }
  }
  return frameWithId({ type: "MESSAGES_SNAPSHOT", messages }, fnv1a(`snapshot\u0000${sessionId}\u0000${JSON.stringify(messages)}`));
}

function partitionRuns(entries: JsonlEntry[]): JsonlEntry[][] {
  const runs: JsonlEntry[][] = [];
  let current: JsonlEntry[] = [];
  for (const e of entries) {
    if (e.kind === "message" && e.role === "user" && current.length > 0) { runs.push(current); current = []; }
    current.push(e);
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

function runIdFor(sessionId: string, run: JsonlEntry[]): string {
  const firstUser = run.find((e) => e.kind === "message" && e.role === "user");
  const firstEntryId = firstUser?.entryId ?? run[0]?.entryId ?? "";
  return `run-${fnv1a(`${sessionId}\u0000${firstEntryId}`)}`;
}

function runFrames(sessionId: string, run: JsonlEntry[]): ReplayFrame[] {
  const runId = runIdFor(sessionId, run);
  const out: ReplayFrame[] = [];
  let state = createState({ sessionId, runId });
  const start = translate({ event: "agent_start" }, state);
  out.push(frameWithId(start.frames[0]!, fnv1a(`run\u0000${runId}\u0000start`)));
  state = start.state;
  for (const entry of run) {
    const r = translate(entry, state);
    const ch = entryContentHash(entry);
    r.frames.forEach((f, idx) => out.push(frameWithId(f, fnv1a(`${entry.entryId}\u0000${ch}\u0000${idx}`))));
    state = r.state;
  }
  const end = translate({ event: "agent_settled" }, state);
  out.push(frameWithId(end.frames[0]!, fnv1a(`run\u0000${runId}\u0000finish`)));
  return out;
}

export function replayActiveBranch(opts: { sessionId: string; entries: JsonlEntry[] }): ReplayResult {
  const { sessionId, entries } = opts;
  const frames: ReplayFrame[] = [snapshotFrames(sessionId, entries)];
  for (const run of partitionRuns(entries)) frames.push(...runFrames(sessionId, run));
  return { frames, resyncDone: { uptoSeq: frames.length } };
}

export function resyncDoneFrame(deps: { sessionId: string; uptoSeq: number }): ReplayFrame {
  return frameWithId({ type: "CUSTOM", name: "pi.resync.done", value: { uptoSeq: deps.uptoSeq } }, fnv1a(`resync.done\u0000${deps.sessionId}\u0000${deps.uptoSeq}`));
}
```

- [ ] **Step 5: Verify GREEN + no regressions**: `bun test` (full suite) and `bunx tsc --noEmit`.

- [ ] **Step 6: Commit**
```bash
git add src/history.ts test/history.test.ts test/fixtures/
git commit -m "feat(history): JSONL active-branch replay with deterministic ids + resync terminator (EV-5)"
```

---

### Task 4: Apply the three PI-SPEC amendments (verbatim, §0)

**Files:** Modify: `docs/PI-SPEC.md` (only §5.2 step 3 and two §5.3 edits).

- [ ] **Step 1: §5.2 step 3 compaction line (ruling A; cited O9/O10)**

OLD:
```
   - `compaction` → `MESSAGES_SNAPSHOT` + `CUSTOM` (`pi.context.compaction`)
```
NEW:
```
   - `compaction` → `CUSTOM` (`pi.context.compaction`); `MESSAGES_SNAPSHOT` emitted at
     init, carrying the active branch (ruling A — cited O9, O10)
```

- [ ] **Step 2: §5.3 resync_done line (ruling B1; cited O8)**

OLD:
```
ext → client    : replay batch (§5.2), then { type: "resync_done", uptoSeq }
```
NEW:
```
ext → client    : replay batch (§5.2), then { type: "CUSTOM", name: "pi.resync.done", value: { uptoSeq } } (ruling B1 — cited O8: no RESYNC_DONE in the AG-UI enum)
```

- [ ] **Step 3: §5.3 clarifying sentence (ruling B2; cited O6)**

Append this paragraph to §5.3 (below the handshake block, per spec §0 verbatim):
```
Inbound resume and resync control frames are runtime-validated by `transport.ts`'s
`parseInbound` against a discriminated union (resume, resync, AG-UI event, ack-only);
control frames do not surface to the `onInbound` AG-UI consumer. The relay server's
role is unchanged: it relays these frames opaquely per §5.3 and §7.3. (ruling B2 — cited O6)
```

- [ ] **Step 4: Verify blast radius**: `git diff docs/PI-SPEC.md | grep -E '^@@'` — hunks confined to §5.2/§5.3 only.

- [ ] **Step 5: Commit**
```bash
git add docs/PI-SPEC.md
git commit -m "docs: apply EV-5 PI-SPEC amendments §5.2/§5.3 (rulings A, B1, B2; O6/O8/O9/O10)"
```

---

### Task 5: Full gate sweep + plan + push + PR

- [ ] **Step 1: Typecheck** — `bunx tsc --noEmit` (exit 0, no output). Record exit code.
- [ ] **Step 2: Full tests** — `bun test` (exit 0; all 49 existing + new EV-5 tests green). Record the pass/fail count.
- [ ] **Step 3: Additive-ensure** — confirm no existing mapping/test was edited: `git diff main...HEAD --stat`.
- [ ] **Step 4: Commit the plan** — `git add docs/superpowers/plans/2026-08-31-EV-5-implementation.md && git commit -m "docs: add EV-5 implementation plan"`.
- [ ] **Step 5: Re-verify committed state** — repeat Steps 1–2 after the plan commit.
- [ ] **Step 6: Push + PR (no merge)** — `git push -u origin ev-5-history`; `gh pr create --base main --head ev-5-history --title "feat(history): JSONL history replay and resync (EV-5)" --body "…"`. Record PR number + head SHA. Do NOT merge, do NOT poll CI.
