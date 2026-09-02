---
id: EV-9
title: "Conformance framing — purpose, scope, invariants, normative keywords, reference-client link"
state: Done
owner: null
epic: EPIC-2
goal: docs/SERVER-SIDE-SPEC.md opens with a purpose-and-conformance section that defines the server's single responsibility as standardized-frame relay plus control plane, states the system invariants in the document's own words, establishes the normative keyword convention, and carries the one permitted external reference — a link to https://github.com/jumpseat-inc/pi-remote as the reference client implementation.
---

## Intent

The first thing a server implementer reads, and the guard against the classic
failure: a server that "helpfully" inspects or translates frames. This section
states the system invariants **in the document's own words** — the server
accepts and forwards standardized messages only; all AG-UI translation happens
in the client; the server never learns what a pi session file is; credentials
carry tenancy — with no citation to any other document, because the reader is
assumed to have none. It also establishes the document convention the rest of
the epic writes against: RFC 2119-style MUST/SHOULD/MAY for wire contracts,
clearly marked non-normative guidance for implementation recommendations
(storage shapes, state machines, deployment), a document map, and the single
permitted external reference — the reference-client link — placed here so every
later section inherits exactly one.

**Self-containment requirement:** this section must be fully intelligible with
no access to PI-SPEC or the client source; where it restates an invariant, the
restatement is complete on the page.

## Acceptance

- §1 states the single-responsibility boundary and the system invariants
  completely in the document's own words.
- The normative/non-normative keyword convention is defined and every later
  section's obligations are expressible in it.
- The document's one external reference (the repo link) appears here and is
  characterized as reference implementation, not dependency.
- A document map lists the sections EV-10 through EV-13 produce, with the
  reader path for each.
- The section contains zero references to PI-SPEC, client file names, or
  internal ruling ids.
