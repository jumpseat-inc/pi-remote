/**
 * EV-19 mock control-plane script tests (committed tooling, not product code).
 *
 * The script at scripts/ev19-mock-control-plane.ts is the local mock the
 * EV-19 real-host enrollment observation runs against (design spec §5):
 * exactly three endpoints — RFC 8414 discovery, /authorize 302, /token —
 * with every request (including unexpected ones) appended to a log file.
 * These tests pin that contract so the Skeptic can reproduce the run.
 */
import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "scripts", "ev19-mock-control-plane.ts");

interface Started {
  port: number;
  logPath: string;
  proc: ReturnType<typeof spawn>;
  dir: string;
}

async function startMock(): Promise<Started> {
  const dir = mkdtempSync(join(tmpdir(), "ev19-mock-test-"));
  const logPath = join(dir, "requests.log");
  const proc = spawn("bun", [SCRIPT, "--port", "0", "--log", logPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  // The script prints "MOCK_LISTENING <port>" on stdout when bound.
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mock did not listen in 10s")), 10_000);
    let out = "";
    proc.stdout!.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      const m = out.match(/MOCK_LISTENING (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    proc.once("exit", (code) => reject(new Error(`mock exited early: ${code}`)));
  });
  return { port, logPath, proc, dir };
}

function stopMock(s: Started): void {
  s.proc.kill("SIGTERM");
}

describe("EV-19 mock control plane", () => {
  test("discovery document carries absolute authorization and token endpoints", async () => {
    const s = await startMock();
    try {
      const res = await fetch(`http://127.0.0.1:${s.port}/.well-known/oauth-authorization-server`);
      expect(res.status).toBe(200);
      const doc = (await res.json()) as Record<string, string>;
      expect(doc.authorizationEndpoint).toBe(`http://127.0.0.1:${s.port}/authorize`);
      expect(doc.tokenEndpoint).toBe(`http://127.0.0.1:${s.port}/token`);
    } finally {
      stopMock(s);
    }
  }, 15_000);

  test("/authorize 302s to the request's redirect_uri with a code and echoed state", async () => {
    const s = await startMock();
    try {
      const redirectUri = "http://127.0.0.1:54321/callback";
      const state = "st4te-abc";
      const url =
        `http://127.0.0.1:${s.port}/authorize?client_id=pi-remote&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
      const res = await fetch(url, { redirect: "manual" });
      expect(res.status).toBe(302);
      const location = res.headers.get("location") ?? "";
      const loc = new URL(location);
      expect(loc.origin + loc.pathname).toBe(redirectUri);
      expect(loc.searchParams.get("state")).toBe(state);
      expect((loc.searchParams.get("code") ?? "").length).toBeGreaterThan(0);
    } finally {
      stopMock(s);
    }
  }, 15_000);

  test("/token returns token JSON with a string access_token", async () => {
    const s = await startMock();
    try {
      const res = await fetch(`http://127.0.0.1:${s.port}/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&code=c&code_verifier=v&redirect_uri=http://127.0.0.1:54321/callback&client_id=pi-remote",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(typeof body.access_token).toBe("string");
      expect((body.access_token as string).length).toBeGreaterThan(0);
    } finally {
      stopMock(s);
    }
  }, 15_000);

  test("every request is logged, including unexpected ones (which get 404)", async () => {
    const s = await startMock();
    try {
      await fetch(`http://127.0.0.1:${s.port}/.well-known/oauth-authorization-server`);
      await fetch(`http://127.0.0.1:${s.port}/nope`);
      // Log lines are flushed per request; small settle wait.
      await new Promise((r) => setTimeout(r, 300));
      expect(existsSync(s.logPath)).toBe(true);
      const lines = readFileSync(s.logPath, "utf8")
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as Record<string, string>);
      expect(lines.length).toBe(2);
      expect(lines[0]!.method).toBe("GET");
      expect(lines[0]!.path).toBe("/.well-known/oauth-authorization-server");
      expect(lines[1]!.method).toBe("GET");
      expect(lines[1]!.path).toBe("/nope");
    } finally {
      stopMock(s);
    }
  }, 15_000);
});
