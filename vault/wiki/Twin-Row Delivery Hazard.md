---
title: Twin-Row Delivery Hazard
type: concept
summary: When two distinct delivery paths render identical user-visible bytes, a substring (toContain) assertion on the rendered transcript is path-blind — a row-level test must assert the whole transcript or drive the exact path.
aliases: [path-blind assertion, identical-bytes hazard, twin row, toContain trap]
tags: [concept/testing, tui, doctrine]
sources: ["[[FLLWUP-47 Run]]", "[[BUG-2 Run]]"]
created: 2026-09-27
updated: 2026-09-27
---
Two copy keys can render to the **same user-visible bytes**. When they do, an assertion that only checks presence — `expect(notifyLines).toContain("<row>")` — cannot tell which delivery path produced the line. The test goes green on whichever path happens to fire, and the path it was written to pin stays unverified. That is the hazard: the string is correct, the *assertion shape* is wrong.

**Worked example (FLLWUP-47).** `rc.offLifecycle` and `shutdown.closed` both render to `Remote tunnel closed` ([[login.ts]] `loginEnglishFor`, `src/login.ts:287-288`; the Indonesian overlay rows `Tunnel remote ditutup` sit in [[copy.ts]]). The [[BUG-2 Run]] test ran `/rc:off` then `expect(notifyLines).toContain("Remote tunnel closed")` — satisfied by the off-lifecycle row. The production shutdown path (`pi.on("session_shutdown")` → `onShutdown` → `deps.print`) was never exercised. The [[FLLWUP-47 Run]] closed it by firing the sole `session_shutdown` handler at the real entry's subscription boundary and asserting the **whole transcript**: `expect(notifyLines).toEqual(["Remote tunnel closed"])`. Exact-equality over the entire sink makes the assertion path-specific even though the bytes are identical.

**The settling test.** A path pin is real when it goes red for the right reason: drop the row from the target path while leaving the shared constructor wiring intact → red; reroute it to the forbidden writer → red on the raw-terminal sentinel. Both were run for FLLWUP-47 ([[Real-Surface Verification]], [[Fixture-Green Honesty]]). A `toContain` cannot be falsified this way, because a sibling path keeps supplying the bytes.

**Generalization.** This is the assertion-level sibling of wiring-by-construction ([[Fixture-Green Honesty]]): the constructor proves the call exists, and a substring proves the bytes appeared — neither proves *this path* delivered *this row*. Any two keys that share rendered copy (deliberately, or via a fallback column, or across locales) create the hazard. Assert the transcript; or drive the exact path and assert exact equality.

**Adjacent citation trap.** Because the two layers are separate files, a reader can cite the wrong one: [[copy.ts]] holds the **id (Indonesian) overlay**, while the **English** key table is in [[login.ts]]. Quoting `copy.ts` for the English text is wrong (the FLLWUP-47 Skeptic caught exactly this in a dispatch input).

## Related
[[Notify Sink]], [[Fixture-Green Honesty]], [[login.ts]], [[copy.ts]], [[Real-Surface Verification]], [[FLLWUP-47 Run]], [[BUG-2 Run]]

## Sources
[[FLLWUP-47 Run]], [[BUG-2 Run]]