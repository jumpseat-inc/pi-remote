/**
 * FLLWUP-4 — id overlay (`src/copy.ts`), resolver fallback semantics, and
 * end-to-end locale resolution through the controller.
 *
 * Unit tests cover test-plan items 1–4, 7, 8 of the design spec; the
 * integration tests cover items 5–6 (red-then-green footer resolution under
 * `setLocale("id")` and `<serverUrl>` substitution at the two re-point
 * sites). Locale is reset to "en" after every test.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  getLocale,
  indonesianCopy,
  renderCopy,
  resolveCopy,
  setLocale,
} from "../src/copy";
import { englishFor, tunnelReasonCopy } from "../src/tunnel";
import { FOOTER_ROWS, loginEnglishFor } from "../src/login";
import {
  createRemoteController,
  type RemoteControllerDeps,
} from "../index";

const EN_URL_EXPIRED = "The tunnel URL expired — run /rc to re-dial";

// ---------------------------------------------------------------------------
// Shared integration harness (minimal; no relay — the dial test uses a
// construct-only WebSocket so currentTunnelId/activeHttp are set without a
// live connection).
// ---------------------------------------------------------------------------
function makeDeps(overrides?: Partial<RemoteControllerDeps>): {
  deps: RemoteControllerDeps;
  setStatus: (string | undefined)[];
  printed: string[];
} {
  const setStatus: (string | undefined)[] = [];
  const printed: string[] = [];
  const deps: RemoteControllerDeps = {
    configDir: "/tmp/pi-remote-copy-test",
    serverUrl: "https://cp.example.com",
    sessionName: "copy-test",
    cwd: "/tmp",
    hostMetadata: { piVersion: "1.0", platform: "linux", arch: "x64" },
    sessionId: () => "sess-copy",
    setStatus: (s) => setStatus.push(s),
    print: (l) => printed.push(l),
    sendUserMessage: async () => {},
    isStreaming: () => false,
    resolvePendingPrompt: () => false,
    readActiveBranch: async () => [],
    inputPrompt: async () => undefined,
    fetch: (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch,
    WebSocket: class {
      onopen: unknown = null;
      onclose: unknown = null;
      onerror: unknown = null;
      onmessage: unknown = null;
      constructor(_url: string) {}
      send(): void {}
      close(): void {}
    } as unknown as typeof WebSocket,
    command: () => {},
    on: () => {},
    ...overrides,
  };
  return { deps, setStatus, printed };
}

afterEach(() => {
  setLocale("en");
});

// ---------------------------------------------------------------------------
// Item 1 — table-completeness drift alarm
// ---------------------------------------------------------------------------
describe("indonesianCopy coverage (22 keys)", () => {
  test("covers exactly tunnelReasonCopy keys ∪ FOOTER_ROWS keys, non-empty", () => {
    const expected = [
      ...Object.values(tunnelReasonCopy).map((c) => c.userLineKey),
      ...Object.keys(FOOTER_ROWS),
    ].sort();
    expect(new Set(expected).size).toBe(22); // skeptic-verified: union size 22
    expect(Object.keys(indonesianCopy).sort()).toEqual(expected);
    for (const [key, value] of Object.entries(indonesianCopy)) {
      expect(typeof value === "string" && value.length > 0).toBe(true);
      expect(value).not.toBe(key); // no key echoed as its own translation
    }
  });
});

// ---------------------------------------------------------------------------
// Item 3 — fallback semantics
// ---------------------------------------------------------------------------
describe("resolveCopy fallback semantics", () => {
  test("id locale + key missing from id table → English default", () => {
    setLocale("id");
    const english = { "login.failure.timedOut": "Timed out" };
    expect(resolveCopy("login.failure.timedOut", english)).toBe("Timed out");
  });

  test("unknown key → raw key echoed (today's behavior, unchanged)", () => {
    setLocale("id");
    expect(resolveCopy("no.such.key", {})).toBe("no.such.key");
    setLocale("en");
    expect(resolveCopy("no.such.key", { a: "A" })).toBe("no.such.key");
  });

  test("unknown locale raw values normalize to en (fail-open)", () => {
    for (const raw of ["fr", "", null, undefined, 42, true, "id-ID"]) {
      setLocale(raw);
      expect(getLocale()).toBe("en");
    }
    setLocale("en");
    expect(getLocale()).toBe("en");
    setLocale("id");
    expect(getLocale()).toBe("id");
  });

  test("id locale lookup through loginEnglishFor: out-of-scope login row falls back to English", () => {
    setLocale("id");
    const englishTimedOut = loginEnglishFor("login.failure.timedOut");
    setLocale("en");
    expect(loginEnglishFor("login.failure.timedOut")).toBe(englishTimedOut);
  });
});

// ---------------------------------------------------------------------------
// Item 4 — reason→key contract golden (EV-2 contract unchanged)
// ---------------------------------------------------------------------------
describe("reason→key contract golden", () => {
  test("userLineKey set is exactly the six tunnel keys", () => {
    expect(
      Object.values(tunnelReasonCopy)
        .map((c) => c.userLineKey)
        .sort()
    ).toEqual(
      [
        "tunnel.error.unauthenticated",
        "tunnel.error.forbidden",
        "tunnel.error.unreachable",
        "tunnel.error.serverError",
        "tunnel.error.teardownFailed",
        "tunnel.error.invalidResponse",
      ].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// Item 7 — urlExpired rows (R4): both locales name /rc
// ---------------------------------------------------------------------------
describe("urlExpired remedy names /rc (R4)", () => {
  test("English row names /rc", () => {
    expect(loginEnglishFor("tunnel.error.urlExpired")).toBe(EN_URL_EXPIRED);
    expect(EN_URL_EXPIRED).toContain("/rc");
  });

  test("id row names /rc and matches the English row in meaning", () => {
    setLocale("id");
    const id = loginEnglishFor("tunnel.error.urlExpired");
    expect(id).toContain("/rc");
    expect(id).not.toBe(EN_URL_EXPIRED); // actually localized
    expect(id).toContain("—"); // em-dash preserved
  });
});

// ---------------------------------------------------------------------------
// Item 2 — locale picking through the delegated lookups
// ---------------------------------------------------------------------------
describe("locale picking through englishFor / loginEnglishFor", () => {
  test("under en, lookups are byte-identical to the English defaults", () => {
    setLocale("en");
    expect(englishFor("tunnel.error.unauthenticated")).toBe(
      tunnelReasonCopy.enrollment_expired.userLine
    );
    expect(loginEnglishFor("status.live")).toBe(FOOTER_ROWS["status.live"]!);
    expect(loginEnglishFor("rc.unenrolled")).toBe(FOOTER_ROWS["rc.unenrolled"]!);
  });

  test("under id, lookups resolve to the id overlay across domains", () => {
    setLocale("id");
    // tunnel reason domain
    expect(englishFor("tunnel.error.unauthenticated")).toBe(
      indonesianCopy["tunnel.error.unauthenticated"]!
    );
    // status row domain
    expect(loginEnglishFor("status.live")).toBe(indonesianCopy["status.live"]!);
    // command-output row domain
    expect(loginEnglishFor("rc.unenrolled")).toBe(indonesianCopy["rc.unenrolled"]!);
    // distinct from English
    expect(indonesianCopy["tunnel.error.unauthenticated"]!).not.toBe(
      tunnelReasonCopy.enrollment_expired.userLine
    );
  });
});

// ---------------------------------------------------------------------------
// Item 8 — designer invariants on the id rows (spec §5)
// ---------------------------------------------------------------------------
describe("id-row designer invariants", () => {
  const COMMAND_RE = /\/rc(?::[a-z]+)?/g;

  test("command literals appear byte-identically in the id row", () => {
    const keys = new Set([
      ...Object.keys(FOOTER_ROWS),
      ...Object.values(tunnelReasonCopy).map((c) => c.userLineKey),
    ]);
    const englishFor2 = (key: string): string => {
      const row = Object.values(tunnelReasonCopy).find(
        (c) => c.userLineKey === key
      );
      return row ? row.userLine : FOOTER_ROWS[key] ?? "";
    };
    for (const key of keys) {
      const en = englishFor2(key);
      const id = indonesianCopy[key];
      expect(id).toBeDefined();
      const enCmds = en.match(COMMAND_RE) ?? [];
      const idCmds = id!.match(COMMAND_RE) ?? [];
      expect(idCmds.sort()).toEqual(enCmds.sort());
    }
  });

  test("em-dash (U+2014) preserved wherever the English row uses it", () => {
    const englishOf = (key: string): string => {
      const row = Object.values(tunnelReasonCopy).find(
        (c) => c.userLineKey === key
      );
      return row ? row.userLine : FOOTER_ROWS[key] ?? "";
    };
    for (const [key, id] of Object.entries(indonesianCopy)) {
      if (englishOf(key).includes("—")) {
        expect(id).toContain("—");
      }
      expect(id).not.toContain("--"); // no ASCII stand-ins
    }
  });

  test("no silakan softener, no leaked URLs or HTTP codes", () => {
    for (const value of Object.values(indonesianCopy)) {
      expect(value!.toLowerCase()).not.toContain("silakan");
      expect(value).not.toMatch(/https?:\/\//);
      expect(value).not.toMatch(/\b[1-5]\d{2}\b/); // no 3-digit HTTP codes
    }
  });

  test("<serverUrl> placeholder survives in stored id strings; renderCopy substitutes", () => {
    const idUnreachable = indonesianCopy["tunnel.error.unreachable"]!;
    expect(idUnreachable).toContain("<serverUrl>");
    const rendered = renderCopy(idUnreachable, {
      serverUrl: "https://cp.example.com",
    });
    expect(rendered).toContain("https://cp.example.com");
    expect(rendered).not.toContain("<serverUrl>");
  });

  test("renderCopy keeps the placeholder when no value is supplied", () => {
    expect(renderCopy("a `<serverUrl>` b", {})).toBe("a `<serverUrl>` b");
  });
});

// ---------------------------------------------------------------------------
// Items 5 + 6 — red-then-green integration under setLocale("id")
// ---------------------------------------------------------------------------
describe("integration: controller copy resolution under id locale", () => {
  test("reducer error with a tunnel reason renders the id footer sentence", () => {
    setLocale("id");
    const { deps, setStatus } = makeDeps();
    const ctrl = createRemoteController(deps);
    ctrl.reducer({ type: "error", reason: "enrollment_expired" });
    expect(setStatus.at(-1)).toBe(indonesianCopy["tunnel.error.unauthenticated"]);
  });

  test("rendered unreachable footer contains the real server URL, not the marker", () => {
    setLocale("id");
    const { deps, setStatus } = makeDeps();
    const ctrl = createRemoteController(deps);
    ctrl.reducer({ type: "error", reason: "control_plane_unreachable" });
    const line = setStatus.at(-1);
    expect(line).toBe(
      renderCopy(indonesianCopy["tunnel.error.unreachable"]!, {
        serverUrl: "https://cp.example.com",
      })
    );
    expect(line).toContain("https://cp.example.com");
    expect(line).not.toContain("<serverUrl>");
  });

  test("teardown failure print resolves through the id table with serverUrl", async () => {
    // Persist a fake credential so /rc dials.
    const fs = await import("node:fs");
    const fsp = await import("node:fs/promises");
    const configDir = "/tmp/pi-remote-copy-test";
    await fsp.mkdir(`${configDir}/pi-remote`, { recursive: true });
    fs.writeFileSync(
      `${configDir}/pi-remote/credentials.json`,
      JSON.stringify({
        serverUrl: "https://cp.example.com",
        accessToken: "at-copy",
        tokenExpiry: Date.now() + 60_000,
      })
    );
    const { deps, printed } = makeDeps({
      fetch: (async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return new Response(
            JSON.stringify({
              tunnelId: "t-copy",
              url: "wss://tunnel.example/live",
              tokenTtl: 60,
            }),
            { status: 200 }
          );
        }
        if (init?.method === "DELETE") {
          return new Response(null, { status: 500 }); // teardown_failed
        }
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    });
    const ctrl = createRemoteController(deps);
    const rc = ctrl.commands.find((c) => c.name === "rc")!;
    await rc.handler();
    setLocale("id");
    await ctrl.onShutdown();
    expect(printed).toContain(indonesianCopy["tunnel.error.teardownFailed"]!);
  });
});

// ---------------------------------------------------------------------------
// R3 — entry-point locale sourcing: env over setting, fail-open en
// ---------------------------------------------------------------------------
describe("entry-point locale sourcing (R3)", () => {
  function fakePi(env: Record<string, string | undefined>, settings: Record<string, unknown>) {
    const registered: string[] = [];
    return {
      configDir: () => "/tmp/pi-remote-copy-test",
      getSetting: (name: string) => settings[name],
      env: (name: string) => env[name],
      version: () => "1.0.0",
      platform: () => "linux",
      arch: () => "x64",
      sessionId: () => "sess",
      setStatus: () => {},
      sendUserMessage: async () => {},
      isIdle: () => true,
      readActiveBranch: async () => [],
      input: async () => undefined,
      registerCommand: (name: string, _opts: unknown) => {
        registered.push(name);
      },
      on: () => {},
      registered,
    };
  }

  test("PI_REMOTE_LOCALE env wins over the setting", async () => {
    const entry = (await import("../index")).default;
    const pi = fakePi({ PI_REMOTE_LOCALE: "id" }, { "piRemote.locale": "fr" });
    entry(pi as never);
    expect(getLocale()).toBe("id");
    setLocale("en");
  });

  test("setting applies when env is unset; unrecognized → en (fail-open)", async () => {
    const entry = (await import("../index")).default;
    let pi = fakePi({}, { "piRemote.locale": "id" });
    entry(pi as never);
    expect(getLocale()).toBe("id");
    setLocale("en");
    pi = fakePi({}, { "piRemote.locale": "fr" });
    entry(pi as never);
    expect(getLocale()).toBe("en");
  });
});
