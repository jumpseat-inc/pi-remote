---
id: FLLWUP-2
title: "Reconcile EV-8 card text with the seven-state footer set"
state: Done
owner: null
epic: EPIC-1
goal: council/cards/EV-8.md carries the authoritative seven-state footer set from spec §8 (off, not enrolled, authorizing, dialing, resyncing, live, error) before the EV-8 runner deliberates.
---

## Intent

Filed from EV-1's step 13 (objection O-11, cross-seam gap). Product-owner
ruling Q2 (binding) made §8's footer state set authoritative at seven states
in lifecycle order — off, not enrolled, authorizing, dialing, resyncing, live,
error — but EV-8's card text still names the pre-EV-1 four-state set
(off/dialing/live/resyncing) and would seed its deliberation with a
contradiction. This card edits EV-8's card face only; the actual
implementation of the states belongs to EV-8 itself.

## Acceptance

- EV-8's Intent and Acceptance name the seven-state set in lifecycle order,
  citing spec §8 as authoritative and product-owner ruling Q2 as source.
- No EV-8 card text contradicts the seven-state set or the /rc: colon
  namespace as pinned by EV-1.
- council/validate.py stays clean after the edit.

## Deliberation record

Full council (surface-touching) per orchestrator note 5; single round; all
seats converged; Skeptic recorded no open objections; consolidator sorted
three buckets: no open judgment, no open objections, ready for owner.

**Settled edit (owner/principal/designer converged, §8/Q2/EV-7-rule-4/EV-3/EV-5 binding):**

1. Intent footer clause: replace `off / dialing / live / resyncing` with the
   seven-state set in lifecycle order — off, not enrolled, authorizing,
   dialing, resyncing, live, error — citing spec §8 as authoritative and
   product-owner ruling Q2 as source; every state change is a stated sentence
   via loginEnglishFor (EV-7), never a glyph ack or raw string.
2. Acceptance no-credential bullet: `footer status returns to off` →
   `footer status is not enrolled` (matches §8).
3. Acceptance footer bullet: name all seven states in lifecycle order (§8/Q2);
   `error` derives only from the typed transport stream (EV-3/EV-7); `resyncing`
   shows during replay (EV-5).
4. New Acceptance bullet (b6): `/rc:login` sets footer to `authorizing` when
   the login driver begins and to `off` on terminal; the seven-state set has no
   `idle` state (EV-7 success→idle reconciled to `off`).

No colon-namespace changes (already conformant: /rc, /rc:login, /rc:off).

**Skeptic (job-30.4):** all 8 objections closed-green — each CONFIRMS the
contradiction in current EV-8.md text that this edit targets (four-state
Intent lines 20-21; `returns to off` line 34; footer bullet names 2 of 7;
authorizing/error/not-enrolled absent; no /rc:login→authorizing text; idle
already absent; validate.py gate integrity verified; colon namespace intact).
Verdict: no open objections; card moveable.

**Consolidator (job-30.5):** settled = the 4-part edit above; open judgment =
NONE (terminal state off settled by EV-7 rule 4; principal/owner explicitness
difference is style not values; designer resyncing-ordering flag is a
non-blocking note, order binding via §8/Q2); open objections = NONE. Ready for
owner.

## Step 8–12 record

- Step 8 owner (job-30.6): applied settled edit in worktree
  `.worktrees/flluwp-2-ev8-footer`, branch `flluwp-2-ev8-footer`, SHA
  `c9c13e73b1328d8c8c983baa83eca434000e4bbd`, PR jumpseat-inc/pi-remote#8
  (base main), validate.py clean. Diff confined to council/cards/EV-8.md
  card face (+ council state commits); no src/ code. Card In Review
  (observed: branch + open PR).
- Step 9 skeptic (job-30.7, verify cycle 1/3): 8/8 objections closed-green,
  no open objections, verdict pass. Shared EV-7/EV-3/EV-5/§8 seams verified
  in the edited Intent and Acceptance.
- Step 10 judge (job-30.8, per product-owner EV-1 general rule — object is
  the PR branch at Skeptic-verified SHA, not main): PASS.
- Deterministic merge check — all five criteria met: (1) owner gate green
  (validate.py clean); (2) `gates` workflow SUCCESS on head SHA c9c13e7 and
  on merged SHA be059ce (facilitator-verified via gh); (3) no blocking
  Skeptic objection; (4) judge PASS; (5) no Needs Human / no outstanding
  ruling. Merged `gh pr merge 8 --merge --match-head-commit c9c13e7` at
  2026-08-31T21:45:08Z, merge commit be059ce2ee3071a8ac4e9ae22906d54f6fe00887.
- Step 12 reconcile: local main rebased (fast-forward clean, merge
  preserved); card set Done.
- Step 13 follow-ups: none. All deliberation objections were confirmations
  of the edit's motivation already addressed; no deferred idea or
  out-of-scope finding warranted a new card.
