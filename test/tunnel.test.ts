import { describe, expect, test } from "bun:test";
import {
  createTunnel,
  refreshAccessToken,
  deleteTunnel,
  discoverAuthServer,
  TunnelError,
  isTunnelError,
  tunnelReasonCopy,
  englishFor,
  ALREADY_LIVE_COPY,
  type TunnelHttpDeps,
  type TunnelReason,
  type DiscoveryDocument,
} from "../src/tunnel";

// ---------------------------------------------------------------------------
// Test harness: an injected fake control plane via a mocked fetch. No real
// network, no env, no module-level mutable state.
// ---------------------------------------------------------------------------

interface Req {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface RespondChoice {
  status: number;
  body?: unknown;
  /** Simulate a network/DNS/TCP/TLS failure by rejecting the fetch promise. */
  netFail?: boolean;
}

type Responder = (req: Req) => RespondChoice;

/** A Response-like stub sufficient for tunnel.ts's consumption. */
function jsonResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

/** Build an injected fetch that dispatches on URL and records every request. */
function makeFetch(responder: Responder): [TunnelHttpDeps["fetch"], Req[]] {
  const log: Req[] = [];
  const fetchImpl = (async (input: string | URL | { url: string }, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    const body = typeof init?.body === "string" ? init.body : undefined;
    const req: Req = { url, method, headers, body };
    log.push(req);
    const choice = responder(req);
    if (choice.netFail) return Promise.reject(new Error("network down"));
    return jsonResponse(choice.status, choice.body);
  }) as unknown as TunnelHttpDeps["fetch"];
  return [fetchImpl, log];
}

const DEFAULT_SERVER = "https://cp.example";
const TOKEN_ENDPOINT = `${DEFAULT_SERVER}/oauth/token`;
const DISCOVERY_URL = `${DEFAULT_SERVER}/.well-known/oauth-authorization-server`;

function makeDeps(
  overrides: Partial<TunnelHttpDeps> = {},
  responder: Responder = () => ({ status: 500, body: {} })
): { deps: TunnelHttpDeps; log: Req[] } {
  const [fetch, log] = makeFetch(responder);
  return {
    deps: {
      serverUrl: DEFAULT_SERVER,
      accessToken: "enroll-token",
      fetch,
      now: () => 1000,
      discoveryCache: new Map(),
      ...overrides,
    },
    log,
  };
}

function createInput() {
  return {
    sessionId: "sess-1",
    sessionName: "tty",
    cwd: "/home/me/project",
    hostMetadata: { os: "linux", shell: "zsh" },
  };
}

/** Standard happy-path create responder. */
function happyCreateResponder(): Responder {
  return (req) => {
    if (req.method === "POST" && req.url === `${DEFAULT_SERVER}/tunnels`) {
      return { status: 200, body: { tunnelId: "t1", url: "wss://tunnel.example/live?sig=abc", tokenTtl: 60 } };
    }
    if (req.url === DISCOVERY_URL) {
      return { status: 200, body: { token_endpoint: TOKEN_ENDPOINT } };
    }
    if (req.url === TOKEN_ENDPOINT && req.method === "POST") {
      return { status: 200, body: { access_token: "new-at", refresh_token: "new-rt", expires_in: 300 } };
    }
    return { status: 404, body: {} };
  };
}

// ---------------------------------------------------------------------------

describe("EV-2 control-plane tunnel REST client", () => {
  test("createTunnel success: parsed result, Bearer header, payload fields", async () => {
    const { deps, log } = makeDeps({}, happyCreateResponder());
    const result = await createTunnel(createInput(), deps);
    expect(result).toEqual({ tunnelId: "t1", url: "wss://tunnel.example/live?sig=abc", expiresAt: 1000 + 60 * 1000 });

    expect(log).toHaveLength(1);
    const req = log[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe(`${DEFAULT_SERVER}/tunnels`);
    expect(req.headers.authorization).toBe("Bearer enroll-token");
    const payload = JSON.parse(req.body ?? "{}") as Record<string, unknown>;
    expect(payload.sessionId).toBe("sess-1");
    expect(payload.sessionName).toBe("tty");
    expect(payload.cwd).toBe("/home/me/project");
    expect(payload.hostMetadata).toEqual({ os: "linux", shell: "zsh" });
  });

  test("O2: expiresAt is absolute epoch-ms now + tokenTtl*1000, no raw TTL returned", async () => {
    const { deps } = makeDeps({ now: () => 5_000_000 }, happyCreateResponder());
    const result = await createTunnel(createInput(), deps);
    expect(result.expiresAt).toBe(5_000_000 + 60 * 1000);
    expect(result).not.toHaveProperty("tokenTtl"); // raw relative value never returned
  });

  test("validation: non-ws url is a typed validation error", async () => {
    const { deps } = makeDeps(
      {},
      () => ({ status: 200, body: { tunnelId: "t1", url: "https://not-a-ws", tokenTtl: 60 } })
    );
    let thrown: unknown;
    try {
      await createTunnel(createInput(), deps);
    } catch (e) {
      thrown = e;
    }
    expect(isTunnelError(thrown)).toBe(true);
    expect((thrown as TunnelError).kind).toBe("validation");
    expect((thrown as TunnelError).reason).toBe("validation");
  });

  test("validation: 0 / negative / non-number tokenTtl is a typed validation error", async () => {
    for (const bad of [0, -1, "60", null]) {
      const { deps } = makeDeps(
        {},
        () => ({ status: 200, body: { tunnelId: "t1", url: "wss://x.example/live", tokenTtl: bad } })
      );
      let thrown: unknown;
      try {
        await createTunnel(createInput(), deps);
      } catch (e) {
        thrown = e;
      }
      expect(isTunnelError(thrown)).toBe(true);
      expect((thrown as TunnelError).kind).toBe("validation");
    }
  });

  test("401 → enrollment_expired: kind unauthenticated, copy names /rc:login, no raw body/url leak", async () => {
    const { deps } = makeDeps({}, () => ({ status: 401, body: { trace: "secret-raw-body" } }));
    let thrown: unknown;
    try {
      await createTunnel(createInput(), deps);
    } catch (e) {
      thrown = e;
    }
    const err = thrown as TunnelError;
    expect(isTunnelError(thrown)).toBe(true);
    expect(err.kind).toBe("unauthenticated");
    expect(err.reason).toBe("enrollment_expired");
    const copy = englishFor(tunnelReasonCopy[err.reason]?.userLineKey ?? "");
    expect(copy).toContain("/rc:login");
    expect(err.message).not.toContain("secret-raw-body");
    expect(err.message).not.toContain("wss://");
  });

  test("403 → enrollment_rejected: kind forbidden, copy names /rc:login and admin; 401/403 lines differ", async () => {
    const { deps } = makeDeps({}, () => ({ status: 403, body: {} }));
    let thrown: unknown;
    try {
      await createTunnel(createInput(), deps);
    } catch (e) {
      thrown = e;
    }
    const err = thrown as TunnelError;
    expect(isTunnelError(thrown)).toBe(true);
    expect(err.kind).toBe("forbidden");
    expect(err.reason).toBe("enrollment_rejected");
    const copy = englishFor(tunnelReasonCopy[err.reason]?.userLineKey ?? "");
    expect(copy).toContain("/rc:login");
    expect(copy).toContain("admin");

    const ua = englishFor(tunnelReasonCopy.enrollment_expired.userLineKey);
    const fb = englishFor(tunnelReasonCopy.enrollment_rejected.userLineKey);
    expect(ua).not.toBe(fb); // 401 and 403 copy are distinct (ruling Item 1)
    expect(err.message).not.toContain("wss://");
  });

  test("unreachable: network failure → kind unreachable, copy names serverUrl, no /rc:login", async () => {
    const { deps } = makeDeps({}, () => ({ status: 200, netFail: true }));
    let thrown: unknown;
    try {
      await createTunnel(createInput(), deps);
    } catch (e) {
      thrown = e;
    }
    const err = thrown as TunnelError;
    expect(isTunnelError(thrown)).toBe(true);
    expect(err.kind).toBe("unreachable");
    expect(err.reason).toBe("control_plane_unreachable");
    const copy = englishFor(tunnelReasonCopy[err.reason]?.userLineKey ?? "");
    expect(copy).toContain("<serverUrl>"); // English default names the placeholder; spec §3.2 table literal
    expect(copy).not.toContain("/rc:login");
  });

  test("server_error: 5xx → server_error, copy distinct from unreachable", async () => {
    const { deps } = makeDeps({}, () => ({ status: 500, body: {} }));
    let thrown: unknown;
    try {
      await createTunnel(createInput(), deps);
    } catch (e) {
      thrown = e;
    }
    const err = thrown as TunnelError;
    expect(isTunnelError(thrown)).toBe(true);
    expect(err.kind).toBe("server_error");
    expect(err.reason).toBe("server_error");
    const se = englishFor(tunnelReasonCopy.server_error.userLineKey);
    const ur = englishFor(tunnelReasonCopy.control_plane_unreachable.userLineKey);
    expect(se).not.toBe(ur);
  });

  test("refresh success: absolute expiresAt, rotated refresh token returned not applied (O6)", async () => {
    const { deps, log } = makeDeps({}, happyCreateResponder());
    const result = await refreshAccessToken("expired-rt", deps);
    expect(result.accessToken).toBe("new-at");
    expect(result.refreshToken).toBe("new-rt"); // rotated token returned for EV-8 to persist
    expect(result.expiresAt).toBe(1000 + 300 * 1000); // now + expires_in*1000

    const discovery = log.filter((r) => r.url === DISCOVERY_URL);
    expect(discovery).toHaveLength(1); // RFC 8414 discovery used
    const refreshReq = log.find((r) => r.url === TOKEN_ENDPOINT)!;
    expect(refreshReq.method).toBe("POST");
    const body = JSON.parse(refreshReq.body ?? "{}") as Record<string, unknown>;
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("expired-rt");
  });

  test("refresh failure: error names /rc:login; no POST /tunnels issued from refresh", async () => {
    const { deps, log } = makeDeps({}, (req) => {
      if (req.url === DISCOVERY_URL) return { status: 200, body: { token_endpoint: TOKEN_ENDPOINT } };
      return { status: 401, body: {} };
    });
    let thrown: unknown;
    try {
      await refreshAccessToken("expired-rt", deps);
    } catch (e) {
      thrown = e;
    }
    const err = thrown as TunnelError;
    expect(isTunnelError(thrown)).toBe(true);
    expect(err.reason).toBe("enrollment_expired");
    expect(englishFor(tunnelReasonCopy.enrollment_expired.userLineKey)).toContain("/rc:login");
    expect(log.some((r) => r.url.endsWith("/tunnels"))).toBe(false);
  });

  test("no auto-refresh inside createTunnel: 401 to /tunnels is terminal, never triggers a refresh call (O5)", async () => {
    const { deps, log } = makeDeps({}, (req) => {
      if (req.url === DISCOVERY_URL) return { status: 200, body: { token_endpoint: TOKEN_ENDPOINT } };
      return { status: 401, body: {} }; // POST /tunnels -> 401
    });
    let thrown: unknown;
    try {
      await createTunnel(createInput(), deps);
    } catch (e) {
      thrown = e;
    }
    expect(isTunnelError(thrown)).toBe(true);
    expect((thrown as TunnelError).reason).toBe("enrollment_expired");
    // No token-refresh request was made from within createTunnel.
    expect(log.some((r) => r.url === TOKEN_ENDPOINT)).toBe(false);
    expect(log.filter((r) => r.method === "POST" && r.url.endsWith("/tunnels"))).toHaveLength(1);
  });

  test("deleteTunnel: issues exactly one DELETE with Bearer; 404 and 410 are success; network failure swallowed", async () => {
    // 204 success
    const { deps, log } = makeDeps({}, () => ({ status: 204, body: {} }));
    await expect(deleteTunnel("t1", deps)).resolves.toBeUndefined();
    expect(log).toHaveLength(1);
    expect(log[0]!.method).toBe("DELETE");
    expect(log[0]!.url).toBe(`${DEFAULT_SERVER}/tunnels/t1`);
    expect(log[0]!.headers.authorization).toBe("Bearer enroll-token");

    // 404 -> success (idempotent)
    const { deps: d404 } = makeDeps({}, () => ({ status: 404, body: {} }));
    await expect(deleteTunnel("t1", d404)).resolves.toBeUndefined();

    // 410 -> success (idempotent)
    const { deps: d410 } = makeDeps({}, () => ({ status: 410, body: {} }));
    await expect(deleteTunnel("t1", d410)).resolves.toBeUndefined();

    // network failure -> swallowed, does not throw
    const { deps: dNet } = makeDeps({}, () => ({ status: 200, netFail: true }));
    await expect(deleteTunnel("t1", dNet)).resolves.toBeUndefined();
  });

  test("deleteTunnel: other non-2xx surfaces teardown_failed; second call is a safe no-op", async () => {
    // 500 -> teardown_failed
    const { deps } = makeDeps({}, () => ({ status: 500, body: {} }));
    let thrown: unknown;
    try {
      await deleteTunnel("t1", deps);
    } catch (e) {
      thrown = e;
    }
    const err = thrown as TunnelError;
    expect(isTunnelError(thrown)).toBe(true);
    expect(err.reason).toBe("teardown_failed");
    expect(err.serverUrl).toBe(DEFAULT_SERVER);

    // Already-cleared id: deleteTunnel is safe to call again (resolves, no throw).
    const { deps: dAgain } = makeDeps({}, () => ({ status: 404, body: {} }));
    await expect(deleteTunnel("t1", dAgain)).resolves.toBeUndefined();
  });

  test("already_live copy: exact sentence with <serverUrl>; one-time tunnel URL never in any copy", () => {
    expect(ALREADY_LIVE_COPY).toBe("already connected to `<serverUrl>`; ignoring this `/rc`");
    const allCopy = [...Object.values(tunnelReasonCopy).map((c) => c.userLine), ALREADY_LIVE_COPY];
    for (const line of allCopy) {
      expect(line).not.toContain("wss://");
      expect(line).not.toContain("wss:");
    }
  });

  test("discovery cached per serverUrl (O7): two refresh calls fetch discovery once, not module-level state", async () => {
    const { deps, log } = makeDeps({}, happyCreateResponder());
    await refreshAccessToken("rt-1", deps);
    await refreshAccessToken("rt-2", deps);
    const discoveryCount = log.filter((r) => r.url === DISCOVERY_URL).length;
    expect(discoveryCount).toBe(1);
  });

  test("copy map: each reason resolves to its English default; reason set closed to §3.2", () => {    const closed: TunnelReason[] = [
      "enrollment_expired",
      "enrollment_rejected",
      "control_plane_unreachable",
      "server_error",
      "teardown_failed",
      "validation",
    ];
    expect(Object.keys(tunnelReasonCopy).sort()).toEqual([...closed].sort());
    for (const reason of closed) {
      const entry = tunnelReasonCopy[reason]!;
      expect(entry.userLine).toBe(englishFor(entry.userLineKey)); // key resolves to its English default
      expect(entry.severity).toBe("error");
      expect(entry.footerState).toBe("error");
    }
  });

  test("static guard: no WebSocket(/wss:// literal, no process.env, no PI_REMOTE_HOST_KEY in tunnel.ts (G-3/G-4)", async () => {
    const src = await Bun.file(new URL("../src/tunnel.ts", import.meta.url)).text();
    expect(src).not.toMatch(/WebSocket\(/);
    expect(src).not.toMatch(/wss:\/\//);
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/PI_REMOTE_HOST_KEY/);
  });

  test("no module-level mutable state: importing tunnel.ts has no side effects", async () => {
    const before = (globalThis as Record<string, unknown>).__ev2_side_effect ?? "absent";
    await import("../src/tunnel");
    const after = (globalThis as Record<string, unknown>).__ev2_side_effect ?? "absent";
    expect(after).toBe(before);
  });

  test("discoverAuthServer returns the full RFC 8414 doc incl. optional device endpoint", async () => {
    const { deps } = makeDeps({}, () => ({
      status: 200,
      body: {
        authorization_endpoint: `${DEFAULT_SERVER}/auth`,        token_endpoint: TOKEN_ENDPOINT,
        device_authorization_endpoint: `${DEFAULT_SERVER}/device`,
      },
    }));
    const doc = await discoverAuthServer(deps);
    expect(doc.authorizationEndpoint).toBe(`${DEFAULT_SERVER}/auth`);
    expect(doc.tokenEndpoint).toBe(TOKEN_ENDPOINT);
    expect(doc.deviceAuthorizationEndpoint).toBe(`${DEFAULT_SERVER}/device`);
  });

  test("discoverAuthServer is cached per serverUrl inside the injected scope (O7, test 17)", async () => {
    const { deps, log } = makeDeps({}, () => ({
      status: 200,
      body: { authorization_endpoint: "/auth", token_endpoint: TOKEN_ENDPOINT },
    }));
    const a = await discoverAuthServer(deps);
    const b = await discoverAuthServer(deps);
    expect(a).toEqual(b);
    expect(log.filter((r) => r.url === DISCOVERY_URL)).toHaveLength(1);
  });

  test("test 8 (open-untested): refreshAccessToken with a discovery failure throws unreachable; TunnelReason stays closed", async () => {
    const { deps } = makeDeps({}, (req) => {
      if (req.url === DISCOVERY_URL) return { status: 200, netFail: true };
      return { status: 200, body: {} };
    });
    let thrown: unknown;
    try {
      await refreshAccessToken("expired-rt", deps);
    } catch (e) {
      thrown = e;
    }
    const err = thrown as TunnelError;
    expect(isTunnelError(thrown)).toBe(true);
    expect(err.kind).toBe("unreachable");
    expect(err.reason).toBe("control_plane_unreachable");

    // Closed TunnelReason set is unchanged — no discovery_invalid member was added.
    const closed: TunnelReason[] = [
      "enrollment_expired",
      "enrollment_rejected",
      "control_plane_unreachable",
      "server_error",
      "teardown_failed",
      "validation",
    ];
    expect(Object.keys(tunnelReasonCopy).sort()).toEqual([...closed].sort());
  });
});
