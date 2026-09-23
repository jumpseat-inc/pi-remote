# FLLWUP-29 Implementation Plan — Pin the attended PKCE path's no-`error_description` boundary

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Committed fixture pair in `test/login.test.ts` pinning that the attended (PKCE) token-exchange path never emits the `login.failure.detail` line, with a headless positive control that is red at the FLLWUP-25 pre-mechanism base.

**Architecture:** One self-contained `describe` block appended to `test/login.test.ts`. Half (a) drives the attended flow to a non-2xx token POST carrying `error` + `error_description` and asserts the ruled line printed with NO `Details from the server:` line. Half (b) drives the headless flow with the same `onToken` shape and asserts the detail line IS printed — the positive control that is red at base `81d5c74` (no dispatched token-exchange path emitted the detail line before FLLWUP-25) and proves the detection machinery live. On a future widening of the emit into shared `tokenExchangeFailed` handling, half (a) goes red.

**Tech Stack:** Bun + `bun:test`, existing test harness (`makeControl`, `attendedDeps`, `captureLog`, `tempConfigDir`, `resp`).

**Spec:** Card `council/cards/FLLWUP-29.md` (Intent/goal on the card face; no separate spec file — recorded mode Direct, EV-70 owner-only lane).

## Global Constraints

- No product behavior or copy changes: PR diff = plan doc + `test/login.test.ts` only.
- Ruled copy constants (byte-identical): ruled line `Token exchange failed — run /rc:login to retry. No credentials were saved.`; detail prefix `Details from the server:`.
- Transplant constraints (red-at-base): the block uses only base-existing helpers (`makeControl`, `attendedDeps`, `runHeadlessLogin`, `runAttendedLogin`, `captureLog`, `tempConfigDir`, `fakeJwt`, `resp`) and must NOT import or reference `sanitizeErrorDescription` or the `login.failure.detail` key — both absent at `81d5c74`.
- Gates in order: `bun install`; `bunx tsc --noEmit` exit 0; `bun test` green.
- Red-at-base base: `81d5c747349d2e1fc58e9cd898c057209c3f3213` (first parent of FLLWUP-25 mechanism merge `c9a570f`, PR #32 squash), role `required`. Record all seven convention fields before pushing.
- Branch cut from `origin/main` (`f5235893bf5d6026f801b8c7951f531c1ef54bca`), never local `main` (R-CONV-1).

## Review Focus

- A future refactor that moves the `login.failure.detail` emit into shared `tokenExchangeFailed` handling silently widens it to the attended path — expected behavior: half (a) of the new describe block fails on `logs.some(startsWith "Details from the server:")`. Pinned by Task 2.
- The negative assertion's matcher silently rotting (e.g. prefix renamed) — expected behavior: half (b) the positive control fails, proving the harness detects the detail line. Pinned by Task 2.
- An attended-only negative block would be green at base and prove nothing — the pair-in-one-block structure is the card's explicit design consequence; do not split or drop half (b).

---

### Task 1: Plan document

**Files:**
- Create: `docs/superpowers/plans/2026-09-23-fllwup-29-attended-no-detail.md`

- [x] **Step 1: Write this plan** (the file you are reading).

### Task 2: Falsifier (red-at-base) — the fixture block

**Files:**
- Modify: `test/login.test.ts` (append one `describe` block at end of file; no import changes — `rmSync`, `Control`, `LoginDeps`, `LoginOutcome` and all helpers already exist at base and head)

**Interfaces:**
- Consumes: base-existing helpers only — `makeControl(c)`, `attendedDeps(c)`, `runAttendedLogin(deps, null)`, `runHeadlessLogin(deps)`, `captureLog(fn)`, `tempConfigDir()`, `resp(status, body)`; types `Control`, `LoginDeps`, `LoginOutcome`.
- Produces: two tests in describe `"FLLWUP-29: attended PKCE tokenExchangeFailed never emits the error_description detail line (boundary pair)"`.

- [ ] **Step 1: Write the fixture block** — append exactly this to `test/login.test.ts`:

```ts

// ---------------------------------------------------------------------------
// FLLWUP-29: attended-path boundary pair (test-only pin — no product change)
// ---------------------------------------------------------------------------

describe("FLLWUP-29: attended PKCE tokenExchangeFailed never emits the error_description detail line (boundary pair)", () => {
  const RULED = "Token exchange failed — run /rc:login to retry. No credentials were saved.";
  const DETAIL_PREFIX = "Details from the server:";
  const DESCRIPTION = "enrollment rejected by the admin";

  /** Minimal fetch over base helpers: discovery, device POST, token POST via onToken. */
  function pairFetch(c: Control): LoginDeps["fetch"] {
    return (async (input: string | URL | { url: string }, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (url.includes("/.well-known/oauth-authorization-server")) return resp(200, c.discovery);
      if (url === c.tokenEndpoint && method === "POST") {
        const out = c.onToken(c);
        return resp(out.status, out.body);
      }
      if (c.deviceEndpoint && url === c.deviceEndpoint && method === "POST") {
        return resp(200, c.deviceBody);
      }
      return resp(404, {});
    }) as unknown as LoginDeps["fetch"];
  }

  test("(a) attended (PKCE): 400 + error_description on the token body → ruled line, NO detail line", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({
      status: 400,
      body: { error: "some_other_error", error_description: DESCRIPTION },
    });
    const deps = attendedDeps(c);
    const { result, logs } = await captureLog(() => runAttendedLogin(deps, null));
    const o = result as LoginOutcome;
    expect(o.kind).toBe("failure");
    if (o.kind === "failure") expect(o.reason).toBe("tokenExchangeFailed");
    expect(logs).toContain(RULED);
    expect(logs.some((l) => l.startsWith(DETAIL_PREFIX))).toBe(false);
    rmSync(deps.configDir, { recursive: true, force: true });
  });

  test("(b) positive control: headless with the same onToken shape DOES print the detail line", async () => {
    const c = makeControl({}, {});
    c.onToken = () => ({
      status: 400,
      body: { error: "some_other_error", error_description: DESCRIPTION },
    });
    const configDir = tempConfigDir();
    const { logs } = await captureLog(() =>
      runHeadlessLogin({
        serverUrl: c.serverUrl,
        configDir,
        fetch: pairFetch(c),
        now: () => c.simNow,
        sleep: async () => {},
      })
    );
    expect(logs).toContain(RULED);
    expect(logs).toContain(`Details from the server: \`${DESCRIPTION}\``);
    rmSync(configDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Red-at-base record** — all seven convention fields, run BEFORE pushing:
  1. Base identity: `81d5c747349d2e1fc58e9cd898c057209c3f3213` — first parent of FLLWUP-25's mechanism merge `c9a570f` (PR #32 squash); role `required`.
  2. Transplant identity: the describe block of Task 2 Step 1 appended to the base tree's own `test/login.test.ts`; source head = this card's owner head at transplant time.
  3. Exact command: `bun test` (both halves).
  4. Raw red output: verbatim runner counts + every per-failure line (expected red: test (b) only; test (a) green at base by design — the mechanism-absent boundary).
  5. Worktree provenance: `git worktree add --detach ../pi-remote-fllwup-29-redbase 81d5c74…`; main checkout untouched; worktree removed after the run.
  6. Copy set: bare copy (no files beyond the transplant); `bun install`-generated `node_modules` only, to run the command.
  7. Head half: owner head sha, same command `bun test`, `0 fail`.

- [ ] **Step 3: Run gates at head** — `bun install`; `bunx tsc --noEmit` (exit 0); `bun test` (0 fail, 1 Windows-gated skip).

### Task 3: Commit, push, PR

**Files:** none new.

- [ ] **Step 1:** Commit plan doc (`docs: add FLLWUP-29 implementation plan`) and fixture (`test(login): pin attended PKCE tokenExchangeFailed no-detail boundary (FLLWUP-29)`).
- [ ] **Step 2:** Push `owner/fllwup-29-attended-no-detail`, open PR to `main` via `gh`, report PR number + head SHA.
