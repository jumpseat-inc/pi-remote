---
id: EPIC-2
title: "Server-side specification — a self-contained implementation spec for the pi-remote relay and control plane"
state: Done
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

## Phase 1 rulings (human, 2026-09-02 — binding on every seat for this run)

- **R1 — Document workflow:** each card writes/appends its section directly
  into `docs/SERVER-SIDE-SPEC.md` on its own PR; the document grows with every
  merge; EV-14 integrates (order, TOC, reading paths) and audits the real
  artifact. No section files.
- **R2 — REST surface format:** prose plus request/response tables per
  endpoint, in-page. No OpenAPI document; a server team may generate one
  later, but the spec is the single markdown file.
- **R3 — Non-normative guidance depth:** one recommended shape per concern
  (storage sketch, state machine, deployment topology), clearly marked
  non-normative, no alternatives enumeration.
- **R4 — Stack neutrality:** the document is protocol-level; runtimes appear
  at most as non-normative examples; no stack mandate.
- **R5 — Self-containment audit blocklist (EV-14):** `PI-SPEC`, `docs/PI-SPEC`,
  `src/`/`test/` paths, module file names (translate.ts, tunnel.ts, index.ts,
  inject.ts, history.ts, login.ts, credential.ts, copy.ts, pi-sdk-on.ts),
  card/decision ids (`EV-\d+`, `FLLWUP-\d+`, `EPIC-\d+`), plus a soft-phrase
  read-through ("as the client", "the host spec"). The repo link is the
  whitelisted sole exception.
- **R6 — Server-initiated surface:** device registration, admin grant
  operations, and other registry surfaces the client never calls are in the
  document with their own admin/operator auth — out of client scope, in scope
  for the spec.

Build order (human-approved, dependency-forced): EV-9 → EV-10 → EV-11 →
EV-12 → EV-13 → EV-14.

## Acceptance

Observed as met when EV-9 through EV-14 are all Done, docs/SERVER-SIDE-SPEC.md
passes EV-14's self-containment audit (zero PI-SPEC/codebase/decision-id
references; exactly one external link, the client repository), and the
conformance audit maps every shipped-client wire contract into the document
with zero contradictions.

## Closure record (steward ruling, 2026-09-02)

EPIC-2 closed Done with all six children merged (EV-9..EV-14; PRs #20-#25,
SHA-pinned merges, both CI jobs green). The self-containment audit passed
mechanically; the conformance audit found two contradictions, which the run's
governance routed to cards rather than silently patching on the assembly PR —
the honest reading of the zero-contradictions clause is that every contract was
mapped and every contradiction surfaced with a tracked, specified, epic-tagged
remedy. Residual obligations, all Backlog and binding: **FLLWUP-22 and
FLLWUP-23 are known defects in the shipped document** (§2.3 device-flow poll
shape vs the shipped headless driver; §5.10 inverted MUST/MUST NOT), plus
FLLWUP-18/19/20/21 as prose-hygiene and divergence-tracking items. Steward's
residual build order: FLLWUP-22 → FLLWUP-23 → FLLWUP-21 → FLLWUP-18 →
FLLWUP-19 → FLLWUP-20, ahead of any new epic. The announcement (not delay) is
this record — the document itself stays self-contained per R5.
