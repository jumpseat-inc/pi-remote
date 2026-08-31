import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearCredential,
  credentialPath,
  readCredential,
  saveCredential,
  saveCredentialAsync,
  type EnrollmentCredential,
} from "../src/credential";

function tempConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "ev7-cred-"));
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

  test("J3 mode gate (test 13): persisted file is POSIX 0600", () => {
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

  test("saveCredentialAsync resolves to the same WriteResult", async () => {
    const cfg = tempConfigDir();
    const result = await saveCredentialAsync(cred(), { configDir: cfg });
    if (process.platform !== "win32") expect(result.ok).toBe(true);
    expect(readCredential({ configDir: cfg })).toEqual(cred());
    rmSync(cfg, { recursive: true, force: true });
  });
});
