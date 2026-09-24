/**
 * FLLWUP-11 — load smoke against the installed SDK's type surface.
 *
 * Runtime host loading is not testable in-repo (the card accepts type-surface
 * verification where runtime loading is not testable). This suite proves the
 * stronger property available here: the default entry point, executed against
 * a strict Proxy that exposes ONLY the real loader's ExtensionAPI member names
 * (dist/core/extensions/loader.js ~line 200 + types.d.ts ~978), never touches
 * a member outside that surface — the exact failure class that made
 * `pi.configDir()` a TypeError at load before this card.
 */
import { describe, expect, test } from "bun:test";
import type { ExtensionAPI } from "../index.ts";

// The real installed SDK's ExtensionAPI member names (runtime api object,
// loader.js ~200; types.d.ts ~978). Provenance per R-TYPE-1; re-diff on
// SDK upgrades. NOT a repo dependency — vendored list.
const REAL_LOADER_API_KEYS = [
  "on",
  "registerTool",
  "registerCommand",
  "registerShortcut",
  "registerFlag",
  "getFlag",
  "registerMessageRenderer",
  "registerMarkdownTransformer",
  "registerEntryRenderer",
  "sendMessage",
  "sendUserMessage",
  "appendEntry",
  "setSessionName",
  "getSessionName",
  "setLabel",
  "exec",
  "getActiveTools",
  "getAllTools",
  "setActiveTools",
  "getCommands",
  "setModel",
  "getThinkingLevel",
  "setThinkingLevel",
  "registerProvider",
  "unregisterProvider",
  "events",
] as const;

const TOUCHED: string[] = [];

function strictHostProxy(): unknown {
  const allowed = new Set<string>(REAL_LOADER_API_KEYS);
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(t, prop) {
      const key = String(prop);
      TOUCHED.push(key);
      if (!allowed.has(key)) {
        throw new TypeError(
          `pi-remote load smoke: entry touched '${key}', which does not exist on the real ExtensionAPI`
        );
      }
      if (key === "on") {
        return (event: unknown, handler: unknown) => {
          void event;
          void handler;
          return () => {};
        };
      }
      if (key === "registerCommand") {
        return (_name: unknown, opts: { handler: unknown }) => {
          void opts;
        };
      }
      return () => {};
    },
    has() {
      return true; // allow `in` checks; the get trap is the strict gate
    },
  });
}

describe("FLLWUP-11 load smoke", () => {
  test("entry runs clean against a strict real-surface-only host proxy", () => {
    TOUCHED.length = 0;
    // Fresh module import with an isolated HOME so resolvePiAgentDir cannot
    // read a real ~/.pi/agent/settings.json from the dev machine.
    process.env.PI_CODING_AGENT_DIR = "/tmp/pi-remote-fllwup11-loadsmoke";
    const fs = require("node:fs");
    fs.rmSync("/tmp/pi-remote-fllwup11-loadsmoke", { recursive: true, force: true });
    const entry = (require("../index.ts").default) as (pi: unknown) => void;
    const pi = strictHostProxy();
    expect(() => entry(pi)).not.toThrow();
    // The entry must have subscribed lifecycle wiring through the real surface.
    expect(TOUCHED).toContain("on");
    expect(TOUCHED).toContain("registerCommand");
    // And nothing outside the real loader surface.
    for (const key of TOUCHED) {
      expect(REAL_LOADER_API_KEYS as readonly string[]).toContain(key);
    }
  });

  test("every member of index.ts's ExtensionAPI is a real-surface member (compile-time check; enforced by `bunx tsc --noEmit`, not by bun test)", () => {
    // Compile-time structural check via the type system instead of `keyof`
    // runtime reflection: if a stand-in member is ever reintroduced on
    // index.ts's ExtensionAPI that the real API lacks, the conditional type
    // below resolves to `never` and the const fails to compile — caught by
    // the typecheck gate (`bunx tsc --noEmit`), because bun test strips
    // types at runtime and cannot enforce it. See REAL_LOADER_API_KEYS above.
    type RealSurfaceKey = (typeof REAL_LOADER_API_KEYS)[number];
    const surfaceIsSubset: keyof ExtensionAPI extends RealSurfaceKey
      ? true
      : never = true;
    void surfaceIsSubset;
    // Runtime mirror (sanity only — bun test strips the types above): the
    // members index.ts exercises today must be present in the vendored list.
    for (const k of Object.keys({ on: 1, registerCommand: 1, sendUserMessage: 1 })) {
      expect(REAL_LOADER_API_KEYS as readonly string[]).toContain(k);
    }
  });
});
