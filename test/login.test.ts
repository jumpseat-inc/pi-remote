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
  "noServerUrl",
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
    expect(keys).toHaveLength(28);
    for (const k of keys) {
      const resolved = loginEnglishFor(k);
      expect(resolved).not.toBe(k); // resolves, not identity
      expect(resolved.length).toBeGreaterThan(0);
    }
    expect(loginEnglishFor("login.attended.success")).toBe(LOGIN_SUCCESS_COPY);
    expect(LOGIN_SUCCESS_COPY.length).toBeGreaterThan(0);
  });

  test("test 2: closed-set invariant — failure keys exactly the 13-row set; stable login. keys; per-row tail marker", () => {
    expect(Object.keys(loginReasonCopy).sort()).toEqual([...LOGIN_REASONS].sort());
    const tailMarker: Record<LoginReason, string | null> = {
      noServerUrl: "run /rc:login again.",
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
        : { status: 200, body: { error: "authorization_pending" } };
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
    c.onToken = () => ({ status: 200, body: { error: "authorization_pending" } });
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
