---
id: EPIC-8
title: "Control-plane URL as the /rc:login input placeholder"
state: Backlog
owner: null
epic: null
goal: Done means the attended `/rc:login` URL prompt passes the resolved control-plane URL as the host `ui.input` placeholder argument while the prompt title continues to carry that URL as the rendered consent surface, an empty submission enrolls against the resolved URL and typed input overrides it — with the installed host's placeholder-discard recorded as the named residual, since the greyed in-box render the human asked for is host-side and not deliverable by extension code.
---

## Intent

The `/rc:login` attended URL prompt currently names the resolved relay in its
title and passes `ui.input` only that title: the documented second `placeholder`
argument is dropped at two layers (`RemoteControllerDeps.inputPrompt` and the
entry wiring). This epic widens that seam so the resolved URL is forwarded as
the host placeholder while the title keeps carrying it as the rendered consent
surface, because the installed host currently discards the placeholder and the
title is what the person actually sees. Empty submission already consumes the
resolved value and must keep doing so. The epic is not itself actionable.

## Acceptance

Observed as met when EV-18 is `Done` with `bunx tsc --noEmit` exit 0 and
`bun test` green: the attended URL prompt passes the resolved URL as `ui.input`'s
second (`placeholder`) argument, the prompt title is byte-unchanged and still
contains that URL, empty submission enrolls against the resolved URL, typed input
overrides it, the replacement-confirm prompt receives no placeholder, PI-SPEC's
prompt description is updated in the same PR, and the host placeholder-discard
residual is named in the PR description and card record. EV-19's real-host
observation is recorded — the anticipated negative (placeholder not rendered on
pi 0.87.1) recorded as the named residual is that card's honest success.