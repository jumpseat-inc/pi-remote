---
title: Record Accuracy
type: concept
summary: A run record's counts and claims must match the audit they cite — the record's own honesty axis, distinct from whether the code and tests are honest; an inaccurate record misleads the next run.
aliases: [record accuracy, run-record fidelity, record honesty]
tags: [concept/process, doctrine, records]
sources: ["[[EPIC-4 Run (FLLWUP-11..12)]]", "[[EPIC-4 Decision Record]]", "[[EPIC-6 Run (FLLWUP-39..40)]]"]
created: 2026-09-24
updated: 2026-09-24
---
[[Fixture-Green Honesty]] governs what *code* may claim. EPIC-4 surfaced its sibling: what the *run record* may claim. FLLWUP-11's own record stated the stand-in had "twelve" non-`on` members and that "none exist on the real `ExtensionAPI`" — while the audit in the same record found **13** non-`on` base members, of which the **2 kept** members (`registerCommand`, `sendUserMessage`) genuinely do exist on the real SDK. The card's Intent also said "twelve". Every number was an artifact of the original filing, not the verified audit.

**The rule.** A record's counts and characterizations must match the evidence it cites. A run record is durable and is what the next agent reads; a wrong count or a wrong "none exist" propagates. This is a separate axis from test honesty: a suite can be perfectly green while the record that describes it is wrong.

**The EPIC-4 examples, all filed as their own cards:**
- **FLLWUP-33** — reconcile the FLLWUP-11 record's member count and "none exist" phrasing; corrected inline on the card post-run and carried as a Backlog card.
- **FLLWUP-32** — `test/pi-sdk-load.test.ts`'s second header claims a compile-time guarantee its runtime body does not enforce (a comment overstating its own assurance).
- **FLLWUP-34** — `AGENTS.md`'s "Current state" still claims the extension is "Not yet loadable in a real `pi` host"; steward promoted it `Ready` once FLLWUP-12 landed, precisely so a future run cannot re-assert the now-false block.

**Why it is doctrine, not bookkeeping.** The FLLWUP-33 defect was invisible to every gate — the tests passed, the PR was clean — yet the record the board keeps was false. The same pattern is the reason [[Record-Push Discipline]] treats the direct-to-`main` record push as a privileged write: the run's durable state *is* the board and the cards, so their accuracy is load-bearing.

**Third variant — the source comment (EPIC-6).** The [[EPIC-6 Run (FLLWUP-39..40)]] added **FLLWUP-40**: the FLLWUP-12 static pairing test's own source comment in `test/translate.test.ts` claimed a coupling the assertions below it do not enforce (mutating the value-level decode comparison leaves the suite green). The remedy was **comment-only — assertions byte-identical** — re-stating that the test pins derivation-text presence and role vocabulary in the 400-char signature windows, and *not* the decode comparison, consistent with `docs/ROLE-DECODER-DUPLICATION.md`. So the same axis now has three observed surfaces: a card's count (FLLWUP-33), a test header (FLLWUP-32), and a code comment (FLLWUP-40). The lesson generalizes: a claim in *any* durable artifact must state only what is proven.

## Related
[[Fixture-Green Honesty]], [[Record-Push Discipline]], [[Real-Surface Verification]], [[Council Seats]], [[Batched Card Delivery]], [[translate.ts]], [[EPIC-4 Decision Record]], [[EPIC-6 Decision Record]]

## Sources
[[EPIC-4 Run (FLLWUP-11..12)]], [[EPIC-4 Decision Record]], [[EPIC-6 Run (FLLWUP-39..40)]]