---
id: FLLWUP-4
title: "EV-2 localization seam: second (en→id) message lookup and resolver"
state: Deliberating
owner: null
epic: EPIC-1
goal: A second message lookup plus a resolver ships alongside tunnel.ts's existing key-based reason-to-message table so tunnel error and status copy can resolve in a language other than English without touching any emission site.
---

## Intent

Filed from EV-2's step 13. Product-owner ruling Item 2 (binding) gave EV-2 a
key-based reason→message table with English defaults living in tunnel.ts, and
explicitly deferred localization ("a separate card that adds a second lookup
plus a resolver — not part of EV-2"). This card is that separate card.
Post-epic enhancement — intentionally Backlog so the epic's delivery loop does
not pick it up. User-visible surface — every tunnel.ts-sourced command-output
line and footer-adjacent message, once a non-English locale is selected.

## Acceptance

- A second lookup table (Bahasa Indonesia first, per the repo owner's
  locale) keyed by the same stable message keys tunnel.ts already emits,
  extended to cover the ten rows EV-8 added (7 `status.*` footer rows + 3
  `tunnel.error.relayUnreachable`/`protocolViolation`/`urlExpired`
  transport-error rows) so the EV-8-owned vocabulary is localized in the same
  pass.
- A resolver that picks the lookup by a locale setting, defaulting to the
  English table when the requested locale or key is missing (no missing-copy
  crashes).
- No emission-site changes: the reason→key contract from EV-2 is unchanged.
- bunx tsc --noEmit exit 0 and bun test exit 0 with fixtures covering both
  tables and the fallback path.

## Deliberation record

### Round 1 — independent first pass (owner, principal, designer)

**Design note:** vault/wiki has no pages covering the copy/localization seam (index is empty) — wiki grounding unavailable for this card.

**owner (verbatim):**

Grounding findings: most tunnel-domain copy never goes through a lookup today. `index.ts:128` resolves `tunnelReasonCopy[source.reason].userLine` — the English string **directly**, bypassing `englishFor` — and `index.ts:443` prints `tunnelReasonCopy.teardown_failed.userLine` directly. `englishFor` is exported but has zero production callers. So a resolver added *only* behind the existing lookup functions localizes the login-domain surface (footer status rows, rc.* lines) but leaves tunnel-reason footer errors in English forever — contradicting the card's own user-visible-surface goal. Fixing that needs exactly two one-line changes in `index.ts` (`errorSentence` and `doTeardown` become `englishFor(tunnelReasonCopy[...].userLineKey)`), which changes **zero emitted keys** — the reason→key contract from EV-2 is untouched. A literal zero-diff reading of acceptance line 3 makes the acceptance unsatisfiable for tunnel-reason footer errors.

Mechanism: **new module `src/copy.ts`** — deliberately below both `tunnel.ts` and `login.ts` in the import graph (imports nothing from the repo), so there is no cycle. Exports `CopyLocale = "en" | "id"`, `indonesianCopy: Record<string, string>`, `setLocale(raw: unknown)` (anything unrecognized → "en"), `getLocale()`, and `resolveCopy(key, englishTable)` — the resolver takes the English table as a parameter rather than importing it. `englishFor` (tunnel.ts) and `loginEnglishFor` (login.ts) keep their signatures and delegate: `resolveCopy(key, englishDefaults)`. Every existing call site compiles and behaves identically under locale `en`.

Locale sourcing: `piRemote.locale` (string), read once in the pi entry point (`pi.getSetting("piRemote.locale")` — same pattern as `piRemote.serverUrl`) and applied via `setLocale(...)` before the controller is constructed. Default `"en"`; non-string/empty/unrecognized → `"en"` (fail-open). One module-level mutable in `copy.ts`, set once at load, mirroring the existing `loginEndpointRequestLog` precedent; tests reset via `setLocale("en")` in `afterEach`.

Key inventory (complete, 50 keys): 6 `tunnelReasonCopy` keys; 10 EV-8 rows in `FOOTER_ROWS` (7 `status.*` + 3 `tunnel.error.relayUnreachable/protocolViolation/urlExpired`); 6 `FOOTER_ROWS` command-output rows (`rc.unenrolled`, `rc.serverUrlRequired`, `rc.dialingInProgress`, `rc.offLifecycle`, `shutdown.closed`, `rc:login.refusal`); 15 `NON_FAILURE_ROWS` (`login.attended.*`, `login.headless.*`, `login.cancelled`, `login.alreadyRunning`, `login.replacementPrompt`); 13 `FAILURE_ROWS` (`login.failure.*`). Plus two keyless constants: `ALREADY_LIVE_COPY` (ruled verbatim, Item 3) and `ACL_ENFORCEMENT_FAILED_NOTICE` (FLLWUP-7 binding ruling).

Coverage recommendation: mandated 16 (6 tunnel + 10 EV-8) + the 6 `rc.*`/`shutdown.closed`/`rc:login.refusal` command-output rows = **22**, since the card's surface says "every tunnel.ts-sourced command-output line and footer-adjacent message" and these are the command-output lines `index.ts` actually prints. The 28 login-flow keys and the two keyless constants out of scope, flagged. Partial coverage is safe by construction (missing keys fall back to English) — a product choice, not a correctness risk.

Test plan: (1) table-completeness drift alarm — derive expected key set from `tunnelReasonCopy` + `FOOTER_ROWS`, assert `indonesianCopy` covers exactly the agreed scope with non-empty values; (2) locale picking — `setLocale("en")`/`setLocale("id")` sampled per domain; (3) fallback — id + missing key → English; unknown locale (`"fr"`, `""`, `null`, `42`) → English; missing key under en → key echoed; (4) reason→key contract golden — `userLineKey` set is exactly the six keys; (5) integration red-then-green — drive `createRemoteController`'s `reducer` with `{type:"error", reason:"enrollment_expired"}` under `setLocale("id")`, assert the rendered footer sentence is the id string; fails on current code, passes after the two one-line fixes; (6) gates.

Open questions: (a) literal "no emission-site changes" vs. the two one-line resolution-site fixes in `index.ts`; (b) id-table scope 16 / 22 / 50; (c) setting name `piRemote.locale` and silent fallback confirm; (d) ruled verbatim copy (`ALREADY_LIVE_COPY`, `ACL_ENFORCEMENT_FAILED_NOTICE`) out of scope confirm.

**principal (verbatim):**

Cross-seam reading — the contract is *not* what the card assumes. The EV-2 ruling Item 2 specified: `userLine` is a **stable key**, and "tunnel.ts ships an English default lookup that resolves each key to its user-line" — anticipating "a single new file plus a **resolver hook**." The code shipped the key and the lookup, but **the hook was never wired on the tunnel side**. Today there are **three coexisting resolution mechanisms** at the emission sites: (1) `loginEnglishFor(key)` — used for `status.*`, the three transport-error rows, and the six `rc.*`/`shutdown.*` command lines; (2) `tunnelReasonCopy[reason].userLine` — direct English-string read at the tunnel-side error footer (`index.ts:129`) and the teardown print (`index.ts:443`); (3) `ALREADY_LIVE_COPY` — an unkeyed string constant printed verbatim (`index.ts:462`). `englishFor` is exported but never called by any production site.

Key inventory: same 50-key enumeration as the owner (arrived independently); `tunnel.error.*` namespace is authored in **two modules** — 6 keys in `tunnel.ts`, 3 in `login.ts`'s `FOOTER_ROWS` — so the id table must span both sources. Card-mandated coverage = 16 keys.

Architecture: one new pure module `src/messages.ts` exporting `idMessages: Partial<Record<string,string>>` (the Bahasa overlay), a merged English-default map (or delegation to the existing `englishFor`/`loginEnglishFor`), and `resolveMessage(key, locale)` = id-hit → id string, else English, else raw key. Nothing in `tunnel.ts`/`login.ts`/`merge.ts` moves; both existing lookups remain the English-default source of truth. Resolver pure, locale as parameter; index.ts resolves locale once and threads a bound `resolve` in.

Reframe: this card is actually **"complete the resolver hook that EV-2's Item-2 ruling already specified, then add the id overlay."** The honest no-op constraint is **"reason→key values unchanged, no *new* keys except one (the already-live line), and the three emission sites re-point from `.userLine`/constant to the resolver."** Under that reframe the design is sound and uncontroversial, but the literal "no emission-site changes" wording must be corrected to "no *key-contract* changes," or the card ships a half-localized product and fails its own goal text.

Blind spots: the vocabulary side cannot see that `englishFor` is a dead export or that `tunnel.error.*` got split across two files; the render side cannot see the ruling's resolver-hook intent or that `ALREADY_LIVE_COPY` is the only key-less tunnel-sourced line; neither side alone sees that `tunnel.error.unreachable` and `ALREADY_LIVE_COPY` embed `` `<serverUrl>` `` yet `index.ts` prints them verbatim with **no substitution** — today's English output already shows the literal `` `<serverUrl>` `` marker.

Locale: `PI_REMOTE_LOCALE` env → `pi.getSetting("piRemote.locale")` → default `"en"`; not in `credentials.json`; no `process.env.LANG` auto-detection in this card (follow-up); resolver normalizes anything not equal to `"id"` to `"en"`.

Failure modes: (a) missing/unknown locale → `"en"`; (b) key missing from id table → English default, **not** the raw key; (c) key missing everywhere → raw key (today's behavior, unchanged); (d) partial id coverage → per-key fallback — designed behavior, the id table never has to be exhaustive to be safe.

Leave out: the 28 login-flow rows and the 6 `rc.*`/`shutdown.*` command lines are not in the mandated 16 — but leaving them English while `status.*` is Indonesian yields a mixed-language interface. Recommends folding the 6 `rc.*` rows in; boundary is a judgment call for product-owner. `ACL_ENFORCEMENT_FAILED_NOTICE` out of scope. No plural/gender formatting — flat single-string rows. Do not touch `transport.ts`; do not change `merge.ts`'s key-derivation maps.

Testable claims: (1) `englishFor` unwired (grep-settled); (2) tunnel-side footer line cannot change language today — red-then-green fixture driving a 503 → `server_error` through the controller under id locale; (3) fallback semantics are three-valued (id hit → id; out-of-coverage key → English sentence, not raw key; unknown key → raw key; unknown locale → English); (4) the 16 mandated keys exactly covered, non-empty, distinct from English, and no orphan id key no emission site can emit.

Open questions for product-owner: (1) does "no emission-site changes" permit the three mechanical re-points (recommend: constraint is "keys unchanged" not "byte-identical emission sites"); (2) the already-live line has no key — assigning one (recommend `tunnel.alreadyLive`, not `tunnel.error.*`) is a net-new key, ruling needed; (3) coverage boundary 16 / 22 / 50; (4) locale setting name/precedence confirm; (5) the un-substituted `` `<serverUrl>` `` literal — in scope or follow-up.

**designer (verbatim):**

Framing: Bahasa Indonesia copy is read by a person at a pi terminal at 02:00 looking at a footer that says `error` and a one-line print above it that must (a) name the fault, (b) name the fix, (c) not lie about the network. The card is surface-touching; the Indonesian strings *are* the surface. The narrower seam is the **command-literal signifier** — the literal substring `/rc:login` the driver must type verbatim.

Six instruments: (1) **literal-substring invariant** — `/rc:login`, `/rc:off`, `/rc` are pi command names; never translated, never wrapped, never expanded; unit-tested containment assertion. (2) **`<placeholder>` invariant** — angle-bracketed placeholders must survive untouched so the render pipeline still substitutes them; test renders with a known `serverUrl` and asserts the placeholder is gone in output. (3) **em-dash sentence shape** — keep the U+2014 joiner glyph; the EV-2 ruling chose it deliberately; fault-and-fix stays one stated sentence. (4) **no-blame, no-leak** — no HTTP status codes, no raw exception text, no one-time tunnel URL in the id strings. (5) **imperative, no-over-promise** — bare verb imperatives (`Jalankan`, `Periksa`); no *"silakan"* softener on unrecoverable rows; *"…untuk coba lagi"* faithful for retry rows. (6) **stated-refusal shape** — refusals read as one stated sentence naming the target command; `ALREADY_LIVE_COPY`'s semicolon marks a successful no-op, not a fault — keep it.

Coverage completeness — the largest single hazard in the card. Walking every emission site: an `id`-locale driver's first-run path is (1) `pi.input` prompt in English, (2) J2 REPLACEMENT_PROMPT in English, (3) attended/headless driver prints in English, (4) success line in English with English `(tenant …)` parenthetical, (5) `/rc` prints in English, (6) footer in Indonesian, (7) shutdown line in English. **The footer is the only piece the card actually localizes in the user's first-run path; everything else around it stays English.** Smallest change closing this: scope the second lookup to all keys consumed by `englishFor` and `loginEnglishFor`. If the product-owner prefers the acceptance as-written, the partial localization must at minimum be announced in the id-table itself. **This is a card-scope question, escalated, not a design judgment.**

Falsifiable predictions (with falsifiers): (1) id `tunnel.error.unauthenticated` keeps `/rc:login` byte-identical — string containment test. (2) id 403 line ≠ id 401 line, both contain `/rc:login`, admin clause present — string tests; the comprehension judgment (driver reads "ask your admin" as a named-actor clause) needs a native-speaker cold read. (3) rendered id `tunnel.error.unreachable` contains the URL and NOT the literal `<serverUrl>` — pure-seam test. (4) id `tunnel.error.urlExpired` names the re-dial command — but the English row's remedy ("re-dial") is ambiguous between `/rc` and `/rc:login`; a ruling must pin it. (5) id `status.live` reads as a positive state — assert it contains none of `error`/`gagal`/`tidak`/`kedaluwarsa`/`habis`; which Indonesian word captures "Live" is comprehension-only. (6) `ACL_ENFORCEMENT_FAILED_NOTICE` stays English under id — the gap test; the designer wants it to fail loudly and route the escalation. (7) J2 prompt parenthetical either leaks English or disappears — comprehension hazard only a smoke can settle.

Testable vs. comprehension-only split: string containment/equivalence and resolver-fallback tests are `bun test`-gateable; items 2/5 word-choice and imperative-politeness judgments need a native-speaker cold-read smoke, proposed as `scripts/render-smoke.ts --locale=id` with four critical-moment fixtures, a skeptic-side deliverable, runnable but not merge-gating.

Preferences (ranked last, held loosely): keep the em-dash; bare imperative over "silakan"; no second-person pronoun (English copy has none); id table inherits any future en-dash standardization.

Open questions for a ruling: (1) card scope — 16 / all-two-lookup-keys / full 50; (2) locale-selection mechanism shape (`RemoteControllerDeps.locale?` vs pi setting vs env vs `process.env.LANG`); (3) `re-dial` resolution in `tunnel.error.urlExpired` — `/rc` or `/rc:login`; (4) cold-read smoke responsibility.
