---
id: EPIC-2
title: "Server-side specification — a self-contained implementation spec for the pi-remote relay and control plane"
state: Backlog
owner: null
epic: null
goal: docs/SERVER-SIDE-SPEC.md is a self-contained specification of a conformant server implementation of the relay and control-plane interfaces pi-remote requires — no reference to docs/PI-SPEC.md or to pi-remote's source anywhere in the document — such that a server team can build a conformant server reading only that document.
---

## Intent

PI-SPEC §10 deliberately scoped the server out of this repo — but the extension
shipped (EPIC-1) against a contract the server team has never seen written from
their side. This epic produces `docs/SERVER-SIDE-SPEC.md`: an
implementation-plan-grade specification, **self-contained by mandate** — the
human's binding constraint for the epic. The document is written for a reader
who has never seen PI-SPEC or the pi-remote codebase: every contract, shape,
error case, and invariant is restated in full on the page. Its **only** external
reference is a link to the client reference implementation,
https://github.com/jumpseat-inc/pi-remote — a courtesy pointer, never a
dependency: nothing in the document is correct only because the client does X.

The council-side verification may (and should) check the document against the
shipped client's fixtures and binding rulings — but that check lives in card
records, never on the page. All client-side decisions are inherited as fixed
input to be restated, not cited: the OAuth2 enrollment contract (RFC 8414
discovery, PKCE attended, RFC 8628 device flow, refresh at token_endpoint), the
tunnel error kinds, the envelope and inbound control-frame union, and the
two-seam retry boundary.

Delivered by children EV-9 through EV-14; EV-14's self-containment audit is the
gate that makes the mandate real.

## Acceptance

Observed as met when EV-9 through EV-14 are all Done, docs/SERVER-SIDE-SPEC.md
passes EV-14's self-containment audit (zero PI-SPEC/codebase/decision-id
references; exactly one external link, the client repository), and the
conformance audit maps every shipped-client wire contract into the document
with zero contradictions.
