/**
 * Package discovery contract — the `pi` manifest is how pi's loader finds the
 * entry point.
 *
 * For a git/npm package, pi's `collectPackageResources`
 * (dist/core/package-manager.js) does exactly one of two things:
 *   (a) if `package.json` has a `pi` manifest, it loads ONLY the paths under
 *       `pi.<resourceType>`; else
 *   (b) it scans the conventional resource dirs (`extensions/`, `skills/`,
 *       `prompts/`, `themes/`).
 * There is NO fallback to a root `index.ts`. This package keeps its entry at
 * the root, so without a `pi` manifest the loader discovers zero extensions
 * and `pi-remote` silently never loads. This suite pins the manifest that
 * makes branch (a) pick up the entry.
 *
 * The discovery mirror below is a vendored restatement of that contract — the
 * repo's tests do not depend on the installed pi package (same convention as
 * test/pi-sdk-load.test.ts). Re-diff it against the loader on SDK upgrades.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const ENTRY_EXTENSIONS = /\.(ts|js)$/;

interface PiManifest {
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
  themes?: string[];
}

function readPiManifest(packageRoot: string): PiManifest | null {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf-8")) as {
      pi?: unknown;
    };
    if (typeof pkg !== "object" || pkg === null || typeof pkg.pi !== "object" || pkg.pi === null) {
      return null;
    }
    const manifest: PiManifest = {};
    for (const field of ["extensions", "skills", "prompts", "themes"] as const) {
      const entries = (pkg.pi as Record<string, unknown>)[field];
      if (Array.isArray(entries) && entries.every((e) => typeof e === "string")) {
        manifest[field] = entries as string[];
      }
    }
    return manifest;
  } catch {
    return null;
  }
}

/**
 * Mirror of `collectPackageResources`'s extension branch. Returns resolved
 * extension paths only; the conventional-dir branch is included so a removed
 * manifest is caught (this repo has no `extensions/` dir, so it yields []).
 */
function discoverExtensionEntries(packageRoot: string): string[] {
  const manifest = readPiManifest(packageRoot);
  if (manifest) {
    return (manifest.extensions ?? []).map((entry) => resolve(packageRoot, entry));
  }
  const dir = join(packageRoot, "extensions");
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (ENTRY_EXTENSIONS.test(p)) files.push(p);
    }
  };
  walk(dir);
  return files;
}

describe("package discovery manifest", () => {
  test("package.json declares a `pi` manifest with an extensions entry", () => {
    const manifest = readPiManifest(REPO_ROOT);
    expect(manifest).not.toBeNull();
    expect(Array.isArray(manifest?.extensions)).toBe(true);
    expect(manifest?.extensions?.length).toBeGreaterThan(0);
  });

  test("every declared extension entry exists and is a TS/JS file", () => {
    const manifest = readPiManifest(REPO_ROOT);
    const entries = manifest?.extensions ?? [];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const resolved = resolve(REPO_ROOT, entry);
      expect(existsSync(resolved)).toBe(true);
      expect(statSync(resolved).isFile()).toBe(true);
      expect(ENTRY_EXTENSIONS.test(resolved)).toBe(true);
    }
  });

  test("pi's discovery resolves the root index.ts entry (no conventional dir fallback)", () => {
    // First confirm the failure mode this test guards against: there is no
    // conventional `extensions/` dir, so absent the manifest the loader would
    // find nothing.
    expect(existsSync(join(REPO_ROOT, "extensions"))).toBe(false);

    const discovered = discoverExtensionEntries(REPO_ROOT);
    expect(discovered).toContain(resolve(REPO_ROOT, "index.ts"));
  });

  test("the discovered entry is the module that exports the extension default", () => {
    const discovered = discoverExtensionEntries(REPO_ROOT);
    const entry = discovered.find((p) => p === resolve(REPO_ROOT, "index.ts"));
    expect(entry).toBeDefined();
    const source = readFileSync(entry!, "utf-8");
    expect(source).toMatch(/export\s+default\b/);
  });
});