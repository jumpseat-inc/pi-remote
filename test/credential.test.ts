import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  buildWindowsAclArgv,
  clearCredential,
  credentialPath,
  parseWhoamiUserSid,
  readCredential,
  saveCredential,
  saveCredentialAsync,
  type EnrollmentCredential,
} from "../src/credential";

function tempConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "ev7-cred-"));
}

/** Patch process.platform (skeptic pin: always restore — see callers' finally). */
function setPlatform(p: NodeJS.Platform): NodeJS.Platform {
  const orig = process.platform;
  (process as unknown as { platform: NodeJS.Platform }).platform = p;
  return orig;
}

function cred(overrides: Partial<EnrollmentCredential> = {}): EnrollmentCredential {
  return {
    serverUrl: "https://cp.example",
    accessToken: "at-1",
    refreshToken: "rt-1",
    tokenExpiry: 1234567890,
    tenantId: "tenant-1",
    ...overrides,
  };
}

describe("EV-7 credential store", () => {
  test("credentialPath points to <configDir>/pi-remote/credentials.json (plural)", () => {
    const path = credentialPath({ configDir: "/tmp/pi-conf" });
    expect(path).toBe(join("/tmp/pi-conf", "pi-remote", "credentials.json"));
    expect(path).toContain("credentials.json");
  });

  test("save → read round-trips the piRemote.* keys", () => {
    const cfg = tempConfigDir();
    const input = cred();
    const result = saveCredential(input, { configDir: cfg });
    if (process.platform !== "win32") expect(result.ok).toBe(true);
    const got = readCredential({ configDir: cfg });
    expect(got).toEqual(input);
    rmSync(cfg, { recursive: true, force: true });
  });

  test.skipIf(process.platform === "win32")("J3 mode gate (test 13): persisted file is POSIX 0600", () => {
    const cfg = tempConfigDir();
    saveCredential(cred(), { configDir: cfg });
    const p = credentialPath({ configDir: cfg });
    const mode = statSync(p).mode & 0o777;
    expect(mode).toBe(0o600);
    rmSync(cfg, { recursive: true, force: true });
  });

  test("re-run full-replaces, never merges (test 15): file holds exactly the new keys", () => {
    const cfg = tempConfigDir();
    saveCredential(
      cred({ accessToken: "old-at", refreshToken: "old-rt", tenantId: "old" }),
      { configDir: cfg }
    );
    // Second run writes a disjoint set of keys; the refreshToken/tenantId must vanish.
    const next: EnrollmentCredential = {
      serverUrl: "https://cp2.example",
      accessToken: "new-at",
      tokenExpiry: 999,
    };
    saveCredential(next, { configDir: cfg });
    const got = readCredential({ configDir: cfg });
    expect(got).toEqual(next);
    expect(got).not.toHaveProperty("refreshToken");
    expect(got).not.toHaveProperty("tenantId");
    rmSync(cfg, { recursive: true, force: true });
  });

  test("readCredential returns null when absent; clear removes it", () => {
    const cfg = tempConfigDir();
    expect(readCredential({ configDir: cfg })).toBeNull();
    saveCredential(cred(), { configDir: cfg });
    clearCredential({ configDir: cfg });
    expect(readCredential({ configDir: cfg })).toBeNull();
    clearCredential({ configDir: cfg }); // idempotent
    rmSync(cfg, { recursive: true, force: true });
  });

  test("readCredential returns null on corrupt/unreadable content (never partial)", () => {
    const cfg = tempConfigDir();
    const p = credentialPath({ configDir: cfg });
    mkdirSync(join(cfg, "pi-remote"), { recursive: true });
    writeFileSync(p, '{"serverUrl": "x"}', "utf8");
    expect(readCredential({ configDir: cfg })).toBeNull();
    rmSync(cfg, { recursive: true, force: true });
  });

  test("buildWindowsAclArgv: exact icacls argv — tmp, /inheritance:r, /grant:r *SID:(M)", () => {
    expect(buildWindowsAclArgv("C:\\tmp\\cred.json.tmp-1", "S-1-5-21-1-2-3")).toEqual([
      "C:\\tmp\\cred.json.tmp-1",
      "/inheritance:r",
      "/grant:r",
      "*S-1-5-21-1-2-3:(M)",
    ]);
  });

  test("parseWhoamiUserSid: extracts the (never-localized) SID column of whoami /user /fo csv", () => {
    const csv =
      '"UserName","SID"\r\n"DESKTOP\\alice","S-1-5-21-3623811015-3361044348-30300820-1013"\r\n';
    expect(parseWhoamiUserSid(csv)).toBe(
      "S-1-5-21-3623811015-3361044348-30300820-1013"
    );
    expect(parseWhoamiUserSid('"UserName","SID"\r\n')).toBeNull();
    expect(parseWhoamiUserSid("")).toBeNull();
  });

  test("win32 fail-closed: ACL failure ⇒ {ok:false, acl_enforcement_failed}, nothing on disk, no tmp remains", () => {
    const origPlatform = setPlatform("win32");
    try {
      const cfg = tempConfigDir();
      const appliedPaths: string[] = [];
      const result = saveCredential(cred(), {
        configDir: cfg,
        applyAcl: (path) => {
          appliedPaths.push(path);
          return { ok: false };
        },
      });
      expect(result).toEqual({ ok: false, reason: "acl_enforcement_failed" });
      // {ok:false} ⟺ nothing was left on disk (the load-bearing invariant).
      expect(readCredential({ configDir: cfg })).toBeNull();
      expect(existsSync(credentialPath({ configDir: cfg }))).toBe(false);
      // tmp lives in dirname(credentialPath) = <cfg>/pi-remote/, NOT cfg itself.
      const credDir = dirname(credentialPath({ configDir: cfg }));
      expect(readdirSync(credDir).filter((e) => e.includes(".tmp-"))).toEqual([]); // no tmp remains
      expect(appliedPaths).toHaveLength(1);
      rmSync(cfg, { recursive: true, force: true });
    } finally {
      setPlatform(origPlatform);
    }
  });

  test("win32 + successful ACL seam ⇒ {ok:true} and the credential is readable (no platform penalty)", () => {
    const origPlatform = setPlatform("win32");
    try {
      const cfg = tempConfigDir();
      const result = saveCredential(cred(), {
        configDir: cfg,
        applyAcl: () => ({ ok: true }),
      });
      expect(result).toEqual({ ok: true });
      expect(readCredential({ configDir: cfg })).toEqual(cred());
      rmSync(cfg, { recursive: true, force: true });
    } finally {
      setPlatform(origPlatform);
    }
  });

  test.skipIf(process.platform !== "win32")("win32 ACL read-back (SDDL via icacls /save): no inherited ACEs, no well-known SIDs, current-user grant; re-enroll replaces", () => {
    const cfg = tempConfigDir();
    try {
      const result = saveCredential(cred(), { configDir: cfg });
      expect(result).toEqual({ ok: true });
      const p = credentialPath({ configDir: cfg });

      const who = Bun.spawnSync(["whoami", "/user", "/fo", "csv"]);
      expect(who.exitCode).toBe(0);
      const sid = parseWhoamiUserSid(who.stdout.toString());
      expect(sid).not.toBeNull();

      // icacls /save writes SDDL as UTF-16LE with a BOM — decode accordingly.
      const sddlPath = join(cfg, "acl.sddl");
      const saved = Bun.spawnSync(["icacls", p, "/save", sddlPath]);
      expect(saved.exitCode).toBe(0);
      const raw = readFileSync(sddlPath);
      expect(raw.subarray(0, 2).toString("hex")).toBe("fffe"); // UTF-16LE BOM
      const sddl = raw.subarray(2).toString("utf16le");
      // Locale-independent: SIDs, never display names (Everyone/Users are localized).
      expect(sddl).not.toContain("S-1-1-0"); // Everyone
      expect(sddl).not.toContain("S-1-5-32-545"); // BUILTIN\Users
      expect(sddl).not.toContain("S-1-5-11"); // Authenticated Users
      expect(sddl).not.toContain(";ID;"); // inherited-ACE flag → inheritance stripped
      expect(sddl).toContain(sid as string); // the current user holds the grant

      // The human icacls output shows no inherited marker either.
      const shown = Bun.spawnSync(["icacls", p]);
      expect(shown.exitCode).toBe(0);
      expect(shown.stdout.toString()).not.toContain("(<I>)");

      // Re-enrollment replaces over the protected target ((M) includes DELETE).
      const again = saveCredential(cred({ accessToken: "at-2" }), { configDir: cfg });
      expect(again).toEqual({ ok: true });
      expect(readCredential({ configDir: cfg })?.accessToken).toBe("at-2");
    } finally {
      rmSync(cfg, { recursive: true, force: true });
    }
  });

  test("saveCredentialAsync resolves to the same WriteResult", async () => {
    const cfg = tempConfigDir();
    const result = await saveCredentialAsync(cred(), { configDir: cfg });
    if (process.platform !== "win32") expect(result.ok).toBe(true);
    expect(readCredential({ configDir: cfg })).toEqual(cred());
    rmSync(cfg, { recursive: true, force: true });
  });
});
