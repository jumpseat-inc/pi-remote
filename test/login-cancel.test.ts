/**
 * EV-17 map item 7 — the red-at-base record (O-3-corrected, timing-only).
 *
 * Self-contained by design: this single file is the transplant — it
 * materializes verbatim at the pre-mechanism base sha (where
 * `createLoginCommand.cancel()` only flips the flag and the attended wait is
 * NOT woken) and runs there unchanged. At base the timing assertion is RED
 * (elapsed >= redirectTimeoutMs; the flag check precedes the timeout branch,
 * so the outcome is still `cancelled`); at head (cancel() = set-then-wake)
 * it is GREEN. Per O-3's correction, the falsifier asserts timing only —
 * never a failure reason (a "reason redirectTimeout" red would
 * mis-diagnose) — and cites O-3's probe, not the struck `vault/wiki/login.ts.md:55`
 * citation.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLoginCommand, type LoginDeps, type LoginOutcome } from "../src/login";

const CANCEL_LINE = "Sign-in cancelled — no credentials were saved.";

function resp(status: number, body: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as unknown as Response;
}

const SERVER = "https://cp.example";
const TOKEN_ENDPOINT = `${SERVER}/oauth/token`;
const DISCOVERY = {
  authorization_endpoint: `${SERVER}/auth`,
  token_endpoint: TOKEN_ENDPOINT,
  device_authorization_endpoint: `${SERVER}/oauth/device`,
};

describe("EV-17 item 7: cancel() wakes the attended wait (red at base, green at head)", () => {
  test("mid-wait cancel() ends the run strictly before redirectTimeoutMs", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "ev17-cancel-"));
    const fakeFetch = (async (url: string | URL) => {
      const href = typeof url === "string" ? url : url.href;
      if (href.includes("/.well-known/oauth-authorization-server")) return resp(200, DISCOVERY);
      if (href === TOKEN_ENDPOINT) return resp(200, { access_token: "at", expires_in: 300 });
      return resp(404, {});
    }) as unknown as typeof fetch;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: unknown[]) => {
      logs.push(a.join(" "));
    };

    // No openUrl: the fallback URL prints, the wait parks, no callback ever
    // arrives. cancel() at ~50ms must wake it well inside the 500ms window.
    const deps: LoginDeps = {
      serverUrl: SERVER,
      configDir,
      fetch: fakeFetch,
      redirectTimeoutMs: 500,
    };
    const cmd = createLoginCommand(deps);
    setTimeout(() => cmd.cancel(), 50);
    const start = Date.now();
    let outcome: LoginOutcome | undefined;
    try {
      outcome = (await cmd.run("attended")) as LoginOutcome;
    } finally {
      console.log = origLog;
    }
    const elapsed = Date.now() - start;

    expect(outcome).toEqual({ kind: "cancelled" });
    // The discriminating assertion: an interrupt, not a reason-flip at timer
    // fire. At base the wait is not woken and this is RED (elapsed >= 500).
    expect(elapsed).toBeLessThan(500);
    expect(logs.filter((l) => l === CANCEL_LINE)).toHaveLength(1);
    rmSync(configDir, { recursive: true, force: true });
  });
});
