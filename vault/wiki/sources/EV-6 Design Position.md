---
title: EV-6 Design Position
type: source
summary: Designer seat position establishing that replay correctness requires zero transformation of injected input — no input handler, no filtering, deliverAs is what pi actually does.
aliases: [EV-6 design position]
tags: [design, inject, replay]
sources: ["[[EV-6 Design Position]]"]
created: 2026-09-02
updated: 2026-09-02
---
The designer's EV-6 position (2026-08-31). Load-bearing principle: **replay-correctness = no transformation** — EV-6 must not register an `input` extension handler, must not filter or mark its own injections, so remote messages are indistinguishable from typed ones in the JSONL and the replay path is correct by construction. Corollaries: `deliverAs` mirrors pi's actual delivery semantics (idle → plain, mid-stream → steer, queued → followUp); `promptId` is the only durable correlation key; `deviceId` is opaque and already on the envelope — never into free text; resolving the host UI prompt directly is conditional on sponsorship (later closed permanently OFF by steward's R3 Side B — the steering fallback is the product). Interaction questions it raised (how does a remote client know a prompt is pending?) fed FLLWUP-5 and FLLWUP-8.

## Related
[[inject.ts]], [[Fixture-Green Honesty]], [[Copy Honesty Doctrine]]

## Sources
`vault/raw/2026-08-31-design-ev6-remote-input-injection.md`
