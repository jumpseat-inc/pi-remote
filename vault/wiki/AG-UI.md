---
title: AG-UI
type: concept
summary: The open, event-based protocol standardizing agent-to-user-application interaction — the only wire format pi-remote and its server spec speak, with CUSTOM events as the escape hatch.
aliases: [Agent-User Interaction protocol, AG-UI protocol]
tags: [concept/protocol]
sources: ["[[pi-remote]]", "[[Server-Side Spec]]", "[[translate.ts]]"]
created: 2026-09-02
updated: 2026-09-02
---
AG-UI is an open, lightweight, event-based protocol standardizing how AI agents connect to user-facing applications: agent backends emit typed events, frontends render them, and simple inputs flow back. Transport-agnostic by design — SSE, WebSockets, and webhooks are all documented transports (pi-remote uses WebSocket via [[transport.ts]]). Sites: https://docs.ag-ui.com (documentation), https://github.com/ag-ui-protocol/ag-ui (source).

**Event taxonomy** (EventType enum, as this corpus uses it): lifecycle (`RUN_STARTED`, `RUN_FINISHED`, `STEP_STARTED`, `STEP_FINISHED`), text messages (`TEXT_MESSAGE_START`/`CONTENT`/`END`), tool calls (`TOOL_CALL_START`/`ARGS`/`END`, `TOOL_CALL_RESULT`), state (`STATE_SNAPSHOT`, `STATE_DELTA`, `MESSAGES_SNAPSHOT`), reasoning (`REASONING_MESSAGE_*` — the current family; `THINKING_TEXT_MESSAGE_*` is deprecated and removed in 1.0.0), and special (`RAW`, `CUSTOM`).

**How this system uses it** (see [[translate.ts]] for the mapping, [[Closed Vocabulary Discipline]] for the rules): the client's live events and JSONL history both translate through one pure mapper; the relay forwards frames opaquely ([[Server-Side Spec]] INV-1); anything AG-UI cannot express escapes as `CUSTOM` with a `pi.<category>` name — never a second wire format. The deprecated THINKING family and the missing RESYNC_DONE event were both caught by Skeptic probes against the AG-UI repo — the corrections that produced [[Spec Correction Governance]]'s strongest precedents.

**Externally-sourced detail, flagged:** the taxonomy summary above is grounded in the AG-UI repository documentation (retrieved via context7, 2026-09-02), beyond what the corpus itself states; the corpus's own claims are in the linked pages.

## Related
[[translate.ts]], [[transport.ts]], [[Server-Side Spec]], [[Closed Vocabulary Discipline]], [[Spec Correction Governance]], [[pi-remote]]

## Sources
[[pi-remote]], [[translate.ts]], [[Server-Side Spec]], [[FLLWUP-5 Ruling]] (probe-4/8 AG-UI findings), https://docs.ag-ui.com, https://github.com/ag-ui-protocol/ag-ui
