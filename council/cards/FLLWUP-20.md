---
id: FLLWUP-20
title: "Align PI-SPEC §7.3's per-device lastAckedSeq sentence with the shipped single-watermark reality"
state: Backlog
owner: null
epic: EPIC-2
goal: docs/PI-SPEC.md §7.3's sentence that "the extension tracks lastAckedSeq per device" is amended to state the shipped reality — the host extension tracks a single merged inbound watermark, with per-device lastAckedSeq bookkeeping living server-side — and nothing else in the section changes.
---

## Intent

Filed from EV-12's step 13 per the product-owner's OJ-2 ruling (pre-confirmed
at ruling time; no further confirmation required). Shaped on FLLWUP-19.

PI-SPEC §7.3 says "the extension tracks `lastAckedSeq` per device" — written
before EV-3's transport settled. The shipped code tracks one merged inbound
watermark (`inboundSeq = Math.max(...)`, a single `highestDeviceAck`, no
per-device seq map anywhere in `src/` — EV-12 Skeptic objection O10,
closed-green by code read). Per-device `lastAckedSeq` bookkeeping is the
*server's* job (EV-12's §4.3 names the server the single producer of the
host-bound stream precisely because the host keeps one watermark). A
PI-SPEC reader could implement a host that maintains per-device watermarks,
which the shipped single-watermark ack semantics cannot consume.

**Scope:** amend only the one false sentence in §7.3. Docs-only prose sync;
no code change, no contract change. This drift is pre-existing PI-SPEC prose
outside EV-12's contract surface (the data-plane section of
docs/SERVER-SIDE-SPEC.md), so it did not ride the EV-12 PR — the OJ-2
reconciliation applies Spec Correction Governance's third test exactly as
FLLWUP-19 did for §7.2.

## Acceptance

- §7.3's sentence states the single merged watermark and places per-device
  bookkeeping server-side; consistent with docs/SERVER-SIDE-SPEC.md §4.3.
- No other PI-SPEC sentence changes in the same PR.
