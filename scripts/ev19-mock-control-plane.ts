/**
 * EV-19 mock control plane — committed observation tooling, NOT product code.
 *
 * Serves exactly the three endpoints the attended /rc:login driver needs to
 * complete enrollment against a loopback-only control plane (EV-19 design
 * spec §5): RFC 8414 discovery, /authorize (302 back to the request's
 * redirect_uri with a code + echoed state), and /token. Every request —
 * including unexpected ones, which 404 — is appended as one JSON line to the
 * log file, so "the log shows only the three expected requests" is a
 * checkable assertion.
 *
 * Usage: bun scripts/ev19-mock-control-plane.ts --port <p> --log <path>
 * `--port 0` binds an ephemeral port; the bound port is printed as
 * `MOCK_LISTENING <port>` on stdout. Mints no copy, touches no surface.
 */
import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const logIdx = args.indexOf("--log");
const port = portIdx >= 0 ? Number(args[portIdx + 1]) : 0;
const logPath = logIdx >= 0 ? args[logIdx + 1] : undefined;

function log(method: string, path: string): void {
  if (logPath) {
    appendFileSync(logPath, `${JSON.stringify({ ts: new Date().toISOString(), method, path })}\n`);
  }
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  fetch(req) {
    const url = new URL(req.url);
    const origin = `http://127.0.0.1:${server.port}`;
    log(req.method, url.pathname);
    if (req.method === "GET" && url.pathname === "/.well-known/oauth-authorization-server") {
      return Response.json({
        authorizationEndpoint: `${origin}/authorize`,
        tokenEndpoint: `${origin}/token`,
      });
    }
    if (req.method === "GET" && url.pathname === "/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const target = new URL(redirectUri);
      target.searchParams.set("code", `mock-code-${crypto.randomUUID()}`);
      target.searchParams.set("state", state);
      return new Response(null, { status: 302, headers: { location: target.toString() } });
    }
    if (req.method === "POST" && url.pathname === "/token") {
      return Response.json({
        access_token: `mock-access-${crypto.randomUUID()}`,
        refresh_token: `mock-refresh-${crypto.randomUUID()}`,
        expires_in: 3600,
      });
    }
    return new Response("not found", { status: 404 });
  },
});

console.log(`MOCK_LISTENING ${server.port}`);
