---
id: EPIC-5
title: "SDK reconciliation residuals — the EPIC-4 run's seven follow-ups"
state: Ready
owner: null
epic: null
goal: Observed as met when FLLWUP-32 through FLLWUP-38 are all Done with bunx tsc --noEmit exit 0 and bun test green: the load-smoke test header's claim matches its body, the FLLWUP-11 run record's member count and "none exist on the real ExtensionAPI" phrasing are corrected, AGENTS.md no longer claims the extension is not loadable in a real pi host, a committed regression probe catches a dropped message_start masked by the message_update fallback, emission-semantics claims are grounded in the event-constructing layer, the duplicated message-family role decoder has a scoped removal home, and the vendored PiTextContent's textSignature field is declared or annotated.
---

## Intent

Filed at the close of the autonomous `/features-deliver EPIC-4` run (2026-09-24).
That run landed **FLLWUP-11** and **FLLWUP-12** (the `ExtensionAPI` stand-in and
handler-payload reconciliation with the installed pi SDK) and closed EPIC-4
`Done`, but its step-13 gates filed **seven follow-ups — FLLWUP-32 through
FLLWUP-38 — that now have no live home**: each still carries `epic: EPIC-4`, a
Done card. This epic gives them one, the way EPIC-4 grouped FLLWUP-11/12 and
EPIC-3 grouped its own residuals.

The seven cluster into three themes:

- **Fixture / test honesty** — FLLWUP-32 (the load-smoke test's second header
  claims a compile-time guarantee its runtime body does not enforce) and
  FLLWUP-35 (a fold-bookkeeping probe for a dropped `message_start` that the
  `message_update` fallback can silently mask). Both are the "a green fixture is
  not proof" class that EPIC-4's own verify cycle exposed.
- **Record / documentation honesty** — FLLWUP-33 (the FLLWUP-11 run record says
  "twelve" members and "none exist on the real ExtensionAPI", while the audit
  found 13 with 2 kept) and FLLWUP-34 (`AGENTS.md` still says the extension is
  "Not yet loadable in a real `pi` host" and names FLLWUP-11/12 as the blocking
  pair).
- **Reconciliation residuals** — FLLWUP-36 (ground emission-semantics claims at
  the event-constructing layer, not only the pass-through emitter), FLLWUP-37
  (the duplicated message-family role decoder between `translate.ts` and
  `pi-sdk-events.ts`, forced by the G-12 no-runtime-imports rule), and
  FLLWUP-38 (declare or annotate the vendored `PiTextContent`'s omitted optional
  `textSignature` field).

Waiting is not neutral. FLLWUP-34's precondition ("once FLLWUP-12 lands") is now
satisfied, and the next run reads `AGENTS.md` first — leaving the false
installability block in place risks re-asserting an obsolete gate. FLLWUP-32/35
are exactly the silent-masking failure mode the reconciliation run was chartered
to close, surviving at adjacent seams. Grouping these means the pins and the
corrections land together instead of drifting as unowned `Backlog`.

**Grouping reassigns FLLWUP-32 through FLLWUP-38 from `epic: EPIC-4` to
`epic: EPIC-5`.** This card tracks the set and is not actionable on its own.

## Acceptance

Observed as met when FLLWUP-32 through FLLWUP-38 are all `Done`:

- the load-smoke test's second header claim is true of its runtime body (or the
  body is changed to make the claim true);
- the FLLWUP-11 run record's member count and "none exist on the real
  ExtensionAPI" phrasing are corrected;
- `AGENTS.md`'s "Current state" no longer claims the extension is unloadable in a
  real `pi` host;
- a committed regression test catches a dropped `message_start` masked by the
  `message_update` fallback path;
- emission-semantics claims are grounded in the event-constructing layer, not
  only the pass-through emitter;
- the duplicated message-family role decoder has a tracked, scoped removal home
  that engages the G-12 constraint head-on (lifting G-12 is `steward` authority);
- the vendored `PiTextContent`'s omitted optional `textSignature` field is
  declared or annotated, verified against the installed dist types.

`bunx tsc --noEmit` exits 0 and `bun test` is green throughout. Delivered by
children FLLWUP-32 through FLLWUP-38; this card is not actionable on its own.