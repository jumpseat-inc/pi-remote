---
id: FLLWUP-4
title: "EV-2 localization seam: second (en→id) message lookup and resolver"
state: Backlog
owner: null
epic: EPIC-1
goal: A second message lookup plus a resolver ships alongside tunnel.ts's existing key-based reason-to-message table so tunnel error and status copy can resolve in a language other than English without touching any emission site.
---

## Intent

Filed from EV-2's step 13. Product-owner ruling Item 2 (binding) gave EV-2 a
key-based reason→message table with English defaults living in tunnel.ts, and
explicitly deferred localization ("a separate card that adds a second lookup
plus a resolver — not part of EV-2"). This card is that separate card.
Post-epic enhancement — intentionally Backlog so the epic's delivery loop does
not pick it up. User-visible surface — every tunnel.ts-sourced command-output
line and footer-adjacent message, once a non-English locale is selected.

## Acceptance

- A second lookup table (Bahasa Indonesia first, per the repo owner's
  locale) keyed by the same stable message keys tunnel.ts already emits.
- A resolver that picks the lookup by a locale setting, defaulting to the
  English table when the requested locale or key is missing (no missing-copy
  crashes).
- No emission-site changes: the reason→key contract from EV-2 is unchanged.
- bunx tsc --noEmit exit 0 and bun test exit 0 with fixtures covering both
  tables and the fallback path.
