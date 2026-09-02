# EV-10 — Enrollment and identity spec (§2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append §2 "Enrollment and identity" to `docs/SERVER-SIDE-SPEC.md`, self-contained, covering discovery, both grant flows, refresh, scope, token claims/tenancy, and the 401/403 error vocabulary.

**Architecture:** Docs-only change on the branch `docs/ev-10-enrollment-identity` (isolated git worktree). §2 is appended immediately after §1.7 and matches §1's framing: §2.x subsections, RFC 2119 keywords for wire contracts, clearly-marked non-normative Guidance blocks, prose + request/response tables (no OpenAPI).

**Tech Stack:** Markdown; `bunx tsc --noEmit` and `bun test` as gates (run in full even though the change is docs-only).

**Spec:** The card EV-10 brief is the handoff spec (no separate design file). Binding rulings R1–R6 apply: append in place; prose+tables per endpoint; one recommended shape per non-normative concern; stack-neutral; audit-blocklist clean (no PI-SPEC/src/test/module-file/card-id references, no soft phrases, no external links besides the §1.7 repo link); registry/admin surfaces mentioned only where they intersect enrollment.

## Global Constraints

- §2 must not contradict §1 (invariants INV-1..INV-6, keyword convention, document map row for §2).
- The blocklist scan over the appended section must find zero occurrences of: `PI-SPEC`, `src/`, `test/`, `login.ts`, `credential.ts`, `tunnel.ts`, `translate.ts`, `EV-`, `FLLWUP-`, `EPIC-`, "as the client", "the host spec".
- The only external link in the whole document remains the §1.7 repo link.
- Normative decisions to land (grounded in the reference client's observed behavior):
  - Discovery: `GET /.well-known/oauth-authorization-server` under the control-plane origin over HTTPS; `authorization_endpoint`, `token_endpoint`, `device_authorization_endpoint` REQUIRED; `revocation_endpoint` OPTIONAL; all values absolute HTTPS URLs; unrecognized fields ignored.
  - Attended flow: Authorization Code + PKCE (S256), loopback redirect `http://127.0.0.1:<ephemeral-port>/callback`, public client (no secret), form-urlencoded token exchange; server MUST accept variable loopback ports.
  - Headless flow: RFC 8628 device grant; device response carries `device_code`, `user_code`, `verification_uri` (REQUIRED), `verification_uri_complete` (OPTIONAL), `expires_in`, `interval`; poll semantics exactly `authorization_pending` / `slow_down` (+5 s backing off) / `expired_token` / `access_denied`; poll errors delivered as HTTP 400 with RFC 6749 §5.2-shaped bodies (normative page governs; the current host treats non-2xx poll responses as fatal — divergence flagged in the owner report, not papered over).
  - Refresh: `grant_type=refresh_token` at the token endpoint (no separate refresh endpoint); request carries `refresh_token` + `client_id`; server MAY rotate; a rotated refresh token MUST be invalidated; the host MUST replace its stored refresh token whenever the response carries one.
  - Scope: `pi-remote:host` authorizes host-side tunnel operations; enrollment requests it; tokens without it are insufficient (403).
  - Claims: access tokens are JWTs; REQUIRED claims `sub` (tenant-scoped, namespaced by tenant), `tenant_id`, `scope`, `exp`; server derives tenancy solely from the token (INV-3).
  - Errors: 401 = invalid/expired/revoked credential → only remedy re-enrollment; 403 = valid credential, insufficient scope → remedy re-consent + administrator scope grant; status codes MUST NOT be merged; a server returning 401 for a scope problem or 403 for an invalid credential is non-conformant. Uniform error body `{"error", "error_description"}` with codes `invalid_token` / `insufficient_scope`; RFC 6749 error codes for the token-endpoint grant failures.

---

### Task 1: Write §2 into docs/SERVER-SIDE-SPEC.md

**Files:**
- Modify: `docs/SERVER-SIDE-SPEC.md` (append §2 after §1.7)

**Interfaces:**
- Consumes: §1's terminology, INV-1..INV-6, keyword convention (§1.5), document map row for §2 (§1.6).
- Produces: §2.1–§2.8 fully on the page; §3+ may later reference the 401/403 vocabulary and the token claims.

- [ ] **Step 1: Append the section** with subsections in the card's order: 2.1 discovery, 2.2 attended flow, 2.3 headless flow, 2.4 refresh, 2.5 scope, 2.6 claims and tenancy, 2.7 error semantics, 2.8 the host-side credential (kept brief so §1.6's map row for §2 — "credential storage requirements on the host side" — is honored). Admin/registry intersect only in the 403 remedy (§2.7) pointing at the later registry section by section number, not by name.

- [ ] **Step 2: Self-review against the card** — every endpoint has request table, response table, status codes, error bodies; both flows step by step including all four device-flow error codes by name; nothing left to "as the client expects"; blocklist scan clean.

### Task 2: Gates (in full, docs-only notwithstanding)

**Files:** none (verification only)

- [ ] **Step 1:** `bunx tsc --noEmit` — must pass.
- [ ] **Step 2:** `bun test` — must pass (baseline in this worktree: 207 pass / 1 skip / 0 fail).

### Task 3: Commit, push, open PR

**Files:** none new

- [ ] **Step 1:** Conventional Commit: `docs(spec): specify enrollment and identity (§2)` (plan file rides the same commit).
- [ ] **Step 2:** Push `docs/ev-10-enrollment-identity` to origin; open a PR against `main` with `gh`.
- [ ] **Step 3:** Report PR number, head SHA, branch, coverage summary, gate results. Do not poll CI.
