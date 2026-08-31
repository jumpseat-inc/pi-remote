---
id: FLLWUP-5
title: "Emit pi.human_input.resolved host-side completion event"
state: Deliberating
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

## Deliberation record

### Step 1 — path classification

- Full council (not mechanical): cross-seam (translate.ts pure mapper + inject.ts
  resolution surface + index.ts lifecycle wiring) and spec-ambiguous/design-judgment —
  the relation between an added `ui_prompt_end` PiEvent mapping in the pure fold and
  the lifecycle-layer emission of `pi.human_input.resolved {promptId, deviceId, ts}`
  is not pinned (a pure fold cannot mint `ts` or know the envelope `deviceId`; whether
  `ui_prompt_end` maps to the resolved frame directly, to a separate surface, or both,
  and whether the resolved frame fires for untracked steering-fallbacks, each admits
  a different design).
- Surface-touching: yes — the remote client's approval UI flips to a "resolved" state
  on real feedback (EV-6 H5 forward-dep). `designer` seated as third generator in steps 2–3.
- Binding context carried in (not open for relitigation): CUSTOM shape
  `{type:"CUSTOM", name:"pi.<category>", value:{pi, data}}` with `name` the sole
  dispatch key (§4); deviceId from the inbound envelope never into free text (EV-6
  invariant); the pure fold shape and purity guards (no clock/entropy in translate.ts)
  stay green — the emitting site of the resolution frame is the lifecycle layer
  (index.ts); resolution tracking to hook is EV-6's (promptId, occurrence) registry in
  inject.ts, with `InjectResult` kinds `resolved` (direct, fixture-seam only per R3
  Side B) and `steered_fallback` (the permanent live path).
- Grounding: `vault/wiki/index.md` has no module pages (stub catalog) — semantics
  grounded in docs/PI-SPEC.md §4/§5.4/§7.3 and the installed pi SDK
  (`pi-coding-agent/dist/core/extensions/types.d.ts`): `ui_prompt_end` is a real SDK
  event `{type:"ui_prompt_end"; reason:"ui_prompt"; kind:UIPromptKind; title?}`,
  registered via `pi.on("ui_prompt_end")`.
