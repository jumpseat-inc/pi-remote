# PO Ruling — FLLWUP-25: surfacing the device-flow token endpoint's `error_description`

Ruling seat: product-owner. Date: 2026-09-02 (latest date evidenced in the run's
records). Trigger: FLLWUP-25 (state `Ready`), which defers its central decision
to this seat; the steward gated implementation on this ruling.

## Ruling 1 — Boundary: only `tokenExchangeFailed` surfaces `error_description`

The server-provided `error_description` is surfaced on exactly one failure
outcome: **`tokenExchangeFailed`** (`login.failure.tokenExchangeFailed`). Not
`deviceDenied`, not `expiredCode`, not `invalidTokenResponse`, not any attended
(PKCE) path.

Why this boundary:

- `tokenExchangeFailed` is the one outcome where the client genuinely does not
  know the cause: the token endpoint returned an error code outside the four
  RFC 8628 codes (or a non-2xx without a parseable code), so the server is the
  only party that can name the reason (scope mismatch vs. account issue — the
  card's own motivating example). Copy Honesty Doctrine: state what actually
  happened, and the only actor who performed it is the server.
- `deviceDenied` (`access_denied`) and `expiredCode` (`expired_token`) already
  have cause-accurate client rows — RFC 8628 fixes these codes' semantics and
  the ruled copy states them. Appending server prose risks a contradiction with
  honest copy ("denied on the other device" vs. some IdP's paraphrase) and buys
  the user nothing: the remedy (re-run /rc:login) is already named and is the
  same regardless of what the description says.
- `invalidTokenResponse` fires when the body failed to validate as an OAuth2
  response at all; its `error_description`, if any, is prose from a response we
  have just declared not-an-OAuth2-response. Treating that text as evidence
  fails the doctrine's trustworthiness leg. Its remedy (control-plane admin)
  is already ruled and correct.

## Ruling 2 — Exact copy: one new key, appended as a separate second line

New copy key (free at authoring time per Stable Keys; stable from merge):

```
login.failure.detail
```

Exact English string (placeholder token in the existing `<angleBracket>`
register, matching `<serverUrl>` / `<tenantId>`):

```
Details from the server: `<errorDescription>`
```

Placement and mechanism:

- Emitted as a **second line immediately after** the ruled
  `tokenExchangeFailed` line, resolved through `loginEnglishFor` like every
  login row — no bypass, no second vocabulary (EV-7 general rule). It is
  printed via the same output mechanism that prints the user line, same
  channel, no prefix glyphs.
- The four ruled failure rows are **not modified**. `tokenExchangeFailed`'s
  string stays byte-identical: `"Token exchange failed — run /rc:login to
  retry. No credentials were saved."` The detail line is additive, which is
  what makes the absent-description case provably unchanged (Ruling 5).
- The backticks delimit the server text so the user can see where the IdP's
  words begin and end. Inner backticks in the server text are **not** escaped
  or stripped — the sanitizer (Ruling 3) is the only transformation; do not
  add content edits beyond it.
- No remedy clause is added to the detail line. The ruled parent line already
  names the only real remedy (`run /rc:login to retry`); a second remedy on a
  server-provided detail would over-promise actions the server text may not
  support (doctrine: name only remedies a real actor can perform).

## Ruling 3 — Safety rules for the untrusted server text (implementer-exact)

The sanitizer takes the JSON-decoded `error_description` string and performs
exactly these steps, in order:

1. **Strip all control characters**: every code point in U+0000–U+001F (C0,
   including ESC U+001B, CR, LF, tab, BEL) and U+007F–U+009F (DEL + C1,
   including 8-bit CSI U+009B). With every escape-sequence introducer gone,
   no ANSI/terminal escape sequence can be formed; bracket fragments like
   `[31m` without ESC are inert and pass through untouched. Do **not**
   attempt textual ANSI-pattern matching — control stripping is the complete
   escape rule.
2. **Collapse whitespace**: replace every run of Unicode whitespace with a
   single space (stripped newlines/tabs must not leave double spaces), then
   trim leading/trailing spaces. Result is always a single terminal line.
3. **Cap length**: if the result exceeds **200 code points** (count code
   points, not UTF-16 units or bytes — never split a surrogate pair), keep
   the first 200 and append the literal marker `...` (three ASCII periods).
4. **Empty check**: if the result is the empty string, the description is
   treated as absent — the detail line is not emitted at all, and output is
   the ruled line only (Ruling 5). Apply the same omit-if-empty rule when the
   field is missing, `null`, or a non-string.

There is no step 5. No quoting normalization, no backtick escaping, no HTML
escaping (output is a plain terminal line, not markup), no truncation ellipsis
other than the ruled `...`.

## Ruling 4 — Localization: English-only by design; no `id` overlay

`login.failure.detail` is a login-flow row, and the 28 login-flow rows are
**deliberately outside** the covered-key set (FLLWUP-4 OJ2: a translation
project re-introduces the unverified-non-native-Bahasa risk; coverage is
announced as partial at the module per Fixture-Green Honesty). No Bahasa
Indonesia entry is added; the resolver's fail-open to English covers `id`
locales as it already does for the other 27 login rows. If a future ruling
expands login-flow coverage, this key rides that ruling — not this one.

## Ruling 5 — Absent description: byte-identical output confirmed

With `error_description` absent (or sanitizing to empty), no detail line is
emitted and no ruled string changes. Output is byte-identical to today's ruled
line. This is structural (additive second line, untouched rows), so fixtures
can assert it directly.

## Escalation

None required. No portfolio change, no residual accepted, no recorded human
decision touched (FLLWUP-22's "obey RFC 8628" ruling is honored — surfacing
`error_description` is client behavior the RFC permits), and the goal as
written is fully served by this ruling. Within this seat's authority.

## Fixtures required

1. `tokenExchangeFailed` with a well-formed `error_description` → ruled line
   followed by `Details from the server: `<sanitized>``.
2. `tokenExchangeFailed` with the field absent / `null` / non-string → ruled
   line only, byte-identical.
3. `tokenExchangeFailed` with a whitespace-only description → ruled line only
   (omit-if-empty).
4. Hostile descriptions: ESC + CSI sequence, raw newlines/tabs, >200-char
   payload, lone-surrogate boundary → sanitizer output pinned exactly (no ESC,
   single line, 200 code points + `...`, no split pairs).
5. `deviceDenied`, `expiredCode`, `invalidTokenResponse` with a description
   present in the body → **no detail line** (boundary is dispatch-level, not
   sanitizer-level).
6. All pre-existing login fixtures still green unchanged.

## Grounding

- `vault/wiki/Copy Honesty Doctrine.md` — state what happened; name only
  remedies a real actor can perform; never print untrusted content raw (the
  doctrine's secret/printing leg, extended here to hostile server text).
- `vault/wiki/Stable Keys.md` (FLLWUP-4 OJ1) — ruled rows change only by
  ruling (here: not changed at all); new key free at authoring time.
- `vault/wiki/copy.ts.md` (FLLWUP-4 OJ2) — the 28 login-flow rows are
  deliberately outside the id table; English-only boundary for Ruling 4.
- `vault/wiki/login.ts.md` (FLLWUP-22 poll contract) — body parsed before the
  status gate; four RFC 8628 codes dispatch to their own outcomes; the rest
  falls to `tokenExchangeFailed`, which is where unknown-cause lives.
- `vault/wiki/Cheapest To Reverse.md` — not needed as tiebreaker; the
  boundary and format are decided on user value, and the additive-line design
  is also the cheapest to reverse (delete one key and one emit site).
