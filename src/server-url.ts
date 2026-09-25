/**
 * EV-15 — the single control-plane URL resolver.
 *
 * Mirrors the `copy.ts` precedent: dependency-free, imports nothing from the
 * repo (no cycle risk). One home for the default URL and the total tier
 * order; the three runtime resolve sites (`rearm`, `rcCommand`,
 * `rcLoginCommand` in index.ts) all consult `resolveServerUrl` so they cannot
 * diverge, and the load-time tier stays explicit-only (the entry passes the
 * two raw tiers; nothing on the load path picks up the credential or the
 * default).
 *
 * Tier order: env → setting → stored credential → DEFAULT_SERVER_URL.
 * Emptiness is trim-based: `undefined`, `null`, `""`, and whitespace-only
 * tiers are all absent and fall through to the next tier. The return type is
 * total (`string`) — this is what makes the login driver's no-URL failure
 * row unreachable (EV-15 Acceptance 4).
 *
 * `normalizeServerUrl` is deliberately NOT exported: there is no consumer
 * outside the resolver, and normalization is tested through
 * `resolveServerUrl` (test/server-url.test.ts).
 */

/** Last-resort control-plane URL: used only when every explicit tier is absent. */
export const DEFAULT_SERVER_URL = "https://relay.jumpseat.sh";

/**
 * Total resolver. Tier order: env → setting → stored credential →
 * DEFAULT_SERVER_URL. Always returns a non-empty trimmed URL.
 */
export function resolveServerUrl(input: {
  envUrl?: string | undefined;
  settingUrl?: string | undefined;
  credentialUrl?: string | null | undefined;
}): string {
  const tiers = [input.envUrl, input.settingUrl, input.credentialUrl];
  for (const tier of tiers) {
    if (typeof tier === "string") {
      const trimmed = tier.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return DEFAULT_SERVER_URL;
}
