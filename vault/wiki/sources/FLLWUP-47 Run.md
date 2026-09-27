---
title: FLLWUP-47 Run
type: source
summary: The mechanical single-card run that pinned shutdown.closed's delivery to the notify sink with a path-specific row-level test (PR #53, merge 8ade4fb), closing the last gap the BUG-2 run left.
aliases: [FLLWUP-47 run, shutdown.closed notify row run]
tags: [council/run, testing, tui]
sources: ["[[FLLWUP-47 Run]]"]
created: 2026-09-27
updated: 2026-09-27
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the [[BUG-2 Run]], [[EPIC-3 Run (FLLWUP-27..30)]], [[EPIC-4 Run (FLLWUP-11..12)]], and [[EPIC-6 Run (FLLWUP-39..40)]] precedent. Authority is `council/cards/FLLWUP-47.md` (run record), PR #53, and the filed follow-up `council/cards/FLLWUP-48.md`.

A facilitator-run Council on **FLLWUP-47** (2026-09-27), the residual the [[BUG-2 Run]] filed. `council_route` returned a fallback, not a recorded mode. Step-1 judgment: **mechanical and not surface-touching** — a single row-level test, unambiguous, one area; it changes no copy and no surface, it *asserts* an existing string's delivery. So steps 2–6 were skipped by rule, no deliberation ran, and no `designer` sat ([[Council Seats]]).

**The gap.** BUG-2 proved `rc.unenrolled`, `rc.offLifecycle`, and `rc:login.refusal` at the notify sink but accepted `shutdown.closed` on constructor wiring alone: `onShutdown` calls `deps.print(loginEnglishFor("shutdown.closed"))`, and `print` is `ctx.ui.notify`. A later edit can keep that wiring and still drop the row ([[Fixture-Green Honesty]], [[Notify Sink]]).

**Why the obvious assertion was path-blind.** `rc.offLifecycle` and `shutdown.closed` render to the **identical** English bytes `"Remote tunnel closed"` ([[login.ts]] `loginEnglishFor`, `src/login.ts:287-288`). BUG-2's `expect(notifyLines).toContain("Remote tunnel closed")` ran after `/rc:off`, so it was satisfied by the *off-lifecycle* row and never touched the `session_shutdown` path. This is the [[Twin-Row Delivery Hazard]]: byte-identical copy across two paths makes a substring assertion useless as a path pin.

**What shipped (PR #53, head `f9ecd01db00000ec1d7819675877f3fc76632fd6`, squash merge `8ade4fb55e665016573b533d36ca78e6e94aafd5`).**
- `test/bug2-login-notify.test.ts` gains `session_shutdown delivers exactly \`Remote tunnel closed\` via ctx.ui.notify; console.log and process.stdout.write stay silent`. It loads the real [[index.ts]] entry against a fake host, **fires the sole `pi.on("session_shutdown")` handler** at the event-subscription boundary, then asserts the whole sink transcript `toEqual(["Remote tunnel closed"])` and both raw-terminal sentinels empty.
- Harness change: the fake host's `on` now captures handlers by event name (was `on: () => () => {}`), with a `fireEvent` helper and a deadline-bounded `waitForNotifyRow` poll (the shutdown handler is `void controller.onShutdown()` — fire-and-forget).
- **No production code changed.** Copy rows byte-unchanged; the footer state machine untouched.

**Verification.** Skeptic (job-2) at the pinned head: `bun install` → 6 packages, `bunx tsc --noEmit` exit 0, `bun test` **332 pass / 7 skip / 0 fail** across 20 files (skips = the Windows-gated credential ACL suite on Linux). Verdict **no open objections**. Gate integrity proven by defect injection ([[Real-Surface Verification]]): (a) row dropped from `onShutdown` leaving the `print → notify` wiring intact → red (row never hits the sink); (b) row rerouted to `console.log` → red; (c),(d) double-path `console.log` / `process.stdout.write` → red at the sentinel asserts; all four restored, suite green. Judge (job-3) **PASS** after re-running the suite at the head. CI on the merged SHA: workflow `gates` run 36327584974, `gates` and `gates-windows` success.

**Process.** Owner worktree cut from `origin/main` `2ab38b9` (`../pi-remote-fllwup-47`, branch `owner/FLLWUP-47-shutdown-notify-row`); the PR diff is product-only ([[Run Workspace Isolation]]). Local `main` fast-forwarded `2ab38b9..8ade4fb` — no union-merge reconcile needed. The step-12 record push went directly to `main` (`ffb8d84` Done, `0f26450` follow-up). **Deviation flagged, not overwritten:** step 11 says *the human merges, not the facilitator*, and every prior PR was merged by the account `tistaharahap`. The human explicitly authorized the facilitator to execute this merge in chat ("I'm authorizing you to merge now"); it was a pinned `--squash --match-head-commit`, no `--admin`, and is attributed to `tistaharahap`. The authorization is recorded verbatim in the `ffb8d84` commit body. The rule stands; this run is a flagged exception ([[Record-Push Discipline]]).

**Follow-up.** The owner's step-8 note — `fireEvent` captures handlers from both the direct `pi.on` seam and the `deps.on` forwarder but always passes one shared `fakeCtx`; a future test firing a forwarded event with event-shaped context may need per-event ctx variants — filed and pushed as **FLLWUP-48** (`0f26450`), approved at the step-13 gate (mode `active`, `File`).

## Related
[[Twin-Row Delivery Hazard]], [[Notify Sink]], [[login.ts]], [[index.ts]], [[copy.ts]], [[Fixture-Green Honesty]], [[Real-Surface Verification]], [[Council Seats]], [[Run Workspace Isolation]], [[Record-Push Discipline]], [[pi-remote]]

## Sources
`council/cards/FLLWUP-47.md`; PR #53 (merge `8ade4fb`); `council/cards/FLLWUP-48.md`. No `vault/raw/` file — deviation stated above.