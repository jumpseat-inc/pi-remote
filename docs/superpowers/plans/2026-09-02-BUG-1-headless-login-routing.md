# BUG-1 Implementation Plan — Route `/rc:login --headless` to the device-flow driver

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invoking `/rc:login --headless` selects the login driver's `headless` mode (RFC 8628 device flow); `/rc:login` with no flag still selects `attended`; both proven by tests in `test/index.test.ts`.

**Architecture:** Thread the argv string through the command-handler type (`RemoteController.commands`, `RemoteControllerDeps.command`, and the internal `rcCommand`/`rcOffCommand`/`rcLoginCommand` signatures), parse the literal token `--headless` into a `LoginMode` in `rcLoginCommand()`, and pass it to `cmd.run(mode, existing)`. Everything else (J5 refusal, J2 URL prompt, footer transitions, `applyFooter("off")` on both terminals) is untouched.

**Tech Stack:** Bun + TypeScript. Tests: `bun test` with the existing dependency-injected `RemoteControllerDeps` harness in `test/index.test.ts`.

**Spec:** Card BUG-1 (verbatim, in the dispatch) — Intent and Acceptance sections. Source-of-truth docs: `docs/PI-SPEC.md` §7.2, §8, EV-7; `src/login.ts` exports `type LoginMode = "attended" | "headless"` (L48) and `run(mode, …)` (L100).

## Global Constraints

- `--headless` is the literal token; no flag (or args without it) → `"attended"`. No other tokens recognized.
- No user-visible copy added or changed (card: "No user-visible copy is added or changed").
- Do NOT touch `src/login.ts` (reserved for FLLWUP-24/25).
- The while-live/non-idle refusal (J5, `rc:login.refusal`) still fires **before** any mode selection; copy unchanged.
- Footer behavior unchanged: `authorizing` on driver begin, `off` on both success and failure.
- Gates: `bunx tsc --noEmit` exit 0; `bun test` ≥ 218 pass, 0 fail (baseline: 218 pass / 1 skip).
- Conventional Commits.

## Review Focus

- **Args string with trailing/extra tokens** (e.g. `"--headless "`, `"--headless --foo"`): `"--headless"` must still resolve to headless. → Pinned by Task 1's `"args containing the token"` test.
- **`handler()` called with no args by existing callers** (`test/copy.test.ts:323` calls `await rc.handler()`): optional parameter keeps this compiling and attended. → Pinned by full-suite green after widening the type.
- **J5 refusal ordering vs mode selection:** refusal must fire before parsing matters; a live session with `--headless` must still refuse. → Pinned by extending the existing refusal test to pass `--headless`.
- **OpenURL must never fire in headless mode** (card acceptance: "no browser is opened"): if the attended path were reached, `openUrl` would be invoked after discovery. → The headless test uses a discovery mock that serves a device endpoint and asserts `openUrl` calls = 0.

---

### Task 1: Failing tests in `test/index.test.ts` (EV-8 block)

**Files:**
- Modify: `test/index.test.ts` (the `describe("EV-8 /rc:login (J5)")` block, ~L723)

**Interfaces:**
- Consumes: `h.runCommand(name, args?)` (extended harness method), `h.deps.fetch` override, `h.printed`, `console.log` capture, `loginEnglishFor` from `../src/login`.
- Produces: two tests that fail on current code (headless flag ignored → attended path runs).

**Harness change (precondition for the tests):** the harness's `command` dep records handlers as `() => handler(name)`, dropping args, and `runCommand` passes none. Extend both seams so argv reaches `rcLoginCommand`:

```ts
// in the Harness interface
runCommand: (name: string, args?: string) => Promise<void>;

// in makeHarness deps
command: (name, handler) => {
  commandHandlers[name] = (args?: string) => handler(name, args);
},

// runCommand implementation
runCommand: async (name, args) => {
  await commandHandlers[name]?.(args);
},
```

Note: the `commandHandlers` map's value type must widen from `() => void | Promise<void>` to `(args?: string) => void | Promise<void>`.

**Step 1: Write the failing tests** — add inside `describe("EV-8 /rc:login (J5)")`, after the existing tests:

```ts
test("EV-7 + BUG-1: /rc:login --headless runs the device flow; no browser opened", async () => {
  const openUrls: string[] = [];
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...a: unknown[]) => {
    logs.push(a.join(" "));
  };
  const h = await makeHarness({
    openUrl: async (url) => {
      openUrls.push(url);
      return true;
    },
  });
  h.deps.fetch = (async (url: string) => {
    if (url.includes("oauth-authorization-server")) {
      return new Response(
        JSON.stringify({
          authorization_endpoint: "https://cp.example.com/auth",
          token_endpoint: "https://cp.example.com/token",
          device_authorization_endpoint: "https://cp.example.com/device",
        }),
        { status: 200 }
      );
    }
    if (url.includes("/device")) {
      return new Response(
        JSON.stringify({
          device_code: "dc-1",
          user_code: "ABCD-EFGH",
          verification_uri: "https://cp.example.com/verify",
          verification_uri_complete: "https://cp.example.com/verify?code=ABCD-EFGH",
          expires_in: 300,
          interval: 5,
        }),
        { status: 200 }
      );
    }
    if (url.includes("/token")) {
      return new Response(
        JSON.stringify({ access_token: "at-new", refresh_token: "rt-new", expires_in: 3600 }),
        { status: 200 }
      );
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    await h.runCommand("rc:login", "--headless");
  } finally {
    console.log = origLog;
  }

  expect(logs).toContain(loginEnglishFor("login.headless.instructions"));
  expect(openUrls).toHaveLength(0); // no browser in headless mode
  expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
  h.relay.stop();
});

test("EV-7 + BUG-1: /rc:login with no flag still runs the attended flow", async () => {
  const openUrls: string[] = [];
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...a: unknown[]) => {
    logs.push(a.join(" "));
  };
  const h = await makeHarness({
    randomBytes: () => new Uint8Array(8),
    openUrl: async (url) => {
      openUrls.push(url);
      // Simulate the browser completing consent (same wire trick as the
      // existing attended test: fetch the redirect_uri with the state).
      const u = new URL(url);
      const state = u.searchParams.get("state") ?? "";
      const redirect = u.searchParams.get("redirect_uri") ?? "";
      await fetch(`${redirect}?code=okcode&state=${state}`);
      return true;
    },
  });
  h.deps.fetch = (async (url: string, init?: RequestInit) => {
    if (url.includes("oauth-authorization-server")) {
      return new Response(
        JSON.stringify({
          authorization_endpoint: "https://cp.example.com/auth",
          token_endpoint: "https://cp.example.com/token",
          device_authorization_endpoint: "https://cp.example.com/device",
        }),
        { status: 200 }
      );
    }
    if (url.includes("/token") && init?.method === "POST") {
      return new Response(
        JSON.stringify({ access_token: "at-new", refresh_token: "rt-new", expires_in: 3600 }),
        { status: 200 }
      );
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    await h.runCommand("rc:login");
  } finally {
    console.log = origLog;
  }

  expect(openUrls.length).toBeGreaterThanOrEqual(1); // attended opens the browser
  expect(logs).not.toContain(loginEnglishFor("login.headless.instructions"));
  expect(lastSet(h.setStatus)).toBe(OFF_SENTENCE);
  h.relay.stop();
});

test("EV-7 + BUG-1: args containing the token select headless (token is literal, whitespace-tolerant)", async () => {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...a: unknown[]) => {
    logs.push(a.join(" "));
  };
  const h = await makeHarness({});
  h.deps.fetch = (async (url: string) => {
    if (url.includes("oauth-authorization-server")) {
      return new Response(
        JSON.stringify({
          authorization_endpoint: "https://cp.example.com/auth",
          token_endpoint: "https://cp.example.com/token",
          device_authorization_endpoint: "https://cp.example.com/device",
        }),
        { status: 200 }
      );
    }
    if (url.includes("/device")) {
      return new Response(
        JSON.stringify({
          device_code: "dc-1",
          user_code: "ABCD-EFGH",
          verification_uri: "https://cp.example.com/verify",
          expires_in: 300,
        }),
        { status: 200 }
      );
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  try {
    await h.runCommand("rc:login", "--headless --extra");
  } finally {
    console.log = origLog;
  }

  expect(logs).toContain(loginEnglishFor("login.headless.instructions"));
  h.relay.stop();
});
```

Also extend the existing refusal test with a `--headless` variant assertion (J5 precedence — refusal fires regardless of argv):

```ts
// inside the existing "refused when live" test, after the first refusal check:
await h.runCommand("rc:login", "--headless");
expect(h.printed).toContain(loginEnglishFor("rc:login.refusal"));
expect(lastSet(h.setStatus)).toBe(LIVE_SENTENCE); // footer unchanged
```

(Note: the headless tests capture `console.log` because the driver's `print` seam is `console.log` (src/login.ts L836), not `deps.print` — restore it in `finally` so relay error output isn't swallowed.)

**Step 2: Run to verify RED**

Run: `bun test test/index.test.ts`
Expected: FAIL — the new headless test fails because `runCommand` drops args and `rcLoginCommand` hardcodes `"attended"` (the attended flow errors on the un-mocked device endpoint discovery → `openUrls` gets no call but `login.headless.instructions` never prints; the no-flag test fails on `openUrls.length` since `openUrl` isn't wired through the harness's dropped-args handler yet). Confirm the failure messages name the missing behavior, not a typo.

**Step 3: Commit the red tests**

```bash
git add test/index.test.ts
git commit -m "test(index): BUG-1 failing tests for /rc:login --headless routing"
```

(Committing a red test is intentional for this card: the runner records red→green evidence; Task 2 immediately makes it green before the PR.)

### Task 2: Route the mode through `index.ts` (GREEN)

**Files:**
- Modify: `index.ts` (~L93 `RemoteControllerDeps.command`, ~L115 `RemoteController.commands`, ~L544 `rcLoginCommand`, ~L588 `deps.command("rc:login", …)`, ~L657 returned `commands`, ~L694 entry-point `command` dep)

**Interfaces:**
- Consumes: `LoginMode` from `./src/login` (already exported, L48).
- Produces: command handlers with signature `(args: string | undefined) => void | Promise<void>`; `rcLoginCommand(args?: string)`; mode resolution `--headless` → `"headless"`, otherwise `"attended"`.

**Step 1: Widen the handler types and thread args (minimal implementation)**

- Import `LoginMode` type alongside the existing import:

```ts
import { createLoginCommand, loginEnglishFor } from "./src/login";
import type { LoginMode } from "./src/login";
```

- Widen `RemoteControllerDeps.command` (index.ts ~L93):

```ts
command: (name: string, handler: (args: string | undefined) => void | Promise<void>) => void;
```

(this is already the shape — verify; widen only if it differs)

- Widen `RemoteController.commands` (index.ts ~L115):

```ts
commands: { name: string; handler: (args?: string) => void | Promise<void> }[];
```

- Widen only `rcLoginCommand` (minimal: `rcCommand`/`rcOffCommand` stay zero-param; a zero-param function is assignable to both the `deps.command` handler type and the widened `commands` entry, and they ignore argv today):

```ts
async function rcLoginCommand(args?: string): Promise<void> {
  // J5 refusal FIRST (unchanged) — mode selection happens only after it.
  if (footer === "live" || footer === "dialing" || footer === "resyncing" || footer === "authorizing" || footer === "error") {
    deps.print(loginEnglishFor("rc:login.refusal"));
    return;
  }
  // BUG-1: parse the mode from argv. `--headless` is the literal token;
  // no flag (or any args without it) → attended (EV-7/§7.2/§8).
  const mode: LoginMode = (args ?? "").split(/\s+/).includes("--headless") ? "headless" : "attended";
  // …rest of body unchanged until the run call…
  const outcome = await cmd.run(mode, existing);
  void outcome;
  applyFooter("off"); // success AND failure both return to off (J5/EV-7)
}
```

- The returned `commands` array needs no shape change (the functions now accept the optional param), but confirm its declared type matches the widened `RemoteController.commands`.
- Entry point (index.ts ~L694) already forwards: `handler: (args) => handler(args)` — verify it compiles with the widened dep type; no change expected there.

**Step 2: Run the suite to verify GREEN**

Run: `bun test test/index.test.ts`
Expected: PASS — all tests in the file green, including the three new ones and the extended refusal test.

**Step 3: Commit**

```bash
git add index.ts
git commit -m "feat(index): route /rc:login --headless to the device-flow login driver"
```

### Task 3: Full gates + plan bookkeeping

**Files:**
- Modify: `docs/superpowers/plans/2026-09-02-BUG-1-headless-login-routing.md` (checkboxes only)

**Step 1: Typecheck gate**

Run: `bunx tsc --noEmit`
Expected: exit 0, "No errors found".

**Step 2: Full test gate**

Run: `bun test`
Expected: ≥ 218 pass (baseline 218 + 3 new = 221), 0 fail, 1 Windows-gated skip unchanged.

**Step 3: Mark plan checkboxes done and commit**

```bash
git add docs/superpowers/plans/2026-09-02-BUG-1-headless-login-routing.md
git commit -m "docs: add BUG-1 headless login routing implementation plan"
```

### Task 4: Push branch and open PR

**Step 1:** `git push -u origin fix/bug-1-headless-login`

**Step 2:** `gh pr create --base main --title "fix(index): route /rc:login --headless to the device-flow driver" --body "<summary + gate results>"`

Report: branch name, PR URL, head SHA, gate outputs, `git diff --numstat`.
