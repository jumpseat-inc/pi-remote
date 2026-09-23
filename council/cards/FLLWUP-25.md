---
id: FLLWUP-25
title: "Surface the device-flow token endpoint's error_description in login failure output"
state: Done
owner: null
epic: EPIC-2
goal: When a device-flow token poll or exchange fails with an error_description, the /rc:login failure output includes that server-provided description, so the user sees why the identity provider refused rather than only the client's generic failure line.
---

## Intent

Filed from FLLWUP-22's deferred items (the §2.3 poll-shape fix, PR #26, left
this deliberately out of its boundary). The driver currently ignores the
`error_description` field that OAuth2 servers provide alongside `error` — the
user sees the client's generic failure line with no hint of the IdP's actual
reason (e.g. scope mismatch vs account issue). Touches verbatim-ruled
user-visible copy, so it needs a product-owner copy ruling before its
deliberation (the [[Copy Honesty Doctrine]] cuts both ways: honest about the
server's reason, without over-promising what the user can fix, and never
printing untrusted server text unescaped into the terminal).

## Acceptance

- The failure output includes the server's `error_description` when present,
  rendered safely (no unescaped control characters or terminal-escape
  sequences from server text).
- Absent `error_description`, output is unchanged from the ruled lines.
- The product-owner copy ruling (which exact line format, and the safety
  rules) precedes implementation and is recorded on the card.
- Fixtures cover present, absent, and hostile `error_description` values;
  bunx tsc --noEmit exit 0; bun test full suite green.

## Copy ruling (product-owner, 2026-09-02)

Recorded at `vault/raw/2026-09-02-po-fllwup-25-error-description.md`.

- **Boundary:** only `tokenExchangeFailed` surfaces the server's
  `error_description`. `deviceDenied` (`access_denied`), `expiredCode`
  (`expired_token`), and `invalidTokenResponse` do not.
- **Copy:** one new key `login.failure.detail`, exact English string
  `Details from the server: \`<errorDescription>\``, emitted as a second line
  immediately after the ruled `tokenExchangeFailed` line. The four ruled rows are
  unchanged.
- **Safety (in order):** strip code points U+0000–U+001F and U+007F–U+009F;
  collapse whitespace runs to one space then trim; cap at 200 code points (never
  split surrogate pairs), append `...` when truncated; omit the line entirely if
  the result is empty/whitespace-only/missing/non-string. No other
  transformation (no backtick/HTML escaping; textual ANSI matching is rejected).
- **Localization:** English-only by design — login-flow rows are outside the `id`
  overlay table (FLLWUP-4 OJ2).
- **Absent:** byte-identical to today's output (structural).

## Run record

### Step 1 / precondition — classification
`council_route` op `route` → fallback. Classification: **mechanical** — one module (`src/login.ts`) plus tests. **Surface-touching: yes** (new user-visible copy line). The card and the steward (batch ruling) required a product-owner copy ruling before implementation; it was routed to `product-owner` **before** the owner.

### Precondition — product-owner copy ruling (job-11, settled 1.2m)
Recorded at `vault/raw/2026-09-02-po-fllwup-25-error-description.md`: new key `login.failure.detail`, exact string `Details from the server: \`<errorDescription>\``, additive second line after `tokenExchangeFailed` only; sanitizer strip C0/C1 → collapse whitespace → 200-code-point cap + `...` → omit if empty; English-only; absent byte-identical. Recorded on the card face.

### Step 7 — mechanical handoff
No spec file; the card + the copy ruling is the handoff. Card set `In Progress`; validate.py clean.

### Step 8 — owner implements (job-12, settled 16.6m)
Worktree cut from `origin/main` (FLLWUP-27 convention); branch `feat/fllwup-25-error-description`, PR #32 at head `b78f744f829c563a161684cb393ca63fe11f4d3f`. Gates: `bun install` ok; `bunx tsc --noEmit` exit 0; `bun test` 234/1/0 (+10 fixtures). Delta: plan, `src/login.ts` (+35), `test/login.test.ts` (+209); `index.ts` and `src/copy.ts` untouched. Card set `In Review` from the observed open PR.

### Step 9 — skeptic (job-13, settled 8.5m)
Recheck at `b78f744` → fallback. **No open objections.** 11 objections, each with a runnable test, all closed-green: rendered detail exact and single-line; sanitizer order; 200-code-point cap and lone-surrogate boundary; absent/null/whitespace byte-identical; dispatch boundary end-to-end **including the attended PKCE path** (the owner's fixtures did not cover it); `<serverUrl>` inside server text renders literally; copy exactness; gates 234/1/0; red-at-base (209-line block transplanted onto `81d5c74`) → `SyntaxError: Export named 'sanitizeErrorDescription' not found` plus a behavioral probe `Received: undefined`; tsc gate-integrity probe. Two owner-flagged cosmetics confirmed as ruled consequences, not defects.

### Step 10 — judge (job-14, settled 0.8m)
Input: the `goal` + Skeptic evidence only. **Verdict: PASS** (independently re-ran tsc + `bun test` 234/1/0; confirmed the emit boundary).

### Step 11 — merge gate (unattended, human-authorized)
`gh pr merge 32 --admin --merge --match-head-commit b78f744…`; PR MERGED at 2026-09-23T19:32:58Z, merge commit **`c9a570fc63bfd753601a9628bb5b811e1e195dcb`**. CI on the merged SHA: `gates` success, `gates-windows` success.

### Step 12 — sync and reconcile
`git fetch origin`; `main` attached, rebased onto `origin/main` cleanly (2 local commits replayed; merge confirmed an ancestor; no conflict markers; validate.py clean). Card set `Done` from the observed merged artifact.

### Step 13 — follow-ups
Two candidates → gate `active` rendered **File** for both: *Pin the attended PKCE path's no-error_description boundary in the login suite* → **FLLWUP-29**; *Keep the shared main worktree's HEAD untouched during a run* → **FLLWUP-30**.

### Step 14 — persist
No durable wiki artifact surfaced; nothing hand-edited under `vault/` (the PO ruling raw file is the seat's own record).
