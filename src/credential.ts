/**
 * EV-7 credential store.
 *
 * A dedicated, atomic, user-only-readable JSON credential file at
 * `<configDir>/pi-remote/credentials.json` serializing the `piRemote.*`
 * enrollment keys. pi exposes no generic extension-settings write API and no
 * chmod-0600 guarantee on its settings.json (EV-7 design §1.3 / J3), so EV-7
 * ships its own store.
 *
 * Guarantees:
 *  - Atomicity: write to a temp file in the same directory, `fsync`, then
 *    `rename` over the target. A crash leaves either the old file or the new,
 *    never a half-written one.
 *  - POSIX mode 0600 (`fs.chmod` before `rename`).
 *  - Full replace on re-run — never merge.
 *  - Write-on-success only; a failed flow writes nothing half-written.
 *
 * Windows (J3): `fs.chmod` is a no-op and EV-7 does not implement an NTFS ACL.
 * The file is still written, but `saveCredential` returns
 * `{ ok: false, reason: "platform_acl_not_supported" }` so the login driver
 * can surface the README-documented caveat as the storage-failed platform
 * notice (`process.platform === "win32"`).
 */

import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrollmentCredential {
  /** Configured control-plane server URL (EV-8's resolved value). */
  serverUrl: string;
  /** Short-TTL access token. */
  accessToken: string;
  /** Long-lived, revocable at the control plane. */
  refreshToken?: string;
  /** Absolute epoch-ms expiry of `accessToken`. */
  tokenExpiry: number;
  /** Best-effort cached tenant claim — never an auth authority. */
  tenantId?: string;
}

export type WriteResult =
  | { ok: true }
  | { ok: false; reason: "platform_acl_not_supported" | "io_error" };

export interface StoreDeps {
  /** pi agent config directory (the `pi-remote` dir lives inside it). */
  configDir: string;
}

const CREDENTIAL_RELPATH = join("pi-remote", "credentials.json");

/** Absolute path to the single credential JSON file. */
export function credentialPath(deps: StoreDeps): string {
  return join(deps.configDir, CREDENTIAL_RELPATH);
}

function writeAtomic(target: string, data: string): WriteResult {
  const dir = dirname(target);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return { ok: false, reason: "io_error" };
  }

  // Temp file in the same directory so `rename` is atomic (same filesystem).
  const tmp = `${target}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  let fd: number | undefined;
  try {
    fd = openSync(tmp, "w", 0o600);
    writeSync(fd, data);
    fsyncSync(fd);
  } catch {
    closeSyncSafe(fd);
    rmSync(tmp, { force: true, recursive: false });
    return { ok: false, reason: "io_error" };
  }
  closeSync(fd);

  // J3: POSIX mode 0600 before rename, when the platform supports chmod.
  if (process.platform !== "win32") {
    try {
      chmodSync(tmp, 0o600);
    } catch {
      rmSync(tmp, { force: true, recursive: false });
      return { ok: false, reason: "io_error" };
    }
  }

  try {
    renameSync(tmp, target);
  } catch {
    rmSync(tmp, { force: true, recursive: false });
    return { ok: false, reason: "io_error" };
  }

  // J3 Windows caveat: chmod is a no-op, so no user-only guarantee is made.
  if (process.platform === "win32") {
    return { ok: false, reason: "platform_acl_not_supported" };
  }
  return { ok: true };
}

function closeSyncSafe(fd: number | undefined): void {
  if (fd !== undefined) {
    try {
      closeSync(fd);
    } catch {
      /* already closed */
    }
  }
}

/**
 * Atomically persist the credential (full replace). Returns a `WriteResult`
 * so the login driver can render `login.failure.storageFailed` and, on
 * Windows, append the J3 platform notice.
 */
export function saveCredential(
  cred: EnrollmentCredential,
  deps: StoreDeps
): WriteResult {
  return writeAtomic(credentialPath(deps), JSON.stringify(cred, null, 2));
}

/** Awaitable form of `saveCredential` (EV-8 seam). */
export async function saveCredentialAsync(
  cred: EnrollmentCredential,
  deps: StoreDeps
): Promise<WriteResult> {
  return saveCredential(cred, deps);
}

/** Read the persisted credential, or `null` when absent/unreadable/corrupt. */
export function readCredential(deps: StoreDeps): EnrollmentCredential | null {
  const path = credentialPath(deps);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as EnrollmentCredential;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.serverUrl !== "string" ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.tokenExpiry !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Remove the credential file if present (idempotent on POSIX 0600 dir). */
export function clearCredential(deps: StoreDeps): void {
  try {
    rmSync(credentialPath(deps), { force: true });
  } catch {
    /* best-effort */
  }
}
