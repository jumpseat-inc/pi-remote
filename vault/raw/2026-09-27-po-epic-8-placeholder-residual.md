# PO Ruling — EPIC-8 wave 3: the placeholder residual

Date: 2026-09-27 · Seat: product-owner (features-new wave 3, EPIC-8, ruling LAST)

## What the human asked for

A greyed placeholder inside the `/rc:login` URL input, clearing on first
keystroke, with empty-Enter consuming the default relay URL.

## What the extension controls

- Empty-Enter → resolved URL: **already ships** (index.ts:681-683).
- Passing the resolved URL as `ui.input`'s second (`placeholder`) argument:
  deliverable at the seam (index.ts:107 dep widening + index.ts:973 wiring).

## What no extension code can deliver on the installed host

The greyed in-box render. Verified three ways:

1. Installed pi 0.87.1 dist:
   `@earendil-works/pi-coding-agent@0.87.1/dist/modes/interactive/components/extension-input.js:25`
   — `constructor(title, _placeholder, onSubmit, onCancel, opts)`; the
   underscore-prefixed `_placeholder` is never used; the component's `Input`
   is constructed with no placeholder. `interactive-mode.js:1980,2084-2095`
   forwards title + placeholder into that component.
2. EV-15's recorded skeptic attack, O5 closed-green
   (council/cards/EV-15.md step 4): same finding.
3. The shipped code itself records it (index.ts J2 comment): "The host
   surface has no editable prefill (ExtensionUIDialogOptions has no such
   capability)."

## Ruling consequence

- The prompt **title keeps carrying the resolved URL** byte-unchanged — it
  is the only rendered consent surface on hosts that discard placeholders
  (Copy Honesty Doctrine; Gulf of Evaluation). Removing it, as the wave-2
  draft proposed, would erase the URL from every prompt surface on the
  installed host: a regression against EV-15's settled design, not a
  feature.
- No new title literal is minted, so no verbatim copy ruling is needed
  (Stable Keys) and **FLLWUP-41 is untouched**: its `login.urlPrompt` key
  with `<serverUrl>` substitution keys the sentence as it ships.
- The greyed render is recorded as the **named residual**: it requires a
  host-side change in pi's `ExtensionInputComponent`, outside this
  repository. Once a host honors the documented signature
  (`types.d.ts:75` — `input(title, placeholder?, opts?)`), the extension
  render appears with zero further extension change, because EPIC-8 passes
  the argument.
- EV-19 verifies at the real boundary and records the anticipated negative
  (Real-Surface Verification): the placeholder is expected NOT to render on
  pi 0.87.1; that recorded deviation is the card's honest success, not a
  failure.

If the human wants the literal greyed in-box render, the path is upstream
(pi host component), not this portfolio.
