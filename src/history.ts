/**
 * EV-5 — JSONL history replay / resync builder.
 *
 * Replays the active JSONL branch through the pure `translate.ts` mapper: emits
 * exactly one init `MESSAGES_SNAPSHOT` carrying the active-branch message list,
 * walks the entries synthesizing one RUN_STARTED/RUN_FINISHED pair per past run
 * (deterministic runId), omits STEP frames entirely, frames every emitted frame
 * with `replay: true` + a deterministic FNV-1a id, and reports
 * `{ frames, resyncDone: { uptoSeq } }` for the `pi.resync.done` terminator.
 *
 * No I/O, no clock, no entropy. The active-branch entries are supplied by the
 * caller (EV-8 reads them via `ctx.sessionManager` / direct JSONL; both
 * normalize to translate.ts's `JsonlEntry` surface). Here it is a pure fold.
 * See docs/PI-SPEC.md §5 and the EV-5 design spec §1–§2.
 */
import type { AgUiFrame, JsonlEntry } from "./translate";
import { translate, createState } from "./translate";

// ---------------------------------------------------------------------------
// Frame types.
// ---------------------------------------------------------------------------

export interface MessagesSnapshotFrame {
  type: "MESSAGES_SNAPSHOT";
  messages: { role: "assistant" | "user"; content: string }[];
}

export interface ResyncDoneFrame {
  type: "CUSTOM";
  name: "pi.resync.done";
  value: { uptoSeq: number };
}

export type ReplayFrame = (AgUiFrame | MessagesSnapshotFrame | ResyncDoneFrame) & {
  id: string;
  replay: true;
};

export interface ReplayResult {
  frames: ReplayFrame[];
  resyncDone: { uptoSeq: number };
}

// ---------------------------------------------------------------------------
// Deterministic (pure) helpers.
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hex hash — deterministic, pure, no entropy source. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Frame the given frame with `replay: true` + a deterministic id (never overwritten by the live UUID stamper). */
function frameWithId(f: AgUiFrame | MessagesSnapshotFrame | ResyncDoneFrame, id: string): ReplayFrame {
  return { ...f, id, replay: true };
}

/** Stable hash of an entry's payload (excludes entryId, which is already in the id mix). */
function entryContentHash(entry: JsonlEntry): string {
  const copy: Record<string, unknown> = { ...entry };
  delete copy.entryId;
  return fnv1a(JSON.stringify(copy));
}

// ---------------------------------------------------------------------------
// Snapshot (init only).
// ---------------------------------------------------------------------------

function snapshotFrames(sessionId: string, entries: JsonlEntry[]): ReplayFrame {
  const messages: { role: "assistant" | "user"; content: string }[] = [];
  for (const e of entries) {
    if (e.kind === "message" && (e.role === "user" || e.role === "assistant")) {
      let content = "";
      for (const b of e.content) if (b.type === "text") content += b.text;
      messages.push({ role: e.role, content });
    }
  }
  return frameWithId(
    { type: "MESSAGES_SNAPSHOT", messages },
    fnv1a(`snapshot\u0000${sessionId}\u0000${JSON.stringify(messages)}`)
  );
}

// ---------------------------------------------------------------------------
// Past-run walk.
// ---------------------------------------------------------------------------

/**
 * Partition the active-branch entries into past runs. A run begins at each
 * `user` message entry and extends through the entries before the next `user`
 * entry. Entries before the first `user` entry (e.g. a compaction marker or an
 * assistant message opening a compaction-cut tail) form a leading run.
 */
function partitionRuns(entries: JsonlEntry[]): JsonlEntry[][] {
  const runs: JsonlEntry[][] = [];
  let current: JsonlEntry[] = [];
  for (const e of entries) {
    if (e.kind === "message" && e.role === "user" && current.length > 0) {
      runs.push(current);
      current = [];
    }
    current.push(e);
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

/**
 * Deterministic per-run id: `run-<fnv1a(sessionId \0 firstUserEntryId)>`.
 * When a past run's first *kept* entry is not a `user` message (compaction cut
 * the user turn), fall back to the first kept entry's id — never crash, and the
 * same session replays to the same runId every time (U4).
 */
function runIdFor(sessionId: string, run: JsonlEntry[]): string {
  const firstUser = run.find((e) => e.kind === "message" && e.role === "user");
  const firstEntryId = firstUser?.entryId ?? run[0]?.entryId ?? "";
  return `run-${fnv1a(`${sessionId}\u0000${firstEntryId}`)}`;
}

/** Synthesisze one RUN_STARTED/RUN_FINISHED pair (via the live agent_start/agent_settled mapping) around the run's entries. */
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
    r.frames.forEach((f, idx) => {
      out.push(frameWithId(f, fnv1a(`${entry.entryId}\u0000${ch}\u0000${idx}`)));
    });
    state = r.state;
  }

  const end = translate({ event: "agent_settled" }, state);
  out.push(frameWithId(end.frames[0]!, fnv1a(`run\u0000${runId}\u0000finish`)));
  return out;
}

// ---------------------------------------------------------------------------
// Public surface.
// ---------------------------------------------------------------------------

export function replayActiveBranch(opts: { sessionId: string; entries: JsonlEntry[] }): ReplayResult {
  const { sessionId, entries } = opts;
  const frames: ReplayFrame[] = [snapshotFrames(sessionId, entries)];
  for (const run of partitionRuns(entries)) {
    frames.push(...runFrames(sessionId, run));
  }
  return { frames, resyncDone: { uptoSeq: frames.length } };
}

/** The `pi.resync.done` terminator frame (deterministic id; `value.uptoSeq` = max replayed seq). */
export function resyncDoneFrame(deps: { sessionId: string; uptoSeq: number }): ReplayFrame {
  return frameWithId(
    { type: "CUSTOM", name: "pi.resync.done", value: { uptoSeq: deps.uptoSeq } },
    fnv1a(`resync.done\u0000${deps.sessionId}\u0000${deps.uptoSeq}`)
  );
}
