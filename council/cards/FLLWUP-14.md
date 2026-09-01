---
id: FLLWUP-14
title: "Document remote raise-UI best-effort behavior for select, editor, and custom prompt kinds"
state: Backlog
owner: null
epic: EPIC-1
goal: The README (and the spec row it mirrors) state that the remote raise UI is best-effort for the select, editor, and custom prompt kinds because the installed SDK discards the prompt body at the ui_prompt_start boundary.
---

## Intent

Filed from FLLWUP-8's step 13. FLLWUP-8 wired the live raise path and proved
the SDK's `ui_prompt_start` payload carries only `{kind, title?}` — the prompt
body (options, editor contents, custom schema) is discarded by the SDK before
the extension sees it. For `confirm` (and `input` with a title) the remote
prompt is fully faithful; for `select`/`editor`/`custom` a remote user sees
kind + title only. That is an SDK-boundary fact, not an extension defect —
this card documents it honestly rather than pretending fidelity. User-visible
surface — the README's remote-approval section and the spec row it mirrors.

## Acceptance

- README states the fidelity boundary per prompt kind: faithful for
  confirm/input-with-title, best-effort (kind + title only) for
  select/editor/custom, with the SDK-boundary reason in one sentence.
- The mirrored spec row (§4's pi.human_input row or §5.4, whichever the
  deliberation places it in) carries the same statement — docs-only
  prose-sync per the standing governance precedent.
- bunx tsc --noEmit exit 0; bun test exit 0 (docs-only; suite untouched).
