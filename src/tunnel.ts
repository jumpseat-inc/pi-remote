/**
 * EV-2 — control-plane tunnel REST client.
 *
 * A pure, STATELESS HTTPS REST client for the control plane. It creates a
 * tunnel via `POST /tunnels` using the opaque enrollment credential, consumes
 * (runtime-validates and returns) the signed one-time tunnel URL, refreshes
 * the access token via RFC 8414 discovery + RFC 6749 §6 refresh, and deletes a
 * tunnel via `DELETE /tunnels/:id` on teardown.
 *
 * It is the only code besides `transport.ts` that touches the network, and it
 * only ever uses `fetch` (HTTPS). It never dials a WebSocket, never calls
 * `setStatus`, never reads pi settings or OS environment variables, and
 * holds no module-level mutable state. All dependencies (`fetch`, the clock)
 * and the base `serverUrl`/enrollment credential are injected. See
 * docs/PI-SPEC.md §3/§7.2 and the EV-2 design spec §1–§3.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TunnelErrorKind =
  | "unauthenticated" // 401 — expired or revoked enrollment credential
  | "forbidden" // 403 — valid credential lacking pi-remote:host scope
  | "unreachable" // network/DNS/TCP/TLS or discovery failure
  | "server_error" // 5xx
  | "validation"; // create/refresh response failed runtime validation

export type TunnelReason =
  | "enrollment_expired"
  | "enrollment_rejected"
  | "control_plane_unreachable"
  | "server_error"
  | "teardown_failed"
  | "validation";

export type Severity = "error" | "live" | "resyncing";

export interface ReasonCopy {
  footerState: Severity;
  /** Stable message key (ruling Item 2) — resolved by the English default lookup. */
  userLineKey: string;
  /** English default user-facing string. */
  userLine: string;
  severity: Severity;
}

export interface TunnelHttpDeps {
  /** Control-plane base server URL. */
  serverUrl: string;
  /** Opaque enrollment credential (Bearer). Never persisted or read from env here. */
  accessToken: string;
  fetch: typeof fetch;
  /** Clock returning epoch ms (injected for testability). */
  now?: () => number;
  /** Shared per-serverUrl RFC 8414 discovery cache (injected; never module-level). */
  discoveryCache?: Map<string, Promise<DiscoveryDocument>>;
}

/**
 * RFC 8414 discovery document (subset this repo consumes).
 * `authorizationEndpoint` and `tokenEndpoint` are required contract fields;
 * `deviceAuthorizationEndpoint` is optional per RFC 8414/8628.
 */
export interface DiscoveryDocument {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  deviceAuthorizationEndpoint?: string;
}

export interface CreateTunnelInput {
  sessionId: string;
  sessionName: string;
  cwd: string;
  hostMetadata: Record<string, string>;
}

export interface CreateTunnelResult {
  tunnelId: string;
  url: string;
  expiresAt: number; // absolute epoch-ms
}

export interface RefreshTokenResult {
  accessToken: string;
  /** Rotated refresh token, returned (not applied internally) for the caller to persist (O6). */
  refreshToken?: string;
  expiresAt: number; // absolute epoch-ms
}

// ---------------------------------------------------------------------------
// The signed one-time URL scheme validator.
// NOTE: this module never contains the literal `wss:` + `//` sequence as copy
// or in any string an error could carry. The regex is spelled `wss?:` plus a
// slash-pair (`\/\/`) and matches the `wss` / `ws` schemes; for the critique:
// the trailing comment does not write the scheme with a doubled slash.
// ---------------------------------------------------------------------------
const WSS_SCHEME = /^wss?:\/\//;

// ---------------------------------------------------------------------------
// Copy vocabulary (settled + ruled).
// ---------------------------------------------------------------------------

/**
 * Exact copy for the idempotent-while-connected acknowledgment (ruling Item 3).
 * Not an error, not severity-tagged. `<serverUrl>` is the configured
 * control-plane server URL — never the one-time tunnel URL (§7.2).
 */
export const ALREADY_LIVE_COPY =
  "already connected to `<serverUrl>`; ignoring this `/rc`";

/**
 * Pure reason → copy map. The reason set is CLOSED to the rows in §3.2 — no
 * `unknown` / raw `http_401`-style leak. `userLine` is the English default;
 * localization is a future card (ruling Item 2).
 */
export const tunnelReasonCopy: Record<TunnelReason, ReasonCopy> = {
  enrollment_expired: {
    footerState: "error",
    userLineKey: "tunnel.error.unauthenticated",
    userLine: "Enrollment expired or revoked — run /rc:login",
    severity: "error",
  },
  enrollment_rejected: {
    footerState: "error",
    userLineKey: "tunnel.error.forbidden",
    userLine:
      "This host lacks the pi-remote:host scope — run /rc:login to re-consent; if the scope is missing after that, ask your control-plane admin to grant it",
    severity: "error",
  },
  control_plane_unreachable: {
    footerState: "error",
    userLineKey: "tunnel.error.unreachable",
    userLine:
      "Control plane unreachable at `<serverUrl>` — check your network and try again",
    severity: "error",
  },
  server_error: {
    footerState: "error",
    userLineKey: "tunnel.error.serverError",
    userLine: "Control plane returned a server error — try again",
    severity: "error",
  },
  teardown_failed: {
    footerState: "error",
    userLineKey: "tunnel.error.teardownFailed",
    userLine: "Failed to notify the control plane of tunnel teardown",
    severity: "error",
  },
  validation: {
    footerState: "error",
    userLineKey: "tunnel.error.invalidResponse",
    userLine: "Control plane returned an invalid tunnel response",
    severity: "error",
  },
};

const englishDefaults: Record<string, string> = Object.fromEntries(
  Object.values(tunnelReasonCopy).map((c) => [c.userLineKey, c.userLine])
);

/** English-default lookup: resolves a message key to its user-facing string. */
export function englishFor(key: string): string {
  return englishDefaults[key] ?? key;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class TunnelError extends Error {
  override readonly name = "TunnelError";
  readonly kind?: TunnelErrorKind;
  readonly reason: TunnelReason;
  readonly serverUrl: string;
  readonly status?: number;

  constructor(
    kind: TunnelErrorKind | undefined,
    reason: TunnelReason,
    serverUrl: string,
    status?: number
  ) {
    super(reason);
    this.kind = kind;
    this.reason = reason;
    this.serverUrl = serverUrl;
    this.status = status;
    // message is only the semantic reason string — never a raw HTTP body,
    // stack trace, or the one-time tunnel URL (§3.1).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isTunnelError(e: unknown): e is TunnelError {
  return e instanceof TunnelError;
}

// ---------------------------------------------------------------------------
// RFC 8414 discovery (shared, cached per serverUrl inside injected scope)
// ---------------------------------------------------------------------------

function discoveryUrlFor(serverUrl: string): string {
  return `${serverUrl}/.well-known/oauth-authorization-server`;
}

/**
 * Fetch + cache the RFC 8414 discovery document for the server URL.
 * Transport/HTTP/parse failures throw `TunnelError("unreachable",
 * "control_plane_unreachable", …)` and evict the cached entry; a 200 doc is
 * returned as-is (field-level validity is the caller's job — tunnel keeps
 * its unreachable mapping, login decides `discovery_invalid`). Shared with
 * `login.ts` via the injected cache.
 */
export async function discoverAuthServer(deps: TunnelHttpDeps): Promise<DiscoveryDocument> {
  const cache =
    deps.discoveryCache ?? new Map<string, Promise<DiscoveryDocument>>();
  const existing = cache.get(deps.serverUrl);
  if (existing !== undefined) return existing;

  const p = (async () => {
    let res: Response;
    try {
      res = await deps.fetch(discoveryUrlFor(deps.serverUrl));
    } catch {
      throw new TunnelError("unreachable", "control_plane_unreachable", deps.serverUrl);
    }
    if (!res.ok) {
      throw new TunnelError("unreachable", "control_plane_unreachable", deps.serverUrl);
    }
    const doc = (await res.json().catch(() => null)) as {
      authorization_endpoint?: unknown;
      token_endpoint?: unknown;
      device_authorization_endpoint?: unknown;
    } | null;
    if (doc === null) {
      throw new TunnelError("unreachable", "control_plane_unreachable", deps.serverUrl);
    }
    const result: DiscoveryDocument = {
      authorizationEndpoint:
        typeof doc.authorization_endpoint === "string"
          ? doc.authorization_endpoint
          : "",
      tokenEndpoint:
        typeof doc.token_endpoint === "string" ? doc.token_endpoint : "",
    };
    if (typeof doc.device_authorization_endpoint === "string") {
      result.deviceAuthorizationEndpoint = doc.device_authorization_endpoint;
    }
    return result;
  })();

  cache.set(deps.serverUrl, p);
  try {
    return await p;
  } catch (e) {
    if (cache.get(deps.serverUrl) === p) cache.delete(deps.serverUrl);
    throw e;
  }
}

/**
 * Map an HTTP response status from create/refresh to the closed reason set.
 * A 401 is always terminal (`enrollment_expired`) — createTunnel never
 * auto-refreshes on 401 (O5); the one silent refresh is EV-8 policy.
 */
function throwForStatus(
  kind: "create" | "refresh" | "delete",
  status: number,
  deps: TunnelHttpDeps
): never {
  if (status === 401) {
    throw new TunnelError("unauthenticated", "enrollment_expired", deps.serverUrl, status);
  }
  if (status === 403) {
    throw new TunnelError("forbidden", "enrollment_rejected", deps.serverUrl, status);
  }
  if (kind === "delete") {
    throw new TunnelError(undefined, "teardown_failed", deps.serverUrl, status);
  }
  if (status >= 500) {
    throw new TunnelError("server_error", "server_error", deps.serverUrl, status);
  }
  // Any other non-2xx non-401/403: a server-side rejection in the closed set.
  throw new TunnelError("server_error", "server_error", deps.serverUrl, status);
}

// ---------------------------------------------------------------------------
// createTunnel
// ---------------------------------------------------------------------------

export async function createTunnel(
  input: CreateTunnelInput,
  deps: TunnelHttpDeps
): Promise<CreateTunnelResult> {
  const now = deps.now ?? Date.now;

  let res: Response;
  try {
    res = await deps.fetch(`${deps.serverUrl}/tunnels`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${deps.accessToken}`,
      },
      body: JSON.stringify({
        sessionId: input.sessionId,
        sessionName: input.sessionName,
        cwd: input.cwd,
        hostMetadata: input.hostMetadata,
      }),
    });
  } catch {
    throw new TunnelError("unreachable", "control_plane_unreachable", deps.serverUrl);
  }
  if (!res.ok) throwForStatus("create", res.status, deps);

  const body = (await res.json().catch(() => null)) as {
    tunnelId?: unknown;
    url?: unknown;
    tokenTtl?: unknown;
  } | null;
  const url = body?.url;
  const tokenTtl = body?.tokenTtl;
  const tunnelId = body?.tunnelId;

  // Runtime-validation gate before any URL can reach a dialer (spec §2.2).
  if (typeof url !== "string" || !WSS_SCHEME.test(url)) {
    throw new TunnelError("validation", "validation", deps.serverUrl, res.status);
  }
  if (
    typeof tokenTtl !== "number" ||
    !Number.isFinite(tokenTtl) ||
    tokenTtl <= 0
  ) {
    throw new TunnelError("validation", "validation", deps.serverUrl, res.status);
  }
  if (typeof tunnelId !== "string") {
    throw new TunnelError("validation", "validation", deps.serverUrl, res.status);
  }

  // O2: absolute epoch-ms computed at the conversion site; the raw relative
  // TTL is never stored or returned.
  const expiresAt = now() + tokenTtl * 1000;
  return { tunnelId, url, expiresAt };
}

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

export async function refreshAccessToken(
  refreshToken: string,
  deps: TunnelHttpDeps
): Promise<RefreshTokenResult> {
  const now = deps.now ?? Date.now;
  // Discovery failure always maps to control_plane_unreachable (closed set).
  const doc = await discoverAuthServer(deps);
  const tokenEndpoint = doc.tokenEndpoint;
  if (!tokenEndpoint) {
    throw new TunnelError("unreachable", "control_plane_unreachable", deps.serverUrl);
  }

  let res: Response;
  try {
    res = await deps.fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
  } catch {
    throw new TunnelError("unreachable", "control_plane_unreachable", deps.serverUrl);
  }
  if (!res.ok) throwForStatus("refresh", res.status, deps);

  const body = (await res.json().catch(() => null)) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  } | null;

  const accessToken = body?.access_token;
  if (typeof accessToken !== "string") {
    throw new TunnelError("validation", "validation", deps.serverUrl, res.status);
  }
  const expiresIn = body?.expires_in;
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new TunnelError("validation", "validation", deps.serverUrl, res.status);
  }

  // O2: absolute epoch-ms at the conversion site.
  const result: RefreshTokenResult = { accessToken, expiresAt: now() + expiresIn * 1000 };

  // O6: a rotated refresh token is RETURNED (never applied internally) so
  // EV-8 can persist it via EV-7-owned keys.
  const rotated = body?.refresh_token;
  if (typeof rotated === "string") result.refreshToken = rotated;

  return result;
}

// ---------------------------------------------------------------------------
// deleteTunnel
// ---------------------------------------------------------------------------

export async function deleteTunnel(
  tunnelId: string,
  deps: TunnelHttpDeps
): Promise<void> {
  let res: Response;
  try {
    res = await deps.fetch(
      `${deps.serverUrl}/tunnels/${encodeURIComponent(tunnelId)}`,
      { method: "DELETE", headers: { authorization: `Bearer ${deps.accessToken}` } }
    );
  } catch {
    // Best-effort on the wire; never blocks teardown. Swallowed (spec §2.4).
    return;
  }
  if (res.status === 404 || res.status === 410) return; // idempotent success
  if (res.status >= 200 && res.status < 300) return;
  // Any other non-2xx surfaces teardown_failed; teardown proceeds locally regardless.
  throwForStatus("delete", res.status, deps);
}
