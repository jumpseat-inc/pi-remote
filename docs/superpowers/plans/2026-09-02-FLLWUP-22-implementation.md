# FLLWUP-22 Implementation Plan — §2.3 device-flow poll answer shape (400 vs 2xx error body)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/login.ts`'s device-flow poll loop recognize RFC 8628 §3.5 error bodies carried on HTTP 400 (the normative §2.3 shape), instead of aborting any non-2xx with `tokenExchangeFailed`.

**Architecture:** Structural reorder only — move the `res.json()` parse and `error` extraction above the `res.ok` gate, and gate the existing four-code dispatch table (`authorization_pending` / `slow_down` / `expired_token` / `access_denied`) on `res.ok || res.status === 400`. Everything else falls through to a retained `error || !res.ok` → `tokenExchangeFailed` check. No new `LoginReason`, no copy change.

**Tech Stack:** Bun + TypeScript (`bun test`, `bunx tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-09-02-FLLWUP-22-design.md` (authoritative; read together with this plan).

## Global Constraints

- `docs/SERVER-SIDE-SPEC.md` §2.3 stays AS WRITTEN — do not touch the spec document.
- No new `LoginReason`; no copy changes; no changes to `timedOut`/`unreachable`/`invalidTokenResponse` paths.
- `res.json().catch(() => null)` fails closed — keep it; post-reorder it is live at every status.
- The four codes are recognized ONLY on 400 and 2xx. A 500 carrying `{"error":"access_denied"}` must NOT surface `deviceDenied`; a 500 carrying `{"error":"authorization_pending"}` must NOT continue polling.
- Do NOT add a plain `500 {}` fixture (settled: pins nothing distinct).
- Out of scope: RFC 8628 connection-timeout divergence, `error_description`, 5xx retry policy.
- Gates in order: (1) `bunx tsc --noEmit` exit 0; (2) `bun test` full suite green (baseline 207 pass / 1 skip / 0 fail; nothing may flip except via the intended flips).
- Conventional Commits (repo AGENTS.md); scope `login`.

---

### Task 1: Fixture flips + new 400-window and honesty fixtures (test first — RED)

**Files:**
- Modify: `test/login.test.ts:538` (test 9 "bounded poll": `status: 200` → `status: 400` on the pending-poll pin — THE normative §2.3/RFC pin)
- Modify: `test/login.test.ts:633` (test 11 "Ctrl-C": `status: 200` → `status: 400` — cosmetic; the test never issues a token POST, but the literal exists, so flip it for consistency)
- Modify: `test/login.test.ts` (append a new `describe` block after `"EV-7 headless flow"`)

**Interfaces:**
- Consumes: existing harness `makeControl(overrides, tokenBody)`, `makeFetch(c)`, `resp(status, body)`, `fakeJwt(sub?)`, `tempConfigDir()`, `captureLog`, `readCredential`, `runHeadlessLogin(deps)`, `loginEndpointRequestLog`.
- Produces: new describe block `"FLLWUP-22: RFC 8628 poll error shape (400 window)"` with 11 tests.

**Non-JSON bodies:** `makeFetch` always re-wraps `onToken` output via `resp(out.status, out.body)` (which builds `{ json: async () => body }`), so a raw `Response` cannot be smuggled through `onToken`. Instead, pass a **rejected Promise** as `body`: `json: async () => body` then resolves with a rejected promise, and `await res.json()` rejects — exactly what a non-JSON body does at the `json()` seam, exercising the production `.catch(() => null)` with zero harness changes.

- [ ] **Step 1: Write the fixtures.** Append after the `"EV-7 headless flow"` describe block:

```ts
describe("FLLWUP-22: RFC 8628 poll error shape (400 window)", () => {
  /** Non-JSON body simulation: `resp` builds `json: async () => body`, so a
   * rejected-Promise body makes `await res.json()` reject at the json() seam. */
  function nonJsonBody(): unknown {
    return Promise.reject(new SyntaxError("Unexpected token 'n' — not valid JSON"));
  }

  function headlessDeps(c: Control, configDir: string, sleep: LoginDeps["sleep"] = async () => {}): LoginDeps {
    return { serverUrl: c.serverUrl, configDir, fetch: makeFetch(c), now: () => c.simNow, sleep };
  }

  test("normative §2.3 pin (test 9 flip): 400 + authorization_pending keeps polling → success", async () => {
    const c = makeControl({}, {});
    c.simNow = 0;
    c.onToken = (ctl: Control) =>
      ctl.simNow >= 290 * 1000
        ? { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } }
        : { status: 400, body: { error: "authorization_pending" } };
    const configDir = tempConfigDir();
    const deps = headlessDeps(c, configDir, async (ms: number) => { c.simNow += ms; });
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 slow_down → continue with interval increased by 5000ms (sleep seam: 2000 then 7000)", async () => {
    const c = makeControl({}, {});
    let calls = 0;
    c.onToken = () =>
      ++calls === 1
        ? { status: 400, body: { error: "slow_down" } }
        : { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } };
    const configDir = tempConfigDir();
    const sleeps: number[] = [];
    const deps = headlessDeps(c, configDir, async (ms: number) => { sleeps.push(ms); c.simNow += ms; });
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(deps));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    expect(sleeps).toEqual([2000, 7000]); // deviceBody interval:2 → 2000ms; +5000 → 7000ms
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 expired_token → expiredCode, expire tail printed once, no credential", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: { error: "expired_token" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("expiredCode");
    // "The code expires in …" renders at flow start AND in the expired tail — tail exactly once.
    expect(logs.filter((l) => l.includes("The code expires in")).length).toBe(2);
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 access_denied → deviceDenied, no credential", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: { error: "access_denied" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("deviceDenied");
    expect(logs.some((l) => l.includes("Device authorization was denied"))).toBe(true);
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 unknown error code → tokenExchangeFailed", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: { error: "some_other_error" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    expect(logs.some((l) => l.includes("Token exchange failed"))).toBe(true);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 {} (absent error) → tokenExchangeFailed", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: {} });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("500 + {error:access_denied} → tokenExchangeFailed, NOT deviceDenied (anti-false-denial)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 500, body: { error: "access_denied" } });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result, logs } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    expect(logs.some((l) => l.includes("Device authorization was denied"))).toBe(false);
    rmSync(configDir, { recursive: true, force: true });
  });

  test("500 + {error:authorization_pending} → tokenExchangeFailed, NOT continue (anti-silent-continue)", async () => {
    const c = makeControl({}, {});
    let calls = 0;
    c.onToken = () =>
      ++calls === 1
        ? { status: 500, body: { error: "authorization_pending" } }
        : { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } };
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    // If the 500 error body were wrongly honored as "continue", poll #2 would
    // return success and the outcome would be "success", not this failure.
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    const tokenPosts = loginEndpointRequestLog.filter(
      (e) => (e as { url: string }).url === c.tokenEndpoint
    );
    expect(tokenPosts.length).toBe(1); // no second poll issued
    rmSync(configDir, { recursive: true, force: true });
  });

  test("500 with non-JSON body → tokenExchangeFailed (not a throw)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 500, body: nonJsonBody() });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("400 with non-JSON body → tokenExchangeFailed (pins the .catch on the now-live 400 parse path)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({ status: 400, body: nonJsonBody() });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("200 + authorization_pending still polls (tolerated-legacy pin)", async () => {
    const c = makeControl({}, {});
    let calls = 0;
    c.onToken = () =>
      ++calls === 1
        ? { status: 200, body: { error: "authorization_pending" } }
        : { status: 200, body: { access_token: fakeJwt("t"), expires_in: 300 } };
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("success");
    rmSync(configDir, { recursive: true, force: true });
  });

  test("200 + {error:access_denied, access_token:valid} → deviceDenied, credential never saved (error-wins honesty pin)", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({
      status: 200,
      body: { error: "access_denied", access_token: fakeJwt("t"), expires_in: 300 },
    });
    const configDir = tempConfigDir();
    loginEndpointRequestLog.length = 0;
    const { result } = await captureLog(() => runHeadlessLogin(headlessDeps(c, configDir)));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("deviceDenied");
    expect(readCredential({ configDir })).toBeNull();
    rmSync(configDir, { recursive: true, force: true });
  });
});
```

  And flip the two existing literals:
  - `test/login.test.ts:538`: `{ status: 200, body: { error: "authorization_pending" } }` → `{ status: 400, body: { error: "authorization_pending" } }`.
  - `test/login.test.ts:633`: `({ status: 200, body: { error: "authorization_pending" } })` → `({ status: 400, body: { error: "authorization_pending" } })`.

- [ ] **Step 2: Verify RED.** Run `bun test test/login.test.ts`. Expected: the test-9 flip and the five 400 per-code fixtures FAIL on shipped code (400 → `tokenExchangeFailed`/no poll); the Ctrl-C flip, the five 500/200 honesty/legacy pins PASS on shipped code (they are regression guards). Failure messages must be outcome mismatches (`tokenExchangeFailed` vs `success` etc.), not errors.

- [ ] **Step 3: Commit (RED).**

```bash
git add test/login.test.ts
git commit -m "test(login): pin RFC 8628 poll error fixtures — 400 window, slow_down seam, honesty guards"
```

### Task 2: Reorder the poll loop (GREEN)

**Files:**
- Modify: `src/login.ts:716-757` (headless poll loop only; lines drifted slightly from the spec's ~:716–757 — current `!res.ok` gate at :716, parse at :721, error extraction at :723).

**Interfaces:**
- Consumes: nothing new; same `res`, `body`, `error`, `interval`, `printedExpiredTail` locals as before.
- Produces: identical `LoginOutcome` vocabulary; only the 400 window's outcomes change.

- [ ] **Step 1: Apply the reorder.** Replace, inside the headless `for (;;)` loop:

```ts
    if (!res.ok) {
      // Non-2xx without a parseable error → token exchange failure.
      print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
      return { kind: "failure", reason: "tokenExchangeFailed" };
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    const error = typeof body?.["error"] === "string" ? (body["error"] as string) : undefined;
```

  with:

```ts
    // FLLWUP-22: parse BEFORE the status gate so RFC 8628 §3.5 error bodies
    // carried on 400 (the normative §2.3 shape) reach the dispatch table.
    // The .catch(() => null) fails closed at every status: a non-JSON 400 or
    // 500 body → tokenExchangeFailed, never a throw.
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    const error = typeof body?.["error"] === "string" ? (body["error"] as string) : undefined;
    if (res.ok || res.status === 400) {
```

  Then replace the tail of the table (from the `access_denied` row's closing brace through the `invalidTokenResponse` extraction start) so the retained fallthrough covers unknown-error and all other non-2xx:

```ts
    if (error === "access_denied") {
      print(deps, loginEnglishFor("login.failure.deviceDenied"));
      return { kind: "failure", reason: "deviceDenied" };
    }
    if (error) {
      print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
      return { kind: "failure", reason: "tokenExchangeFailed" };
    }
```

  becomes:

```ts
    if (error === "access_denied") {
      print(deps, loginEnglishFor("login.failure.deviceDenied"));
      return { kind: "failure", reason: "deviceDenied" };
    }
  }
  if (error || !res.ok) {
    // Unknown error code (2xx or 400), a 400 without a recognized error, or
    // any other non-2xx (401/429/500…) → token exchange failure. The four
    // RFC 8628 codes are recognized only on 400 and 2xx; other statuses'
    // bodies are effectively unread.
    print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
    return { kind: "failure", reason: "tokenExchangeFailed" };
  }
```

  i.e. the final shape is:

```ts
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    const error = typeof body?.["error"] === "string" ? (body["error"] as string) : undefined;
    if (res.ok || res.status === 400) {
      if (error === "authorization_pending") {
        continue;
      }
      if (error === "slow_down") {
        interval += 5000;
        continue;
      }
      if (error === "expired_token") {
        if (!printedExpiredTail) {
          print(deps, render(loginEnglishFor("login.headless.expire"), { expiresIn: String(Math.max(1, Math.round((expiresIn * 1000 - elapsed) / 1000))) }));
          printedExpiredTail = true;
        }
        print(deps, loginEnglishFor("login.failure.expiredCode"));
        return { kind: "failure", reason: "expiredCode" };
      }
      if (error === "access_denied") {
        print(deps, loginEnglishFor("login.failure.deviceDenied"));
        return { kind: "failure", reason: "deviceDenied" };
      }
    }
    if (error || !res.ok) {
      // Unknown error code (2xx or 400), a 400 without a recognized error, or
      // any other non-2xx (401/429/500…) → token exchange failure. The four
      // RFC 8628 codes are recognized only on 400 and 2xx; other statuses'
      // bodies are effectively unread.
      print(deps, loginEnglishFor("login.failure.tokenExchangeFailed"));
      return { kind: "failure", reason: "tokenExchangeFailed" };
    }
    const at = body?.[K_ACCESS_TOKEN];
```

- [ ] **Step 2: Verify GREEN.** Run `bun test` — full suite. Expected: all new fixtures pass, both flips pass, and the pre-existing 207 tests are unchanged (207 baseline + 11 new = 218 pass / 1 skip / 0 fail).

- [ ] **Step 3: Commit (GREEN).**

```bash
git add src/login.ts
git commit -m "fix(login): recognize RFC 8628 400 error bodies in the device-flow poll"
```

### Task 3: Gates, push, PR

- [ ] **Step 1: Gate 1** — `bunx tsc --noEmit` → exit 0. Record output.
- [ ] **Step 2: Gate 2** — `bun test` → full suite green; record counts. Nothing may have flipped except the intended flips.
- [ ] **Step 3:** Push `fix/fllwup-22-poll-400-shape` and open a PR to `main` with `gh pr create`. PR body must state: the defect, the ruling (client adapts to spec; §2.3 untouched), the reorder, and the fixture inventory (2 flips + 11 new fixtures; the plain `500 {}` fixture deliberately omitted as settled by the Skeptic).
- [ ] **Step 4:** Report: PR number, head SHA, branch, both gate results verbatim, plan path. Do not poll CI.
