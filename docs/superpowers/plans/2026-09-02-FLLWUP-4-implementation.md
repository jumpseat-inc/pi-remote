# FLLWUP-4 Implementation Plan — en→id message lookup and resolver

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Bahasa Indonesia message overlay (22 keys) plus a pure resolver ships alongside the existing key-based reason→message tables, with locale sourced `PI_REMOTE_LOCALE` env → `piRemote.locale` setting → fail-open `"en"`.

**Architecture:** New pure module `src/copy.ts` (imports nothing from the repo) holds the id overlay, module-level locale, `resolveCopy(key, englishTable)` three-valued fallback, and `renderCopy` placeholder substitution. `englishFor` (tunnel.ts) and `loginEnglishFor` (login.ts) delegate to `resolveCopy` with unchanged signatures. Exactly two resolution-site re-points in `index.ts` (`errorSentence` tunnel branch, `doTeardown` catch), each rendering with `{ serverUrl }`. Entry point reads locale env-over-setting before controller construction.

**Tech Stack:** Bun + TypeScript, `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-02-FLLWUP-4-design.md` (rulings OJ1–OJ5 binding; card `council/cards/FLLWUP-4.md`).

## Global Constraints

- No emitted message key changes; no new keys; reason→key contract unchanged.
- Zero changes to `ALREADY_LIVE_COPY`, `ACL_ENFORCEMENT_FAILED_NOTICE`, the `inputPrompt` literal at `index.ts:542`, `transport.ts`, `merge.ts`; `index.ts:462` and `test/index.test.ts:288` parked (R1).
- Id-table module comment announces the coverage boundary per OJ2 (22 keys; 28 login-flow rows + keyless constants + keyless `inputPrompt` literal at `index.ts:542` named as English-remaining).
- Designer invariants (spec §5): `/rc`, `/rc:login`, `/rc:off` byte-identical inside id strings; `` `<serverUrl>` `` survives in stored strings; em-dash U+2014 preserved; imperative shapes; no leaked codes/URLs.
- R4: the one English-copy amendment is `tunnel.error.urlExpired` → `"The tunnel URL expired — run /rc to re-dial"`; the id row names `/rc` too.
- Gates: `bunx tsc --noEmit` exit 0, then `bun test` exit 0 (187+ pass, 1 win32-ACL skip, 0 fail).
- Conventional Commits (scopes: transport, translate, history, inject, tunnel, or none).

---

### Task 1: `src/copy.ts` — id overlay, resolver, substitution helper

**Files:**
- Create: `src/copy.ts`
- Test: `test/copy.test.ts`

**Interfaces:**
- Produces: `CopyLocale = "en" | "id"`; `indonesianCopy: Partial<Record<string, string>>` (exactly the 22 keys: 6 `tunnelReasonCopy.userLineKey`s ∪ 16 `FOOTER_ROWS` keys); `setLocale(raw: unknown): void` (`"id"` → id, anything else → en); `getLocale(): CopyLocale`; `resolveCopy(key: string, englishTable: Record<string, string>): string`; `renderCopy(line: string, subs: Record<string, string | undefined>): string`.

- [ ] Step 1: Write failing tests (test-plan items 1–4, 7, 8 in `test/copy.test.ts`): table-completeness drift alarm (expected set derived from `tunnelReasonCopy` + `FOOTER_ROWS`, non-empty values), fallback semantics (id + out-of-scope key → English; unknown key → raw key; `"fr"`/`""`/`null`/`42` → en), reason→key golden (six tunnel keys), urlExpired rows (both locales name `/rc`), invariants (command literals byte-identical, em-dash U+2014, no `silakan`, no `http`/3-digit codes, `` `<serverUrl>` `` survives + `renderCopy` substitutes).
- [ ] Step 2: `bun test test/copy.test.ts` → FAIL (module missing).
- [ ] Step 3: Implement `src/copy.ts` with the coverage-boundary module comment per OJ2.
- [ ] Step 4: `bun test test/copy.test.ts` → PASS. Commit `feat: add copy.ts id overlay, resolver, and render helper (FLLWUP-4)`.

### Task 2: Delegation + the R4 English amendment

**Files:**
- Modify: `src/tunnel.ts` (`englishFor` delegates), `src/login.ts` (`loginEnglishFor` delegates; `urlExpired` row gains `/rc`)

**Interfaces:**
- Consumes: `resolveCopy` from Task 1. Signatures of `englishFor`/`loginEnglishFor` unchanged.
- Produces: locale-aware lookups at every existing call site; English under locale `en` byte-identical except the urlExpired row.

- [ ] Step 1: Add failing tests: locale picking through `englishFor`/`loginEnglishFor` across domains (tunnel reason, status row, command-output row) under `setLocale("id")`/`setLocale("en")` (test-plan item 2).
- [ ] Step 2: `bun test test/copy.test.ts` → FAIL (lookups still English under id).
- [ ] Step 3: Delegate both lookups to `resolveCopy`; amend the login.ts:238 row per R4.
- [ ] Step 4: `bun test` full → PASS (existing suites green under en). Commit `feat: delegate englishFor/loginEnglishFor through resolveCopy; name /rc in urlExpired (FLLWUP-4)`.

### Task 3: The two re-points + entry-point locale sourcing

**Files:**
- Modify: `index.ts` (`errorSentence` tunnel branch ≈:129, `doTeardown` catch ≈:443, `applyFooter` threads serverUrl, default-export entry reads locale)
- Test: `test/copy.test.ts` (integration additions)

**Interfaces:**
- Consumes: `renderCopy`, `setLocale` from Task 1; `englishFor` from tunnel.ts.
- Produces: footer tunnel-error lines and teardown print resolve per locale with `{ serverUrl }` substituted; `setLocale` applied before controller construction from `PI_REMOTE_LOCALE` env → `piRemote.locale` setting.

- [ ] Step 1: Write failing integration tests: drive `createRemoteController`'s reducer with `{type:"error", reason:"enrollment_expired"}` under `setLocale("id")` → footer sentence is the id string (item 5); `control_plane_unreachable` → rendered line contains the real server URL, not the literal marker (item 6, footer shape); `/rc` dial with a 500-on-DELETE fetch → teardown print is the id string rendered with serverUrl (item 6, teardown shape); entry-point env-over-setting wiring.
- [ ] Step 2: `bun test test/copy.test.ts` → FAIL (footer English-locked today).
- [ ] Step 3: Re-point `errorSentence` tunnel branch to `renderCopy(englishFor(tunnelReasonCopy[source.reason].userLineKey), { serverUrl })`, thread `serverUrl` (`activeHttp?.serverUrl ?? deps.serverUrl`) through `renderFooter`/`applyFooter`; re-point `doTeardown` catch to `renderCopy(englishFor(tunnelReasonCopy.teardown_failed.userLineKey), { serverUrl })`; add `setLocale(pi.env("PI_REMOTE_LOCALE") ?? …)` in the entry point. `index.ts:462` untouched.
- [ ] Step 4: `bun test` full → PASS incl. `test/index.test.ts:288` (parked site untouched). Commit `feat: resolve tunnel footer/teardown copy per locale with serverUrl substitution (FLLWUP-4)`.

### Task 4: Gates + PR

- [ ] Step 1: `bunx tsc --noEmit` → exit 0.
- [ ] Step 2: `bun test` → 187+ pass, 1 skip, 0 fail.
- [ ] Step 3: Push `feat/fllwup-4-id-localization`; `gh pr create` against `main`.
