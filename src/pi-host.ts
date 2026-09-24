/**
 * FLLWUP-11 — local host capabilities replacing removed stand-in members.
 *
 * The real pi SDK's ExtensionAPI exposes none of: getSetting, env, setStatus,
 * input, sessionId, readActiveBranch, isIdle, configDir, version, platform,
 * arch (verified 2026-09-24 against dist/core/extensions/types.d.ts AND the
 * loader's runtime api object, dist/core/extensions/loader.js ~line 200 —
 * calling pi.configDir() in a real host is a TypeError at load). The members
 * that are genuinely local capabilities are re-homed here, per R-TYPE-1:
 *
 *  - configDir  → resolvePiAgentDir: PI_CODING_AGENT_DIR env override, else
 *                 $HOME/.pi/agent (provenance: dist/config.js —
 *                 ENV_AGENT_DIR = "PI_CODING_AGENT_DIR",
 *                 CONFIG_DIR_NAME = ".pi", getAgentDir()).
 *  - getSetting → readHostSettings: guarded read of <configDir>/settings.json,
 *                 returning its `piRemote` object ({} on any failure). Read-only,
 *                 fail-open: a missing or corrupt file never blocks the extension
 *                 from loading.
 *  - platform/arch → hostMetadataFromOs over node:os.
 *
 * env → process.env (no wrapper needed). version is dropped entirely: the
 * tunnel's hostMetadata is informational (SERVER-SIDE-SPEC §"hostMetadata …
 * MAY be empty") and the SDK exposes no version accessor on ExtensionAPI.
 *
 * Pure resolution logic + I/O seams; no module-level mutable state.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Real SDK env override for the agent config dir (dist/config.js). */
export const PI_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";

export interface ResolveAgentDirDeps {
  env: Record<string, string | undefined>;
  homedir: string;
}

/** Resolve the pi agent config directory: env override → $HOME/.pi/agent. */
export function resolvePiAgentDir(deps: ResolveAgentDirDeps): string {
  const override = deps.env[PI_AGENT_DIR_ENV];
  if (override) return override;
  return join(deps.homedir, ".pi", "agent");
}

export interface ReadHostSettingsDeps {
  configDir: string;
  /** Test seam: overrides the settings.json read. Defaults to a real read. */
  readFile?: (path: string) => string;
}

/** Read `<configDir>/settings.json` and return its `piRemote` object ({} on any failure). */
export function readHostSettings(deps: ReadHostSettingsDeps): Record<string, unknown> {
  const path = join(deps.configDir, "settings.json");
  let raw: string;
  try {
    raw = deps.readFile ? deps.readFile(path) : readFileSync(path, "utf8");
  } catch {
    return {}; // missing or unreadable — fail open
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const piRemote = (parsed as Record<string, unknown>).piRemote;
      if (piRemote && typeof piRemote === "object" && !Array.isArray(piRemote)) {
        return piRemote as Record<string, unknown>;
      }
    }
  } catch {
    // corrupt JSON — fail open
  }
  return {};
}

export interface HostOsDeps {
  platform: () => string;
  arch: () => string;
}

/** hostMetadata from node:os (informational; SERVER-SIDE-SPEC allows empty). */
export function hostMetadataFromOs(deps: HostOsDeps): Record<string, string> {
  return { platform: deps.platform(), arch: deps.arch() };
}
