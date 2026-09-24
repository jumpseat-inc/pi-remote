---
id: FLLWUP-40
title: "Correct the FLLWUP-12 pairing test's source comment, which overstates what the test pins"
state: Backlog
owner: null
epic: null
goal: correct the FLLWUP-12 static pairing test's source comment in test/translate.test.ts (~:431-434) so it matches what the test actually pins (wording to match the merged docs/ROLE-DECODER-DUPLICATION.md).
---

## Intent

Filed from FLLWUP-37's step 13 (EPIC-5), held in-container, then confirmed
`File` by a `product-owner` ruling (job-8). Recorded disposition, verbatim:

> Mode: File — composite 0.37 < merge threshold 1.00 — Correct the FLLWUP-12 pairing test's source comment, which overstates what the test pins (active)

FLLWUP-37's cycle-1 Skeptic finding (`closed-red`) demonstrated that the
static pairing test's source comment in `test/translate.test.ts` claims a
coupling the assertions below it do not enforce: dropping `"user"` from the
decode comparison leaves the suite green (273 pass / 1 skip / 0 fail), and
the 400-char signature window matches the return-type annotation rather than
the decode comparison. The merged `docs/ROLE-DECODER-DUPLICATION.md`
(squash `3660df5`) already states the true scope — the test pins
derivation-text presence and role vocabulary in the signature windows, and
does **not** pin the value-level decode comparison. The FLLWUP-37 fix was
doc-only and did not reopen the test file, so this comment-only correction
becomes its own card. No assertion changes, no behavior change, no G-12
touch.

## Acceptance

- The pairing test's source comment in `test/translate.test.ts` (~:431–434)
  accurately describes what the test pins, consistent with
  `docs/ROLE-DECODER-DUPLICATION.md`.
- No assertion or behavior change; the pairing test still passes.
- `bunx tsc --noEmit` exit 0; `bun test` all-pass.