/**
 * FLLWUP-36 — construction-layer grounding probe for emission-semantics claims.
 *
 * FLLWUP-12's verification grounded its emission-semantics claims by reading
 * the installed engine's event-constructing layer (agent-loop.js,
 * anthropic-messages.js, assistant-message-frame.js), not only the
 * pass-through emitter — and that grounding caught the object-identity premise
 * the pass-through view alone would have blessed (wiki:
 * Emission-Semantics Fidelity). This card makes that grounding a systematic,
 * repeatable check: a scripted probe that EXECUTES the installed construction
 * layer and asserts its emission semantics, so any future card's claim about
 * what the engine emits is verified against the layer that constructs the
 * event — not against emitter-shape reasoning.
 *
 * What runs: the probe locates the installed pi SDK on this disk (NOT a repo
 * dependency — R-TYPE-1), imports the REAL `runAgentLoop` (pi-agent-core
 * dist/agent-loop.js) and the REAL `AssistantMessageEventStream` (pi-ai
 * dist/utils/event-stream.js), and drives the construction layer with a
 * synthetic provider feed whose shape follows anthropic-messages.js's
 * emission discipline (ONE shared accumulator object created once per
 * assistant stream; every inner event carries `partial: output`; the feed
 * ends in a terminal `done` event carrying that same object). Assertions
 * land on the AgentEvents the loop emits — the layer that constructs the
 * message_* events pi-remote's live path consumes.
 *
 * What each assertion pins (per-emission, one assistant stream):
 *   A1  message_start / message_update carry FRESH spread-copies — object
 *       identity never survives an emission (agent-loop.js: `message:
 *       { ...partialMessage }` on message_start AND every message_update).
 *   A2  message_end carries the accumulated final message — the same object
 *       the stream's result() resolves to (agent-loop.js emits finalMessage
 *       on message_end without copying).
 *   A3  Payload-intrinsic keys partition emissions into logical messages:
 *       `${role}:${timestamp}` is shared by exactly the emissions of one
 *       stream and distinct across streams (role/timestamp are set once on
 *       the accumulator, anthropic-messages.js; copied verbatim by
 *       assistant-message-frame.js cloneStartMessage; preserved through the
 *       spread by construction).
 *   A4  The repo's own derivation helper holds on every real emission:
 *       agentMessageId (src/pi-sdk-events.ts) is stable across all emissions
 *       of one stream and distinct across streams.
 *   A5  Source-level binding: content anchors pin these probes to the
 *       construct-layer files themselves (content-anchored, layout-tolerant),
 *       so the documented grounding re-verifies on every run.
 *
 * Provenance (read from installed @earendil-works/pi-coding-agent 0.87.1,
 * 2026-09-24; re-verified by A5 on every run): agent-loop.js
 * streamAssistantResponse emits `message: { ...partialMessage }` on
 * message_start and every message_update and the accumulated finalMessage on
 * message_end; anthropic-messages.js stream() creates ONE accumulated
 * `output` per assistant stream (with `timestamp: Date.now()`) and every
 * inner event carries `partial: output`; assistant-message-frame.js
 * cloneStartMessage copies role/timestamp verbatim onto the start frame.
 *
 * Where the SDK is not installed (e.g. CI's ubuntu gates job), the probe
 * skips honestly with a printed reason — the semantic claims are re-provable
 * on any disk with the SDK via `bun test test/construction-grounding.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { agentMessageId } from "../src/pi-sdk-events";

/** Result of locating the installed pi SDK package root on this disk. */
interface SdkLocation {
  root: string;
  /** How the root was found — recorded for skip-notice provenance. */
  via: string;
}

/**
 * Locate the installed pi SDK package root. Three anchors, first match wins:
 *   1. explicit override (PI_CODING_AGENT_DIR holds the *config* dir, not the
 *      install root, so the probe has its own test-scoped override);
 *   2. the `pi` binary on PATH — a symlink into <pkgRoot>/dist/bundle, so
 *      resolve the realpath and walk up to the owning package.json;
 *   3. the global node_modules layout next to the bun/npm bin dir
 *      (<binRoot>/lib/node_modules/@earendil-works/pi-coding-agent).
 * Non-brittle: the probe's own anchors hardcode no version directories; the
 * layout fallback also tolerates a versioned sibling (pi-coding-agent@N).
 */
function locateSdkRoot(): SdkLocation | null {
  const override = process.env.PI_REMOTE_TEST_SDK_ROOT;
  if (override && existsSync(join(override, "package.json"))) {
    return { root: override, via: "PI_REMOTE_TEST_SDK_ROOT override" };
  }
  try {
    const piPath = execFileSync("which", ["pi"], { encoding: "utf8" }).trim();
    if (piPath) {
      // The bin entry is a symlink into <pkgRoot>/dist/bundle — resolve it
      // first, or walking up never reaches the package directory.
      let cur: string | null = dirname(realpathSync(piPath));
      for (let i = 0; cur && i < 12; i++) {
        const pkg = join(cur, "package.json");
        if (existsSync(pkg) && readFileSync(pkg, "utf8").includes('"name": "@earendil-works/pi-coding-agent"')) {
          return { root: cur, via: `pi binary at ${piPath}` };
        }
        cur = dirname(cur);
      }
    }
  } catch {
    // `which pi` unavailable — fall through to the layout anchor.
  }
  const nmRoot = join(dirname(process.execPath), "..", "lib/node_modules/@earendil-works");
  if (existsSync(nmRoot)) {
    const plain = join(nmRoot, "pi-coding-agent");
    if (existsSync(plain)) return { root: plain, via: "global node_modules layout" };
    try {
      const hit = readdirSync(nmRoot).find((name) => name.startsWith("pi-coding-agent@"));
      if (hit) return { root: join(nmRoot, hit), via: "global node_modules layout (versioned)" };
    } catch {
      // unreadable dir — fall through
    }
  }
  return null;
}

/** The construction-layer surface the probe needs (structural, not vendored). */
interface LoadedSdk {
  runAgentLoop: (...args: unknown[]) => Promise<unknown>;
  createAssistantMessageEventStream: () => unknown;
}

/** Import the construction layer by file path (the SDK is not a dependency). */
async function loadConstructionLayer(root: string): Promise<LoadedSdk | null> {
  const coreEntry = join(root, "node_modules/@earendil-works/pi-agent-core/dist/index.js");
  const aiEntry = join(root, "node_modules/@earendil-works/pi-ai/dist/index.js");
  if (!existsSync(coreEntry) || !existsSync(aiEntry)) return null;
  try {
    const core = (await import(pathToFileURL(coreEntry).href)) as Record<string, unknown>;
    const piAi = (await import(pathToFileURL(aiEntry).href)) as Record<string, unknown>;
    const runAgentLoop = core.runAgentLoop;
    const createAssistantMessageEventStream = piAi.createAssistantMessageEventStream;
    if (typeof runAgentLoop !== "function" || typeof createAssistantMessageEventStream !== "function") {
      return null;
    }
    return {
      runAgentLoop: runAgentLoop as LoadedSdk["runAgentLoop"],
      createAssistantMessageEventStream: createAssistantMessageEventStream as LoadedSdk["createAssistantMessageEventStream"],
    };
  } catch {
    return null;
  }
}

const SDK_LOAD = await (async (): Promise<{ sdk: LoadedSdk; location: SdkLocation } | null> => {
  const location = locateSdkRoot();
  if (!location) return null;
  const sdk = await loadConstructionLayer(location.root);
  if (!sdk) return null;
  return { sdk, location };
})();

if (!SDK_LOAD) {
  console.warn(
    "construction-grounding: skipped — installed pi SDK not found on this disk " +
      "(CI's ubuntu gates job has none). Run on a disk with the pi SDK installed: " +
      "bun test test/construction-grounding.test.ts"
  );
}
const skipReason = SDK_LOAD ? null : "installed pi SDK not found";

// ---------------------------------------------------------------------------
// Synthetic provider feed — follows anthropic-messages.js's emission
// discipline: one shared accumulator, every inner event carries
// `partial: output`, terminal done event carries the same object.
// ---------------------------------------------------------------------------

interface ProbeMessage {
  role: string;
  timestamp: number;
  content: Array<Record<string, unknown>>;
  stopReason: string;
  [key: string]: unknown;
}

/** Structural shape of the real AssistantMessageEventStream we drive. */
interface FeedableStream {
  push(event: unknown): void;
}

interface AgentEventLike {
  type: string;
  message?: ProbeMessage;
}

interface StreamRun {
  /** message_* events emitted for the assistant stream under test. */
  emissions: AgentEventLike[];
  /** The accumulator reference (what the stream's result() resolves to). */
  final: ProbeMessage;
}

/** One synthetic assistant stream fed through the REAL construction layer. */
async function runOneStream(sdk: LoadedSdk, timestamp: number, text: string): Promise<StreamRun> {
  const stream = sdk.createAssistantMessageEventStream() as FeedableStream;
  const output: ProbeMessage = {
    role: "assistant",
    content: [],
    api: "anthropic",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "pending",
    timestamp,
  };
  stream.push({ type: "start", partial: output });
  output.content.push({ type: "text", text: "" });
  const idx = output.content.length - 1;
  stream.push({ type: "text_start", contentIndex: idx, partial: output });
  stream.push({ type: "text_delta", contentIndex: idx, delta: text, partial: output });
  output.content[idx] = { type: "text", text };
  stream.push({ type: "text_end", contentIndex: idx, content: text, partial: output });
  stream.push({ type: "done", reason: "stop", message: output });
  // runAgentLoop's 6th param is the StreamFn — called as streamFn(model,
  // context, options) — so hand it a closure returning the already-fed
  // real stream; queued events yield in order (EventStream FifoQueue).

  const emissions: AgentEventLike[] = [];
  const emit = (event: AgentEventLike) => {
    if (event.type.startsWith("message_") && event.message?.role === "assistant") {
      emissions.push(event);
    }
  };
  const config = {
    model: { api: "anthropic", id: "test-model", provider: "test", name: "Test" },
    convertToLlm: (messages: unknown[]) => messages,
  };
  await sdk.runAgentLoop(
    [{ role: "user", content: "probe", timestamp: timestamp - 1 }],
    { messages: [] },
    config,
    emit,
    undefined,
    () => stream
  );
  return { emissions, final: output };
}

// ---------------------------------------------------------------------------
// A5's content anchors — pin the probe (and the doc claims) to the files
// that construct the events. Content-anchored, not line-anchored, so an SDK
// upgrade that shifts lines but keeps the mechanism stays green; an upgrade
// that changes the mechanism goes red here.
// ---------------------------------------------------------------------------
const CONSTRUCT_FILES: Array<{ rel: string; anchors: string[] }> = [
  {
    rel: "node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js",
    anchors: ['type: "message_start"', 'type: "message_update"', "{ ...partialMessage }", "finalMessage", 'type: "message_end"'],
  },
  {
    rel: "node_modules/@earendil-works/pi-ai/dist/api/anthropic-messages.js",
    anchors: ["const output = {", 'role: "assistant"', "timestamp: Date.now()", 'partial: output'],
  },
  {
    rel: "node_modules/@earendil-works/pi-ai/dist/utils/assistant-message-frame.js",
    anchors: ['role: "assistant"', "timestamp: message.timestamp"],
  },
];

describe("construction-layer grounding (FLLWUP-36)", () => {
  test.skipIf(skipReason !== null)("probe loads the real construction layer from the installed SDK", () => {
    expect(SDK_LOAD).not.toBeNull();
  });

  test.skipIf(skipReason !== null)(
    "A1: message_start/message_update emit fresh copies — object identity never survives an emission",
    async () => {
      const { sdk } = SDK_LOAD!;
      const run = await runOneStream(sdk, 1700000000001, "hello");
      const frames = run.emissions.filter((e) => e.type === "message_start" || e.type === "message_update");
      // start + at least two updates (text_start, text_delta) = 3 emissions
      expect(frames.length).toBeGreaterThanOrEqual(3);
      const identities = new Set(frames.map((f) => f.message));
      expect(identities.size).toBe(frames.length);
      // And none of them shares identity with the accumulated message.
      for (const frame of frames) {
        expect(frame.message).not.toBe(run.final);
      }
    }
  );

  test.skipIf(skipReason !== null)(
    "A2: message_end emits the accumulated final message itself, not a copy",
    async () => {
      const { sdk } = SDK_LOAD!;
      const run = await runOneStream(sdk, 1700000000001, "hello");
      const ends = run.emissions.filter((e) => e.type === "message_end");
      expect(ends.length).toBe(1);
      expect(ends[0]!.message).toBe(run.final);
    }
  );

  test.skipIf(skipReason !== null)(
    "A3: ${role}:${timestamp} partitions emissions into exactly the logical messages streamed",
    async () => {
      const { sdk } = SDK_LOAD!;
      const t1 = 1700000000001;
      const t2 = 1700000000002;
      const run1 = await runOneStream(sdk, t1, "one");
      const run2 = await runOneStream(sdk, t2, "two");
      const keysOf = (run: StreamRun) => run.emissions.map((e) => `${e.message!.role}:${e.message!.timestamp}`);
      expect(keysOf(run1).length).toBeGreaterThanOrEqual(3);
      expect(new Set(keysOf(run1))).toEqual(new Set([`assistant:${t1}`]));
      expect(new Set(keysOf(run2))).toEqual(new Set([`assistant:${t2}`]));
    }
  );

  test.skipIf(skipReason !== null)(
    "A4: agentMessageId (src/pi-sdk-events.ts) is stable within a stream, distinct across streams",
    async () => {
      const { sdk } = SDK_LOAD!;
      const t1 = 1700000000001;
      const t2 = 1700000000002;
      const run1 = await runOneStream(sdk, t1, "one");
      const run2 = await runOneStream(sdk, t2, "two");
      for (const emission of run1.emissions) {
        expect(agentMessageId(emission.message)).toBe(`assistant:${t1}`);
      }
      for (const emission of run2.emissions) {
        expect(agentMessageId(emission.message)).toBe(`assistant:${t2}`);
      }
    }
  );

  test.skipIf(skipReason !== null)(
    "A5: source anchors pin the probe to the construct-layer files",
    () => {
      const { location } = SDK_LOAD!;
      for (const file of CONSTRUCT_FILES) {
        const path = join(location.root, file.rel);
        expect(existsSync(path)).toBe(true);
        const src = readFileSync(path, "utf8");
        for (const anchor of file.anchors) {
          expect(src).toContain(anchor);
        }
      }
    }
  );
});
