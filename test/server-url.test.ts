/**
 * EV-15 — the single control-plane URL resolver (`src/server-url.ts`).
 *
 * Pins the total tier order (env → setting → stored credential →
 * DEFAULT_SERVER_URL) with trim-based emptiness, so the three runtime resolve
 * sites in index.ts cannot diverge. Also pins that the load-time tier stays
 * explicit-only: index.ts never hardcodes or imports the default URL — the
 * entry passes the two raw tiers (`envServerUrl`, `settingServerUrl`) and the
 * controller resolves.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DEFAULT_SERVER_URL, resolveServerUrl } from "../src/server-url";

describe("resolveServerUrl (EV-15 tier order: env → setting → stored credential → default)", () => {
  test("totality: every tier absent → DEFAULT_SERVER_URL", () => {
    expect(resolveServerUrl({})).toBe(DEFAULT_SERVER_URL);
    expect(DEFAULT_SERVER_URL).toBe("https://relay.jumpseat.sh");
  });

  test("env beats setting with both set", () => {
    expect(
      resolveServerUrl({ envUrl: "https://env.example", settingUrl: "https://setting.example" })
    ).toBe("https://env.example");
  });

  test("setting beats stored credential; credential beats the default", () => {
    expect(
      resolveServerUrl({ settingUrl: "https://setting.example", credentialUrl: "https://cred.example" })
    ).toBe("https://setting.example");
    expect(resolveServerUrl({ credentialUrl: "https://cred.example" })).toBe("https://cred.example");
  });

  test("normalization: empty/whitespace tiers are absent (trim-based fallthrough)", () => {
    expect(resolveServerUrl({ envUrl: "" })).toBe(DEFAULT_SERVER_URL);
    expect(resolveServerUrl({ envUrl: "   " })).toBe(DEFAULT_SERVER_URL);
    expect(resolveServerUrl({ settingUrl: "" })).toBe(DEFAULT_SERVER_URL);
    expect(resolveServerUrl({ settingUrl: "   " })).toBe(DEFAULT_SERVER_URL);
    // Empty env falls to the setting tier (behavior change vs the old `??` collapse).
    expect(resolveServerUrl({ envUrl: "", settingUrl: "https://setting.example" })).toBe(
      "https://setting.example"
    );
    expect(resolveServerUrl({ envUrl: "  ", settingUrl: "https://setting.example" })).toBe(
      "https://setting.example"
    );
    expect(resolveServerUrl({ envUrl: "  ", settingUrl: "" })).toBe(DEFAULT_SERVER_URL);
  });

  test("credential tier: null/undefined/empty all fall to the default (EV-15 pin)", () => {
    expect(resolveServerUrl({ credentialUrl: "" })).toBe(DEFAULT_SERVER_URL);
    expect(resolveServerUrl({ credentialUrl: "   " })).toBe(DEFAULT_SERVER_URL);
    expect(resolveServerUrl({ credentialUrl: null })).toBe(DEFAULT_SERVER_URL);
    expect(resolveServerUrl({ credentialUrl: undefined })).toBe(DEFAULT_SERVER_URL);
    expect(
      resolveServerUrl({ credentialUrl: null, settingUrl: "https://setting.example" })
    ).toBe("https://setting.example");
  });

  test("values are returned trimmed", () => {
    expect(resolveServerUrl({ envUrl: "  https://env.example  " })).toBe("https://env.example");
    expect(resolveServerUrl({ credentialUrl: "\thttps://cred.example\n" })).toBe(
      "https://cred.example"
    );
  });
});

// ---------------------------------------------------------------------------
// T14 — load-time tier stays explicit-only (EV-15 Acceptance 3)
// ---------------------------------------------------------------------------
describe("load-time tier stays explicit-only (EV-15 T14)", () => {
  test("index.ts never hardcodes or imports the default URL — the entry passes the two raw tiers only", () => {
    const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
    // If the load path ever folds the default in (or the constant is imported
    // at the entry), this grep goes red — the resolver owns the default.
    expect(source).not.toContain("relay.jumpseat.sh");
    expect(source).not.toContain("DEFAULT_SERVER_URL");
    // The two raw tiers are the only URL-bearing deps the entry provides.
    expect(source).toContain("envServerUrl");
    expect(source).toContain("settingServerUrl");
  });
});
