---
id: BUG-1
title: "Route /rc:login --headless to the device-flow driver instead of hardcoding attended"
state: Done
owner: null
epic: EPIC-1
goal: Invoking `/rc:login --headless` selects the login driver's `headless` mode — the RFC 8628 device flow, observable as the `login.headless.instructions` copy being printed and no browser being opened — while `/rc:login` with no flag still selects `attended`, both proven by tests in test/index.test.ts.
---

## Intent

`/rc:login --headless` is specified behavior: PI-SPEC §7.2 defines the RFC 8628
Device Authorization Grant for headless hosts, §8's command table documents
`/rc:login --headless` as running it, and EV-7's goal and acceptance require
both modes ("On a headless host, `/rc:login` completes by relaying a single
short value (code or URL) through another device"). The driver already exists
and is tested: `src/login.ts` exports `type LoginMode = "attended" | "headless"`
and `run(mode, …)`, and `test/login.test.ts`'s "EV-7 headless flow" suite
exercises it, including the discovery-without-device-endpoint failure.

The gap is at the command surface. `index.ts`'s `rcLoginCommand()` takes no
arguments and calls `cmd.run("attended", existing)` unconditionally. Both
registrations drop the argument: `RemoteController.commands` is typed
`handler: () => void | Promise<void>`, `deps.command("rc:login", rcLoginCommand)`
passes the zero-argument function, and the entry point's
`handler: (args) => handler(args)` hands the argv string to it anyway. So
`--headless` is silently ignored and every invocation runs the attended browser
flow — a shipped surface that contradicts both the spec's command table and
EV-7's acceptance.

The fix is small and well-bounded: thread the argv string through the command
type and both registration points, parse `--headless` (attended stays the
default when the flag is absent), and pass the resolved `LoginMode` to
`run()`. Everything else must stay exactly as shipped: the while-live/non-idle
refusal (EV-8 J5, synced into §8 by FLLWUP-10), the server-URL prompt that
fires before the driver, the `authorizing` → `off` footer transitions, and the
final `applyFooter("off")` on both success and failure. No user-visible copy is
added or changed — both flows' copy is already keyed and ruled — so no
product-owner copy ruling is required.

Adjacent but out of scope (separate open follow-ups, both epic EPIC-2):
FLLWUP-24 (RFC 8628 §3.2 connection-failure slowdown during polling) and
FLLWUP-25 (surface the token endpoint's `error_description`). This card only
routes the flag; it does not change the device-flow driver's poll semantics.

## Acceptance

- `/rc:login --headless` invokes the login driver with mode `headless`: the
  device-flow copy (`login.headless.instructions`) is printed and no browser is
  opened (`openUrl` not called) — an automated test in `test/index.test.ts`.
- `/rc:login` with no flag still invokes the driver with mode `attended` — an
  automated test in `test/index.test.ts`.
- The while-live/non-idle refusal still fires before any mode selection and its
  copy is unchanged.
- `bunx tsc --noEmit` exit 0; `bun test` exit 0 with the full suite green.

## Run record

### Step 1 — read and gate (facilitator)
Card read; `state: Ready`. `council_route` op `route` → fallback (`no recorded decision for the current packed state`), so step 1's own judgment applies. Classification: **mechanical** — narrowly scoped, unambiguous, confined to one area (the `index.ts` command surface and its tests), no design tradeoff. **Surface-touching: yes** — the command surface is user-visible. Mechanical + surface-touching seats no `designer`. Proceeded directly to step 7.

Sequencing (human-directed): steward ruled the batch order **BUG-1 → FLLWUP-24 → FLLWUP-25**, with FLLWUP-25 gated on a product-owner copy ruling.

### Step 7 — mechanical handoff
No deliberation ran, so no spec file; the card's own `Intent`/`goal`/`Acceptance` is the handoff. Card set `In Progress`; `validate.py` clean.

### Step 8 — owner implements (job-2, settled 12.1m)
Isolated worktree `.worktrees/bug-1/`, branch `fix/bug-1-headless-login`, PR **#30** open at head `a83209c61b25089dd29559c2b1eabc537d56245c`. Local gates: `bun install` ok; `bunx tsc --noEmit` exit 0; `bun test` **221 pass / 1 skip / 0 fail** (baseline 218/1/0), 3 new tests. TDD red commit `ee821a4` (2 new tests red — the attended copy printed). Owner delta: `index.ts` (+7/−3), `test/index.test.ts`, plan doc; `src/login.ts` untouched. Card set `In Review` from the observed open PR.

Note (facilitator): the branch was cut from the run's local `main`, so PR #30 also carried the run's four council/config/preflight commits; the facilitator disambiguated the base for the Skeptic. Filed as **FLLWUP-27**.

### Step 9 — skeptic verifies (job-3, settled 4.2m)
`council_route` op `recheck` at `a83209c` → fallback, `rechecked: false`; no re-route. Skeptic at the pinned SHA: **no open objections**; 10 objections, each with a runnable test, all `closed-green`. Head: tsc exit 0, `bun test` 221/1/0, `-t "BUG-1"` 3 pass, `-t "EV-8 /rc:login"` 6 pass. Red-at-base pair at `3df2ed4` with `test/index.test.ts` transplanted → **219 pass / 1 skip / 2 fail** (received transcript shows the attended copy); 0 fail at head. tsc failure-injection → TS2322 exit 1 → restored exit 0. Scope: 3 files; `src/copy.ts` + `src/login.ts` 0-line diff.

### Step 10 — judge (job-4, settled 0.8m)
Input: the `goal` + Skeptic evidence only. **Verdict: PASS** (independently re-ran `bun test` 221/1/0, `-t "BUG-1"` 3 pass, `-t "EV-8 /rc:login"` 6 pass).

### Step 11 — merge gate (unattended, human-authorized)
Human authorized unattended merging with `--admin` for this batch. Merged via `gh pr merge 30 --admin --merge --match-head-commit a83209c…`; PR MERGED at 2026-09-23T17:46:26Z, merge commit **`d7907166971e2a6d0d2b748706c2c6f31de49d93`**. CI on the merged SHA: `gates` success, `gates-windows` success.

### Step 12 — sync and reconcile
`git fetch origin`; `git rebase origin/main` replayed the single local-only commit cleanly; `d790716` confirmed an ancestor of the new HEAD; no conflict markers; `validate.py` clean. Card set `Done` from the observed merged artifact.

### Step 13 — follow-ups
One candidate drafted: *Base owner worktrees on origin/main so card PRs stay product-only* → gate `active` rendered **File** (composite 0.31 < 1.00). Applied under the unattended authorization as **FLLWUP-27**.

### Step 14 — persist
No durable wiki artifact surfaced for this card; nothing hand-edited under `vault/`.