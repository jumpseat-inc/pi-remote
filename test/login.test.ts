import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLoginCommand,
  loginEnglishFor,
  loginReasonCopy,
  loginEndpointRequestLog,
  LOGIN_SUCCESS_COPY,
  ALREADY_LOGGING_IN_COPY,
  REPLACEMENT_PROMPT_COPY,
  runAttendedLogin,
  runHeadlessLogin,
  sanitizeErrorDescription,
  ACL_ENFORCEMENT_FAILED_NOTICE,
  type LoginDeps,
  type LoginOutcome,
  type LoginReason,
} from "../src/login";
import { readCredential, saveCredential, type EnrollmentCredential } from "../src/credential";
import { createTunnel, type TunnelHttpDeps } from "../src/tunnel";

// ---------------------------------------------------------------------------
// Vocabulary constants (spec §1.2)
// ---------------------------------------------------------------------------

const LOGIN_REASONS: LoginReason[] = [
  // EV-15 removed "noServerUrl": the resolver (src/server-url.ts) is total,
  // so the driver always has a URL and the failure row is unreachable.
  "unreachable",
  "discoveryInvalid",
  "browserOpenFailed",
  "redirectTimeout",
  "redirectMismatch",
  "authorizationDenied",
  "deviceDenied",
  "tokenExchangeFailed",
  "invalidTokenResponse",
  "expiredCode",
  "storageFailed",
  "timedOut",
];

const NON_FAILURE_KEYS = [
  "login.attended.opening",
  "login.attended.fallback",
  "login.attended.waiting",
  "login.attended.success",
  "login.headless.instructions",
  "login.headless.carry",
  "login.headless.code",
  "login.headless.codeValue",
  "login.headless.expire",
  "login.headless.half",
  "login.headless.thirty",
  "login.headless.success",
  "login.cancelled",
  "login.alreadyRunning",
  "login.replacementPrompt",
];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function resp(status: number, body: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as unknown as Response;
}

/** base64url of a JSON object (for fake JWT tokens). */
function b64urlJson(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fakeJwt(sub?: string): string {
  const header = b64urlJson({ alg: "none" });
  const payload = sub === undefined ? b64urlJson({ scope: "pi-remote:host" }) : b64urlJson({ sub });
  return `${header}.${payload}.sig`;
}

interface Control {
  serverUrl: string;
  tokenEndpoint: string;
  deviceEndpoint?: string;
  discovery: Record<string, string>;
  requests: { url: string; method: string; body?: string }[];
  tokenOnce: unknown; // set by onToken
  simNow: number;
  onToken: (c: Control) => { status: number; body: unknown };
  deviceBody: unknown;
  tunnelBody: unknown;
}

function makeControl(overrides: Partial<Control> = {}, tokenBody?: unknown): Control {
  const serverUrl = "https://cp.example";
  const c: Control = {
    serverUrl,
    tokenEndpoint: `${serverUrl}/oauth/token`,
    discovery: {
      authorization_endpoint: `${serverUrl}/auth`,
      token_endpoint: `${serverUrl}/oauth/token`,
      device_authorization_endpoint: `${serverUrl}/oauth/device`,
    },
    requests: [],
    tokenOnce: undefined,
    simNow: 0,
    deviceEndpoint: `${serverUrl}/oauth/device`,
    onToken: () => ({ status: 200, body: tokenBody ?? { refresh_token: "r1", expires_in: 300 } }),
    deviceBody: {
      device_code: "dc-1",
      user_code: "ABC-DEF",
      verification_uri: `${serverUrl}/device`,
      verification_uri_complete: `${serverUrl}/verify/xyz`,
      expires_in: 300,
      interval: 2,
    },
    tunnelBody: { tunnelId: "t1", url: "wss://tunnel.example/live?sig=abc", tokenTtl: 60 },
    ...overrides,
  };
  return c;
}

function makeFetch(c: Control): LoginDeps["fetch"] {
  return (async (input: string | URL | { url: string }, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    c.requests.push({ url, method, body });
    if (url.includes("/.well-known/oauth-authorization-server")) return resp(200, c.discovery);
    if (url === c.tokenEndpoint && method === "POST") {
      const out = c.onToken(c);
      c.tokenOnce = out.body;
      return resp(out.status, out.body);
    }
    if (c.deviceEndpoint && url === c.deviceEndpoint && method === "POST") {
      return resp(200, c.deviceBody);
    }
    if (url.endsWith("/tunnels") && method === "POST") return resp(200, c.tunnelBody);
    return resp(404, {});
  }) as unknown as LoginDeps["fetch"];
}

/** Bas 64url-encode of raw bytes for code_verifier assertions in tests. */
function b64urlRaw(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function tempConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "ev7-login-"));
}

const FIXED_BYTES = new Uint8Array([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
  0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
]);

interface AttendedOpts {
  stateOverride?: string;
  code?: string;
  callbackPath?: string;
  skipCallback?: boolean;
  dataUrl?: string;
}

/**
 * Build attended deps where the injected `openUrl` simulates a browser that
 * finishes the flow by fetching the loopback callback with the given state.
 */
function attendedDeps(
  c: Control,
  cfg: AttendedOpts = {},
  extras: Partial<LoginDeps> = {}
): LoginDeps & { configDir: string } {
  const configDir = tempConfigDir();
  return {
    serverUrl: c.serverUrl,
    fetch: makeFetch(c),
    now: () => c.simNow,
    randomBytes: () => FIXED_BYTES,
    sha256: async () => new Uint8Array(new Uint8Array(32).fill(7)),
    openUrl: async (url: string) => {
      const u = new URL(url);
      // redirect_uri already ends in /callback.
      const redirect = u.searchParams.get("redirect_uri") ?? "";
      const state = u.searchParams.get("state") ?? "";
      if (cfg.skipCallback) return true;
      const stateParam = cfg.stateOverride !== undefined ? cfg.stateOverride : state;
      const q = `?code=${cfg.code ?? "C1"}&state=${encodeURIComponent(stateParam)}`;
      let target: string;
      if (cfg.callbackPath) {
        const ru = new URL(redirect);
        target = `${ru.origin}${cfg.callbackPath}${q}`;
      } else {
        target = `${redirect}${q}`;
      }
      await fetch(target).catch(() => {});
      return true;
    },
    ...extras,
    configDir,
  };
}

async function captureLog(fn: () => Promise<unknown>): Promise<{ logs: string[]; result: unknown }> {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => {
    logs.push(a.join(" "));
  };
  try {
    const result = await fn();
    return { logs, result };
  } finally {
    console.log = orig;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EV-7 copy vocabulary", () => {
  test("test 1: loginEnglishFor resolves every key in the closed set + success constants", () => {
    const keys = [
      ...LOGIN_REASONS.map((r) => loginReasonCopy[r]!.userLineKey),
      ...NON_FAILURE_KEYS,
    ];
    expect(keys).toHaveLength(27); // EV-15: 13→12 failure rows, no addition
    for (const k of keys) {
      const resolved = loginEnglishFor(k);
      expect(resolved).not.toBe(k); // resolves, not identity
      expect(resolved.length).toBeGreaterThan(0);
    }
    expect(loginEnglishFor("login.attended.success")).toBe(LOGIN_SUCCESS_COPY);
    expect(LOGIN_SUCCESS_COPY.length).toBeGreaterThan(0);
  });

  test("test 2: closed-set invariant — failure keys exactly the 12-row set; stable login. keys; per-row tail marker", () => {
    expect(Object.keys(loginReasonCopy).sort()).toEqual([...LOGIN_REASONS].sort());
    const tailMarker: Record<LoginReason, string | null> = {
      unreachable: "check your network and try again.",
      discoveryInvalid: "check the URL with your control-plane admin.",
      browserOpenFailed: "No credentials were saved",
      redirectTimeout: "No credentials were saved",
      redirectMismatch: "No credentials were saved",
      authorizationDenied: "No credentials were saved",
      deviceDenied: "No credentials were saved",
      tokenExchangeFailed: "No credentials were saved",
      invalidTokenResponse: "No credentials were saved",
      expiredCode: "No credentials were saved",
      storageFailed: "No credentials were saved",
      timedOut: "Run /rc:login to try again.",
    };
    const anyMarker = /no credentials were saved|run \/rc:login|control-plane admin/i;
    for (const r of LOGIN_REASONS) {
      const entry = loginReasonCopy[r]!;
      expect(entry.footerState).toBe("error");
      expect(entry.severity).toBe("error");
      expect(entry.userLineKey.startsWith("login.")).toBe(true);
      const pinned = tailMarker[r]!;
      if (pinned !== null) {
        expect(entry.userLine.toLowerCase()).toContain(pinned.toLowerCase());
      }
      // unreachable is the sole row exempted from the any-marker rule.
      expect(entry.userLine).toBe(loginEnglishFor(entry.userLineKey));
      if (r !== "unreachable") expect(anyMarker.test(entry.userLine)).toBe(true);
    }
  });

  test("test 3: attended.success === headless.success (only the key differs by mode)", () => {
    expect(loginEnglishFor("login.attended.success")).toBe(
      loginEnglishFor("login.headless.success")
    );
  });

  test("test 4: denial / timeout / unreachable-distinctness assertions", () => {
    const a = loginEnglishFor(loginReasonCopy.authorizationDenied.userLineKey);
    const d = loginEnglishFor(loginReasonCopy.deviceDenied.userLineKey);
    expect(a).not.toBe(d);
    const rt = loginEnglishFor(loginReasonCopy.redirectTimeout.userLineKey);
    const ec = loginEnglishFor(loginReasonCopy.expiredCode.userLineKey);
    const to = loginEnglishFor(loginReasonCopy.timedOut.userLineKey);
    expect(rt).not.toBe(ec);
    expect(ec).not.toBe(to);
    expect(rt).not.toBe(to);
    const un = loginEnglishFor(loginReasonCopy.unreachable.userLineKey);
    const di = loginEnglishFor(loginReasonCopy.discoveryInvalid.userLineKey);
    expect(un).not.toBe(di);
  });

  test("test 5: static grep guards over src/login.ts + src/credential.ts", async () => {
    const login = await Bun.file(new URL("../src/login.ts", import.meta.url)).text();
    const cred = await Bun.file(new URL("../src/credential.ts", import.meta.url)).text();
    for (const src of [login, cred]) {
      expect(src).not.toMatch(/wss:?:\/\//);
      expect(src).not.toMatch(/device_code/);
      expect(src).not.toMatch(/access_token/);
      expect(src).not.toMatch(/refresh_token/);
      expect(src).not.toMatch(/process\.env/);
    }
  });

  test("constants: LOGIN_SUCCESS_COPY / ALREADY_LOGGING_IN_COPY / REPLACEMENT_PROMPT_COPY canonical", () => {
    expect(LOGIN_SUCCESS_COPY).toBe(
      "Signed in to `<serverUrl>` — enrollment credentials saved for this host. Run /rc to start a tunnel."
    );
    expect(ALREADY_LOGGING_IN_COPY).toBe(
      "Another /rc:login is already in progress — wait for it to finish, then try again."
    );
    expect(REPLACEMENT_PROMPT_COPY).toContain("Press Enter to continue");
    expect(loginEnglishFor("login.alreadyRunning")).toBe(ALREADY_LOGGING_IN_COPY);
    expect(loginEnglishFor("login.replacementPrompt")).toBe(REPLACEMENT_PROMPT_COPY);
    expect(ACL_ENFORCEMENT_FAILED_NOTICE.length).toBeGreaterThan(0);
    // Binding ruling: cause clause names the host substantively; retry is /rc:login; no "file an issue".
    expect(ACL_ENFORCEMENT_FAILED_NOTICE).toContain("nothing was saved");
    expect(ACL_ENFORCEMENT_FAILED_NOTICE).toContain("Run /rc:login");
    expect(ACL_ENFORCEMENT_FAILED_NOTICE).not.toContain("file an issue");
    expect(ACL_ENFORCEMENT_FAILED_NOTICE).not.toContain("may be readable");
    expect(ACL_ENFORCEMENT_FAILED_NOTICE).not.toContain("other accounts");
  });
});

describe("EV-7 storage-failed notice is reason-keyed, not platform-keyed", () => {
  async function withWin32(fn: () => Promise<unknown>) {
    const origPlatform = process.platform;
    (process as unknown as { platform: NodeJS.Platform }).platform = "win32";
    try {
      return await captureLog(fn);
    } finally {
      (process as unknown as { platform: NodeJS.Platform }).platform = origPlatform;
    }
  }

  test("acl_enforcement_failed (via LoginDeps.applyAcl seam) ⇒ storageFailed row + notice tail", async () => {
    const c = makeControl({}, { access_token: fakeJwt("tenant-acl"), expires_in: 300 });
    const deps = attendedDeps(c, {}, { applyAcl: () => ({ ok: false }) });
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await withWin32(() => runAttendedLogin(deps, null));
    const outcome = result as LoginOutcome;
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") expect(outcome.reason).toBe("storageFailed");
    const line = logs.find((l) =>
      l.includes("Could not persist credentials locally")
    );
    expect(line).toBeDefined();
    expect(line).toContain("user-only protection");
    expect(line).toContain("nothing was saved");
    expect(line).toContain("Run /rc:login");
    expect(line).not.toContain("file an issue");
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("win32 + io_error ⇒ bare storageFailed row, NO notice tail", async () => {
    const c = makeControl({}, { access_token: fakeJwt("tenant-io"), expires_in: 300 });
    const deps = attendedDeps(c);
    // A regular file blocks creating the pi-remote directory ⇒ io_error.
    mkdirSync(deps.configDir, { recursive: true });
    writeFileSync(join(deps.configDir, "pi-remote"), "not a dir");
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await withWin32(() => runAttendedLogin(deps, null));
    const outcome = result as LoginOutcome;
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") expect(outcome.reason).toBe("storageFailed");
    const line = logs.find((l) =>
      l.includes("Could not persist credentials locally")
    );
    expect(line).toBeDefined();
    expect(line).not.toContain("user-only protection");
    expect(line).not.toContain("security software");
    rmSync(deps.configDir, { recursive: true, force: true });
  });
});

describe("EV-7 attended flow", () => {
  test("happy path: success outcome + atomically saved credential (tenant decoded)", async () => {
    const c = makeControl({}, { access_token: fakeJwt("tenant-9"), refresh_token: "r1", expires_in: 300 });
    const deps = attendedDeps(c);
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    const outcome = result as LoginOutcome;
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") expect(outcome.tenantId).toBe("tenant-9");
    expect(logs.some((l) => l.includes("(tenant tenant-9)"))).toBe(true);
    const saved = readCredential({ configDir: deps.configDir });
    expect(saved?.accessToken).toBe(fakeJwt("tenant-9"));
    expect(saved?.serverUrl).toBe(c.serverUrl);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("test 12 (J1): no tenant → tenantId absent, compact success line (no parenthetical)", async () => {
    const c = makeControl({}, { access_token: fakeJwt(undefined), refresh_token: "r1", expires_in: 300 });
    const deps = attendedDeps(c);
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    const outcome = result as LoginOutcome;
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") expect(outcome.tenantId).toBeUndefined();
    expect(logs.some((l) => l.includes("(tenant "))).toBe(false);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("test 6 (PKCE): code_verifier / code_challenge are >=43 chars (32-byte base64url = 43)", async () => {
    // A 32-byte verifier encodes to exactly 43 base64url chars (RFC 7636 §4.1 min).
    expect(b64urlRaw(FIXED_BYTES).length).toBe(43);
    // 31 bytes would be 42 — below the RFC minimum; the driver must use 32.
    expect(b64urlRaw(FIXED_BYTES.subarray(0, 31)).length).toBe(42);

    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    let challenge: string | null = null;
    const deps = attendedDeps(c, {}, {
      openUrl: async (url: string) => {
        const u = new URL(url);
        challenge = u.searchParams.get("code_challenge");
        expect(u.searchParams.get("code_challenge_method")).toBe("S256");
        const redirect = u.searchParams.get("redirect_uri") ?? "";
        await fetch(`${redirect}?code=C1&state=${u.searchParams.get("state")}`).catch(() => {});
        return true;
      },
    });
    loginEndpointRequestLog.length = 0;
    await runAttendedLogin(deps, null);
    const ch = challenge ?? "";
    expect(ch.length).toBeGreaterThanOrEqual(43);
    const tokReq = c.requests.find((r) => r.url === c.tokenEndpoint);
    const form = Object.fromEntries(new URLSearchParams(tokReq?.body ?? ""));
    expect((form["code_verifier"] as string).length).toBeGreaterThanOrEqual(43);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("test 6b (PKCE S256): the challenge digests the code_verifier STRING, not the raw random bytes (FLLWUP-106)", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const captured: { shaInput: Uint8Array | null } = { shaInput: null };
    let challenge: string | null = null;
    const deps = attendedDeps(c, {}, {
      sha256: async (i: Uint8Array) => {
        captured.shaInput = i;
        return new Uint8Array(new Uint8Array(32).fill(7));
      },
      openUrl: async (url: string) => {
        const u = new URL(url);
        challenge = u.searchParams.get("code_challenge");
        const redirect = u.searchParams.get("redirect_uri") ?? "";
        await fetch(`${redirect}?code=C1&state=${u.searchParams.get("state")}`).catch(() => {});
        return true;
      },
    });
    loginEndpointRequestLog.length = 0;
    await runAttendedLogin(deps, null);
    const tokReq = c.requests.find((r) => r.url === c.tokenEndpoint);
    const form = Object.fromEntries(new URLSearchParams(tokReq?.body ?? ""));
    expect(captured.shaInput).not.toBeNull();
    // RFC 7636: SHA256 is over the ASCII of the code_verifier, never the raw
    // random bytes that produced it. On the buggy form this input was the
    // raw bytes and this assertion is red.
    expect(new TextDecoder().decode(captured.shaInput as Uint8Array)).toBe(
      form["code_verifier"] as string
    );
    expect(challenge ?? "").toBe(b64urlRaw(new Uint8Array(new Uint8Array(32).fill(7))));
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("test 14 (open-redirect / loopback guard): mismatched state or path → redirectMismatch, no token exchange", async () => {
    // Mismatched state.
    loginEndpointRequestLog.length = 0;
    const c1 = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    c1.requests = [];
    const d1 = attendedDeps(c1, { stateOverride: "WRONG" });
    const o1 = (await runAttendedLogin(d1, null)) as LoginOutcome;
    expect(o1.kind).toBe("failure");
    if (o1.kind === "failure") expect(o1.reason).toBe("redirectMismatch");
    expect(c1.requests.filter((r) => r.url === c1.tokenEndpoint && r.method === "POST")).toHaveLength(0);
    rmSync(d1.configDir, { recursive: true, force: true });

    // Mismatched path (not /callback).
    loginEndpointRequestLog.length = 0;
    const c2 = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const d2 = attendedDeps(c2, { callbackPath: "/evil" });
    const o2 = (await runAttendedLogin(d2, null)) as LoginOutcome;
    if (o2.kind === "failure") expect(o2.reason).toBe("redirectMismatch");
    expect(c2.requests.filter((r) => r.url === c2.tokenEndpoint && r.method === "POST")).toHaveLength(0);
    rmSync(d2.configDir, { recursive: true, force: true });
  });

  test("test 16 (join): attended → readCredential → createTunnel against fake plane, zero env", async () => {
    const c = makeControl({}, { access_token: fakeJwt("tenant-join"), expires_in: 300 });
    const deps = attendedDeps(c);
    loginEndpointRequestLog.length = 0;
    const outcome = (await runAttendedLogin(deps, null)) as LoginOutcome;
    expect(outcome.kind).toBe("success");

    const cred = readCredential({ configDir: deps.configDir });
    expect(cred).not.toBeNull();
    const tDeps: TunnelHttpDeps = {
      serverUrl: c.serverUrl,
      accessToken: (cred as EnrollmentCredential).accessToken,
      fetch: makeFetch(c),
      now: () => c.simNow,
      discoveryCache: new Map(),
    };
    const tunnel = await createTunnel(
      { sessionId: "sess-1", sessionName: "tty", cwd: "/tmp", hostMetadata: { os: "linux" } },
      tDeps
    );
    expect(tunnel.tunnelId).toBe("t1");
    expect(tunnel.url).toContain("wss://");
    rmSync(deps.configDir, { recursive: true, force: true });
  });
});

describe("EV-16 openUrl contract", () => {
  const OPENING = "Opening your browser to enroll this host with";
  const FALLBACK = "If the browser does not open, visit:";
  const WAITING = "Waiting for browser…";
  const FIXED_ROW =
    "Could not open a browser — on a remote machine run /rc:login --headless. No credentials were saved.";

  test("openUrl resolves false → exact fixed row, no fallback, no waiting, failure outcome, no credential", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const deps = attendedDeps(c, {}, { openUrl: async () => false });
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    expect(result).toEqual({ kind: "failure", reason: "browserOpenFailed" });
    // The opening line still prints (an opener IS present); the attempt fails.
    expect(logs.some((l) => l.includes(OPENING))).toBe(true);
    // The failure row is the settled Phase-1-fixed text, verbatim.
    expect(logs.some((l) => l === FIXED_ROW)).toBe(true);
    // No fallback URL and no waiting line — the finally closes the loopback
    // server and discards verifier/state, so the pasted URL would be dead.
    expect(logs.some((l) => l.includes(FALLBACK))).toBe(false);
    expect(logs.some((l) => l.includes(WAITING))).toBe(false);
    expect(readCredential({ configDir: deps.configDir })).toBeNull();
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("openUrl rejects → same failure branch (rejection collapses to false)", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const deps = attendedDeps(c, {}, {
      openUrl: async () => {
        throw new Error("no browser");
      },
    });
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    expect(result).toEqual({ kind: "failure", reason: "browserOpenFailed" });
    expect(logs.some((l) => l === FIXED_ROW)).toBe(true);
    expect(logs.some((l) => l.includes(FALLBACK))).toBe(false);
    expect(logs.some((l) => l.includes(WAITING))).toBe(false);
    expect(readCredential({ configDir: deps.configDir })).toBeNull();
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("absent openUrl → fallback + waiting, NO opening line, no browserOpenFailed row (proceeds)", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const deps = attendedDeps(c, {}, { redirectTimeoutMs: 50 });
    delete (deps as Partial<LoginDeps>).openUrl;
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    // Without an opener the wait times out — NOT browserOpenFailed (absence
    // must not route to failure, or every production attended login would
    // print the --headless remedy).
    expect(result).toEqual({ kind: "failure", reason: "redirectTimeout" });
    expect(logs.some((l) => l.includes(OPENING))).toBe(false);
    expect(logs.some((l) => l.includes(FALLBACK))).toBe(true);
    expect(logs.some((l) => l.includes(WAITING))).toBe(true);
    expect(logs.some((l) => l.includes("Could not open a browser"))).toBe(false);
    expect(readCredential({ configDir: deps.configDir })).toBeNull();
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("success path with an opener: opening → attempt → fallback → waiting (reorder, byte-identical lines)", async () => {
    const c = makeControl({}, { access_token: fakeJwt("tenant-1"), expires_in: 300 });
    const deps = attendedDeps(c);
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    expect((result as LoginOutcome).kind).toBe("success");
    expect(logs.length).toBe(4);
    expect(logs[0]!.includes(OPENING)).toBe(true);
    expect(logs[1]!.includes(FALLBACK)).toBe(true);
    expect(logs[2]).toBe(WAITING);
    expect(logs[3]!.includes("Signed in to")).toBe(true);
    rmSync(deps.configDir, { recursive: true, force: true });
  });
});

describe("EV-7 headless flow", () => {
  test("happy path: relay block + poll → success, credential saved", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), refresh_token: "r1", expires_in: 300 });
    const configDir = tempConfigDir();
    const deps: LoginDeps = {
      serverUrl: c.serverUrl,
      configDir,
      fetch: makeFetch(c),
      now: () => c.simNow,
      randomBytes: () => FIXED_BYTES,
      sha256: async (i: Uint8Array) => new Uint8Array(new Uint8Array(32).fill(1)),
      sleep: async () => {},
    };
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    expect(logs.some((l) => l.includes("ABC-DEF"))).toBe(true); // user_code carried
    expect(logs.some((l) => l.includes("https://cp.example/verify/xyz"))).toBe(true);
    expect(readCredential({ configDir })).not.toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });

  test("test 7 (device-endpoint optional): attended works without it; headless maps it to discoveryInvalid (≠ unreachable)", async () => {
    // Attended: discovery without device_authorization_endpoint still succeeds.
    const c = makeControl(
      { discovery: { authorization_endpoint: "https://cp.example/auth", token_endpoint: "https://cp.example/oauth/token" } },
      { access_token: fakeJwt("t"), expires_in: 300 }
    );
    const deps = attendedDeps(c);
    loginEndpointRequestLog.length = 0;
    const attended = (await runAttendedLogin(deps, null)) as LoginOutcome;
    expect(attended.kind).toBe("success");
    rmSync(deps.configDir, { recursive: true, force: true });

    // Headless: missing device endpoint → discoveryInvalid, distinct from unreachable.
    const c2 = makeControl({
      discovery: { authorization_endpoint: "https://cp.example/auth", token_endpoint: "https://cp.example/oauth/token" },
    });
    const configDir = tempConfigDir();
    const deps2: LoginDeps = {
      serverUrl: c2.serverUrl,
      configDir,
      fetch: makeFetch(c2),
      now: () => c2.simNow,
    };
    loginEndpointRequestLog.length = 0;
    const headless = (await runHeadlessLogin(deps2)) as LoginOutcome;
    expect(headless.kind).toBe("failure");
    if (headless.kind === "failure") expect(headless.reason).toBe("discoveryInvalid");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("test 9: bounded poll emits <=3 progress prints over a simulated 5-min poll", async () => {
    const c = makeControl({}, {});
    c.simNow = 0;
    c.onToken = (ctl: Control) =>
      ctl.simNow >= 290 * 1000
        ? { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } }
        : { status: 400, body: { error: "authorization_pending" } };
    const configDir = tempConfigDir();
    const deps: LoginDeps = {
      serverUrl: c.serverUrl,
      configDir,
      fetch: makeFetch(c),
      now: () => c.simNow,
      sleep: async (ms: number) => {
        c.simNow += ms;
      },
    };
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    const progress = logs.filter((l) => l.includes("s left — keep waiting"));
    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(progress.length).toBeLessThanOrEqual(3);
    expect(progress.some((l) => l.includes("150s left"))).toBe(true); // half at expires_in/2
    rmSync(configDir, { recursive: true, force: true });
  });
});

describe("FLLWUP-22: RFC 8628 poll error shape (400 window)", () => {
  /** Non-JSON body simulation: `resp` builds `json: async () => body`, so a
   * rejected-Promise body makes `await res.json()` reject at the json() seam.
   * The handler is attached eagerly so the rejection is unhandled only if the
   * poll loop actually awaits the body — matching a real non-JSON response. */
  function nonJsonBody(): unknown {
    const p = Promise.reject(new SyntaxError("Unexpected token 'n' — not valid JSON"));
    p.catch(() => {});
    return p;
  }

  function headlessDeps(
    c: Control,
    configDir: string,
    sleep: LoginDeps["sleep"] = async () => {},
  ): LoginDeps {
    return { serverUrl: c.serverUrl, configDir, fetch: makeFetch(c), now: () => c.simNow, sleep };
  }

  test("400 slow_down → continue with interval increased by 5000ms (sleep seam: 2000 then 7000)", async () => {
    const c = makeControl({}, {});
    let calls = 0;
    c.onToken = () =>
      ++calls === 1
        ? { status: 400, body: { error: "slow_down" } }
        : { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } };
    const configDir = tempConfigDir();
    const sleeps: number[] = [];
    const deps = headlessDeps(c, configDir, async (ms: number) => {
      sleeps.push(ms);
      c.simNow += ms;
    });
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    expect(sleeps).toEqual([2000, 7000]); // deviceBody interval:2 → 2000ms; +5000 → 7000ms
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 expired_token → expiredCode, expire tail printed once, no credential", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: { error: "expired_token" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("expiredCode");
    // "The code expires in …" renders at flow start AND in the expired tail — tail exactly once.
    expect(logs.filter((l) => l.includes("The code expires in")).length).toBe(2);
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 access_denied → deviceDenied, no credential", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: { error: "access_denied" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("deviceDenied");
    expect(logs.some((l) => l.includes("Device authorization was denied"))).toBe(true);
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 unknown error code → tokenExchangeFailed", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: { error: "some_other_error" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    expect(logs.some((l) => l.includes("Token exchange failed"))).toBe(true);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 {} (absent error) → tokenExchangeFailed", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: {} });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("500 + {error:access_denied} → tokenExchangeFailed, NOT deviceDenied (anti-false-denial)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 500, body: { error: "access_denied" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    expect(logs.some((l) => l.includes("Device authorization was denied"))).toBe(false);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("500 + {error:authorization_pending} → tokenExchangeFailed, NOT continue (anti-silent-continue)", async () => {
    const c = makeControl({}, {});
    let calls = 0;
    c.onToken = () =>
      ++calls === 1
        ? { status: 500, body: { error: "authorization_pending" } }
        : { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } };
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    // If the 500 error body were wrongly honored as "continue", poll #2 would
    // return success and the outcome would be "success", not this failure.
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    const tokenPosts = loginEndpointRequestLog.filter(
      (e) => (e as { url: string }).url === c.tokenEndpoint,
    );
    expect(tokenPosts.length).toBe(1); // no second poll issued
    rmSync(configDir, { recursive: true, force: true });
  });

  test("500 with non-JSON body → tokenExchangeFailed (not a throw)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 500, body: nonJsonBody() });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 with non-JSON body → tokenExchangeFailed (pins the .catch on the now-live 400 parse path)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: nonJsonBody() });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("200 + authorization_pending still polls (tolerated-legacy pin)", async () => {
    const c = makeControl({}, {});
    let calls = 0;
    c.onToken = () =>
      ++calls === 1
        ? { status: 200, body: { error: "authorization_pending" } }
        : { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } };
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("200 + {error:access_denied, access_token:valid} → deviceDenied, credential never saved (error-wins honesty pin)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({
      status: 200,
      body: { error: "access_denied", access_token: fakeJwt("t"), expires_in: 300 },
    });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("deviceDenied");
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });
});

describe("FLLWUP-24: RFC 8628 §3.5 connection-failure slowdown + cause-distinguished expiry (PO ruling 1)", () => {
  /** A fetch that simulates a connection-level failure (fetch throw) when a
   * predicate matches, delegating to the control's normal fetch otherwise. */
  function fetchWithThrow(
    c: Control,
    throwWhen: (url: string, method: string) => boolean
  ): LoginDeps["fetch"] {
    const inner = makeFetch(c);
    return (async (input: string | URL | { url: string }, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (throwWhen(url, method)) {
        throw new TypeError("fetch failed: connection reset");
      }
      return inner(url, init);
    }) as unknown as LoginDeps["fetch"];
  }

  test("connection failure on token poll → sleep 5000ms, re-poll, succeed (no terminal unreachable)", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    let tokenThrows = 1; // only the first token poll throws
    const configDir = tempConfigDir();
    const sleeps: number[] = [];
    const deps: LoginDeps = {
      serverUrl: c.serverUrl,
      configDir,
      fetch: fetchWithThrow(
        c,
        (url, method) => url === c.tokenEndpoint && method === "POST" && tokenThrows-- > 0
      ),
      now: () => c.simNow,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        c.simNow += ms;
      },
    };
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    // interval poll (deviceBody interval:2 → 2000ms), then one 5000ms slowdown
    // retry per connection failure, then the successful interval poll.
    expect(sleeps).toEqual([2000, 5000, 2000]);
    // Retry is silent: the unreachable copy must not print on the retry path.
    expect(logs.some((l) => l.includes("Cannot reach"))).toBe(false);
    expect(readCredential({ configDir })).not.toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });

  test("all-connection-failure window → unreachable at expiry (PO ruling 1: the token endpoint was never reached), silent retries at interval+5s gaps", async () => {
    const base = makeControl();
    const c = makeControl(
      { deviceBody: { ...(base.deviceBody as Record<string, unknown>), expires_in: 10 } },
      {}
    );
    const configDir = tempConfigDir();
    const sleeps: number[] = [];
    const deps: LoginDeps = {
      serverUrl: c.serverUrl,
      configDir,
      fetch: fetchWithThrow(c, (url, method) => url === c.tokenEndpoint && method === "POST"),
      now: () => c.simNow,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        c.simNow += ms;
      },
    };
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    // PO ruling 1: no poll in the window ever received an HTTP response, so
    // expiry lands `unreachable` (existing verbatim copy), not `timedOut`.
    if (o.kind === "failure") expect(o.reason).toBe("unreachable");
    // Two in-window retry rounds (2s interval + 5s slowdown, twice), then the
    // second slowdown sleep crosses the 10s window → loop-top expiry fires
    // before any third poll.
    expect(sleeps).toEqual([2000, 5000, 2000, 5000]);
    // Retries are silent: the unreachable copy prints only once, at expiry.
    expect(logs.filter((l) => l.includes("Cannot reach")).length).toBe(1);
    expect(logs.some((l) => l.includes("Sign-in timed out"))).toBe(false);
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });

  test("mixed window (≥1 received response, then expiry) → timedOut (PO ruling 1: the server answered at least once)", async () => {
    const base = makeControl();
    const c = makeControl({
      deviceBody: { ...(base.deviceBody as Record<string, unknown>), expires_in: 10 },
      // After the throw, the server answers every poll with the normative
      // 400 authorization_pending — a received HTTP response, any status.
      onToken: () => ({ status: 400, body: { error: "authorization_pending" } }),
    });
    const configDir = tempConfigDir();
    const sleeps: number[] = [];
    let tokenCalls = 0;
    const deps: LoginDeps = {
      serverUrl: c.serverUrl,
      configDir,
      fetch: fetchWithThrow(c, (url, method) => {
        if (url !== c.tokenEndpoint || method !== "POST") return false;
        // First poll throws (connection level); every later poll gets a
        // 400 authorization_pending response — the server was reached.
        return ++tokenCalls === 1;
      }),
      now: () => c.simNow,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        c.simNow += ms;
      },
    };
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("timedOut");
    // throw→5s→answered polls at interval; the loop-top expiry check fires
    // after the last poll (simNow 11s ≥ 10s) with no trailing interval sleep.
    expect(sleeps).toEqual([2000, 5000, 2000, 2000]);
    expect(logs.some((l) => l.includes("Sign-in timed out"))).toBe(true);
    expect(logs.some((l) => l.includes("Cannot reach"))).toBe(false);
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });
});

describe("FLLWUP-28: cancellation during the RFC 8628 §3.5 slowdown sleep is honored", () => {
  /** Self-contained connection-failure fetch (same shape as the FLLWUP-24
   * block's helper, but local to this block so it exists wherever this block
   * exists): throws at the connection level when a predicate matches,
   * delegating to the control's normal fetch otherwise. */
  function throwOnPoll(c: Control): LoginDeps["fetch"] {
    const inner = makeFetch(c);
    return (async (input: string | URL | { url: string }, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (url === c.tokenEndpoint && method === "POST") {
        throw new TypeError("fetch failed: connection reset");
      }
      return inner(url, init);
    }) as unknown as LoginDeps["fetch"];
  }

  test("cancel flag set inside the 5000ms slowdown sleep → cancelled, no failure copy, no further token poll", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const configDir = tempConfigDir();
    const ctl = { cancelled: false };
    const sleeps: number[] = [];
    const deps: LoginDeps = {
      serverUrl: c.serverUrl,
      configDir,
      fetch: throwOnPoll(c),
      now: () => c.simNow,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        c.simNow += ms;
        if (ms === 5000) ctl.cancelled = true;
      },
    };
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(deps, ctl));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("cancelled");
    // interval poll (deviceBody interval:2 → 2000ms), then the slowdown sleep
    // whose await is interrupted by the cancel — no trailing interval sleep,
    // i.e. the loop never started another poll round.
    expect(sleeps).toEqual([2000, 5000]);
    // No token poll issued after the cancel signal: the module-level endpoint
    // request log carries exactly one token-endpoint POST — the one that
    // threw, before the slowdown. `makeFetch` logs discovery/device/tunnel
    // requests too, so count by URL.
    expect(
      loginEndpointRequestLog.filter((e) => (e as { url: string }).url === c.tokenEndpoint)
    ).toHaveLength(1);
    // Silent path: no failure copy of any kind — neither the connection
    // failure copy nor the expiry copy.
    expect(logs.some((l) => l.includes("Cannot reach"))).toBe(false);
    expect(logs.some((l) => l.includes("Sign-in timed out"))).toBe(false);
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });
});

describe("EV-7 J2 cancellation + replacement prompt (facade)", () => {
  test("test 10: attended pre-seeded → replacement prompt renders before any endpoint request (request log empty at confirm)", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const configDir = tempConfigDir();
    saveCredential(
      { serverUrl: c.serverUrl, accessToken: "old", refreshToken: "old-rt", tokenExpiry: 1, tenantId: "ten" },
      { configDir }
    );
    let logAtConfirm: unknown[] = [];
    let confirmedCalls = 0;
    const command = createLoginCommand({
      serverUrl: c.serverUrl,
      configDir,
      fetch: makeFetch(c),
      now: () => c.simNow,
      randomBytes: () => FIXED_BYTES,
      sha256: async (i: Uint8Array) => new Uint8Array(new Uint8Array(32).fill(9)),
      openUrl: async (url: string) => {
        const u = new URL(url);
        await fetch(`${u.searchParams.get("redirect_uri")}?code=C1&state=${u.searchParams.get("state")}`).catch(() => {});
        return true;
      },
      confirmReplacement: async () => {
        logAtConfirm = [...loginEndpointRequestLog];
        confirmedCalls += 1;
        return true; // Enter
      },
    });
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => command.run("attended"));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    expect(confirmedCalls).toBe(1);
    // No request to authorization/token/device endpoints before the prompt confirmed.
    expect(logAtConfirm.length).toBe(0);
    // The prompt was rendered.
    expect(logs.some((l) => l.includes("already enrolled"))).toBe(true);
    // After confirmation, a token-exchange request exists in the log.
    expect(loginEndpointRequestLog.some((e) => (e as { url: string }).url === c.tokenEndpoint)).toBe(true);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("test 10 (headless exempt): pre-seeded headless run performs no replacement prompt and proceeds", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const configDir = tempConfigDir();
    saveCredential(
      { serverUrl: c.serverUrl, accessToken: "old", refreshToken: "old-rt", tokenExpiry: 1 },
      { configDir }
    );
    let confirmedCalls = 0;
    const command = createLoginCommand({
      serverUrl: c.serverUrl,
      configDir,
      fetch: makeFetch(c),
      now: () => c.simNow,
      sleep: async () => {},
      confirmReplacement: async () => {
        confirmedCalls += 1;
        return true;
      },
    });
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => command.run("headless"));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    expect(confirmedCalls).toBe(0); // headless exemption — no prompt
    expect(logs.some((l) => l.includes("already enrolled"))).toBe(false);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("test 11 (Ctrl-C): cancel during a live flow renders login.cancelled once, zero POSTs after the signal", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: { error: "authorization_pending" } });
    const configDir = tempConfigDir();
    let cancelled = false;
    const command = createLoginCommand({
      serverUrl: c.serverUrl,
      configDir,
      fetch: makeFetch(c),
      now: () => c.simNow,
      sleep: async () => {
        if (!cancelled) {
          cancelled = true;
          command.cancel(); // SIGINT arrives during the first poll sleep
        }
      },
    });
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => command.run("headless"));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("cancelled");
    const cancelLines = logs.filter((l) => l.includes("Sign-in cancelled"));
    expect(cancelLines.length).toBe(1); // rendered exactly once
    // Only the device-auth POST happened; no token-endpoint POST after the signal.
    const devicePosts = loginEndpointRequestLog.filter(
      (e) => (e as { url: string }).url === c.deviceEndpoint
    );
    const tokenPosts = loginEndpointRequestLog.filter(
      (e) => (e as { url: string }).url === c.tokenEndpoint
    );
    expect(devicePosts.length).toBe(1);
    expect(tokenPosts.length).toBe(0);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("test 10/11: replacement prompt 'decline' aborts silently preserving the existing credential", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const configDir = tempConfigDir();
    const existing: EnrollmentCredential = {
      serverUrl: c.serverUrl,
      accessToken: "keep-me",
      refreshToken: "keep-rt",
      tokenExpiry: 1,
    };
    saveCredential(existing, { configDir });
    loginEndpointRequestLog.length = 0;
    const command = createLoginCommand({
      serverUrl: c.serverUrl,
      configDir,
      fetch: makeFetch(c),
      confirmReplacement: async () => false, // Ctrl-C / decline
    });
    const { result, logs } = await captureLog(() => command.run("attended"));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("cancelled");
    // J2: replacement-prompt Ctrl-C aborts SILENTLY — no cancelled/failure line.
    expect(logs.some((l) => l.includes("Sign-in cancelled"))).toBe(false);
    // Existing credential preserved, untouched.
    expect(readCredential({ configDir })).toEqual(existing);
    // No endpoint requests were issued.
    expect(loginEndpointRequestLog.length).toBe(0);
    rmSync(configDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// FLLWUP-25 — device-flow error_description (PO ruling
// vault/raw/2026-09-02-po-fllwup-25-error-description.md)
// ---------------------------------------------------------------------------

describe("FLLWUP-25: error_description sanitizer + copy key", () => {
  test("strips C0 (U+0000–U+001F) and DEL/C1 (U+007F–U+009F): no escape sequence can form", () => {
    const hostile = `be\x1b[31mwarned\x1b[0m\u009b31m plain`;
    expect(sanitizeErrorDescription(hostile)).toBe("be[31mwarned[0m31m plain");
  });

  test("collapses whitespace runs (incl. \\n, \\r\\n, \\t) to single spaces and trims", () => {
    expect(sanitizeErrorDescription("  scope \n\n main \t app \r\n revoked  ")).toBe(
      "scope main app revoked"
    );
    // Ruled ORDER (PO ruling 3): step 1 strips C0 — LF/CR/tab are deleted,
    // not converted to spaces — then step 2 collapses surviving whitespace.
    // A newline between non-space characters therefore fuses the words;
    // only whitespace that survives step 1 is collapsed.
    expect(sanitizeErrorDescription("ab\ncd")).toBe("abcd");
    // Stripped newlines/tabs must not leave double spaces (ruling 3.2):
    expect(sanitizeErrorDescription("a \n\n b")).toBe("a b");
  });

  test("caps at 200 code points + '...' without splitting surrogate pairs", () => {
    // 250 astral chars = 250 code points → first 200 kept, then "...".
    const astral = "𝛼".repeat(250);
    const out = sanitizeErrorDescription(astral)!;
    expect([...out].length).toBe(203); // 200 code points + 3 dots
    expect(out.endsWith("...")).toBe(true);
    // Every kept element is the whole astral char — no lone surrogate.
    expect([...out].every((ch) => ch === "𝛼" || ch === ".")).toBe(true);
    // Under the cap, astral content passes through untruncated and unsplit.
    expect(sanitizeErrorDescription("𝛼".repeat(150))).toBe("𝛼".repeat(150));
    // Cap boundary lands ON an astral char (index 199 in code points): the
    // char straddles the 200-UTF-16-unit mark but must be kept whole. A
    // UTF-16-unit slicer would emit a lone leading surrogate instead.
    const out2 = sanitizeErrorDescription("a".repeat(199) + "𝛼tail")!;
    expect([...out2].length).toBe(203); // 199 a's + 𝛼 + "..."
    expect(out2).toBe("a".repeat(199) + "𝛼" + "...");
  });

  test("returns undefined for missing, null, non-string, and whitespace-only inputs", () => {
    expect(sanitizeErrorDescription(undefined)).toBeUndefined();
    expect(sanitizeErrorDescription(null)).toBeUndefined();
    expect(sanitizeErrorDescription(42)).toBeUndefined();
    expect(sanitizeErrorDescription({ error: "x" })).toBeUndefined();
    expect(sanitizeErrorDescription("   \n\t ")).toBeUndefined();
    expect(sanitizeErrorDescription("")).toBeUndefined();
  });

  test("copy vocabulary: login.failure.detail resolves through loginEnglishFor with the ruled string", () => {
    expect(loginEnglishFor("login.failure.detail")).toBe(
      "Details from the server: `<errorDescription>`"
    );
  });
});

describe("FLLWUP-25: headless poll dispatch surfaces error_description", () => {
  const RULED = "Token exchange failed — run /rc:login to retry. No credentials were saved.";
  const DETAIL_PREFIX = "Details from the server:";

  function failingHeadlessDeps(
    c: Control,
    configDir: string,
    onToken: Control["onToken"]
  ): LoginDeps {
    c.onToken = onToken;
    return {
      serverUrl: c.serverUrl,
      configDir,
      fetch: makeFetch(c),
      now: () => c.simNow,
      sleep: async () => {},
    };
  }

  test("400 unknown error + error_description → ruled line, then one detail line", async () => {
    const c = makeControl({}, {});
    const configDir = tempConfigDir();
    const { result, logs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(c, configDir, () => ({
          status: 400,
          body: {
            error: "some_other_error",
            // ESC + CSI stripped to inert brackets; the newline sits next to a
            // space so step 2 collapses it away (one terminal line, no fusion).
            error_description: "Scope \u001b[31mmain\u001b[0m  denied \n by the admin",
          },
        }))
      )
    );
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    const idx = logs.indexOf(RULED);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(logs[idx + 1]).toBe("Details from the server: `Scope [31mmain[0m denied by the admin`");
    expect(logs.filter((l) => l.startsWith(DETAIL_PREFIX))).toHaveLength(1);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("no error_description → ruled line only, byte-identical (no detail line)", async () => {
    const c = makeControl({}, {});
    const configDir = tempConfigDir();
    const { logs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(c, configDir, () => ({
          status: 400,
          body: { error: "some_other_error" },
        }))
      )
    );
    expect(logs).toContain(RULED);
    expect(logs.some((l) => l.startsWith(DETAIL_PREFIX))).toBe(false);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("error_description null / non-string / whitespace-only → ruled line only", async () => {
    for (const desc of [null, 42, "  \n\t ", { text: "x" }]) {
      const c = makeControl({}, {});
      const configDir = tempConfigDir();
      const { logs } = await captureLog(() =>
        runHeadlessLogin(
          failingHeadlessDeps(c, configDir, () => ({
            status: 400,
            body: { error: "some_other_error", error_description: desc },
          }))
        )
      );
      expect(logs).toContain(RULED);
      expect(logs.some((l) => l.startsWith(DETAIL_PREFIX))).toBe(false);
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  test("boundary: deviceDenied / expiredCode / invalidTokenResponse never emit a detail line", async () => {
    // deviceDenied: 400 access_denied with a description in the body.
    const cd = makeControl({}, {});
    const dd = tempConfigDir();
    const { logs: deniedLogs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(cd, dd, () => ({
          status: 400,
          body: { error: "access_denied", error_description: "the user said no" },
        }))
      )
    );
    expect(deniedLogs.some((l) => l.includes("Device authorization was denied"))).toBe(true);
    expect(deniedLogs.some((l) => l.startsWith(DETAIL_PREFIX))).toBe(false);
    rmSync(dd, { recursive: true, force: true });

    // expiredCode: 400 expired_token with a description.
    const ce = makeControl({}, {});
    const ed = tempConfigDir();
    const { logs: expiredLogs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(ce, ed, () => ({
          status: 400,
          body: { error: "expired_token", error_description: "the code expired" },
        }))
      )
    );
    expect(expiredLogs.some((l) => l.includes("The enrollment code expired"))).toBe(true);
    expect(expiredLogs.some((l) => l.startsWith(DETAIL_PREFIX))).toBe(false);
    rmSync(ed, { recursive: true, force: true });

    // invalidTokenResponse: 2xx, no error field, access_token not a string.
    const ci = makeControl({}, {});
    const id = tempConfigDir();
    const { logs: invalidLogs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(ci, id, () => ({
          status: 200,
          body: { error_description: "trust me this is fine" },
        }))
      )
    );
    expect(invalidLogs.some((l) => l.includes("returned an invalid OAuth2 response"))).toBe(true);
    expect(invalidLogs.some((l) => l.startsWith(DETAIL_PREFIX))).toBe(false);
    rmSync(id, { recursive: true, force: true });
  });

  test("hostile: >200-code-point description truncates to 200 cps + '...' on one line", async () => {
    const c = makeControl({}, {});
    const configDir = tempConfigDir();
    const long = "x".repeat(250) + "\n" + "y".repeat(50);
    const { logs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(c, configDir, () => ({
          status: 400,
          body: { error: "some_other_error", error_description: long },
        }))
      )
    );
    const detail = logs.find((l) => l.startsWith(DETAIL_PREFIX));
    expect(detail).toBeDefined();
    expect(detail!.includes("\n")).toBe(false);
    // The sanitized payload between the backticks: exactly 200 code points +
    // "..." — 300 x/y characters (LF stripped) capped at the first 200,
    // which are all x's (250 x's precede the 50 y's).
    const inner = detail!.slice(detail!.indexOf("`") + 1, detail!.lastIndexOf("`"));
    expect(inner).toBe("x".repeat(200) + "...");
    rmSync(configDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// FLLWUP-29: attended-path boundary pair (test-only pin — no product change)
// ---------------------------------------------------------------------------

describe("FLLWUP-29: attended PKCE tokenExchangeFailed never emits the error_description detail line (boundary pair)", () => {
  const RULED = "Token exchange failed — run /rc:login to retry. No credentials were saved.";
  const DETAIL_PREFIX = "Details from the server:";
  const DESCRIPTION = "enrollment rejected by the admin";

  /** Minimal fetch over base helpers: discovery, device POST, token POST via onToken. */
  function pairFetch(c: Control): LoginDeps["fetch"] {
    return (async (input: string | URL | { url: string }, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (url.includes("/.well-known/oauth-authorization-server")) return resp(200, c.discovery);
      if (url === c.tokenEndpoint && method === "POST") {
        const out = c.onToken(c);
        return resp(out.status, out.body);
      }
      if (c.deviceEndpoint && url === c.deviceEndpoint && method === "POST") {
        return resp(200, c.deviceBody);
      }
      return resp(404, {});
    }) as unknown as LoginDeps["fetch"];
  }

  test("(a) attended (PKCE): 400 + error_description on the token body → ruled line, NO detail line", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({
      status: 400,
      body: { error: "some_other_error", error_description: DESCRIPTION },
    });
    const deps = attendedDeps(c);
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    expect(logs).toContain(RULED);
    expect(logs.some((l) => l.startsWith(DETAIL_PREFIX))).toBe(false);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("(b) positive control: headless with the same onToken shape DOES print the detail line", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({
      status: 400,
      body: { error: "some_other_error", error_description: DESCRIPTION },
    });
    const configDir = tempConfigDir();
    const { logs } = await captureLog(() =>
      runHeadlessLogin({
        serverUrl: c.serverUrl,
        configDir,
        fetch: pairFetch(c),
        now: () => c.simNow,
        sleep: async () => {},
      })
    );
    expect(logs).toContain(RULED);
    expect(logs).toContain(`Details from the server: \`${DESCRIPTION}\``);
    rmSync(configDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// EV-15 T13 — the noServerUrl removal is total: zero references in src/
// ---------------------------------------------------------------------------
describe("EV-15: noServerUrl / rc.serverUrlRequired removal", () => {
  test("grep proves zero noServerUrl/serverUrlRequired references in src/", () => {
    const { readdirSync, readFileSync, statSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const srcDir = join(import.meta.dir, "..", "src");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith(".ts")) {
          const text = readFileSync(p, "utf8");
          if (/noServerUrl|serverUrlRequired/.test(text)) offenders.push(p);
        }
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// EV-17 — attended cancel affordance (docs/superpowers/specs/2026-09-25-EV-17-design.md)
// ---------------------------------------------------------------------------
describe("EV-17: attended cancel affordance", () => {
  const CANCEL_LINE = "Sign-in cancelled — no credentials were saved.";
  const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  /** Deps that park the attended wait: no callback inbound, small timeout. */
  function parkedDeps(
    c: Control,
    extras: Partial<LoginDeps> = {}
  ): LoginDeps & { configDir: string } {
    return attendedDeps(c, { skipCallback: true }, { redirectTimeoutMs: 2000, ...extras });
  }

  test("A1 (raw driver): cancel gate resolving true → cancelled, no endpoint traffic, no credential", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const deps = parkedDeps(c, { waitForCancel: async () => true });
    loginEndpointRequestLog.length = 0;
    const start = Date.now();
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    const elapsed = Date.now() - start;
    const o = result as LoginOutcome;
    expect(o).toEqual({ kind: "cancelled" });
    // A2/A3: an interrupt, not a reason-flip at timer fire — elapsed strictly
    // below the injected redirectTimeoutMs.
    expect(elapsed).toBeLessThan(2000);
    // The driver NEVER prints the cancel line — the print lives in the facade
    // (asserted print-once through the facade in the next test).
    expect(logs.filter((l) => l === CANCEL_LINE)).toHaveLength(0);
    // Zero token-endpoint or device-endpoint requests after the signal.
    expect(
      loginEndpointRequestLog.filter((e) => {
        const url = (e as { url: string }).url;
        return url === c.tokenEndpoint || url === c.deviceEndpoint;
      })
    ).toHaveLength(0);
    expect(readCredential({ configDir: deps.configDir })).toBeNull();
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("A1 (facade): the cancel line is printed exactly once by the facade", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const deps = parkedDeps(c, { waitForCancel: async () => true });
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => createLoginCommand(deps).run("attended"));
    expect(result).toEqual({ kind: "cancelled" });
    expect(logs.filter((l) => l === CANCEL_LINE)).toHaveLength(1);
    expect(readCredential({ configDir: deps.configDir })).toBeNull();
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("A5: the dead callback-cancelled branch is reachable and does NOT set ctl.cancelled", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    const ctl = { cancelled: false };
    const deps = parkedDeps(c, { waitForCancel: async () => true });
    const { result } = await captureLog(() => runAttendedLogin(deps, null, ctl));
    expect(result).toEqual({ kind: "cancelled" });
    // Confirm-cancel settles { type: "cancelled" } via the callback branch —
    // an implementation that sets the flag on this path fails here (O-5).
    expect(ctl.cancelled).toBe(false);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("rejection re-arms: reject once, then resolve true → cancelled, dep invoked twice", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    let calls = 0;
    const gate = async (): Promise<boolean> => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return true;
    };
    const deps = parkedDeps(c, { waitForCancel: gate });
    const { result } = await captureLog(() => runAttendedLogin(deps, null));
    expect(result).toEqual({ kind: "cancelled" });
    expect(calls).toBe(2);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("finisher totality — server-callback win: one settle, signal aborted, no re-arm after the win", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    let calls = 0;
    let seen: AbortSignal | undefined;
    const gate = async (signal: AbortSignal): Promise<boolean> => {
      seen = signal;
      calls += 1;
      await tick(10);
      return false;
    };
    const deps = attendedDeps(c, {}, { redirectTimeoutMs: 5000, waitForCancel: gate });
    const { result } = await captureLog(() => runAttendedLogin(deps, null));
    expect(result).toEqual({ kind: "success" });
    // The callback win aborted the signal (dialog dismissed) ...
    expect(seen?.aborted).toBe(true);
    // ... and the re-arm loop stopped: the dep call count is frozen.
    const frozen = calls;
    await tick(30);
    expect(calls).toBe(frozen);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("finisher totality — timer fire: one settle, signal aborted, no re-arm after the win", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    let calls = 0;
    let seen: AbortSignal | undefined;
    const gate = async (signal: AbortSignal): Promise<boolean> => {
      seen = signal;
      calls += 1;
      await tick(10);
      return false;
    };
    const deps = parkedDeps(c, { redirectTimeoutMs: 100, waitForCancel: gate });
    const { result } = await captureLog(() => runAttendedLogin(deps, null));
    expect(result).toEqual({ kind: "failure", reason: "redirectTimeout" });
    expect(seen?.aborted).toBe(true);
    const frozen = calls;
    await tick(30);
    expect(calls).toBe(frozen);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("finisher totality — confirm-true: exactly one settle, one dep invocation, signal aborted", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    let calls = 0;
    let seen: AbortSignal | undefined;
    const gate = async (signal: AbortSignal): Promise<boolean> => {
      seen = signal;
      calls += 1;
      return true;
    };
    const deps = parkedDeps(c, { waitForCancel: gate });
    const { result } = await captureLog(() => runAttendedLogin(deps, null));
    expect(result).toEqual({ kind: "cancelled" });
    expect(calls).toBe(1);
    expect(seen?.aborted).toBe(true);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("no spin on abort: gate resolving false forever, cancel() wakes → count frozen, cancelled", async () => {
    const c = makeControl({}, { access_token: fakeJwt("t"), expires_in: 300 });
    let calls = 0;
    let seen: AbortSignal | undefined;
    const gate = async (signal: AbortSignal): Promise<boolean> => {
      seen = signal;
      calls += 1;
      await tick(10);
      return false;
    };
    const deps = parkedDeps(c, { waitForCancel: gate });
    loginEndpointRequestLog.length = 0;
    const start = Date.now();
    const cmd = createLoginCommand(deps);
    setTimeout(() => cmd.cancel(), 50);
    const { result } = await captureLog(() => cmd.run("attended"));
    const elapsed = Date.now() - start;
    expect(result).toEqual({ kind: "cancelled" });
    expect(elapsed).toBeLessThan(2000);
    expect(seen?.aborted).toBe(true);
    const frozen = calls;
    await tick(30);
    expect(calls).toBe(frozen);
    expect(
      loginEndpointRequestLog.filter((e) => {
        const url = (e as { url: string }).url;
        return url === c.tokenEndpoint || url === c.deviceEndpoint;
      })
    ).toHaveLength(0);
    rmSync(deps.configDir, { recursive: true, force: true });
  });
});
