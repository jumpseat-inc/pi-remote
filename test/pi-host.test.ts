/**
 * FLLWUP-11 — local host-capability tests (config dir, settings read, os metadata).
 */
import { describe, expect, test } from "bun:test";
import { resolvePiAgentDir, readHostSettings, hostMetadataFromOs } from "../src/pi-host";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform as osPlatform, arch as osArch } from "node:os";

const TMP = join(tmpdir(), "pi-remote-fllwup11-host-test");

describe("resolvePiAgentDir", () => {
  test("PI_CODING_AGENT_DIR override wins", () => {
    const original = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = "/custom/agent-dir";
    try {
      expect(resolvePiAgentDir({ env: process.env, homedir: "/home/me" })).toBe("/custom/agent-dir");
    } finally {
      if (original === undefined) delete process.env.PI_CODING_AGENT_DIR;
      else process.env.PI_CODING_AGENT_DIR = original;
    }
  });

  test("falls back to $HOME/.pi/agent", () => {
    const original = process.env.PI_CODING_AGENT_DIR;
    delete process.env.PI_CODING_AGENT_DIR;
    try {
      expect(resolvePiAgentDir({ env: process.env, homedir: "/home/main" })).toBe("/home/main/.pi/agent");
    } finally {
      if (original !== undefined) process.env.PI_CODING_AGENT_DIR = original;
    }
  });

  test("empty override falls through to the homedir default", () => {
    const original = process.env.PI_CODING_AGENT_DIR;
    process.env.PI_CODING_AGENT_DIR = "";
    try {
      expect(resolvePiAgentDir({ env: process.env, homedir: "/home/main" })).toBe("/home/main/.pi/agent");
    } finally {
      if (original === undefined) delete process.env.PI_CODING_AGENT_DIR;
      else process.env.PI_CODING_AGENT_DIR = original;
    }
  });
});

describe("readHostSettings", () => {
  test("returns the piRemote object when present", () => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "settings.json"), JSON.stringify({ piRemote: { serverUrl: "https://cp.example.com" } }));
    expect(readHostSettings({ configDir: TMP })).toEqual({ serverUrl: "https://cp.example.com" });
  });

  test("missing file → {}", () => {
    rmSync(TMP, { recursive: true, force: true });
    expect(readHostSettings({ configDir: TMP })).toEqual({});
  });

  test("corrupt file → {}", () => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "settings.json"), "{not json");
    expect(readHostSettings({ configDir: TMP })).toEqual({});
  });

  test("missing or non-object piRemote key → {}", () => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "settings.json"), JSON.stringify({ other: 1 }));
    expect(readHostSettings({ configDir: TMP })).toEqual({});
  });
});

describe("hostMetadataFromOs", () => {
  test("builds { platform, arch } from node:os", () => {
    const meta = hostMetadataFromOs({ platform: osPlatform, arch: osArch });
    expect(meta).toEqual({ platform: osPlatform(), arch: osArch() });
  });
});
