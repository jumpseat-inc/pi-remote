---
title: BUG-2 Run
type: source
summary: The single-card run that moved /rc:login user lines off stdout onto ctx.ui.notify so they stop landing in the pi 0.87.1 prompt box (PR #52, merge 112ed22).
aliases: [BUG-2 run, login notify run, prompt-box bug]
tags: [council/run, login, tui, doctrine]
sources: ["[[BUG-2 Run]]"]
created: 2026-09-27
updated: 2026-09-27
---
**Provenance deviation, stated:** this run archived no `vault/raw/` file — the [[EPIC-3 Run (FLLWUP-27..30)]], [[EPIC-4 Run (FLLWUP-11..12)]], and [[EPIC-6 Run (FLLWUP-39..40)]] precedent. Authority is `council/cards/BUG-2.md` (run record), PR #52, and the filed follow-up `council/cards/FLLWUP-47.md`.

A facilitator-run Council on **BUG-2** (2026-09-27). `council_route` returned a fallback, not a recorded mode. The card was classified **mechanical and surface-touching**: the goal already named the sink, the forbidden writers, the exact copy rows, and the terminal footer value, so no deliberation ran and no `designer` sat ([[Council Seats]]). The visible change is where a person reads the lines, not what the lines say.

**What shipped (PR #52, head `68cd9ce`, merge `112ed2245e7b67c8224f1bf2046d3b42a7058fe2`).**
- [[login.ts]] `print` takes an optional `onUserLine` sink. `console.log` remains only when no sink is injected, so driver tests that do not pass one stay green. Production always injects the sink.
- [[index.ts]] production `print` is `(line) => requireCtx().ui.notify(line)`, and `createLoginCommand` gets `onUserLine: deps.print`. That wiring also covers `/rc`, `/rc:off`, the while-live refusal, the headless enroll line, and `shutdown.closed`. Leaving either seam on `console.log` would reproduce the bug on the next command.
- [[pi-sdk-on.ts]] vendors `notify(message: string, type?: "info" | "warning" | "error"): void`, byte-identical to installed `@earendil-works/pi-coding-agent` 0.87.1 `types.d.ts:77`.

Copy rows are byte-unchanged. The footer state machine is unchanged: authorizing, then exactly `Off`. The stacked footer in the screenshot was a redraw desync, not a second `setStatus`. This is [[Notify Sink]].

**Verification.** Skeptic (job-2) at the pinned head: `bun install --frozen-lockfile` exit 0, `bunx tsc --noEmit` exit 0, `bun test` **331 pass / 7 skip / 0 fail**. Skips are the six pre-existing construction-grounding probes plus the Windows-gated credential ACL test (Linux host; `gates-windows` later succeeded on the merged SHA). Rendered surface was read from installed `pi-tui` 0.87.1, not inferred from a stub: info `notify` → `showStatus` → chat transcript, never the editor ([[Real-Surface Verification]]). Red-at-base on an equal triple (base `74abc8ea`, transplant `test/bug2-login-notify.test.ts`, command `bun test test/bug2-login-notify.test.ts`): 0 pass / 3 fail at base, 3 pass / 0 fail at head; all three reds derived mechanism-absent. Judge PASS after re-running that test (3 pass / 0 fail / 16 expect() calls). CI on the merge commit: workflow `gates` run 36324181683, `gates` and `gates-windows` success.

**Process this run exercised.** Owner worktree cut from `origin/main` (`../pi-remote-bug-2`, branch `owner/BUG-2-login-notify`); the PR diff is product-only ([[Run Workspace Isolation]]). Local `main` had diverged (four council record commits vs the merge); union-merged as `ff0998e`, no conflict markers, neither side discarded. The step-12 record push **halted**: `council/phase1-authorizations.json` grants `direct-record-push-to-main` for run `EPIC-7` only ([[Record-Push Discipline]]). The human then said "push to remote"; the six record commits fast-forwarded `112ed22..2e13a89`. That chat instruction is an exception to the Phase-1-record rule, flagged on that page, not a rewrite of it. The human also said "Merge it"; the merge was an ordinary `--merge --match-head-commit`, no `--admin`.

**Residual.** `shutdown.closed` (`Remote tunnel closed`) has no row-level notify assertion — constructor wiring only. Filed and pushed as **FLLWUP-47** (`Ready`, `f18ec74`). [[Fixture-Green Honesty]]: wiring-by-construction is not a driven row.

## Related
[[Notify Sink]], [[login.ts]], [[index.ts]], [[pi-sdk-on.ts]], [[Gulf of Evaluation]], [[Real-Surface Verification]], [[Fixture-Green Honesty]], [[Record-Push Discipline]], [[Run Workspace Isolation]], [[Council Seats]], [[Seven Footer States]], [[pi-remote]]

## Sources
`council/cards/BUG-2.md`; PR #52 (merge `112ed22`); `council/cards/FLLWUP-47.md`. No `vault/raw/` file — deviation stated above.
