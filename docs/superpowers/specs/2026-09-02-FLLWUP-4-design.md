# FLLWUP-4 design — EV-2 localization seam: second (en→id) message lookup and resolver

Card: `council/cards/FLLWUP-4.md` · Epic: EPIC-1 · Date: 2026-09-02
Basis: full-council deliberation (owner + principal + designer, 2 rounds),
Skeptic verification (8 objections run, none gating), consolidator synthesis,
product-owner rulings OJ1–OJ5 (binding, filed at
`vault/raw/2026-09-02-po-fllwup4-ruling.md`).

## Goal

A second message lookup (Bahasa Indonesia) plus a resolver ships alongside
`tunnel.ts`'s existing key-based reason-to-message table so tunnel error and
status copy can resolve in a language other than English without touching any
emission site — where "emission site" means **no emitted message key changes**
(the EV-2 reason→key contract is unchanged; mechanical resolution-site re-points
are in scope, see R4/R5).

## Ground truth (Skeptic-verified on this tree)

- `englishFor` (`src/tunnel.ts:163`) is exported with **zero production
  callers** — the tunnel-side footer (`index.ts:129`, inside `errorSentence`)
  and the teardown print (`index.ts:443`) read `tunnelReasonCopy[…].userLine`
  (the English string) directly.
- `tunnelReasonCopy` (`src/tunnel.ts:115-156`) carries exactly 6
  `userLineKey`s: `tunnel.error.unauthenticated | forbidden | unreachable |
  serverError | teardownFailed | invalidResponse`.
- `src/login.ts` carries the `FOOTER_ROWS` vocabulary: 7 `status.*` rows, 3
  transport rows (`tunnel.error.relayUnreachable | protocolViolation |
  urlExpired` at `src/login.ts:234-238`), 6 command-output rows
  (`rc.unenrolled`, `rc.serverUrlRequired`, `rc.dialingInProgress`,
  `rc.offLifecycle`, `shutdown.closed`, `rc:login.refusal`). `loginEnglishFor`
  resolves them from `englishDefaults`.
- The 22-key inventory (6 tunnel keys ∪ 16 FOOTER_ROWS) is exact: union size
  22, zero duplicates, `transportErrorKey` closure 3 keys.
- `` `<serverUrl>` `` substitution exists only behind `render()` in
  `src/login.ts:315` at specific login-flow print sites. The tunnel-side
  footer and teardown prints today emit the **literal** `` `<serverUrl>` ``
  marker with no substitution (bug this card fixes at the two re-point sites).
- `test/index.test.ts:288` pins `ALREADY_LIVE_COPY` printed verbatim at
  `index.ts:462` — that site is parked (R1); the two re-points red no test.
- Entry-point precedent: `index.ts:657-658` reads
  `pi.env("PI_REMOTE_SERVER_URL") ?? pi.getSetting("piRemote.serverUrl")` —
  env already wins over setting.
- Keyless English literal at `index.ts:542` (`deps.inputPrompt("Control-plane
  server URL …")`) sits outside every key-based enumeration; untouched by this
  card but named in the coverage announcement (R2).
- Baseline gates: `bunx tsc --noEmit` exit 0; `bun test` 187 pass / 1 skip
  (win32 ACL platform-gated) / 0 fail.

## Rulings applied (binding — product-owner, OJ1–OJ5)

1. **R1 — `ALREADY_LIVE_COPY`: follow-up card.** Not keyed, not localized, not
   re-pointed in this card. `index.ts:462` and its pinning test stay exactly as
   they are. The follow-up (proposed key `tunnel.alreadyLive`, id row
   preserving `/rc`, the semicolon, and the `` `<serverUrl>` `` placeholder)
   is drafted at step 13.
2. **R2 — Coverage: 22 keys.** The 6 `rc.*`/`shutdown.closed`/`rc:login.refusal`
   command-output rows join the mandated 16. The 28 login-flow rows are out —
   shipping them would re-introduce the unverified non-native-Bahasa risk EV-2
   Item 2 declined. Partial coverage is **announced in the id-table module**
   (module comment at the surface), and the announcement must also name the
   keyless `inputPrompt` literal at `index.ts:542` as outside the keyed surface.
3. **R3 — Locale source: env-over-setting.**
   `PI_REMOTE_LOCALE` env → `piRemote.locale` setting → fail-open `"en"`;
   anything unrecognized normalized to `"en"`. Same precedence order as the
   existing entry-point knob (`index.ts:657-658`).
4. **R4 — `tunnel.error.urlExpired` remedy: `/rc`.** The English row at
   `src/login.ts:238` is amended in this card to name the command (e.g.
   `"The tunnel URL expired — run /rc to re-dial"`; owner retains wording
   freedom), and the id row names `/rc` too, so the locales do not diverge in
   meaning. This is the only English-copy change in the card; that row was
   never ruled verbatim, so amending it overturns nothing.
5. **R5 — `` `<serverUrl>` `` substitution: in-card, scoped strictly to the two
   re-pointed sites** (`index.ts:129` and `index.ts:443`), each rendering the
   resolved line with `{ serverUrl }`. A resolved line that still prints the
   literal `` `<serverUrl>` `` marker is not honestly resolved. `index.ts:462`
   stays parked.
6. **General rules carried forward:** verbatim-ruled copy changes only through
   its own card/ruling; knowingly partial coverage is announced at the surface
   itself; new configuration follows env-over-setting entry-point precedence.

## Design

### 1. New pure module `src/copy.ts`

Deliberately below both `tunnel.ts` and `login.ts` in the import graph — it
imports nothing from the repo, so there is no cycle. Exports:

- `CopyLocale = "en" | "id"` (or equivalent).
- `indonesianCopy: Partial<Record<string, string>>` — the Bahasa overlay,
  exactly the 22 settled keys, all values non-empty.
- `setLocale(raw: unknown): void` — module-level mutable locale, set once at
  entry-point load (`loginEndpointRequestLog` precedent). Normalization:
  `"id"` → `"id"`; anything else (`"en"`, `""`, `null`, `undefined`, non-string,
  unrecognized like `"fr"`) → `"en"` (fail-open).
- `getLocale(): CopyLocale`.
- `resolveCopy(key: string, englishTable: Record<string, string>): string` —
  three-valued fallback: id-locale hit on `indonesianCopy` → id string;
  otherwise `englishTable[key]` if present → English sentence; otherwise the
  raw key echoed (today's unknown-key behavior, unchanged). The resolver takes
  the English table as a parameter rather than importing it — English stays
  single-sourced in `tunnel.ts`/`login.ts`.

Module comment on `indonesianCopy` announces the coverage boundary verbatim in
spirit: the table covers the 22 keys consumed by `englishFor`/`loginEnglishFor`
for tunnel error, footer status, and command-output lines; the 28 login-flow
rows and the keyless constants (`ALREADY_LIVE_COPY`,
`ACL_ENFORCEMENT_FAILED_NOTICE`) and the keyless `inputPrompt` prompt at
`index.ts:542` remain English — missing keys fall back to English by design.

### 2. Delegation — `englishFor` / `loginEnglishFor` keep their signatures

Both existing lookups delegate: `resolveCopy(key, englishDefaults)`. Every
internal call site (including the ~30 inside `login.ts`) becomes locale-aware
with zero call-site changes; behavior under locale `en` is byte-identical to
today except the single R4 English-row amendment.

### 3. Exactly two resolution-site re-points (R5)

- `index.ts:129` (`errorSentence`, tunnel branch):
  `tunnelReasonCopy[source.reason].userLine` →
  `englishFor(tunnelReasonCopy[source.reason].userLineKey)`, then render the
  resolved line with `{ serverUrl }` (the server URL available at that site —
  the error's server URL / the active dial target).
- `index.ts:443` (`doTeardown` catch): `deps.print(tunnelReasonCopy.teardown_failed.userLine)`
  → resolve through `englishFor(tunnelReasonCopy.teardown_failed.userLineKey)`
  and print with `{ serverUrl }` substitution.

Substitution uses the existing `` `<name>` `` placeholder convention (same
semantics as `render()` at `src/login.ts:315`: `replaceAll("<serverUrl>", …)`).
The owner chooses the cleanest placement for the substitution helper (export
`render` from `login.ts`, or an equivalent helper in `copy.ts`) — either is
in-design; no key-contract change either way. `index.ts:462` is untouched.

### 4. Locale sourcing at the entry point (R3)

In the default-export entry function (`index.ts`, alongside the
`PI_REMOTE_SERVER_URL` read), before the controller is constructed:

```ts
const localeSetting = pi.getSetting("piRemote.locale");
setLocale(
  pi.env("PI_REMOTE_LOCALE") ??
    (typeof localeSetting === "string" ? localeSetting : undefined)
);
```

`setLocale`'s normalization does the fail-open. Tests reset via
`setLocale("en")` in `afterEach`.

### 5. Bahasa copy invariants (designer, binding on the id rows)

- Command literals `/rc`, `/rc:login`, `/rc:off` are never translated, wrapped,
  or expanded — byte-identical inside every id string that contains them.
- `` `<serverUrl>` `` (and any other angle-bracketed placeholder) survives
  untouched in the stored id string so the render pipeline substitutes it.
- The em-dash (U+2014) joiner is preserved; fault-and-fix stays one sentence.
- Imperative verb shapes (`Jalankan`, `Periksa`); no `silakan` softener on
  unrecoverable rows; no HTTP codes, raw exception text, or tunnel URLs leaked.
- `rc:login.refusal` id row keeps the stated-refusal shape naming `/rc:off`.
- The `urlExpired` id row names `/rc` (R4), matching the amended English row
  in meaning.

## Test plan (owner delivers with the change; Skeptic re-runs)

1. **Table-completeness drift alarm** — derive the expected 22-key set from
   `tunnelReasonCopy` + `FOOTER_ROWS`; assert `indonesianCopy` covers exactly
   that set with non-empty values (no orphans, no gaps).
2. **Locale picking** — `setLocale("en")` / `setLocale("id")` sampled across
   domains (tunnel reason, status row, command-output row).
3. **Fallback semantics** — id + key missing from the id table → English;
   unknown locale (`"fr"`, `""`, `null`, `42`) → `"en"`; unknown key under en →
   raw key echoed.
4. **Reason→key contract golden** — `userLineKey` set is exactly the six
   tunnel keys (EV-2 contract unchanged).
5. **Red-then-green integration** — drive `createRemoteController`'s reducer
   with `{type:"error", reason:"enrollment_expired"}` under `setLocale("id")`;
   assert the rendered footer is the id string (fails on the pre-re-point tree,
   passes after).
6. **Placeholder substitution (R5)** — under id locale, the rendered
   `tunnel.error.unreachable` footer line contains the real server URL and not
   the literal `` `<serverUrl>` `` marker; same shape for the teardown print.
7. **urlExpired rows (R4)** — both the English and id rows contain `/rc`.
8. **Invariants** — every id row containing a command literal contains it
   byte-identically; em-dash preserved; `ALREADY_LIVE_COPY` test at
   `test/index.test.ts:288` stays green (site untouched).
9. **Gates** — `bunx tsc --noEmit` exit 0; `bun test` exit 0 (187+ pass, 0
   fail).

## Out of scope (rulings, do not fold in)

- Keying/localizing `ALREADY_LIVE_COPY` and touching `index.ts:462` (R1 —
  follow-up card).
- The 28 login-flow rows, `ACL_ENFORCEMENT_FAILED_NOTICE`, the `inputPrompt`
  literal at `index.ts:542` (named in the announcement only).
- Any new message key; any change to the reason→key contract.
- `process.env.LANG` auto-detection; `transport.ts`; `merge.ts` key-derivation.
