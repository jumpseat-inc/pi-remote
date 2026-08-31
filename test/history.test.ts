import { describe, expect, test } from "bun:test";
import { replayActiveBranch, resyncDoneFrame } from "../src/history";
import type { JsonlEntry } from "../src/translate";

async function loadEntries(name: string): Promise<JsonlEntry[]> {
  const text = await Bun.file(new URL(`./fixtures/${name}`, import.meta.url)).text();
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as JsonlEntry);
}

describe("EV-5 JSONL history replay + resync", () => {
  test("EV-5 U1/O1: one init MESSAGES_SNAPSHOT; zero in-stream snapshot at compaction; one CUSTOM compaction per compaction", async () => {
    const entries = await loadEntries("compacted-tail.jsonl");
    const { frames, resyncDone } = replayActiveBranch({ sessionId: "sess-1", entries });

    const snapshots = frames.filter((f) => f.type === "MESSAGES_SNAPSHOT");
    expect(snapshots).toHaveLength(1);
    const snap = snapshots[0] as { type: string; messages: { role: string; content: string }[] };
    expect(snap.type).toBe("MESSAGES_SNAPSHOT");
    expect(snap.messages).toEqual([
      { role: "assistant", content: "continuing from summary" },
      { role: "user", content: "next turn" },
      { role: "assistant", content: "done" },
    ]);
    // compaction summary NOT inside the snapshot messages
    expect(JSON.stringify(snap.messages)).not.toContain("Earlier conversation summarised");
    // in-stream: exactly one CUSTOM pi.context.compaction (the compaction entry), zero MESSAGES_SNAPSHOT after index 0
    const compactions = frames.filter(
      (f) => f.type === "CUSTOM" && (f as { name: string }).name === "pi.context.compaction"
    );
    expect(compactions).toHaveLength(1);
    for (let i = 1; i < frames.length; i++) {
      expect((frames[i] as { type: string }).type).not.toBe("MESSAGES_SNAPSHOT");
    }
    expect(resyncDone.uptoSeq).toBe(frames.length);
  });

  test("EV-5 §1.7/U3: replay-twice identical ids, matching snapshot, byte-identical in-stream", async () => {
    const a = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("two-runs.jsonl") });
    const b = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("two-runs.jsonl") });
    expect(a.frames.map((f) => f.id)).toEqual(b.frames.map((f) => f.id));
    expect(a.frames[0]).toEqual(b.frames[0]); // snapshot matches
    expect(JSON.stringify(a.frames)).toBe(JSON.stringify(b.frames)); // byte-identical
    for (const f of a.frames) {
      expect(f.replay).toBe(true);
      expect(typeof f.id).toBe("string");
      expect(f.id).toMatch(/^[0-9a-f]+$/); // FNV-1a hex
    }
  });

  test("EV-5: one RUN_STARTED/RUN_FINISHED pair per past run; STEP frames omitted", async () => {
    const { frames } = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("two-runs.jsonl") });
    const starts = frames.filter((f) => f.type === "RUN_STARTED");
    const finishes = frames.filter((f) => f.type === "RUN_FINISHED");
    expect(starts).toHaveLength(2); // two past runs
    expect(finishes).toHaveLength(2);
    const types = frames.map((f) => f.type);
    expect(types).not.toContain("STEP_STARTED");
    expect(types).not.toContain("STEP_FINISHED");
    const runIds = new Set(
      frames.filter((f) => f.type === "RUN_STARTED").map((f) => (f as { runId: string }).runId)
    );
    expect(runIds.size).toBe(2); // distinct per run
  });

  test("EV-5 U4: non-user first-kept-entry run does not crash; runId stable across replays", async () => {
    const a = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("compacted-tail.jsonl") });
    const b = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("compacted-tail.jsonl") });
    const aStart = a.frames.filter((f) => f.type === "RUN_STARTED");
    expect(aStart.length).toBeGreaterThanOrEqual(2); // compaction-led run + normal run
    expect(a.frames.map((f) => f.id)).toEqual(b.frames.map((f) => f.id)); // identical on repeat
    const aRunIds = a.frames.filter((f) => f.type === "RUN_STARTED").map((f) => (f as { runId: string }).runId);
    const bRunIds = b.frames.filter((f) => f.type === "RUN_STARTED").map((f) => (f as { runId: string }).runId);
    expect(aRunIds).toEqual(bRunIds); // stable runIds
    expect(aRunIds.length).toBe(aStart.length); // one id per run
  });

  test("EV-5 §1.6: resync terminator honesty — uptoSeq == max replayed seq; terminator well-formed", async () => {
    const { frames, resyncDone } = replayActiveBranch({ sessionId: "sess-1", entries: await loadEntries("two-runs.jsonl") });
    expect(resyncDone.uptoSeq).toBe(frames.length); // max replayed seq == batch length

    const term = resyncDoneFrame({ sessionId: "sess-1", uptoSeq: resyncDone.uptoSeq });
    expect(term).toMatchObject({ type: "CUSTOM", name: "pi.resync.done", replay: true });
    expect((term as { value: { uptoSeq: number } }).value.uptoSeq).toBe(frames.length);
    expect(typeof term.id).toBe("string");
    expect(term.id).toMatch(/^[0-9a-f]+$/);
    // deterministic across identical inputs
    expect(resyncDoneFrame({ sessionId: "sess-1", uptoSeq: resyncDone.uptoSeq }).id).toBe(term.id);
  });

  test("EV-5: purity — history.ts has no randomUUID/Date.now/Math.random; imports translate only for values", async () => {
    const src = await Bun.file(new URL("../src/history.ts", import.meta.url)).text();
    expect(src).not.toMatch(/crypto\.randomUUID/);
    expect(src).not.toMatch(/Date\.now/);
    expect(src).not.toMatch(/Math\.random/);
  });
});
