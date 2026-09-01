---
id: FLLWUP-15
title: "Settle the pending prompt entry on ui_prompt_end so host-local answers stop emitting stale tracked resolutions"
state: Backlog
owner: null
epic: EPIC-1
goal: When a host-local answer settles a prompt (ui_prompt_end fires without a remote resolution), the pending entry is marked settled, so a later remote answer to the same prompt emits an untracked or stale response instead of a tracked pi.human_input.resolved for an already-answered prompt.
---

## Intent

Filed from FLLWUP-8's step 13 (local-answer race). FLLWUP-8 made the raise
live: a pending entry is registered on `ui_prompt_start` and a remote answer
resolves it with a tracked `pi.human_input.resolved`. But a host-local answer
never settles the pending entry — `ui_prompt_end` fires, the registry still
holds it as open, and a remote answer arriving afterwards emits a tracked
`resolved` for a prompt the host already answered. The remote user sees
confirmation of a resolution that did not happen remotely. Candidate fix named
by the deliberation: settle the newest unsettled occurrence on `ui_prompt_end`
— the deliberation owns the exact semantics. User-visible surface — the
remote client's approval UI, which today can show a false "resolved" state.

## Acceptance

- `ui_prompt_end` without a prior remote resolution marks the newest unsettled
  occurrence for that promptId settled (deliberation verifies the exact
  occurrence semantics against the (promptId, occurrence) key).
- A remote answer arriving after the local settlement emits per the existing
  stale/untracked path — never a tracked `pi.human_input.resolved`.
- A remote answer arriving before `ui_prompt_end` is unaffected (FLLWUP-5/8
  fixtures stay green).
- bunx tsc --noEmit exit 0; bun test exit 0 with race-order fixtures for both
  orderings.
