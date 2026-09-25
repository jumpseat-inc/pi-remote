## Owner's round-1 position (verbatim, for reference)

## Approach

EV-16 has three concrete touch points, all verified in code: (1) the hardcoded `description: "pi-remote"` at `index.ts:939-940`, fed by a `command` dep whose signature (`index.ts:121`) carries no description, so the widening is a *controller-deps* widening — not a real-surface one, because the installed SDK's `RegisteredCommand` already declares `description?: string` (verified at `pi-coding-agent/dist/core/extensions/types.d.ts:963-969`, and mirrored in `index.ts:74-78`). (2) The discarded `openUrl` result at `src/login.ts:539` (`await deps.openUrl?.(authorizeUrlStr).catch(() => false)`), followed unconditionally by the `waiting` print (line 541) — the driver prints its own failure rows at each failure site (lines 560, 564, 584, …), so the fix follows the established pattern: branch before the waiting print, print `login.failure.browserOpenFailed`, return `{ kind: "failure", reason: "browserOpenFailed" }` (already a `LoginReason` member with `footerState: "error"` in `loginReasonCopy`; the `finally` closes the loopback server; `index.ts:704` already applies footer `off` for every failure). (3) The copy row at `src/login.ts:135-139`, replaced verbatim with the Phase-1 ruling text.

### 1. Concrete design

**Registered descriptions** (widen `ControllerDeps.command` to `(name, description, handler)`; all three call sites at `index.ts:714-716` declare one):

- `rc` → `Start the remote tunnel — if not enrolled, run /rc:login first.`
- `rc:off` → `Stop the remote tunnel.`
- `rc:login` → `Enroll this host with the control plane (OAuth2 sign-in). On a remote machine with no usable browser, run with --headless.`

Satisfies the constraint literally (`--headless` present; the condition "remote machine with no usable browser" named), follows the Copy Honesty Doctrine (sentence, real remedy, real actor), and the negative pin holds by construction for `rc`/`rc:off`.

**Flow change** — replace `src/login.ts:538-539` with:

```ts
if (deps.openUrl) {
  const opened = await deps.openUrl(authorizeUrlStr).catch(() => false);
  if (!opened) {
    print(deps, loginEnglishFor("login.failure.browserOpenFailed"));
    return { kind: "failure", reason: "browserOpenFailed" };
  }
}
```

Semantics: **`openUrl` absent = proceed (not failure)**. This is deliberate and grounded: `index.ts`'s production deps object (~lines 907-947) never supplies `openUrl` — the only occurrences are the type at line 116 and the passthrough at line 680 — so treating absence as failure would make every production attended login print "Could not open a browser" without ever trying, a false statement under the Copy Honesty Doctrine and a break of all attended logins. The failure branch is production-dormant until a future card wires a real opener (the vendored `PiExtensionContext.ui` mirror, `src/pi-sdk-on.ts:26-36`, has only `setStatus`/`input`; the real `ExtensionUIContext` has no browser-open method either — I checked the installed `types.d.ts`). The card's mechanism is dep-level per Acceptance 3, and the surface-level discoverability fix (the description) is what reaches today's remote user. The `opening`/`fallback` prints stay before the branch, so on failure the user still has the authorize URL on screen for manual local use.

**LoginOutcome**: `{ kind: "failure", reason: "browserOpenFailed" }`. Byte-diff to name in the PR: on `openUrl` failure the output *gains* `Could not open a browser — on a remote machine run /rc:login --headless. No credentials were saved.` and *loses* `Waiting for browser…`; the success path is byte-identical.

**Test-harness widening** (declared here for card and PR):
- `ControllerDeps.command` (index.ts:121) gains the `description: string` param (required — forces every command to declare one).
- `test/index.test.ts`'s two harnesses (lines 249-250, 491-492) capture it into an exposed `commandDescriptions: Record<string, string>`; assertions: `rc:login`'s contains `--headless` and `remote machine`, `rc`/`rc:off`'s don't contain `--headless`.
- `test/pi-sdk-load.test.ts`'s strict Proxy (lines 68-72, currently `void opts`) widens to capture `opts.description` and asserts the same pins — this is the real-boundary assertion the card asks for, since `registerCommand`'s opts flow to the real `RegisteredCommand` member.
- `test/login.test.ts`: failing-`openUrl` (resolves `false` and rejects) → exact ruled row printed, no waiting line, outcome failure/`browserOpenFailed`, no credential written; absent-`openUrl` → waiting printed, no failure row (pins the production-dormant semantics).

**Spec sync**: one sentence each in `docs/PI-SPEC.md` §7.2's attended bullet and §8's `/rc:login` row: attended mode aborts with the `/rc:login --headless` remedy when the browser cannot be opened (no credential saved). The palette description strings themselves are host copy, not spec material.

**en→id implication** (per the ruling's charge): `login.failure.browserOpenFailed` is *not* in `indonesianCopy` — the COVERAGE BOUNDARY in `src/copy.ts` (lines ~44-50) leaves all `login.failure.*` rows English under every locale by design. So the ruling's new English text is what id users see; no `copy.ts` change, no overlay-key count change. Pin it with `expect(indonesianCopy["login.failure.browserOpenFailed"]).toBeUndefined()`.

**Acceptance 4**: my position is **do not add** `getArgumentCompletions` in EV-16 — the description carries the discoverability; arg completion for `--headless` is scope creep. It is a real member (installed `types.d.ts:968`), so if a later card wants it, that's the explicit R-TYPE-1 re-diff the acceptance names.

## Tradeoffs accepted

- The openUrl-failure branch is production-dormant (no opener is wired and the real host surface offers none), so the flow-level fix is fixture-provable only until a future card wires an opener. I accept this over treating absent-openUrl as failure, which would emit false copy on every production attended login.
- Failing-`openUrl` users lose nothing: the fallback URL is already printed above the failure row, so the ruled text dropping "visit the URL printed above" removes no real remedy — on the remote machine that remedy never worked.
- Widening `command` to a required description touches two test harnesses and three call sites for a copy-only goal; accepted because it makes an undeclared description a compile error rather than a regression.

## Testable claims (for the Skeptic)

1. **Production wiring never supplies `openUrl`** — grep shows only `index.ts:116` (type) and `index.ts:680` (passthrough); the deps object built at ~907-947 has no `openUrl`. Settle: `test/login.test.ts` case with no `openUrl` dep asserts `Waiting for browser…` prints and the browserOpenFailed row does not — goes red if anyone flips absence-to-failure.
2. **`description` is a real-surface member, so no R-TYPE re-diff is owed for the passthrough** — installed `types.d.ts:963-969` (`RegisteredCommand.description?`). Settle: `bunx tsc --noEmit` green with the widened `index.ts:74-78` declaration, plus the load smoke green; the only widening is the internal `ControllerDeps.command` signature, which is fixture-facing.
3. **`ctl.cancelled` cannot shorten the wait today** — `src/login.ts:553` checks it only post-settlement. Settle: attend with small `redirectTimeoutMs`, call `cmd.cancel()` mid-wait, assert elapsed ≈ timeout on current code (red against EV-17's goal) — this is EV-17's red-at-base boundary, derived here so EV-16 doesn't silently absorb it.
4. **The browserOpenFailed key is absent from the id overlay** — settle: the `indonesianCopy["login.failure.browserOpenFailed"] === undefined` pin; guards the announced partial-coverage boundary while the English row changes.
5. **Negative pin is mechanical** — settle: in both the harness (`commandDescriptions`) and the strict Proxy capture, `rc` and `rc:off` descriptions fail `includes("--headless")` while `rc:login`'s passes.
