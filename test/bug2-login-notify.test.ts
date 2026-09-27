/**
 * BUG-2 — user lines must reach the host's notify surface, never the raw
 * terminal. Attended and headless /rc:login user lines land in pi's TUI
 * prompt box when written with console.log (pi owns stdout in interactive
 * mode); the only non-blocking surface is ctx.ui.notify (installed SDK
 * 0.87.1, dist/core/extensions/types.d.ts:77:
 * notify(message: string, type?: "info" | "warning" | "error"): void).
 *
 * Two mechanisms under test:
 *   A. src/login.ts's print seam honors the injected onUserLine sink
 *      (production: the controller's notify-routed print dep) instead of
 *      hardcoding console.log.
 *   B. index.ts's production command print wiring calls ctx.ui.notify,
 *      not console.log (driven at the real entry boundary: default export
 *      + a fake host + a fake command ctx).
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAttendedLogin, type LoginDeps, type LoginOutcome } from "../src/login";

// ---------------------------------------------------------------------------
// Sentinels: record every raw-terminal write; production paths must be silent.
// ---------------------------------------------------------------------------

const consoleLogs: string[] = [];
const stdoutWrites: string[] = [];
let installed = false;

function installSentinels(): void {
  if (installed) return;
  installed = true;
  const origLog = console.log.bind(console);
  console.log = (...a: unknown[]) => {
    consoleLogs.push(a.join(" "));
    void origLog;
  };
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown) => {
    stdoutWrites.push(typeof chunk === "string" ? chunk : String(chunk));
    return true;
  }) as typeof process.stdout.write;
}

function expectSentinelsSilent(): void {
  expect(consoleLogs).toEqual([]);
  expect(stdoutWrites).toEqual([]);
}

// ---------------------------------------------------------------------------
// Test A harness: attended login driven to success, deterministic crypto.
// ---------------------------------------------------------------------------

function resp(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

function b64urlJson(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Three-segment JWT whose payload carries `sub` — the tenant claim source. */
function jwtWithSub(sub: string): string {
  return `${b64urlJson({ alg: "none" })}.${b64urlJson({ sub })}.sig`;
}

function tempConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "bug2-login-"));
}

const SERVER = "https://cp.example";

function attendedDeps(configDir: string, onUserLine: (line: string) => void, accessToken: string): LoginDeps {
  return {
    serverUrl: SERVER,
    configDir,
    fetch: (async (input: string | URL | { url: string }, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (url.includes("/.well-known/oauth-authorization-server")) {
        return resp(200, {
          authorization_endpoint: `${SERVER}/auth`,
          token_endpoint: `${SERVER}/oauth/token`,
        });
      }
      if (url === `${SERVER}/oauth/token` && method === "POST") {
        return resp(200, { access_token: accessToken, refresh_token: "r1", expires_in: 300 });
      }
      return resp(404, {});
    }) as unknown as LoginDeps["fetch"],
    now: () => 0,
    randomBytes: () => new Uint8Array(32).fill(3),
    sha256: async () => new Uint8Array(32).fill(7),
    // Simulated browser: complete consent by fetching the loopback callback
    // with the very state from the authorize URL (wire, not internals).
    openUrl: async (authorizeUrl: string) => {
      const u = new URL(authorizeUrl);
      const state = u.searchParams.get("state") ?? "";
      const redirect = u.searchParams.get("redirect_uri") ?? "";
      await fetch(`${redirect}?code=C1&state=${encodeURIComponent(state)}`).catch(() => {});
      return true;
    },
    onUserLine,
  };
}

// ---------------------------------------------------------------------------
// Test B harness: the real entry loaded against a fake host, commands driven
// with a fake ExtensionCommandContext whose ui.notify is recorded.
// ---------------------------------------------------------------------------

interface EntryHarness {
  notifyLines: string[];
  statusLines: string[];
  run: (name: string, args?: string) => Promise<void>;
  cleanup: () => void;
}

function loadEntry(): EntryHarness {
  const configDir = mkdtempSync(join(tmpdir(), "bug2-entry-"));
  process.env.PI_CODING_AGENT_DIR = configDir;
  const notifyLines: string[] = [];
  const statusLines: string[] = [];
  const handlers: Record<string, (args: string | undefined, ctx: unknown) => Promise<void> | void> = {};
  const fakeCtx = {
    ui: {
      setStatus: (_key: string, text: string | undefined) => {
        statusLines.push(text as string);
      },
      input: async () => undefined,
      confirm: async () => false,
      notify: (message: string, _type?: string) => {
        notifyLines.push(message);
      },
    },
    mode: "tui",
    cwd: configDir,
    sessionManager: { getSessionId: () => "sess-1" },
    isIdle: () => true,
  };
  const fakePi = {
    on: () => () => {},
    registerCommand: (name: unknown, opts: { handler: (args: string | undefined, ctx: unknown) => Promise<void> | void }) => {
      handlers[String(name)] = opts.handler;
    },
    sendUserMessage: () => {},
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const entry = (require("../index.ts").default) as (pi: unknown) => void;
  entry(fakePi);
  return {
    notifyLines,
    statusLines,
    run: async (name, args) => {
      const handler = handlers[name];
      if (!handler) throw new Error(`command not registered: ${name}`);
      await handler(args, fakeCtx);
    },
    cleanup: () => {
      rmSync(configDir, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BUG-2: login user lines reach the notify sink, never the terminal", () => {
  test("attended success: fallback, waiting, and success lines (with tenant parenthetical) go to onUserLine; console.log and process.stdout.write stay silent", async () => {
    installSentinels();
    const lines: string[] = [];
    const configDir = tempConfigDir();
    try {
      const outcome = (await runAttendedLogin(
        attendedDeps(configDir, (l) => lines.push(l), jwtWithSub("tenant-42")),
        null
      )) as LoginOutcome;
      expect(outcome).toEqual({ kind: "success", tenantId: "tenant-42" });

      // All four user rows, rendered, in driver order: opening (openUrl is
      // supplied), the card-pinned fallback, waiting, success. The fallback
      // URL is the wire authorize URL (loopback port is dynamic → structural
      // exactness there; the other three are byte-exact).
      expect(lines.length).toBe(4);
      expect(lines[0]).toBe("Opening your browser to enroll this host with `https://cp.example`…");
      expect(lines[1]).toMatch(/^If the browser does not open, visit: `https:\/\/cp\.example\/auth\?.*`$/);
      expect(lines[2]).toBe("Waiting for browser…");
      expect(lines[3]).toBe(
        "Signed in to `https://cp.example` — enrollment credentials saved for this host. Run /rc to start a tunnel. (tenant tenant-42)"
      );

      expectSentinelsSilent();
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  test("attended success without a tenant claim: no parenthetical appended", async () => {
    installSentinels();
    const lines: string[] = [];
    const configDir = tempConfigDir();
    try {
      const outcome = (await runAttendedLogin(
        attendedDeps(configDir, (l) => lines.push(l), "at-new"),
        null
      )) as LoginOutcome;
      expect(outcome).toEqual({ kind: "success", tenantId: undefined });
      expect(lines[lines.length - 1]).toBe(
        "Signed in to `https://cp.example` — enrollment credentials saved for this host. Run /rc to start a tunnel."
      );
      expectSentinelsSilent();
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });
});

describe("BUG-2: production index.ts print wiring routes through ctx.ui.notify", () => {
  test("/rc (unenrolled) and /rc:off print via notify; console.log and process.stdout.write stay silent", async () => {
    installSentinels();
    const h = loadEntry();
    try {
      await h.run("rc");
      await h.run("rc:off");

      expect(h.notifyLines).toContain("No enrollment credential found — run /rc:login");
      expect(h.notifyLines).toContain("Remote tunnel closed");

      expectSentinelsSilent();
    } finally {
      h.cleanup();
    }
  });
});
