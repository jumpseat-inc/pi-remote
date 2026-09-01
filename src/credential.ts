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
 * Windows (FLLWUP-7): user-only readability is enforced via an NTFS ACL
 * applied by icacls to the tmp file BEFORE any credential byte is written
 * (inherited ACEs stripped, current user granted Modify by SID), so the ACL
 * travels through the rename and no unprotected window exists. Fail-closed:
 * if the ACL cannot be applied (EDR, FAT/exFAT volume, missing icacls, SID
 * resolution failure), the tmp is deleted, nothing is renamed, and
 * `saveCredential` returns `{ ok: false, reason: "acl_enforcement_failed" }`
 * so the login driver can surface the acl-failed notice. `{ ok: true }`
 * means persisted AND user-only-protected on every platform.
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
import { spawnSync } from "node:child_process";
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
  | { ok: false; reason: "io_error" | "acl_enforcement_failed" };

export type ApplyAcl = (path: string) => { ok: true } | { ok: false };

export interface StoreDeps {
  /** pi agent config directory (the `pi-remote` dir lives inside it). */
  configDir: string;
  /** Test seam: overrides the win32 icacls invocation. Defaults to the real spawner. */
  applyAcl?: ApplyAcl;
}

const CREDENTIAL_RELPATH = join("pi-remote", "credentials.json");

/** Absolute path to the single credential JSON file. */
export function credentialPath(deps: StoreDeps): string {
  return join(deps.configDir, CREDENTIAL_RELPATH);
}

/**
 * Pure argv builder for the icacls invocation applied to the tmp file before
 * rename: strip inherited ACEs, then grant the current user Modify by SID
 * (`*S-1-…`), never by display name (locale-fragile).
 */
export function buildWindowsAclArgv(tmp: string, userSid: string): string[] {
  return [tmp, "/inheritance:r", "/grant:r", `*${userSid}:(M)`];
}

/**
 * Parse the SID column of `whoami /user /fo csv` output — never localized.
 * Returns `null` when no SID is found (header-only, empty, or unexpected).
 */
export function parseWhoamiUserSid(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(/S-1-\d+(?:-\d+)+/);
    if (m) return m[0];
  }
  return null;
}

/**
 * Default win32 ACL executor: resolve the current user's SID via
 * `whoami /user /fo csv`, then `icacls <tmp> /inheritance:r /grant:r
 * *<sid>:(M)`. Any failure (spawn error, non-zero exit, missing icacls, SID
 * resolution failure) fails closed — never an unprotected write.
 */
function defaultApplyAcl(path: string): { ok: true } | { ok: false } {
  let sid: string | null = null;
  try {
    const who = spawnSync("whoami", ["/user", "/fo", "csv"], { windowsHide: true });
    if (who.status === 0 && who.stdout) {
      sid = parseWhoamiUserSid(who.stdout.toString());
    }
  } catch {
    sid = null;
  }
  if (!sid) return { ok: false };
  try {
    const out = spawnSync("icacls", buildWindowsAclArgv(path, sid), { windowsHide: true });
    if (out.error || out.status !== 0) return { ok: false };
  } catch {
    return { ok: false };
  }
  return { ok: true };
}

function writeAtomic(target: string, data: string, deps: StoreDeps): WriteResult {
  const dir = dirname(target);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return { ok: false, reason: "io_error" };
  }

  // Temp file in the same directory so `rename` is atomic (same filesystem).
  const tmp = `${target}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;

  // Windows (FLLWUP-7): apply the user-only NTFS ACL to the EMPTY tmp file
  // before any credential byte is written — mirrors the POSIX 0600-at-open
  // invariant, and the ACL travels through the rename. Fail-closed: an ACL
  // failure deletes the tmp and reports `acl_enforcement_failed`; nothing is
  // ever renamed unprotected.
  if (process.platform === "win32") {
    const applyAcl = deps.applyAcl ?? defaultApplyAcl;
    let applied = false;
    let aclFd: number | undefined;
    try {
      aclFd = openSync(tmp, "w", 0o600);
      applied = applyAcl(tmp).ok;
    } catch {
      applied = false;
    }
    closeSyncSafe(aclFd);
    if (!applied) {
      rmSync(tmp, { force: true });
      return { ok: false, reason: "acl_enforcement_failed" };
    }
  }

  let fd: number | undefined;
  try {
    fd = openSync(tmp, "w", 0o600); // win32: re-opens the still-empty tmp
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
 * so the login driver can render `login.failure.storageFailed` and, for
 * `reason === "acl_enforcement_failed"`, append the acl-failed notice.
 */
export function saveCredential(
  cred: EnrollmentCredential,
  deps: StoreDeps
): WriteResult {
  return writeAtomic(credentialPath(deps), JSON.stringify(cred, null, 2), deps);
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
