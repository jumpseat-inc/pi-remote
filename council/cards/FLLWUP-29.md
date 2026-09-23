---
id: FLLWUP-29
title: "Pin the attended PKCE path's no-error_description boundary in the login suite"
state: In Review
owner: null
epic: EPIC-3
goal: The login suite pins that the attended (PKCE) token-exchange path emits no `login.failure.detail` line even when the response body carries an `error_description`, so the dispatch boundary the Skeptic proved only by ad-hoc probe is covered by a committed fixture.
---

## Intent

Filed from the FLLWUP-25 run's Skeptic verification. FLLWUP-25 added the
`login.failure.detail` line to the headless device-flow poll's
`tokenExchangeFailed` path only; the attended (PKCE) token-exchange path must
not emit it. The owner's committed fixtures cover the device-flow boundaries
(`deviceDenied`, `expiredCode`, `invalidTokenResponse`) but not the attended
path — the Skeptic proved the attended boundary correct by an ad-hoc probe only.

Behavior is correct today; this card pins it so a future change that widens the
emit site into the shared `tokenExchangeFailed` handling cannot silently start
printing the server's description on the attended path without a red test.

## Acceptance

- A committed fixture in `test/login.test.ts` drives the attended (PKCE)
  token-exchange failure with an `error_description` present on the response
  body and asserts NO `login.failure.detail` line is printed.
- The fixture fails if the attended path starts emitting the detail line
  (red-at-base demonstrated for the mechanism it pins).
- No product behavior or copy changes; `bunx tsc --noEmit` exit 0; `bun test`
  green.

## Run rulings — /features-deliver EPIC-3 (2026-09-23)

Recorded human decisions, for this run only; immutable for the run and binding
on every seat, `steward` included. A runner that meets a dispute covered here
applies the ruling and cites it; it does not re-ask.

- **R-CONV-1 (FLLWUP-27, FLLWUP-30)** — The run-hygiene conventions are written
  in this repository's `AGENTS.md`. This card is unaffected; recorded here for
  run completeness.
- **R-ORDER-1 (run-wide)** — Build order: FLLWUP-27 → FLLWUP-30 → FLLWUP-28 →
  FLLWUP-29. This card runs fourth.
- **R-PUSH-1 (run-wide)** — Run-scoped authorization: the step-12 record
  commit may be committed and pushed directly to `main` for this run only.
  Never extended to any later run.
- **R-ADMIN-1 (run-wide)** — Run-scoped authorization:
  `gh pr merge <PR> --squash --admin --match-head-commit <X>` may be used if a
  `main` ruleset blocks an ordinary merge. Unused while `main` is unprotected.
  Never extended to any later run.
- **R-MERGE-1 (run-wide)** — This run is unattended. The orchestrator executes
  the deterministic merge check and the merge without pausing for human
  confirmation, including the first merge of the run.
## Run record — /features-deliver EPIC-3 (2026-09-23)

### Step 1 — recorded mode Direct (authoritative)
EV-70 owner-only lane. Mechanical, not surface-touching (test-suite-only change, no user-visible surface). Concurs with the recorded routing; no fallback judgment needed. Direct path: no deliberation, no spec file, no skeptic, no judge — merge criteria 1, 2, 5 only. (`council_route` is not exposed in this container; the recorded mode from the dispatch input is authoritative per EV-69/EV-70.)

### Step 7 — handoff (this commit)
Card set `In Progress` (card + board), validate.py clean. Owner handed the card's own Intent/goal (mechanical path — no spec file) with facilitator-gathered grounding:

- Mechanism: FLLWUP-25's `login.failure.detail` emit lives on the headless `tokenExchangeFailed` dispatch only (`src/login.ts` ~792–803, guarded by the FLLWUP-25 comment); the attended PKCE exchange (~573) prints only the ruled line and never parses the response body on `!res.ok`. The committed FLLWUP-25 boundary fixture covers headless outcomes (deviceDenied / expiredCode / invalidTokenResponse) only — no attended-path fixture exists (the Skeptic proved the attended boundary by ad-hoc probe, uncommitted).
- Red-at-base base: `81d5c747349d2e1fc58e9cd898c057209c3f3213` — first parent of FLLWUP-25's mechanism merge `c9a570f` (PR #32 squash; branch head `b78f744`). Role: required. The same base FLLWUP-25's skeptic transplanted onto. At this base no detail-line mechanism exists anywhere.
- Design consequence (stated in the handoff, verbatim rule from the convention): an attended-only negative assertion is GREEN at that base (the attended path printed no detail line even pre-mechanism), so it cannot produce a valid red. The falsifier must be a boundary PAIR in one self-contained describe block: (a) the attended drive — callback completes, token POST answers non-2xx with `error` + `error_description` in the body — asserting outcome `tokenExchangeFailed`, the ruled line printed, and NO line starting with "Details from the server:"; and (b) a headless drive with the same onToken shape asserting the detail line IS printed — the positive control that is red at the base (mechanism absent: no dispatched token-exchange path emits the detail line) and proves the negative assertion's detection machinery is live (same capture harness, same prefix matcher). On a future widening of the emit into shared handling, half (a) goes red — the pin the card exists for.
- Transplant constraints: the block must use only base-existing helpers (`makeControl`, `attendedDeps`, `runHeadlessLogin`, `runAttendedLogin`, `captureLog`, `tempConfigDir`, `fakeJwt`, `resp`) and must NOT import or reference `sanitizeErrorDescription` or the `login.failure.detail` key — both absent at `81d5c74`; an import/reference failure is a copy-set-dependent red, disqualified as a base measurement. Transplant = the describe block appended to the base tree's own `test/login.test.ts`, no new files.
- Ruled copy constants for assertions: ruled line "Token exchange failed — run /rc:login to retry. No credentials were saved."; detail prefix "Details from the server:".
- origin/main at dispatch: `f5235893bf5d6026f801b8c7951f531c1ef54bca` (carries FLLWUP-28's PR #35 fixture; suite 236 tests, 235 pass / 1 skip / 0 fail). SSH :22 to github.com is blocked; a repo-local `url.https://github.com/.insteadOf git@github.com:` rewrite is configured in the shared `.git/config`, so linked worktrees fetch/push over HTTPS — do not debug ssh timeouts.

### Step 8 — owner implements (job-5.1, settled 6.0m, ~0.88M tokens)
Worktree `/home/tista/codes/pi-remote-fllwup-29` cut from `origin/main` `f5235893bf5d6026f801b8c7951f531c1ef54bca` (main-worktree HEAD untouched). Branch `owner/fllwup-29-attended-no-detail`, PR #36 open at head `c7697e9421e0f6f5351729e19bc1d7d7a06e30f7`, diff = `test/login.test.ts` (+64) + plan doc (+131) only — no product changes. Fixture: describe block `FLLWUP-29: attended PKCE tokenExchangeFailed never emits the error_description detail line (boundary pair)` — (a) attended drive via `attendedDeps`, token POST 400 + `{error, error_description}`, asserts outcome `tokenExchangeFailed`, ruled line printed, NO line starting "Details from the server:"; (b) headless positive control, same onToken shape, asserts the detail line IS printed. Red-at-base (owner record, all seven fields): base `81d5c747349d2e1fc58e9cd898c057209c3f3213` (required; first parent of FLLWUP-25 mechanism merge `c9a570f`), transplant = the 63-line describe block appended to the base tree's own `test/login.test.ts` (source head `c7697e9`, no new files), command `bun test` both halves, red = 225 pass / 1 skip / 1 fail / 1288 expect() / 227 tests, single failure line naming the positive-control half: `Expected to contain: "Details from the server: \`enrollment rejected by the admin\`"` (mechanism-absent class — attended half (a) passed at base, red names the absent mechanism artifact, not a copy-set artifact), detached worktree `../pi-remote-fllwup-29-redbase` removed after run, copy set bare (+`node_modules` from `bun install` to execute), head half `c7697e9` / `bun test` / 0 fail. Gates in the worktree: `bun install` ok; `bunx tsc --noEmit` exit 0; `bun test` 237 pass / 1 skip / 0 fail (238 tests across 11 files). Card set `In Review` from the observed open PR (facilitator-verified: `gh pr view 36` OPEN at `c7697e9`, `gh pr diff --name-only` = plan doc + test file). Merge gate recorded at step 11.
