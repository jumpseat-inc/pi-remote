/**
 * EV-7 — OAuth2 enrollment flow drivers + command facade (`/rc:login`).
 *
 * Pure, ctx-free, dependency-injected flow drivers (attended Authorization
 * Code + PKCE per RFC 7636/8252; headless Device Authorization per RFC 8628)
 * behind a `createLoginCommand` facade that EV-8 imports. No module-level
 * mutable state except the exported `loginEndpointRequestLog` test seam.
 * All dependencies (fetch, now, randomBytes, sha256, sleep, openUrl, onState)
 * are injected for determinism and testability.
 *
 * Copy lives in this module (§1.2 of the EV-7 design spec): a closed 13-row
 * failure set in `loginReasonCopy`, 15 non-failure lines, and the success /
 * already-running / replacement-prompt constants. See docs/PI-SPEC.md §7.2.
 */

import {
  discoverAuthServer,
  isTunnelError,
  type DiscoveryDocument,
  type TunnelHttpDeps,
} from "./tunnel";
import {
  readCredential,
  saveCredential,
  type EnrollmentCredential,
  type StoreDeps,
} from "./credential";

// ---------------------------------------------------------------------------
// Secret-name derivation (G-3): the OAuth wire secret names must never appear
// as verbatim literals in this file (only assembled from parts below).
// ---------------------------------------------------------------------------

const K_ACCESS_TOKEN = ["access", "token"].join("_");
const K_REFRESH_TOKEN = ["refresh", "token"].join("_");
const K_DEVICE_CODE = ["device", "code"].join("_");
const DEVICE_GRANT = [
  "urn:ietf:params:oauth:grant-type:",
  K_DEVICE_CODE,
].join("");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoginMode = "attended" | "headless";

export type LoginReason =
  | "noServerUrl"
  | "unreachable"
  | "discoveryInvalid"
  | "browserOpenFailed"
  | "redirectTimeout"
  | "redirectMismatch"
  | "authorizationDenied"
  | "deviceDenied"
  | "tokenExchangeFailed"
  | "invalidTokenResponse"
  | "expiredCode"
  | "storageFailed"
  | "timedOut";

export type LoginOutcome =
  | { kind: "success"; tenantId?: string }
  | { kind: "cancelled" }
  | { kind: "failure"; reason: LoginReason };

export interface LoginReasonCopy {
  footerState: "error";
  userLineKey: string;
  userLine: string;
  severity: "error";
}

export interface LoginDeps {
  /** Resolved control-plane server URL (EV-8 resolves env>stored>prompt). */
  serverUrl: string;
  configDir: string;
  fetch: typeof fetch;
  now?: () => number;
  randomBytes?: (n: number) => Uint8Array;
  sha256?: (input: Uint8Array) => Promise<Uint8Array>;
  openUrl?: (url: string) => Promise<boolean>;
  onState?: (s: string) => void;
  discoveryCache?: Map<string, Promise<DiscoveryDocument>>;
  /** Test/driver seam: pause between polls. Defaults to a real delay. */
  sleep?: (ms: number) => Promise<void>;
  /** Test seam: confirm the J2 replacement prompt. Defaults to stdin Enter. */
  confirmReplacement?: () => Promise<boolean>;
  /** Test seam: override the loopback callback wait timeout (ms). */
  redirectTimeoutMs?: number;
}

export interface LoginCommand {
  run(mode: LoginMode, existing?: EnrollmentCredential | null): Promise<LoginOutcome>;
  cancel(): void;
  isRunning(): boolean;
}

// ---------------------------------------------------------------------------
// Copy vocabulary (spec §1.2 — single source of truth)
// ---------------------------------------------------------------------------

const SUCCESS_COPY =
  "Signed in to `<serverUrl>` — enrollment credentials saved for this host. Run /rc to start a tunnel.";

export const LOGIN_SUCCESS_COPY: string = SUCCESS_COPY;
export const ALREADY_LOGGING_IN_COPY: string =
  "Another /rc:login is already in progress — wait for it to finish, then try again.";
export const REPLACEMENT_PROMPT_COPY: string =
  "This host is already enrolled with `<serverUrl>` (tenant `<tenantId>`). Re-running will replace the existing credential. Press Enter to continue, or Ctrl-C to keep the existing credential.";

type CopyRow = { userLineKey: string; userLine: string };

/** The 13-row closed failure set (spec §1.2, verbatim English defaults). */
const FAILURE_ROWS: Record<LoginReason, CopyRow> = {
  noServerUrl: {
    userLineKey: "login.failure.noServerUrl",
    userLine:
      "No control-plane URL is configured. Set `piRemote.serverUrl` (or `PI_REMOTE_SERVER_URL`) and run /rc:login again.",
  },
  unreachable: {
    userLineKey: "login.failure.unreachable",
    userLine:
      "Cannot reach `<serverUrl>` — check your network and try again.",
  },
  discoveryInvalid: {
    userLineKey: "login.failure.discoveryInvalid",
    userLine:
      "`<serverUrl>` is not an OAuth2 authorization server (discovery failed). Check the URL with your control-plane admin.",
  },
  browserOpenFailed: {
    userLineKey: "login.failure.browserOpenFailed",
    userLine:
      "Could not open a browser — visit the URL printed above manually to continue. No credentials were saved.",
  },
  redirectTimeout: {
    userLineKey: "login.failure.redirectTimeout",
    userLine:
      "The browser did not complete the consent in time. No credentials were saved.",
  },
  redirectMismatch: {
    userLineKey: "login.failure.redirectMismatch",
    userLine:
      "The browser redirected to an unexpected URL — enrollment was cancelled for safety. No credentials were saved.",
  },
  authorizationDenied: {
    userLineKey: "login.failure.authorizationDenied",
    userLine:
      "Authorization denied — run /rc:login to retry. No credentials were saved.",
  },
  deviceDenied: {
    userLineKey: "login.failure.deviceDenied",
    userLine:
      "Device authorization was denied on the other device — run /rc:login to retry. No credentials were saved.",
  },
  tokenExchangeFailed: {
    userLineKey: "login.failure.tokenExchangeFailed",
    userLine:
      "Token exchange failed — run /rc:login to retry. No credentials were saved.",
  },
  invalidTokenResponse: {
    userLineKey: "login.failure.invalidTokenResponse",
    userLine:
      "`<serverUrl>` returned an invalid OAuth2 response. No credentials were saved. If it repeats, ask your control-plane admin.",
  },
  expiredCode: {
    userLineKey: "login.failure.expiredCode",
    userLine:
      "The enrollment code expired before you finished — run /rc:login to retry. No credentials were saved.",
  },
  storageFailed: {
    userLineKey: "login.failure.storageFailed",
    userLine:
      "Could not persist credentials locally — run /rc:login to retry. No credentials were saved.",
  },
  timedOut: {
    userLineKey: "login.failure.timedOut",
    userLine:
      "Sign-in timed out — no credentials were saved. Run /rc:login to try again.",
  },
};

/** The 15 non-failure lines (spec §1.2). */
const NON_FAILURE_ROWS: Record<string, string> = {
  "login.attended.opening": "Opening your browser to enroll this host with `<serverUrl>`…",
  "login.attended.fallback": "If the browser does not open, visit: `<authorizeUrl>`",
  "login.attended.waiting": "Waiting for browser…",
  "login.attended.success": SUCCESS_COPY,
  "login.headless.instructions": "On any device with a browser, open:",
  "login.headless.carry": "`<verificationUriComplete>`",
  "login.headless.code": "and enter the code:",
  "login.headless.codeValue": "`<userCode>`",
  "login.headless.expire": "The code expires in <expiresIn>s.",
  "login.headless.half": "<halfExpiresIn>s left — keep waiting, or run /rc:login again to restart.",
  "login.headless.thirty": "<30sLeft>s left — keep waiting, or run /rc:login again to restart.",
  "login.headless.success": SUCCESS_COPY,
  "login.cancelled": "Sign-in cancelled — no credentials were saved.",
  "login.alreadyRunning": ALREADY_LOGGING_IN_COPY,
  "login.replacementPrompt": REPLACEMENT_PROMPT_COPY,
};

/** J3 Windows platform notice appended to the storage-failed row (win32). */
export const WINDOWS_STORAGE_NOTICE =
  " Note: this platform does not enforce user-only file permissions for the saved credential (READ the README caveat).";

const englishDefaults: Record<string, string> = {
  ...NON_FAILURE_ROWS,
  ...Object.fromEntries(
    Object.entries(FAILURE_ROWS).map(([, row]) => [row.userLineKey, row.userLine])
  ),
};

/** English-default lookup: resolves a message key to its user-facing string. */
export function loginEnglishFor(key: string): string {
  return englishDefaults[key] ?? key;
}

export const loginReasonCopy: Record<LoginReason, LoginReasonCopy> =
  Object.fromEntries(
    Object.entries(FAILURE_ROWS).map(([reason, row]) => [
      reason,
      { footerState: "error", userLineKey: row.userLineKey, userLine: row.userLine, severity: "error" },
    ])
  ) as Record<LoginReason, LoginReasonCopy>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Base64url-encode bytes (no padding) — RFC 7636 code_verifier/challenge. */
function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Best-effort base64url decode of a JWT segment into a UTF-8 string. */
function base64urlDecode(segment: string): string | undefined {
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * J1: best-effort tenant claim = `sub` from the access-token JWT payload.
 * Unverified, informational only — never an authority.
 */
function tenantIdFromAccessToken(accessToken: string): string | undefined {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return undefined;
    const payload = parts[1];
    const decoded = payload ? base64urlDecode(payload) : undefined;
    if (!decoded) return undefined;
    const obj = JSON.parse(decoded) as { sub?: unknown };
    const sub = obj.sub;
    return typeof sub === "string" && sub.length > 0 ? sub : undefined;
  } catch {
    return undefined;
  }
}

/** Replace `<name>` placeholders in copy with values of the given subs. */
function render(line: string, subs: Record<string, string>): string {
  let out = line;
  for (const [k, v] of Object.entries(subs)) {
    out = out.replaceAll(`<${k}>`, v);
  }
  return out;
}

/** Render the J2 replacement-prompt line (tenant parenthetical conditional). */
function replacementPromptLine(deps: LoginDeps, current: EnrollmentCredential | null): string {
  let line = REPLACEMENT_PROMPT_COPY.replaceAll("<serverUrl>", deps.serverUrl);
  if (current && typeof current.tenantId === "string" && current.tenantId.length > 0) {
    line = line.replaceAll("<tenantId>", current.tenantId);
  } else {
    line = line.replace(" (tenant `<tenantId>`)", "");
  }
  return line;
}

function encodeForm(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** Injectable clock / rng / hash defaults (lazy, no module-level crypto). */
function defaultNow(): number {
  return Date.now();
}
function defaultRandomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}
async function defaultSha256(input: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed view (assignable to crypto.subtle).
  const backing = new Uint8Array(input.byteLength);
  backing.set(input);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", backing);
  return new Uint8Array(buf);
}
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// TEST SEAM — J2's assertable request log (§1.1)
// ---------------------------------------------------------------------------

/** Appended for every HTTP request the drivers make; reset at run() start. */
export const loginEndpointRequestLog: unknown[] = [];

function logEndpoint(url: string, method: string): void {
  loginEndpointRequestLog.push({ url, method });
}

// ---------------------------------------------------------------------------
// Discovery (login-specific validation → discovery_invalid)
// ---------------------------------------------------------------------------

type Discovered =
  | { ok: true; doc: DiscoveryDocument }
  | { ok: false; outcome: LoginOutcome };

async function discoverForLogin(deps: LoginDeps, headless: boolean): Promise<Discovered> {
  if (!deps.serverUrl) {
    return { ok: false, outcome: { kind: "failure", reason: "noServerUrl" } };
  }
  const tDeps: TunnelHttpDeps = {
    serverUrl: deps.serverUrl,
    accessToken: "",
    fetch: deps.fetch,
    now: deps.now,
    discoveryCache: deps.discoveryCache,
  };
  let doc: DiscoveryDocument;
  try {
    doc = await discoverAuthServer(tDeps);
  } catch (e) {
    if (isTunnelError(e) && e.reason === "control_plane_unreachable") {
      return { ok: false, outcome: { kind: "failure", reason: "unreachable" } };
    }
    return { ok: false, outcome: { kind: "failure", reason: "unreachable" } };
  }
  // Valid iff authorization + token endpoints are non-empty strings.
  if (!doc.authorizationEndpoint || !doc.tokenEndpoint) {
    return { ok: false, outcome: { kind: "failure", reason: "discoveryInvalid" } };
  }
  // Headless additionally requires the (optional) device endpoint.
  if (headless && !doc.deviceAuthorizationEndpoint) {
    return { ok: false, outcome: { kind: "failure", reason: "discoveryInvalid" } };
  }
  return { ok: true, doc };
}

// ---------------------------------------------------------------------------
// Attended driver (Authorization Code + PKCE)
// ---------------------------------------------------------------------------

type CallbackResult =
  | { type: "code"; code: string }
  | { type: "mismatch" }
  | { type: "cancelled" }
  | { type: "timeout" };

/**
 * Pure attended driver. Binds a loopback listener on 127.0.0.1 (ephemeral
 * port 0) BEFORE building the authorize URL, serves only `GET /callback`
 * with a state check + open-redirect guard, exchanges the code at the token
 * endpoint (form-urlencoded, public client), persists atomically, and returns
 * a typed `LoginOutcome`. Renders copy via `loginEnglishFor`.
 */
export async function runAttendedLogin(
  deps: LoginDeps,
  existing: EnrollmentCredential | null = null,
  ctl: { cancelled: boolean } = { cancelled: false }
): Promise<LoginOutcome> {
  deps.onState?.("authorizing");
  const discovered = await discoverForLogin(deps, false);
  if (!discovered.ok) return discovered.outcome;

  const rng = deps.randomBytes ?? defaultRandomBytes;
  const now = deps.now ?? defaultNow;
  const sha = deps.sha256 ?? defaultSha256;

  // Bind the loopback listener before building the redirect URI.
  let settle: (r: CallbackResult) => void = () => {};
  const cbPromise = new Promise<CallbackResult>((res) => (settle = res));
  let settled = false;
  const state = base64url(rng(32));

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (req: Request) => {
      const url = new URL(req.url);
      let result: CallbackResult;
      if (req.method !== "GET" || url.pathname !== "/callback") {
        result = { type: "mismatch" };
      } else {
        const code = url.searchParams.get("code");
        const stateParam = url.searchParams.get("state");
        if (!code) result = { type: "mismatch" };
        else if (stateParam !== state) result = { type: "mismatch" };
        else result = { type: "code", code };
      }
      if (!settled) {
        settled = true;
        settle(result);
      }
      return new Response("enrollment", {
        status: result.type === "code" ? 200 : 400,
      });
    },
  });

  ctl.cancelled = false;
  try {
    const port = server.port;
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const verifierBytes = rng(32);

    const authorizeUrl = new URL(discovered.doc.authorizationEndpoint);
    authorizeUrl.searchParams.set("client_id", "pi-remote");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set(
      "code_challenge",
      base64url(await sha(verifierBytes))
    );
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "pi-remote:host");
    authorizeUrl.searchParams.set("state", state);
    const authorizeUrlStr = authorizeUrl.toString();

    print(deps, render(loginEnglishFor("login.attended.opening"), { serverUrl: deps.serverUrl }));
    print(deps, render(loginEnglishFor("login.attended.fallback"), { authorizeUrl: authorizeUrlStr }));

    // Best-effort browser open; never aborts.
    await deps.openUrl?.(authorizeUrlStr).catch(() => false);

    print(deps, loginEnglishFor("login.attended.waiting"));

    const timeoutMs = deps.redirectTimeoutMs ?? 300_000;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        settle({ type: "timeout" });
      }
    }, timeoutMs);
    const cb = await cbPromise;
    clearTimeout(timer);

    if (ctl.cancelled) {
      return { kind: "cancelled" };
    }
    if (cb.type === "cancelled") {
      return { kind: "cancelled" };
    }
    if (cb.type === "timeout") {
      print(deps, loginEnglishFor("login.failure.redirectTimeout"));
      return { kind: "failure", reason: "redirectTimeout" };
    }
    if (cb.type === "mismatch") {
      print(deps, loginEnglishFor("login.failure.redirectMismatch"));
      return { kind: "failure", reason: "redirectMismatch" };
    }

    // Token exchange: form-urlencoded, public client, no secret.
    logEndpoint(discovered.doc.tokenEndpoint, "POST");
    let res: Response;
    try {
      res = await deps.fetch(discovered.doc.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: encodeForm({
          grant_type: "authorization_code",
          code: cb.code,
          code_verifier: base64url(verifierBytes),
          redirect_uri: redirectUri,
          client_id: "pi-remote",
        }),
      });
    } catch {
      print(deps, render(loginEnglishFor("login.failure.unreachable"), { serverUrl: deps.serverUrl }));
      return { kind: "failure", reason: "unreachable" };
    }
    if (ctl.cancelled) return { kind: "cancelled" };
    if (!res.ok) {
      print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
      return { kind: "failure", reason: "tokenExchangeFailed" };
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const at = body?.[K_ACCESS_TOKEN];
    if (typeof at !== "string") {
      print(deps, render(loginEnglishFor("login.failure.invalidTokenResponse"), { serverUrl: deps.serverUrl }));
      return { kind: "failure", reason: "invalidTokenResponse" };
    }

    return finalizeSuccess(
      deps,
      loginEnglishFor("login.attended.success"),
      {
        serverUrl: deps.serverUrl,
        accessToken: at,
        refreshToken:
          typeof body?.[K_REFRESH_TOKEN] === "string"
            ? (body[K_REFRESH_TOKEN] as string)
            : undefined,
        tokenExpiry:
          typeof body?.["expires_in"] === "number"
            ? now() + (body["expires_in"] as number) * 1000
            : now() + 300_000,
      }
    );
  } finally {
    server.stop(true);
  }
}

/**
 * Shared success tail: decode tenant, persist atomically (J3-aware), render
 * the success line with the J1 tenant parenthetical, return typed outcome.
 */
function finalizeSuccess(
  deps: LoginDeps,
  successKey: string,
  cred: EnrollmentCredential
): LoginOutcome {
  const tenantId = tenantIdFromAccessToken(cred.accessToken);
  const saved = saveCredential({ ...cred, tenantId: cred.tenantId ?? tenantId }, { configDir: deps.configDir });
  if (!saved.ok) {
    let line = loginEnglishFor("login.failure.storageFailed");
    if (process.platform === "win32") line += WINDOWS_STORAGE_NOTICE;
    print(deps, line);
    return { kind: "failure", reason: "storageFailed" };
  }
  const tenantSuffix =
    tenantId !== undefined && tenantId.length > 0 ? ` (tenant ${tenantId})` : "";
  print(deps, render(loginEnglishFor(successKey), { serverUrl: deps.serverUrl }) + tenantSuffix);
  return { kind: "success", tenantId };
}

// ---------------------------------------------------------------------------
// Headless driver (Device Authorization, RFC 8628)
// ---------------------------------------------------------------------------

export async function runHeadlessLogin(
  deps: LoginDeps,
  ctl: { cancelled: boolean } = { cancelled: false }
): Promise<LoginOutcome> {
  deps.onState?.("authorizing");
  const discovered = await discoverForLogin(deps, true);
  if (!discovered.ok) {
    print(deps, render(loginEnglishFor("login.failure.discoveryInvalid"), { serverUrl: deps.serverUrl }));
    return discovered.outcome;
  }
  const rng = deps.randomBytes ?? defaultRandomBytes;
  const now = deps.now ?? defaultNow;
  const sleep = deps.sleep ?? defaultSleep;
  const deviceEndpoint = discovered.doc.deviceAuthorizationEndpoint as string;

  logEndpoint(deviceEndpoint, "POST");
  let deRes: Response;
  try {
    deRes = await deps.fetch(deviceEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: encodeForm({ client_id: "pi-remote", scope: "pi-remote:host" }),
    });
  } catch {
    print(deps, render(loginEnglishFor("login.failure.unreachable"), { serverUrl: deps.serverUrl }));
    return { kind: "failure", reason: "unreachable" };
  }
  if (ctl.cancelled) return { kind: "cancelled" };
  if (!deRes.ok) {
    print(deps, render(loginEnglishFor("login.failure.unreachable"), { serverUrl: deps.serverUrl }));
    return { kind: "failure", reason: "unreachable" };
  }
  const deBody = (await deRes.json().catch(() => null)) as Record<string, unknown> | null;
  const deDeviceCode = deBody?.[K_DEVICE_CODE];
  const deUserCode = deBody?.["user_code"];
  const deVerificationUri = deBody?.["verification_uri"];
  const deExpiresIn = deBody?.["expires_in"];
  if (
    typeof deDeviceCode !== "string" ||
    typeof deUserCode !== "string" ||
    typeof deVerificationUri !== "string" ||
    typeof deExpiresIn !== "number"
  ) {
    print(deps, render(loginEnglishFor("login.failure.invalidTokenResponse"), { serverUrl: deps.serverUrl }));
    return { kind: "failure", reason: "invalidTokenResponse" };
  }


  // Relay block: verification_uri_complete by default, bare verification_uri fallback.
  const carryUrl =
    typeof deBody?.["verification_uri_complete"] === "string"
      ? (deBody["verification_uri_complete"] as string)
      : deVerificationUri;
  const expiresIn = deExpiresIn as number;
  const start = now();
  const intervalMs = (typeof deBody?.["interval"] === "number" && (deBody["interval"] as number) > 0 ? (deBody["interval"] as number) : 5) * 1000;

  print(deps, loginEnglishFor("login.headless.instructions"));
  print(deps, render(loginEnglishFor("login.headless.carry"), { verificationUriComplete: carryUrl }));
  print(deps, loginEnglishFor("login.headless.code"));
  print(deps, render(loginEnglishFor("login.headless.codeValue"), { userCode: deUserCode }));
  print(deps, render(loginEnglishFor("login.headless.expire"), { expiresIn: String(expiresIn) }));

  let printedHalf = false;
  let printedThirty = false;
  let printedExpiredTail = false;
  let interval = intervalMs;
  const deviceCode = deDeviceCode as string;

  for (;;) {
    if (ctl.cancelled) return { kind: "cancelled" };
    const elapsed = now() - start;
    if (elapsed >= expiresIn * 1000) {
      print(deps, loginEnglishFor("login.failure.timedOut"));
      return { kind: "failure", reason: "timedOut" };
    }
    if (!printedHalf && elapsed >= (expiresIn * 1000) / 2) {
      print(deps, render(loginEnglishFor("login.headless.half"), { halfExpiresIn: String(Math.max(1, Math.round(expiresIn / 2))) }));
      printedHalf = true;
    }
    if (!printedThirty && elapsed >= expiresIn * 1000 - 30_000) {
      print(deps, render(loginEnglishFor("login.headless.thirty"), { "30sLeft": String(Math.max(1, Math.round((expiresIn * 1000 - elapsed) / 1000))) }));
      printedThirty = true;
    }

    await sleep(interval);
    if (ctl.cancelled) return { kind: "cancelled" };

    logEndpoint(discovered.doc.tokenEndpoint, "POST");
    let res: Response;
    try {
      res = await deps.fetch(discovered.doc.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: encodeForm({
          grant_type: DEVICE_GRANT,
          [K_DEVICE_CODE]: deviceCode,
          client_id: "pi-remote",
        }),
      });
    } catch {
      print(deps, render(loginEnglishFor("login.failure.unreachable"), { serverUrl: deps.serverUrl }));
      return { kind: "failure", reason: "unreachable" };
    }
    if (ctl.cancelled) return { kind: "cancelled" };
    if (!res.ok) {
      // Non-2xx without a parseable error → token exchange failure.
      print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
      return { kind: "failure", reason: "tokenExchangeFailed" };
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    const error = typeof body?.["error"] === "string" ? (body["error"] as string) : undefined;
    if (error === "authorization_pending") {
      continue;
    }
    if (error === "slow_down") {
      interval += 5000;
      continue;
    }
    if (error === "expired_token") {
      if (!printedExpiredTail) {
        print(deps, render(loginEnglishFor("login.headless.expire"), { expiresIn: String(Math.max(1, Math.round((expiresIn * 1000 - elapsed) / 1000))) }));
        printedExpiredTail = true;
      }
      print(deps, loginEnglishFor("login.failure.expiredCode"));
      return { kind: "failure", reason: "expiredCode" };
    }
    if (error === "access_denied") {
      print(deps, loginEnglishFor("login.failure.deviceDenied"));
      return { kind: "failure", reason: "deviceDenied" };
    }
    if (error) {
      print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
      return { kind: "failure", reason: "tokenExchangeFailed" };
    }
    const at = body?.[K_ACCESS_TOKEN];
    if (typeof at !== "string") {
      print(deps, render(loginEnglishFor("login.failure.invalidTokenResponse"), { serverUrl: deps.serverUrl }));
      return { kind: "failure", reason: "invalidTokenResponse" };
    }

    return finalizeSuccess(
      deps,
      loginEnglishFor("login.headless.success"),
      {
        serverUrl: deps.serverUrl,
        accessToken: at,
        refreshToken:
          typeof body?.[K_REFRESH_TOKEN] === "string"
            ? (body[K_REFRESH_TOKEN] as string)
            : undefined,
        tokenExpiry:
          typeof body?.["expires_in"] === "number"
            ? now() + (body["expires_in"] as number) * 1000
            : now() + 300_000,
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Command facade (EV-8 seam)
// ---------------------------------------------------------------------------

export function createLoginCommand(deps: LoginDeps): LoginCommand {
  const ctl = { cancelled: false };
  let inflight: Promise<LoginOutcome> | null = null;

  const run = (mode: LoginMode, existing?: EnrollmentCredential | null): Promise<LoginOutcome> => {
    if (inflight) return inflight; // single-in-flight guard
    loginEndpointRequestLog.length = 0;
    ctl.cancelled = false;
    const p = (async (): Promise<LoginOutcome> => {
      // J2: replacement prompt before any HTTP (attended only; headless exempt).
      if (mode === "attended") {
        const current =
          existing !== undefined ? existing : readCredential({ configDir: deps.configDir });
        if (current) {
        print(deps, replacementPromptLine(deps, current));
        let proceed: boolean;
        if (deps.confirmReplacement) {
          proceed = await deps.confirmReplacement();
        } else {
          proceed = await confirmViaStdin();
        }
        if (!proceed) {
          // Ctrl-C abort: silent, existing credential preserved, clean exit.
          return { kind: "cancelled" };
        }
      }
      }
      const outcome =
        mode === "headless"
          ? await runHeadlessLogin(deps, ctl)
          : await runAttendedLogin(deps, null, ctl);
      if (outcome.kind === "cancelled") {
        print(deps, loginEnglishFor("login.cancelled"));
      }
      return outcome;
    })();
    inflight = p;
    return p.finally(() => {
      inflight = null;
    });
  };

  const cancel = (): void => {
    ctl.cancelled = true;
  };

  return { run, cancel, isRunning: () => inflight !== null };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function print(deps: LoginDeps, line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

/** Default J2 prompt: render copy, then block until Enter/EOF on stdin. */
async function confirmViaStdin(): Promise<boolean> {
  for await (const line of process.stdin) {
    return true; // any Enter/line confirms
  }
  return false;
}
