---
title: Verify Cycle Cap
type: concept
summary: Three verify-fix-reverify cycles per card, hard; a closed-red at the cap exits to the orchestrator, and bounded extensions are a ruling-seat call.
aliases: [step-9 cap, verify-fix cycle]
tags: [concept/process, verification]
sources: ["[[FLLWUP-7 Design Position r1]]", "[[FLLWUP-5 Ruling]]"]
created: 2026-09-02
updated: 2026-09-02
---
Step 9's verify → fix → verify loop is capped at **three cycles per card** (initial Skeptic verification plus two fix-and-reverify rounds) — a separate cap from the ≤3 deliberation rounds of step 3. The counter is per card, not per pass; judge REJECTs that send a card back to In Progress consume the same total.

Exit semantics at the cap: **closed-red bars the exit outright** (a documented defect is not a fixed defect); **open-untested** residuals may close only with a product-owner ruling accepting them; closed-green contributes nothing. The Judge Object Rule interacts: a merge-check red that is a CI-runner fact (not a seat objection) leaves the disposition genuinely open — FLLWUP-7's bounded fourth cycle is the worked example (permitted conditioned on a semantic-assertion fix, with a steward fallback if a fourth distinct representation defect had surfaced; none did).

Spend across the epic: no card exceeded 1-2 cycles except FLLWUP-7 (3 + 1 bounded); OJ-ruling cards typically closed at cycle 1.

## Related
[[Judge Object Rule]], [[Deterministic Merge Check]], [[Council Seats]], [[FLLWUP-7 Design Position r1]]

## Sources
[[FLLWUP-5 Ruling]], [[FLLWUP-7 Design Position r1]]
