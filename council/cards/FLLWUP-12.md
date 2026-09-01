---
id: FLLWUP-12
title: "Reconcile handler payload narrowing with real SDK event payloads"
state: Backlog
owner: null
epic: EPIC-1
goal: Every forward() handler's defensive narrowing matches the real SDK's actual event payload shapes, so no live event is silently dropped by a field mismatch between the stand-in's assumed shape and the real payload.
---

## Intent

Filed from FLLWUP-9's step 13 (deliberation finding F-2). Example: the real
SDK's `MessageStartEvent` is `{type:"message_start"; message: AgentMessage}` —
handlers narrowing on `messageId`/`events`/`content` fields that the real
payload does not carry would drop live events silently, exactly the failure
class FLLWUP-5's probe 4 exposed for the cast. FLLWUP-9 fixed the event-name
type honesty; this card fixes the payload-shape honesty. Pairs naturally with
FLLWUP-8's live-path work (which touches `forward` for the raise path) but is
a separate card per the runner's split.

## Acceptance

- Each of the eleven live subscriptions' handler narrowing is checked against
  the installed SDK's payload type for that event (dist types.d.ts is the
  authority) and corrected or documented where it differs.
- Fixtures feed real-shaped payloads (not stand-in-shaped) through
  translate.ts's live path with the expected frames emitted — the probe-4
  misroute class has a regression test per event family.
- bunx tsc --noEmit exit 0; bun test exit 0 with the full suite green.
