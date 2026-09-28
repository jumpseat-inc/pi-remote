---
id: EPIC-8
title: "Control-plane URL as the /rc:login input placeholder"
state: Done
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

## Closure (run 2026-09-28)

Delivered by children EV-18 and EV-19 — both merged and `Done`:

- **EV-18** — render the resolved control-plane URL as the attended `/rc:login` input
  placeholder (PR #54, merged `0fdf1d9`).
- **EV-19** — verify the `/rc:login` URL placeholder at the installed-host boundary
  (PR #55, merged `b848464`).

Gates on `main` at closure: `bunx tsc --noEmit` exit 0; `bun test` 340 pass / 7 skip
(Windows-gated ACL and construction-grounding probes, expected) / 0 fail;
`council/validate.py` clean. `docs/PI-SPEC.md` §7.2/§8 carry the placeholder pass-through
description.

The named residual is recorded: installed pi 0.87.1's `ExtensionInputComponent` discards
the placeholder, so no greyed in-box render occurs on the installed host; the prompt title
remains the rendered consent surface carrying the resolved URL until a host honors the
documented `ui.input(title, placeholder?, opts?)` signature. EV-19's real-host observation
confirmed the negative and also completed an empty-Enter attended enrollment against a local
mock control plane, with the persisted `serverUrl` byte-equal to the resolved URL.

Follow-up candidates at EV-18's step 13 (both resolved before any write): the P-E CDP smoke
was **merged into EV-19**; the future-honoring-host double-render residual was **dropped**.
Both dispositions were confirmed by `product-owner`. No new `FLLWUP-` card was filed by this
run.