# BUG-2: /rc:login user lines via ctx.ui.notify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all `/rc:login` user lines (attended + headless) and the production `index.ts` print wiring through `ctx.ui.notify` instead of `console.log`, so lines stop painting inside pi's TUI prompt box.

**Architecture:** One injectable sink per seam. `src/login.ts`'s `print` helper gains an optional `LoginDeps.onUserLine` sink (fallback: the historical `console.log`, which keeps every existing login-driver test green unchanged). `index.ts`'s controller `print` dep becomes `requireCtx().ui.notify(line)` and the `createLoginCommand` call passes `onUserLine: deps.print`, so both seams converge on the same notify surface. The vendored `PiExtensionContext` gains the real `ui.notify` member.

**Tech Stack:** TypeScript, Bun, bun:test. pi 0.87.1 SDK surface (vendored structural types in `src/pi-sdk-on.ts`).

**Spec:** Card BUG-2 (verbatim handoff; council card file on local main, not in this worktree).

## Global Constraints

- Copy rows are byte-unchanged. No `src/copy.ts` or `src/login.ts` copy edits.
- Footer sentences stay on `ctx.ui.setStatus("pi-remote", …)` only — never also printed.
- User lines go through `ctx.ui.notify`; never `console.log` / `process.stdout.write` in production paths.
- Grounded notify signature (installed `@earendil-works/pi-coding-agent` 0.87.1 `dist/core/extensions/types.d.ts:77`): `notify(message: string, type?: "info" | "warning" | "error"): void`.
- Out of scope: browser-opener wiring (FLLWUP-43), the footer state machine, `ctx.ui.confirm` dialog copy.
- Gates: `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun test`. No data-import or boot gates in this repo.
- Conventional Commits; scope `translate` not needed here — use plain `fix:`/`test:` types.

## Review Focus

- A host context arriving before any notify (production `requireCtx()` throws if no ctx yet) — pinned by the entry-boundary test driving a real command handler with a fake `cmdCtx` (Task 3).
- `LoginDeps.onUserLine` absent (headless CLI-style reuse / existing tests) — fallback must remain `console.log`; pinned by a login-level test (Task 2).
- Tenant parenthetical only when `sub` is a non-empty string in the access-token JWT payload — pinned with a JWT token vs a non-JWT token (Task 1/2).
- `process.stdout.write` must also stay silent (not just `console.log`) — both sentinels patched in the BUG-2 tests (Task 1/2).

---

### Task 1: Transplant falsifier — red-at-base record (test-only commit)

**Files:**
- Create: `test/bug2-login-notify.test.ts` (self-contained; no harness imports)

**Interfaces:**
- Consumes: `runAttendedLogin`, `LoginDeps` from `../src/login`; the default entry from `../index.ts`.
- Produces: the mechanism-absent falsifier record (seven fields, recorded in the card run report).

- [ ] **Step 1: Write the falsifier test**

Test A (login seam): build attended deps (fixed `randomBytes`/`sha256`, fake discovery+token `fetch`, `openUrl` that fetches the loopback callback with the wire state) plus `onUserLine` collector. Patch `console.log` and `process.stdout.write` with recording sentinels. Drive `runAttendedLogin` to success with a JWT access token carrying `sub: "tenant-42"`. Assert the sink received exactly:
  - ``If the browser does not open, visit: `<authorizeUrl>` `` (rendered),
  - `Waiting for browser…`,
  - ``Signed in to `https://cp.example` — enrollment credentials saved for this host. Run /rc to start a tunnel.` + ` (tenant tenant-42)``,
and that both sentinels recorded nothing.

Test B (entry boundary): fresh temp `PI_CODING_AGENT_DIR`; load `../index.ts` default with a fake `pi` (capturing `registerCommand` handlers); invoke the `rc` handler with a fake `cmdCtx` whose `ui.notify` is recorded (and `setStatus`/`input`/`confirm` stubs). Assert notify received `No enrollment credential found — run /rc:login`; run `rc:off` handler; assert notify received `Remote tunnel closed`; both sentinels silent.

- [ ] **Step 2: Red at base (detached worktree at `74abc8ea6aeb320f221def97ca41c670220c1601`)**

Transplant only `test/bug2-login-notify.test.ts` into the detached base worktree; bare copy (no other files). Run `bun test test/bug2-login-notify.test.ts`. Record raw counts + per-failure lines. Remove the worktree.

- [ ] **Step 3: Watch the same test fail in the owner worktree (TDD RED)**

Run: `bun test test/bug2-login-notify.test.ts` → FAIL (lines land in sentinels, not the sink).

- [ ] **Step 4: Commit the falsifier** — `test: add BUG-2 notify-seam falsifier (red at base 74abc8e)`

### Task 2: Make the login seam deliver through the injected sink

**Files:**
- Modify: `src/login.ts` (`LoginDeps` interface; `print` helper ~line 973)
- Test: `test/bug2-login-notify.test.ts` (Test A turns green)

**Interfaces:**
- Produces: `LoginDeps.onUserLine?: (line: string) => void` — called once per user line; when absent the helper falls back to `console.log(line)` (existing login tests stay green unchanged).

- [ ] **Step 1: Add `onUserLine` to `LoginDeps`** (documented optional sink; production injects the controller's notify-routed `print`).
- [ ] **Step 2: Change `print` to call `deps.onUserLine?.(line)` first, else `console.log(line)`.**
- [ ] **Step 3: Run Test A → PASS** (`bun test test/bug2-login-notify.test.ts`).
- [ ] **Step 4: Run the full login suite** (`bun test test/login.test.ts test/login-cancel.test.ts`) → all green unchanged (fallback path).
- [ ] **Step 5: Commit** — `fix(transport): route login user lines through the injected notify sink`

### Task 3: Production wiring — index.ts print → ctx.ui.notify

**Files:**
- Modify: `src/pi-sdk-on.ts` (`PiExtensionContext.ui` gains `notify`)
- Modify: `index.ts` (line ~962 `print` dep; `createLoginCommand` call ~line 684)
- Test: `test/bug2-login-notify.test.ts` (Test B turns green)

**Interfaces:**
- Produces: controller dep `print: (line) => requireCtx().ui.notify(line)`; login command receives `onUserLine: deps.print`.

- [ ] **Step 1: Add grounded `notify(message: string, type?: "info" | "warning" | "error"): void;` to the vendored ui surface with provenance comment (installed types.d.ts:77).**
- [ ] **Step 2: Point `print` at `requireCtx().ui.notify(line)` and pass `onUserLine: deps.print` into `createLoginCommand`.**
- [ ] **Step 3: Run Test B → PASS; then `bun test test/bug2-login-notify.test.ts` fully green.**
- [ ] **Step 4: Commit** — `fix(transport): print command output via ctx.ui.notify, not console.log`

### Task 4: Harness-level acceptance tests (attended success, headless, tenant suffix)

**Files:**
- Modify: `test/index.test.ts` (BUG-1 helper comment + BUG-2 tests)

**Interfaces:**
- Consumes: harness `makeHarness` (`printed` collector = the notify stand-in, `setStatus` recorder).

- [ ] **Step 1: New BUG-2 test — attended success:** harness with `inputPrompt → ""`, zero `randomBytes`, browser-simulating `openUrl`, fake discovery/token fetch (token = JWT with `sub: "tenant-42"`); console.log + process.stdout.write sentinels; run `rc:login`. Assert: `printed` contains the rendered fallback, `Waiting for browser…`, and the success line with ` (tenant tenant-42)`; sentinels empty; `setStatus` contains `Authorizing with the control plane…` and its last entry is `Off`.
- [ ] **Step 2: New BUG-2 test — no tenant:** same flow with non-JWT access token `at-new`; success line has NO ` (tenant …)` suffix.
- [ ] **Step 3: Update the BUG-1 headless tests:** lines now land in `h.printed` (via `onUserLine: deps.print`), not `logs`; assert sentinels stayed silent. Update the stale `captureConsole` comment.
- [ ] **Step 4: Run** `bun test test/index.test.ts` → green.
- [ ] **Step 5: Commit** — `test: pin BUG-2 notify delivery for attended and headless /rc:login`

### Task 5: Gates + push + PR

- [ ] **Step 1:** `bun install --frozen-lockfile` → clean.
- [ ] **Step 2:** `bunx tsc --noEmit` → exit 0.
- [ ] **Step 3:** `bun test` → full suite green (expected non-pass limited to the Windows-gated credential-ACL skip on non-Windows).
- [ ] **Step 4:** Push `owner/BUG-2-login-notify`; `gh pr create` with what-changed + verify instructions. Do not poll CI. Do not merge.
