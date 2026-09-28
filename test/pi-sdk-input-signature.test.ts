/**
 * EV-18 — vendored-signature pin for PiExtensionContext["ui"]["input"].
 *
 * At base the vendored declaration was two-param
 * (`input(title: string, placeholder?: string)`), so a three-arg call failed
 * to compile with TS2554 ("Expected 1-2 arguments, but got 3"). The reconciled
 * declaration (installed @earendil-works/pi-coding-agent@0.87.1
 * dist/core/extensions/types.d.ts:75) is three-param:
 *
 *   input(title, placeholder?, opts?: { signal?: AbortSignal; timeout?: number })
 *
 * The property pinned here is compile-time: the three-arg calls below compile
 * (proven by `bunx tsc --noEmit` in the gate) and, at runtime, pass all three
 * arguments through to the underlying function. This is not the EV-18
 * wiring-forward probe (designer P3) — it is the vendored-declaration pin.
 */
import { describe, expect, test } from "bun:test";
import type { PiExtensionContext } from "../src/pi-sdk-on.ts";

describe("EV-18: vendored ui.input signature", () => {
  test("a three-arg call (title, placeholder, opts) is accepted and forwarded", async () => {
    const calls: unknown[][] = [];
    const input = ((...args: unknown[]) => {
      calls.push(args);
      return Promise.resolve(undefined);
    }) as PiExtensionContext["ui"]["input"];

    // Three-arg call incl. a structural opts member — compiles only against
    // the reconciled three-param declaration.
    const result = await input("title", "https://env.example", { timeout: 1_000 });
    expect(result).toBeUndefined();
    expect(calls[0]).toEqual(["title", "https://env.example", { timeout: 1_000 }]);

    // The two-arg and one-arg forms remain valid (optional params).
    await input("title", "https://env.example");
    await input("title");
    expect(calls).toHaveLength(3);
  });
});
