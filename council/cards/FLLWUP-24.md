---
id: FLLWUP-24
title: "Honor RFC 8628 §3.2's connection-failure slowdown: retry the device-flow token poll after 5s instead of failing terminal unreachable"
state: Done
owner: null
epic: EPIC-2
goal: The headless device-flow driver retries the token poll after 5 seconds when the request fails at the connection level (fetch throw), per RFC 8628 §3.2, instead of failing terminal unreachable.
---

## Intent

Filed from FLLWUP-22's deferred items (the §2.3 poll-shape fix, PR #26, left
this deliberately out of its boundary). RFC 8628 instructs clients that hit a
connection failure during polling to wait 5 seconds and retry; the shipped
driver treats any fetch throw as terminal `unreachable`. Real divergence,
client-side fix — a transient network blip during a 5-300s device-flow window
should not kill a login that would have succeeded. User-visible surface — the
`/rc:login --headless` failure copy: `unreachable` becomes rarer and the retry
is silent unless the window expires.

## Acceptance

- On a connection-level failure (fetch throw), the driver waits 5 seconds and
  re-polls, within the device-code window. At device-code-window expiry the
  terminal outcome is cause-distinguished: if no token poll in the window ever
  received an HTTP response, the outcome is `unreachable` with its existing
  verbatim copy; if at least one poll received a response, the outcome is
  `timedOut` with its existing copy. No copy string changes.
- The four RFC 8628 error codes' dispatch (FLLWUP-22's 400-window table) is
  unchanged; `authorization_pending`/`slow_down` semantics unchanged.
- Fixtures cover the retry path (connection failure → 5s → success) and the
  expiry boundary; bunx tsc --noEmit exit 0; bun test full suite green.
- No copy change without the product-owner's ruling (user-visible lines are
  verbatim-ruled or keyed — see [[Stable Keys]]).

## Errata

- **RFC citation (product-owner 2026-09-02).** The title and goal cite RFC 8628
  §3.2 for the connection-failure slowdown; the directive is **§3.5** and the 5s
  figure is §3.2's default minimum poll interval. The goal's normative content is
  unaffected. See `vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md`.
- **Cause-distinguished expiry (product-owner 2026-09-02).** Acceptance clause 1
  was amended by the product-owner: at device-code-window expiry the terminal
  outcome is `unreachable` if the token endpoint was never reached in the window,
  else `timedOut`. No copy strings change. Same ruling file.

## Run record

### Step 1 — read and gate (facilitator)
`council_route` op `route` → fallback (no recorded decision for the packed state). Classification: **mechanical** — one module (`src/login.ts`), one loop, no design tradeoff. **Surface-touching: yes** — it changes when the `unreachable` error state appears. Mechanical + surface-touching seats no `designer`. Batch order per the steward ruling: BUG-1 → FLLWUP-24 → FLLWUP-25.

### Step 7 — mechanical handoff
No spec file; the card's own `Intent`/`goal`/`Acceptance` is the handoff. Card set `In Progress`; validate.py clean.

### Step 8 — owner implements (job-5, settled 20.5m)
Worktree based on `origin/main` (FLLWUP-27 convention). Branch `fix/fllwup-24-slowdown-retry`, PR #31 at head `1013bc22f305f0deef1a16c62385755e7d156065`. Gates: `bun install` ok; `bunx tsc --noEmit` exit 0; `bun test` 223/1/0. Product-only delta: plan doc, `src/login.ts` (+7/−2), `test/login.test.ts` (+82), `docs/PI-SPEC.md` (+3). Card set `In Review` from the observed open PR.

### Step 9 (cycle 1) — skeptic blocks (job-6, settled 9.6m)
Recheck at `1013bc2` → fallback. **Blocks on O1:** the acceptance as written requires `unreachable` at window expiry; shipped returns `timedOut`, changing the user-visible copy (“Cannot reach `<serverUrl>`…” → “Sign-in timed out…”) in the dead-connection-whole-window scenario — the card's no-copy-change clause applies. O2 (non-blocking): the goal/plan/comment/PI-SPEC cite RFC 8628 §3.2 but the connection-failure directive is §3.5. O3–O8 (retry, cancellation, dispatch unchanged, no copy change, scope, red-at-base) closed-green. Card returned to `In Progress`.

### Step 6 (routing) — product-owner ruling (job-7, settled 2.0m)
Open-judgment/copy item routed to `product-owner`. **Ruling: cause-distinguished expiry** — at window expiry, `unreachable` if no poll in the window ever received an HTTP response, else `timedOut`; no copy strings change. Acceptance clause 1 amended by the PO; §3.2→§3.5 errata rides the PR; card title/goal stand with an errata note. No escalation. Recorded at `vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md`.

### Step 8 (fix cycle 1) — owner (job-8, settled 7.4m)
Same branch; updated head `b56b1dcc82280d6df286ced23d852b72e3b6a4e5`. `sawResponse` flag + cause-distinguished expiry; citation errata in the code comment, plan, and PI-SPEC §7.2; fixtures 1–2 added/adjusted; plan synced. Gates: `bun install` ok; `bunx tsc --noEmit` exit 0; `bun test` 224/1/0.

### Step 9 (verify cycle 2) — skeptic (job-9, settled 10.7m)
Recheck at `b56b1dc` → fallback. **No open objections.** Both cycle-1 blockers closed-green, independently reproduced (incl. an adversarial latch probe for `sawResponse`); gates 224/1/0; FLLWUP-22 dispatch unchanged; copy byte-identical base↔head; scope 4 files; §3.5 errata verified in all three surfaces with the card title/goal intact; red-at-base (the 125-line block transplanted onto `b784540`) → 221/1/**3 fail**, 0 fail at head. Non-blocking coverage note: cancellation-during-the-5s-slowdown is probe-proven but not fixture-pinned → **FLLWUP-28**.

### Step 10 — judge (job-10, settled 2.2m)
Input: the `goal` + Skeptic evidence only. **Verdict: PASS** (re-ran tsc + `bun test` 224/1/0 at head; scope respected).

### Step 11 — merge gate (unattended, human-authorized)
`gh pr merge 31 --admin --merge --match-head-commit b56b1dc…`; PR MERGED at 2026-09-23T18:58:54Z, merge commit **`d63e942d627a6604189e025464c98ebd7c8dda14`**. CI on the merged SHA: `gates` success, `gates-windows` success.

### Step 12 — sync and reconcile
`git fetch origin`. The main worktree had been left **detached at `b784540` by a seat's `git checkout`** (reflog HEAD@{1–4}: seats checked out the PR head in the main checkout), so the first rebase moved a detached HEAD with nothing ahead; reattached `main` (`9c4bf07`) and rebased onto `origin/main` (`d63e942`) — the 4 local commits replayed cleanly, the merge confirmed an ancestor, no conflict markers, validate.py clean. Card set `Done` from the observed merged artifact. (Process smell: seats must not run `git checkout` in the shared main worktree — related to FLLWUP-27.)

### Step 13 — follow-ups
One candidate: *Pin cancellation during the device-flow slowdown wait in the login suite* → gate `active` rendered **File** (composite 0.45 < 1.00). Filed as **FLLWUP-28**.

### Step 14 — persist
No durable wiki artifact surfaced; nothing hand-edited under `vault/` (the PO ruling raw file is the seat's own record).
