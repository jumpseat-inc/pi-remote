---
id: FLLWUP-5
title: "Emit pi.human_input.resolved host-side completion event"
state: Ready
owner: null
epic: EPIC-1
goal: A remote device that resolves an approval prompt receives a CUSTOM pi.human_input.resolved completion frame (promptId, deviceId, ts) confirming its resolution was applied, emitted via an added ui_prompt_end surface in translate.ts and wiring in the lifecycle layer.
---

## Intent

Filed from EV-6's step 13. EV-6 shipped the steering-fallback resolution path
(per product-owner R2 and steward R3 rulings — the fallback is the permanent
product behavior) but deferred the host-side completion signal as a
forward-dependency: the remote user currently gets no explicit confirmation
that their resolution was applied, only indirect evidence from session output.
Root cause: the SDK emits `ui_prompt_start`/`ui_prompt_end` but translate.ts's
PiEvent union only carries `ui.confirm`, so `ui_prompt_end` never reaches the
AG-UI stream. User-visible surface — the remote client's approval UI, which
after this card can flip the prompt to "resolved" state on real feedback
instead of guessing.

## Acceptance

- translate.ts's PiEvent union carries `ui_prompt_end` and maps it through the
  established CUSTOM conventions; the pure fold shape and purity guards stay
  green.
- The lifecycle wiring (or its owner at run time) emits CUSTOM
  `pi.human_input.resolved` with `{promptId, deviceId, ts}` when a resolution
  (direct or steering-fallback) is applied to a prompt EV-6 tracked.
- The deviceId in the frame is the resolving device from the envelope, never
  into free text (EV-6's invariant).
- Fixtures cover the direct-resolution and steering-fallback paths; bunx tsc
  --noEmit exit 0; bun test exit 0 with the full suite green.
- Any §4-adjacent spec sentence this needs rides the PR as a
  facilitator-authored evidence-cited amendment per the standing precedent.
