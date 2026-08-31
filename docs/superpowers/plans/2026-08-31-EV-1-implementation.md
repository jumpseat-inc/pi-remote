# EV-1 — PI-SPEC OAuth2 Enrollment Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite five blocks of `docs/PI-SPEC.md` (§7.2, §7.4, §7.5 row 1, §8, §9.1 clause) to pin the OAuth2-based `/rc:login` enrollment design, the seven-state footer, and the colon command namespace — verbatim per the committed design spec — and clear the repo gates.

**Architecture:** Docs-only card. The single modified file is `docs/PI-SPEC.md`. Each replacement block is taken **verbatim** from the design spec's §2.1–§2.5 (never reworded — the spec's §3 grep gates G-1…G-13 assert exact terms). No `src/`, no README, no package.json, no other doc changes. The only new file is this plan.

**Tech Stack:** Markdown (spec prose), git worktree isolation, `grep` gate verification, `bunx tsc --noEmit`, `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-31-EV-1-design.md` — the ONLY authoritative handoff. This plan argues from that spec; executors read the spec's §2 replacement blocks (quoted there in full) and §3 gate table.

## Global Constraints

- **Verbatim-only:** Each block is copied character-for-character from spec §2.1–§2.5. Do not restructure, rewrap, or "fix" wording. The spec says: "If anything here is ambiguous, the design is wrong — so it is not."
- **Touch list (exhaustive):** `docs/PI-SPEC.md` only — §7.2 (full section), §7.4 (table rows + blast-radius paragraph), §7.5 (row 1 of table only), §8 (full section through status-surface paragraph), §9.1 (one clause). **No other file may change** (README.md line 93 is a filed follow-up card, NOT this card; `src/` must not be created).
- **Binding rulings:** Q1 — `PI_REMOTE_HOST_KEY` retired entirely (zero occurrences in PI-SPEC.md; only `PI_REMOTE_SERVER_URL` survives as env override). Q2 — exactly seven footer states in lifecycle order `off` → `not enrolled` → `authorizing` → `dialing` → `resyncing` → `live` → `error`. Q3 — §7.4/§7.5/§9.1 updates are in-mandate prose sync, no ratification needed.
- **Command surface:** `/rc`, `/rc:login`, `/rc:off`. `/rc-off` must never appear anywhere in the doc.
- **No `POST /refresh` endpoint** — refresh is `grant_type=refresh_token` at `{token_endpoint}` (RFC 6749 §6, Skeptic O-4 closed-green).
- **No inline enrollment prompt in `/rc`** — unenrolled `/rc` refuses to dial, footer `not enrolled`, output names `run /rc:login`. Never "prompt once for … if missing" language.
- **Repo-where-used context:** worktree `.worktrees/ev-1-oauth2-enrollment` on branch `ev-1-oauth2-enrollment`, created fresh from local `main` (`c6a055f`). Do NOT use the stale `ev-1-spec-sync` branch/worktree. Never commit on `main`.
- **Repo gates:** `bunx tsc --noEmit` and `bun test`. CI `gates` workflow (`.github/workflows/gates.yml`) runs `bun test` conditionally — `if: hashFiles('**/*.test.ts', '**/*.test.tsx') != ''`. With zero test files the step is skipped by design. Raw `bun test` exits 1 ("No tests found!") at baseline and after — identical, non-regressing; run `bun test --pass-with-no-tests` for the flag-level equivalent exit-0, and record both honestly. Do not add flags to the workflow; do not add test files.

## Pre-change red state (recorded by Skeptic, step-4 report of the card)

All of these were verified `closed-red` on the pre-change doc — the motivation for the rewrite, not a surprise:
`rc-off` ×2 (§8), `PI_REMOTE_HOST_KEY` ×1 (§7.2:201), `host enrollment key` ×3 (§7.2:199, §7.4:244, §9.1:289), `Bearer` ×0, OAuth2 terms ×0, `not enrolled`/`authorizing`/`error` ×0, `/rc:login` ×0, "with the host key" at `POST /tunnels`.

---

### Task 1: Replace §7.2 Host enrollment (full section)

**Files:**
- Modify: `docs/PI-SPEC.md:193-218` (current §7.2: heading `### 7.2 Host enrollment` through the line ending `and the connection itself is the capability.`)

**Interfaces:**
- Consumes: nothing (first edit).
- Produces: the OAuth2 enrollment section that §7.4/§8/§9.1 edits must not contradict; anchors G-3/G-4/G-7/G-8/G-9/G-10.

- [ ] **Step 1: Read the replacement text**

Read spec §2.1 in `docs/superpowers/specs/2026-08-31-EV-1-design.md`. The block begins `### 7.2 Host enrollment` and ends at `the connection itself is the capability.` — copy it verbatim.

- [ ] **Step 2: Replace the current §7.2 body**

In `docs/PI-SPEC.md`, replace every line from the current `### 7.2 Host enrollment` heading (line 193) through `  and the connection itself is the capability.` (line 218) with the §2.1 block. Old text to match (do not pad with neighboring sections):

```
### 7.2 Host enrollment

An alternative design — *host-minted, server-signed* tokens — forces a
signing key distribution problem before anything works. **Chosen instead: the
server mints and signs; the host never holds a signing key.**

- One-time setup: the user configures a **host enrollment key** — a
  long-lived credential issued by the control plane and stored in extension
  settings (`PI_REMOTE_SERVER_URL` + `PI_REMOTE_HOST_KEY` env vars, or the
  settings block). This key authorizes *creating tunnels*, nothing else.
  On a multi-tenant server the key is issued **to a tenant** (a user or
  account); the extension treats it as opaque and the server resolves
  key → tenant on every request.
- `/rc` flow:
  1. Extension `POST /tunnels` to the control plane with the host key,
     payload: session id, session name, cwd, host metadata.
  2. Server responds with `{ tunnelId, url, tokenTtl }` — a **signed, expiring
     `wss://` URL with a one-time token**
     (`wss://server/tunnelId?token=…`). The token is self-describing: it
     embeds its claims (`tenantId`, `tunnelId`, `sessionId`, `exp`), so the
     server needs no lookup state to authenticate a dial.
  3. Extension dials the URL within the token TTL (default 60 s). The token is
     **single-use**: consumed on successful WS upgrade, then bound to that
     socket. A replayed URL is rejected.
- The host stores no tunnel secrets after connection: the token is discarded,
  and the connection itself is the capability.
```

- [ ] **Step 3: Verify §7.2 greps**

Run from the worktree root:

```bash
grep -n 'Bearer' docs/PI-SPEC.md                      # ≥1 hit in §7.2 (Authorization: Bearer <access_token>)
grep -n 'host key' docs/PI-SPEC.md                    # zero matches inside §7.2's tunnel-create description
grep -inE 'authorization_code|PKCE|code_challenge|device_authorization_endpoint|device_code|grant_type=refresh_token|RFC 8414|token_endpoint' docs/PI-SPEC.md   # ≥3 distinct terms in §7.2
grep -n 'PI_REMOTE_HOST_KEY' docs/PI-SPEC.md          # exit 1 (Q1)
grep -inE 'post.*/refresh' docs/PI-SPEC.md            # exit 1 (no separate refresh endpoint)
```

Expected: all green as described. `device_authorization_endpoint` appears with "all three are required contract fields" (G-10).

- [ ] **Step 4: Commit**

```bash
git add docs/PI-SPEC.md
git commit -m "docs: pin OAuth2 enrollment in §7.2 (PKCE + RFC 8628 device flow)"
```

---

### Task 2: Replace §7.4 trust table rows + blast-radius paragraph

**Files:**
- Modify: `docs/PI-SPEC.md:240-253` (current §7.4 heading through end of blast-radius paragraph)

**Interfaces:**
- Consumes: Task 1's §7.2 (row 1 must say OAuth2 token, not "host enrollment key").
- Produces: G-11 (`host enrollment key` → zero) and blast-radius prose preserved.

- [ ] **Step 1: Read the replacement text**

Read spec §2.2. Two replacement targets: the table (header row through the Client device row) and the blast-radius paragraph. The heading `### 7.4 Trust summary` and anything between stay untouched; in the current file the table is immediately followed by the blast-radius paragraph with no intervening prose.

- [ ] **Step 2: Replace the table rows and blast-radius paragraph**

Match and replace, from the `| Component | Holds | Can do |` header through the end of the blast-radius paragraph (`…only reaches its own tunnel.`), with the §2.2 text (4 table lines + blank line + 6-line paragraph, verbatim).

- [ ] **Step 3: Verify §7.4 greps**

```bash
grep -n 'host enrollment key' docs/PI-SPEC.md   # exit 1 (G-11)
grep -n 'host key' docs/PI-SPEC.md              # zero matches (blast-radius row no longer says host key)
```

- [ ] **Step 4: Commit**

```bash
git add docs/PI-SPEC.md
git commit -m "docs: sync §7.4 trust summary to OAuth2 credential language"
```

---

### Task 3: Replace §7.5 row 1 of the multi-tenancy table

**Files:**
- Modify: `docs/PI-SPEC.md` — first data row of the §7.5 table (currently line 257: `| Enrollment key (§7.2) | key belongs to a tenant | opaque credential, presented as-is |`)

**Interfaces:**
- Consumes: Task 1 (row references §7.2).
- Produces: G-12 — row 1 contains the `sub` claim (tenancy from token claims, ruling Q3).

- [ ] **Step 1: Read the replacement text**

Read spec §2.3 — a single table row. The §7.5 intro sentence and the other two rows are UNCHANGED.

- [ ] **Step 2: Replace only the first row**

Replace exactly:

```
| Enrollment key (§7.2) | key belongs to a tenant | opaque credential, presented as-is |
```

with the §2.3 row (verbatim).

- [ ] **Step 3: Verify**

```bash
grep -n 'sub' docs/PI-SPEC.md                 # §7.5 row 1 contains "`sub` claim" (G-12)
git diff docs/PI-SPEC.md                      # hunk is one row inside §7.5 only (G-13 partial)
```

- [ ] **Step 4: Commit**

```bash
git add docs/PI-SPEC.md
git commit -m "docs: derive §7.5 tenancy from token sub claim"
```

---

### Task 4: Replace §8 Lifecycle & command surface (full section)

**Files:**
- Modify: `docs/PI-SPEC.md:273-284` (current §8 heading `## 8. Lifecycle & command surface` through `…the session is remotely reachable.`)

**Interfaces:**
- Consumes: Task 1 (references `/rc:login`, `POST /tunnels`, §7.2).
- Produces: G-1, G-5, G-6, G-8 — command surface and seven-state footer.

- [ ] **Step 1: Read the replacement text**

Read spec §2.4 — the complete new §8 (heading + 4-row command table + status surface paragraph enumerating all seven states).

- [ ] **Step 2: Replace the entire current §8**

Match from `## 8. Lifecycle & command surface` through the final line `The host user can always see that the session is remotely reachable.` — which is the section's last line before `## 9.` — and replace with the §2.4 block verbatim.

- [ ] **Step 3: Verify §8 greps**

```bash
grep -n 'rc-off' docs/PI-SPEC.md                                # exit 1 (G-1)
grep -n '/rc:login' docs/PI-SPEC.md                             # ≥1 hit (G-6)
grep -nE 'off|not enrolled|authorizing|dialing|resyncing|live|error' docs/PI-SPEC.md   # all seven states present in §8, lifecycle order (G-5)
grep -nE 'inline|prompt.*once|enrollment key if missing' docs/PI-SPEC.md   # exit 1 (G-8)
```

Also visually confirm the status surface lists the seven states as `off` → `not enrolled` → `authorizing` → `dialing` → `resyncing` → `live` → `error` with a bullet for each (Q2), and `resyncing` described as healthy/replay-in-progress.

- [ ] **Step 4: Commit**

```bash
git add docs/PI-SPEC.md
git commit -m "docs: rewrite §8 command surface with /rc:login, /rc:off and seven footer states"
```

---

### Task 5: Sync §9.1 one clause

**Files:**
- Modify: `docs/PI-SPEC.md:289` (current line: `   long-lived host enrollment key used to request tunnels. This avoids the`)

**Interfaces:**
- Consumes: Tasks 1–2 (term consistency).
- Produces: final G-11 closure (zero `host enrollment key` in the whole doc) and G-13 (hunk in §9.1).

- [ ] **Step 1: Read the replacement text**

Read spec §2.5 — one clause swap inside resolved-design-question 1. Nothing else in §9 changes.

- [ ] **Step 2: Replace the clause**

Replace `the host holds only the long-lived host enrollment key used to request tunnels` with `the host holds only the OAuth2 access/refresh credential obtained from \`/rc:login\``.

- [ ] **Step 3: Verify**

```bash
grep -n 'host enrollment key' docs/PI-SPEC.md   # exit 1 (G-11; last occurrence removed)
grep -n 'rc:login' docs/PI-SPEC.md              # ≥1 hit, now also in §9.1
```

- [ ] **Step 4: Commit**

```bash
git add docs/PI-SPEC.md
git commit -m "docs: sync §9.1 token-minting rationale to OAuth2 credential"
```

---

### Task 6: Full gate sweep (G-1…G-13 + repo gates) — hard stop

**Files:** none modified.

- [ ] **Step 1: Run the full gate table from the worktree root**

```bash
# G-1
grep -n 'rc-off' docs/PI-SPEC.md; echo "G-1 exit: $?"          # expect exit 1 (zero matches)
# G-2
grep -n 'PI_REMOTE_HOST_KEY' docs/PI-SPEC.md; echo "G-2 exit: $?"   # expect exit 1 (Q1)
# G-3
grep -n 'Bearer' docs/PI-SPEC.md; echo "G-3a exit: $?"         # expect ≥1 hit inside §7.2
grep -n 'host key' docs/PI-SPEC.md; echo "G-3b exit: $?"       # expect zero inside §7.2 tunnel-create description
# G-4
grep -inE 'authorization_code|PKCE|code_challenge|device_authorization_endpoint|device_code|grant_type=refresh_token|RFC 8414|token_endpoint' docs/PI-SPEC.md; echo "G-4 exit: $?"   # expect ≥3 distinct terms in §7.2
# G-5
grep -nE 'off|not enrolled|authorizing|dialing|resyncing|live|error' docs/PI-SPEC.md; echo "G-5 exit: $?"   # expect all seven states in §8 in lifecycle order
# G-6
grep -n '/rc:login' docs/PI-SPEC.md; echo "G-6 exit: $?"       # expect ≥1 hit
# G-7 — covered by G-3
# G-8
grep -nE 'inline|prompt.*once|enrollment key if missing' docs/PI-SPEC.md; echo "G-8 exit: $?"   # expect exit 1
# G-9
grep -inE 'post.*/refresh' docs/PI-SPEC.md; echo "G-9 exit: $?"   # expect exit 1
# G-10
grep -n 'device_authorization_endpoint' docs/PI-SPEC.md; echo "G-10 exit: $?"   # expect ≥1 hit, required contract field in §7.2
# G-11
grep -n 'host enrollment key' docs/PI-SPEC.md; echo "G-11 exit: $?"   # expect exit 1
# G-12
grep -n 'sub' docs/PI-SPEC.md; echo "G-12 exit: $?"            # expect §7.5 row 1 contains "`sub` claim"
# G-13
git diff docs/PI-SPEC.md | grep -E '^@@'                        # hunks confined to §7.2/§7.4/§7.5/§8/§9.1
```

Record EVERY command's actual stdout + exit code. A failing gate is a hard stop: fix the underlying text and re-run, never lower a threshold.

- [ ] **Step 2: Repo gates**

```bash
bunx tsc --noEmit; echo "tsc exit: $?"          # expect 0
bun test; echo "bun test exit: $?"              # expect exit 1 "No tests found!" — identical to pre-change baseline;
                                                # CI gates.yml skips the Test step when no test files exist (hashFiles guard)
bun test --pass-with-no-tests; echo "pass-with-no-tests exit: $?"   # expect 0 (flag-level equivalent of the conditional skip)
```

- [ ] **Step 3: Confirm no other file changed**

```bash
git status --short    # only docs/PI-SPEC.md (+ this plan file on its first commit)
git diff --stat
```

---

### Task 7: Commit the plan, push, open PR (no merge)

**Files:**
- The plan file `docs/superpowers/plans/2026-08-31-EV-1-implementation.md` is the only new file. It may ride in its own commit or the first docs commit; the card forbids any other new file.

- [ ] **Step 1: Commit the plan**

```bash
git add docs/superpowers/plans/2026-08-31-EV-1-implementation.md
git commit -m "docs: add EV-1 implementation plan"
```

(Or fold into the first Task-1 commit — but keep the final history conventional and the diff of `docs/PI-SPEC.md` cleanly attributable.)

- [ ] **Step 2: Final full verification pass**

Re-run the Task-6 full gate sweep once more AFTER all commits so the committed state — not the working tree — is verified. If the plan file's commit precedes the doc changes, verify per-commit diffs too.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin ev-1-oauth2-enrollment
```

Do NOT push `main`. origin/main is behind local main; the PR will show the council commits — expected, do not merge.

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --head ev-1-oauth2-enrollment \
  --title "docs: sync PI-SPEC with /rc:login OAuth2 enrollment design (EV-1)" \
  --body "EV-1 docs-only rewrite of docs/PI-SPEC.md (§7.2, §7.4, §7.5 row 1, §8, §9.1). Gates G-1..G-13 verified locally; typecheck clean; test gate skipped by CI when no test files exist."
```

Record the PR number/URL. Do NOT merge. Do not poll CI.

- [ ] **Step 5: Report**

Report: worktree path, branch name, PR number/URL, each gate's actual output (G-1…G-13 greps, tsc, bun test — including the raw `bun test` exit-1 baseline note), and any gate that did not pass with its fix.