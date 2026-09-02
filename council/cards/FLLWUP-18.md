---
id: FLLWUP-18
title: "Align the refresh request encoding with RFC 6749 form-encoding or document the divergence permanently (EV-10 follow-up)"
state: In Progress
owner: owner
epic: EPIC-2
goal: Resolve the deliberate divergence between the merged spec's §2.4 refresh request (JSON body) and RFC 6749 §2.3.1 (form-encoding) — either migrate the client and spec together to form-encoding in one PR, or promote the JSON-body divergence from PR-body disclosure to a stated, permanent exception in docs/SERVER-SIDE-SPEC.md.
---

## Intent

Filed from EV-10 step 13 per the orchestrator's binding ruling (EPIC-1
precedent: step-13 follow-up filing is the orchestrator's confirm-or-drop
bookkeeping). During EV-10 cycle 2, the owner aligned §2.4 to the shipped
client's actual refresh body — exactly two REQUIRED fields, `grant_type` +
`refresh_token`, `application/json` — and disclosed the RFC 6749 §2.3.1
divergence in the PR body. The Skeptic verified no functional gap exists
today: the shipped client's refresh body is exactly the REQUIRED shape on the
page. What remains is intent preservation, the same standard applied to
FLLWUP-17: a genuine, implementable future direction, not a fold-in.

## Scope (per the ruling — the deliberation picks)

Either:
- Migrate the refresh request to RFC 6749 §2.3.1 form-encoding
  (`application/x-www-form-urlencoded`) — client and spec in the same PR, per
  the governance precedent; or
- Promote the JSON-body divergence from PR-body disclosure to a stated,
  permanent exception in docs/SERVER-SIDE-SPEC.md.

## Acceptance

- One of the two scope options is implemented end to end.
- If form-encoding: the client's refresh request and spec §2.4 change in the
  same PR; every consumer that parses refresh bodies (including the in-repo
  mock IdP) is updated; bunx tsc --noEmit exit 0; bun test exit 0.
- If documented exception: docs/SERVER-SIDE-SPEC.md §2.4 states the divergence
  from RFC 6749 §2.3.1 as a permanent, normative exception with its rationale,
  so the contract no longer depends on the merged PR body's disclosure.

## Phase 1 ruling (human, 2026-09-02 — binding for this run)

**Q2 ruled: follows Q1's posture — the client and spec migrate to RFC 6749
§2.3.1 form-encoding in one PR** (client refresh body + spec §2.4 amended
together per the governance precedent); the JSON-body divergence is not
promoted to a permanent exception. Client conformance to the RFCs is the
run's standing posture (Q1: obey RFC 8628).
