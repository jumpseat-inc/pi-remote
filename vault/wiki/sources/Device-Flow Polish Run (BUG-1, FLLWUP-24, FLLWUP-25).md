---
title: Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)
type: source
summary: A three-card batch run closing the headless-login gaps — --headless flag routing, RFC 8628 §3.5 connection-failure slowdown, and error_description surfacing — plus the cause-distinguished-expiry doctrine and four follow-ups.
aliases: [device-flow polish run, headless login polish, BUG-1 FLLWUP-24 FLLWUP-25 run]
tags: [council/run, login, device-flow, rfc]
sources: ["[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]"]
created: 2026-09-23
updated: 2026-09-23
---
A three-card batch run (2026-09-23): three merged PRs (#30/#31/#32), one fix cycle, two product-owner rulings. The batch was human-promoted to `Ready` and its **sequence and gating ruled by `steward`** as a portfolio decision — BUG-1 → FLLWUP-24 → FLLWUP-25, no card returned to Backlog, FLLWUP-25 gated on a prior copy ruling. Each merge was SHA-pinned and CI-checked on the merged SHA ([[Deterministic Merge Check]]).

**What shipped.**
- **BUG-1 (PR #30, merge `d790716`)** — `/rc:login --headless` now routes to the device-flow driver. The command surface hardcoded `cmd.run("attended", …)` and dropped argv; the fix threads argv through `RemoteController.commands` and the registrations, parses the literal `--headless`, and selects the mode *after* the J5 refusal. No copy change. Closes the gap between the shipped surface and PI-SPEC §7.2/§8 ([[index.ts]], [[login.ts]]).
- **FLLWUP-24 (PR #31, merge `d63e942`)** — the headless poll's fetch-throw `catch` waits 5 s and re-polls instead of failing terminal `unreachable`. The directive is RFC 8628 **§3.5** (a client hitting connection problems must reduce its polling frequency before retrying); the 5 s is §3.2's default minimum poll interval, adopted as the client's fixed step. At window expiry the outcome is **cause-distinguished** ([[Cause-Distinguished Expiry]]).
- **FLLWUP-25 (PR #32, merge `c9a570f`)** — the server's `error_description` surfaces as a new additive line `login.failure.detail` (`Details from the server: \`<errorDescription>\``) after `tokenExchangeFailed` **only**, through a ruled sanitizer (strip C0/C1 → collapse whitespace → 200-code-point cap → omit-if-empty). The four ruled rows are byte-identical, so the absent case is structurally unchanged ([[Copy Honesty Doctrine]], [[Stable Keys]]).

**New doctrine:** [[Cause-Distinguished Expiry]] — the terminal reason names the cause the client actually observed.

**Ruling mechanics this run demonstrated.**
- **Steward as batch sequencer.** Order, gating, and epic-mixing (an EPIC-1 residual beside two EPIC-2 residuals) is a portfolio question; the steward also fixed the one precondition — FLLWUP-25's implementation must not begin until a product-owner copy ruling is recorded ([[Council Seats]]).
- **A verify-cycle block on user-visible copy routes to `product-owner`, not straight back to the owner.** FLLWUP-24's Skeptic blocked because shipping `timedOut` silently changed copy contra the acceptance and the card's own no-copy-without-a-ruling clause; the facilitator returned the card to `In Progress` and routed the copy question to the PO. The owner could not have decided it.
- **A ruling as a precondition to implementation.** FLLWUP-25's exact copy was ruled *before* the owner ran, collapsing an ambiguous card to a mechanical one.
- **Goal immutability + citation errata.** The goal cited RFC 8628 §3.2 for what is §3.5. The goal was not rewritten once `In Progress`; a card-face errata note rode the implementing PR ([[Spec Correction Governance]]).

**Follow-ups filed (FLLWUP-27..30).** FLLWUP-27 (owner branches off `origin/main` so card PRs are product-only — BUG-1's PR carried the run's own council commits); FLLWUP-28 (pin cancellation during the 5 s slowdown — probe-proven only); FLLWUP-29 (pin the attended PKCE path's no-detail boundary — probe-proven only); FLLWUP-30 (no seat `git checkout` in the shared main worktree — a seat left the main worktree detached and the facilitator's rebase then moved the detached HEAD). FLLWUP-27/28/29/30 came from the decisions gate (`active`) rendering a `File` disposition.

## Related
[[Cause-Distinguished Expiry]], [[Copy Honesty Doctrine]], [[Stable Keys]], [[RFC Conformance Posture]], [[Spec Correction Governance]], [[Council Seats]], [[Fixture-Green Honesty]], [[login.ts]], [[index.ts]], [[RFC References]]

## Sources
`vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md`, `vault/raw/2026-09-02-po-fllwup-25-error-description.md`; card faces BUG-1 / FLLWUP-24 / FLLWUP-25; PRs #30/#31/#32 (pinned merges `d790716`, `d63e942`, `c9a570f`).