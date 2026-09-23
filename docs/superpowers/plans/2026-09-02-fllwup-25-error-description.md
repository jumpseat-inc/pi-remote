# FLLWUP-25: Surface the device-flow token endpoint's `error_description` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the headless device-flow token poll fails with `tokenExchangeFailed`, print a second line carrying the server's sanitized `error_description`, so the user sees why the identity provider refused.

**Architecture:** One new sanitizer helper (pure, exported for tests) plus one detail line emitted at exactly one dispatch site in `runHeadlessLogin` (the `tokenExchangeFailed` print). One new copy key `login.failure.detail` in the `NON_FAILURE_ROWS` vocabulary table, resolved through `loginEnglishFor`. No existing row or key changes; the attended path is untouched.

**Tech Stack:** Bun + TypeScript, `bun:test` (existing harness in `test/login.test.ts`).

**Spec:** Product-owner copy ruling `vault/raw/2026-09-02-po-fllwup-25-error-description.md` (recorded in the main checkout; not committed to this branch), plus card FLLWUP-25 on `council/board.md`.

## Global Constraints

- Do NOT touch `index.ts` or the command surface (`createLoginCommand`, `runAttendedLogin`).
- Do NOT modify any existing user-visible copy string or key. `FAILURE_ROWS.tokenExchangeFailed.userLine` stays byte-identical.
- The detail line is English-only by design (FLLWUP-4 OJ2): NO `src/copy.ts` overlay entry.
- Conventional Commits; red commit (failing tests) before green commit.
- Gates: `bun install`, `bunx tsc --noEmit` (exit 0), `bun test` (baseline 224 pass / 1 skip / 0 fail; must stay green with new fixtures added).

## Review Focus

- Hostile `error_description` with ESC+CSI sequences: expect all U+0000–U+001F and U+007F–U+009F stripped so no escape can form — pinned by sanitizer unit test.
- >200-code-point description with astral characters at the boundary: expect exactly 200 code points + `...`, never a split surrogate pair — pinned by sanitizer unit test.
- Whitespace-only / `null` / non-string / missing description: expect NO detail line and byte-identical ruled output — pinned by headless-flow fixtures.
- Description present on `deviceDenied` / `expiredCode` / `invalidTokenResponse` bodies: expect NO detail line (boundary is dispatch-level, not sanitizer-level) — pinned by headless-flow fixtures.
- Attended (PKCE) token exchange failure: expect unchanged output, never a detail line — existing fixtures already cover the attended path; pinned by the absence of any emit in `runAttendedLogin`.

---

### Task 1: Sanitizer helper + copy key (TDD red→green)

**Files:**
- Modify: `src/login.ts` (add `sanitizeErrorDescription` helper near `render`; add `login.failure.detail` row to `NON_FAILURE_ROWS`)
- Test: `test/login.test.ts`

**Interfaces:**
- Produces: `export function sanitizeErrorDescription(raw: unknown): string | undefined` — returns the sanitized single-line string, or `undefined` when the input is missing / `null` / non-string / sanitizes to empty. Task 2's emit site consumes this exact signature.

- [ ] **Step 1: Write the failing tests** (describe block `FLLWUP-25: error_description sanitizer + copy key`)

```ts
describe("FLLWUP-25: error_description sanitizer + copy key", () => {
  test("strips C0 (U+0000–U+001F) and DEL/C1 (U+007F–U+009F): no escape sequence can form", () => {
    const hostile = `be\x1b[31mwarned\x1b[0m\u009b31m plain`;
    expect(sanitizeErrorDescription(hostile)).toBe("be[31mwarned[0m31m plain");
  });

  test("collapses whitespace runs (incl. \\n, \\r\\n, \\t) to single spaces and trims", () => {
    expect(sanitizeErrorDescription("  scope \n\n main \t app \r\n revoked  ")).toBe(
      "scope main app revoked"
    );
  });

  test("caps at 200 code points + '...' without splitting surrogate pairs", () => {
    // 150 astral chars (2 code points each = 300 code points) → first 100
    // astral chars = 200 code points, then "...". No lone surrogate anywhere.
    const astral = "𝛼".repeat(150);
    const out = sanitizeErrorDescription(astral)!;
    expect([...out].length).toBe(203); // 200 code points + 3 dots
    expect(out.endsWith("...")).toBe(true);
    expect(out.includes("\u{D800}")).toBe(false);
    // Boundary inside the pair must not split: 199 code points of prefix
    // then a 2-code-point char → cap lands at 199 + the marker, char dropped.
    const prefix = "a".repeat(199);
    const out2 = sanitizeErrorDescription(prefix + "𝛼tail")!;
    expect(out2).toBe("a".repeat(199) + "...");
    expect(out2.includes("\u{D800}")).toBe(false);
  });

  test("returns undefined for missing, null, non-string, and whitespace-only inputs", () => {
    expect(sanitizeErrorDescription(undefined)).toBeUndefined();
    expect(sanitizeErrorDescription(null)).toBeUndefined();
    expect(sanitizeErrorDescription(42)).toBeUndefined();
    expect(sanitizeErrorDescription({ error: "x" })).toBeUndefined();
    expect(sanitizeErrorDescription("   \n\t ")).toBeUndefined();
    expect(sanitizeErrorDescription("")).toBeUndefined();
  });

  test("copy vocabulary: login.failure.detail resolves through loginEnglishFor with the ruled string", () => {
    expect(loginEnglishFor("login.failure.detail")).toBe(
      "Details from the server: `<errorDescription>`"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `bun test test/login.test.ts`
Expected: FAIL — `sanitizeErrorDescription` is not exported, `login.failure.detail` resolves to itself (identity).

- [ ] **Step 3: Implement minimally** in `src/login.ts`

Add to the vocabulary section:

```ts
const NON_FAILURE_ROWS: Record<string, string> = {
  // ... existing rows unchanged, then appended:
  "login.failure.detail": "Details from the server: `<errorDescription>`",
};
```

Add near the other helpers:

```ts
/**
 * FLLWUP-25 (PO ruling 3): sanitize the untrusted server `error_description`
 * for terminal display. Order is ruled: (1) strip all C0 (U+0000–U+001F) and
 * DEL+C1 (U+007F–U+009F) code points so no escape sequence can form (no
 * textual ANSI matching); (2) collapse whitespace runs to single spaces and
 * trim — always one terminal line; (3) cap at 200 code points (never split a
 * surrogate pair), appending "..." when truncated. Returns undefined when the
 * input is missing, null, a non-string, or sanitizes to empty — the detail
 * line is omitted entirely in that case.
 */
export function sanitizeErrorDescription(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  const collapsed = stripped.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return undefined;
  const cps = [...collapsed];
  if (cps.length > 200) return cps.slice(0, 200).join("") + "...";
  return collapsed;
}
```

- [ ] **Step 4: Run tests to verify green**

Run: `bun test test/login.test.ts && bunx tsc --noEmit`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit (red first, then green)**

```bash
git add test/login.test.ts
git commit -m "test(login): FLLWUP-25 red — sanitizer + login.failure.detail fixtures"
# then implementation
git add src/login.ts test/login.test.ts
git commit -m "feat(login): add error_description sanitizer and login.failure.detail copy key"
```

### Task 2: Headless dispatch emit (TDD red→green)

**Files:**
- Modify: `src/login.ts` (`runHeadlessLogin` poll dispatch — the `if (error || !res.ok)` branch, `print` at ~line 767)
- Test: `test/login.test.ts`

**Interfaces:**
- Consumes: `sanitizeErrorDescription` from Task 1; `loginEnglishFor("login.failure.detail")` from the vocabulary; `render(line, { errorDescription })` and `print(deps, line)` helpers.

- [ ] **Step 1: Write the failing tests** (describe block `FLLWUP-25: headless poll dispatch surfaces error_description`)

```ts
describe("FLLWUP-25: headless poll dispatch surfaces error_description", () => {
  const RULED = "Token exchange failed — run /rc:login to retry. No credentials were saved.";

  function failingHeadlessDeps(
    c: Control,
    configDir: string,
    onToken: Control["onToken"]
  ): LoginDeps {
    c.onToken = onToken;
    return { serverUrl: c.serverUrl, configDir, fetch: makeFetch(c), now: () => c.simNow, sleep: async () => {} };
  }

  test("400 unknown error + error_description → ruled line, then one detail line", async () => {
    const c = makeControl({}, {});
    const configDir = tempConfigDir();
    const { result, logs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(c, configDir, () => ({
          status: 400,
          body: { error: "some_other_error", error_description: "Scope \u001b[31mmain\u001b[0m  app\nrevoked" },
        }))
      )
    );
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    const idx = logs.indexOf(RULED);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(logs[idx + 1]).toBe('Details from the server: `Scope [31mmain[0m app revoked`');
    expect(logs.filter((l) => l.startsWith("Details from the server:"))).toHaveLength(1);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("no error_description → ruled line only, byte-identical (no detail line)", async () => {
    const c = makeControl({}, {});
    const configDir = tempConfigDir();
    const { logs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(c, configDir, () => ({ status: 400, body: { error: "some_other_error" } }))
      )
    );
    expect(logs).toContain(RULED);
    expect(logs.some((l) => l.startsWith("Details from the server:"))).toBe(false);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("error_description null / non-string / whitespace-only → ruled line only", async () => {
    for (const desc of [null, 42, "  \n\t ", { text: "x" }]) {
      const c = makeControl({}, {});
      const configDir = tempConfigDir();
      const { logs } = await captureLog(() =>
        runHeadlessLogin(
          failingHeadlessDeps(c, configDir, () => ({
            status: 400,
            body: { error: "some_other_error", error_description: desc },
          }))
        )
      );
      expect(logs).toContain(RULED);
      expect(logs.some((l) => l.startsWith("Details from the server:"))).toBe(false);
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  test("boundary: deviceDenied / expiredCode / invalidTokenResponse never emit a detail line even with a description present", async () => {
    // deviceDenied: 400 access_denied with a description in the body
    const cd = makeControl({}, {});
    const dd = tempConfigDir();
    const { logs: deniedLogs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(cd, dd, () => ({
          status: 400,
          body: { error: "access_denied", error_description: "the user said no" },
        }))
      )
    );
    expect(deniedLogs.some((l) => l.includes("Device authorization was denied"))).toBe(true);
    expect(deniedLogs.some((l) => l.startsWith("Details from the server:"))).toBe(false);
    rmSync(dd, { recursive: true, force: true });

    // expiredCode: 400 expired_token with a description
    const ce = makeControl({}, {});
    const ed = tempConfigDir();
    const { logs: expiredLogs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(ce, ed, () => ({
          status: 400,
          body: { error: "expired_token", error_description: "the code expired" },
        }))
      )
    );
    expect(expiredLogs.some((l) => l.includes("The enrollment code expired"))).toBe(true);
    expect(expiredLogs.some((l) => l.startsWith("Details from the server:"))).toBe(false);
    rmSync(ed, { recursive: true, force: true });

    // invalidTokenResponse: 2xx, no error field, access_token not a string
    const ci = makeControl({}, {});
    const id = tempConfigDir();
    const { logs: invalidLogs } = await captureLog(() =>
      runHeadlessLogin(
        failingHeadlessDeps(ci, id, () => ({
          status: 200,
          body: { error_description: "trust me this is fine" },
        }))
      )
    );
    expect(invalidLogs.some((l) => l.includes("returned an invalid OAuth2 response"))).toBe(true);
    expect(invalidLogs.some((l) => l.startsWith("Details from the server:"))).toBe(false);
    rmSync(id, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `bun test test/login.test.ts`
Expected: FAIL — the present-description fixture sees no detail line; the boundary fixtures would pass trivially (no emit exists yet), which is acceptable for red; the present-case red is the obligation.

- [ ] **Step 3: Implement minimally** — in `runHeadlessLogin`, replace the `tokenExchangeFailed` print:

```ts
    if (error || !res.ok) {
      print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
      const detail = sanitizeErrorDescription(body?.["error_description"]);
      if (detail !== undefined) {
        print(deps, render(loginEnglishFor("login.failure.detail"), { errorDescription: detail }));
      }
      return { kind: "failure", reason: "tokenExchangeFailed" };
    }
```

(The G-3 secret-name convention covers only OAuth *secret* wire names; `error_description` is public response metadata per RFC 6749 §5.2 and is written as a verbatim literal, matching the existing `user_code` / `expires_in` / `interval` literals.)

- [ ] **Step 4: Run tests to verify green**

Run: `bun test && bunx tsc --noEmit`
Expected: full suite green (224 baseline + new fixtures), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/login.ts test/login.test.ts
git commit -m "feat(login): surface sanitized error_description on headless tokenExchangeFailed"
```

### Task 3: Gates, push, PR

- [ ] **Step 1:** `bun install` — succeeds.
- [ ] **Step 2:** `bunx tsc --noEmit` — exit 0.
- [ ] **Step 3:** `bun test` — full suite green, 0 fail, 1 skip (Windows-gated), all new fixtures passing.
- [ ] **Step 4:** Push branch; open PR against `main` (no CI poll — PR creation only).
