---
title: Cause-Distinguished Expiry
type: concept
summary: When a bounded wait expires, the terminal reason must name the cause the client actually observed — not a fixed row — so the user can tell a dead network from a slow server.
aliases: [cause-distinguished terminal, observed-cause dispatch]
tags: [concept/copy, doctrine, login]
sources: ["[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]"]
created: 2026-09-23
updated: 2026-09-23
---
Established by the FLLWUP-24 product-owner ruling (2026-09-23). At the device-code window's expiry the headless driver does **not** emit a single fixed terminal row. It distinguishes on what the client observed during the window:

- **No token poll ever received an HTTP response** (every attempt failed at the connection level) → terminal `unreachable`, the existing row `"Cannot reach \`<serverUrl>\` — check your network and try again."`
- **At least one poll received a response** (any status, including `authorization_pending`/`slow_down`/4xx/5xx) → terminal `timedOut`, the existing row `"Sign-in timed out — no credentials were saved. Run /rc:login to try again."`

Mechanism: a loop-scoped latch (`sawResponse`) set on any received response; the expiry path dispatches on it. A response received early and followed by later connection failures still reads `timedOut` — the cause is "the server was reached at some point", and the latch keeps that true.

**Why it is a principle, not an implementation detail.** The PO rejected both unconditional options on [[Copy Honesty Doctrine]] grounds: "Sign-in timed out" on a dead network states the clock, not the cause, and sends the user to "try again" without naming the only remedy that can change the outcome (check the network) — a [[Gulf of Evaluation]] failure; "Cannot reach" after a window the server answered every poll is false copy. The general rule: **the terminal reason must name the cause the client actually observed.** Reversibility is one predicate at the expiry branch ([[Cheapest To Reverse]]).

Both terminal rows already existed in the closed 13-row failure set — this is dispatch policy, not new vocabulary ([[Closed Vocabulary Discipline]], [[Stable Keys]]).

## Related
[[Copy Honesty Doctrine]], [[Gulf of Evaluation]], [[Cheapest To Reverse]], [[Closed Vocabulary Discipline]], [[Stable Keys]], [[login.ts]]

## Sources
[[Device-Flow Polish Run (BUG-1, FLLWUP-24, FLLWUP-25)]]; `vault/raw/2026-09-02-po-fllwup-24-slowdown-expiry.md`.