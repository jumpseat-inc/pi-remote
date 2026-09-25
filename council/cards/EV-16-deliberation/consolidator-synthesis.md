# EV-16 Consolidation — Shared Design Pass

**Verdict: SETTLED — ready to hand off to the owner (EV-16 implementation). EV-17 promotion unblocked. No open judgment, no open objections, no `Needs Human` items.**

## 1. SETTLED

Every item below was closed either by three-seat convergence (with the record cited) or by a Skeptic test that ran and passed. Tests are cited by their O-number from `skeptic-r1.md`.

### S1. Registered description strings (converged, mechanically pinned)

| Command | Settled string | Evidence |
| --- | --- | --- |
| `rc` | `Start the remote tunnel — if not enrolled, run /rc:login first.` | Owner r2 + principal r2 identical ("principal's — converged"); r3 both reaffirm; O6 closed-green |
| `rc:off` | `Stop the remote tunnel.` | Same |
| `rc:login` | `Enroll this host — use --headless on a remote machine with no usable browser.` | Principal r2/r3 hold; owner r3 explicitly yields to it; facilitator note records convergence |

On the `rc:login` string: the designer delivered **no final round-3 string** (output truncated). Convergence rests on the owner's explicit yield, the facilitator's check that the converged string satisfies both of the designer's standing criteria (action clause first, remedy token early), the card-exact condition phrase (`no usable browser`, which the designer's own r2 candidate deviated from), and the designer filing no contrary final position. Recorded here as-is; no contrary position survives in the record.

Skeptic O6 closed the acceptance constraints mechanically: the converged `rc:login` string contains `--headless` exactly once and `remote machine with no usable browser` exactly once (77 chars); `rc` and `rc:off` contain zero occurrences; the binding failure row is byte-exact with the Phase-1 ruling and contains `/rc:login --headless`.

### S2. `openUrl` contract

- **Absent `openUrl` ⇒ proceed** (skip the failure path). Settled by convergence: owner r1/r2 held it, principal r2 held it (routing absence to failure would print the `--headless` remedy to local users with working browsers — a regression), designer r2 conceded. Grounded in O4: production never supplies `openUrl` (only `index.ts:116` type and `:680` passthrough), so absence-as-failure would break every production attended login with false copy.
- **Present + false/reject ⇒ print `login.failure.browserOpenFailed` (binding verbatim text), return `{ kind: "failure", reason: "browserOpenFailed" }`, no credential written.** Owner r1, uncontested through r3.
- **`login.attended.opening` becomes conditional on `openUrl` being present** — owner r2's third reading; today `:535` prints "Opening your browser…" with no opener wired, false copy confirmed by O3's runtime probe.
- **The failure branch is production-dormant** until a future card wires a real opener; O4 closed this green.

### S3. Failure-path ordering

Attempt `openUrl` **before** the fallback print. Owner conceded to principal in r2, with a load-bearing rationale: on failure the `finally` closes the loopback server and discards verifier/state, so the fallback URL is a dead remedy and printing it violates the Copy Honesty Doctrine. On failure: no `fallback`, no `waiting`, failure row, failure outcome. O3 closed green and named the reorder an implementation obligation ("Acceptance-3 reorder is an implementation obligation").

### S4. Harness-widening shape

`RemoteControllerDeps.command` widens to `(name, handler, opts: { description: string })` — **required**, so an undeclared description is a compile error. Both `test/index.test.ts` stand-ins and the `test/pi-sdk-load.test.ts` strict Proxy capture the description; the Proxy capture is the real-boundary assertion. Converged owner r1 / principal r2. One Skeptic correction recorded: O7(2) — the widening bites at the three real call sites (TS2554 probe EXIT=1) while the stand-in lambdas stay legal TypeScript; the owner's "compile error everywhere" framing was corrected, not the design.

### S5. Copy-boundary mechanics

- `login.failure.browserOpenFailed` is absent from the id overlay **by design** (COVERAGE BOUNDARY in `src/copy.ts` keeps all `login.failure.*` rows English under every locale) — no `copy.ts` key change; pin with `indonesianCopy["login.failure.browserOpenFailed"] === undefined`. O5 closed green (also `test/copy.test.ts:84-85` pins 21-key derivation).
- The three new description strings are new English surface and get a COVERAGE BOUNDARY sentence naming them (converged owner r1 / principal r2).
- `login.cancelled` is byte-exact at `src/login.ts:201` (O5) and unchanged.
- Informational, pre-existing, out of scope: the COVERAGE BOUNDARY comment says "22 settled keys" vs the test's 21 — already tracked by FLLWUP-42 (O7(4)). No new card.

### S6. PR claims discipline

Settled in principal r2, uncontested, and grounded in O4 (which proved the exact false spec text exists at `PI-SPEC.md:289` and `:411`):

- PR **may** claim: dep-level failure branch implemented and fixture-reachable; the description is the production user-facing fix; the `opening`-line conditional; the reorder.
- PR **may not** claim: `browserOpenFailed` reachable by a real user, or that production attended login attempts a browser.
- PR **must** name the dormancy, name the opener-wiring follow-up card, and address the false "opens the default browser" spec text (see S7).

### S7. PI-SPEC §7.2 false claim — the "annotate vs correct" residual is governed, not open

The seats converged on "annotate or correct, named in the PR" but left the form as a residual binary. On classification, the residual is **not open judgment**: the principal invoked Spec Correction Governance, and `vault/wiki/Spec Correction Governance.md` prescribes the mechanism — corrections are **facilitator-authored, evidence-cited prose-sync riding the implementing card's PR, never a silent rewrite**. That answers "correct vs annotate" (prose-sync correction, evidence-cited — the evidence is O4's probe), and "which PR" (EV-16's, which both seats already converged on and which edits the very rows in question — §7.2's attended bullet and §8's `/rc:login` row). Exact corrected wording is owner implementation detail within this governed form. Closed without a winner-pick: no seat held a contrary position that survived — they held an unchosen binary that existing policy already decides.

### S8. EV-17 affordance + wait/cancel copy — decided by the Skeptic's O1+O2 results

- **O1 closed-green:** `ctx.ui.confirm(title, message, { signal })` **exists** on the installed SDK (`types.d.ts:72-73`, `signal?: AbortSignal` at `:39`; `timed-confirm.ts` exists in installed examples; scratch compile probe EXIT=0). The designer's ui.confirm-nonexistence hold was an artifact of checking only the vendored minimal mirror (`src/pi-sdk-on.ts`), which omits `confirm` by design (FLLWUP-11). Refuted, not outweighed.
- **O2 closed-green:** a command typed mid-wait **cannot dispatch** — `interactive-mode.js` awaits `getUserInput()` then `session.prompt()` sequentially; queued commands shift only after the current handler resolves. The designer's registered `/rc:login:cancel` affordance collapses on timing. The designer's own requested P3 smoke is exactly O2; it ran and closed against the command.
- **Settled affordance design** (owner r2 + principal r2, identical): `LoginDeps.waitForCancel?: (signal) => Promise<boolean>`, implemented as `requireCtx().ui.confirm("Waiting for the browser…", "Cancel sign-in?", { signal })`; driver races it against `cbPromise`; confirm-cancel settles the callback with `{ type: "cancelled" }` (making today's dead branch reachable — O7(3) proved it unreachable at base with a runtime probe, cancel at ~50ms against a 300ms wait resolved at 305ms); callback-won aborts the signal to dismiss the dialog; `cancel()` must also settle/wake the wait, not just flip a flag; clearTimeout to prevent duplicate timeout settle.
- **Settled copy outcome:** wait line **unchanged** (`Waiting for browser…`); dialog title `Waiting for browser…` / message `Cancel sign-in?`; cancel line **unchanged** (`Sign-in cancelled — no credentials were saved.`), printed once by the facade, never by the driver. The designer's no-op refusal line and `/rc:login:cancel` description die with the command affordance they served.

### S9. EV-17 design-pass item (b) is complete — promotion unblocked

EV-17's Acceptance 6 requires wait/cancel copy settled. It is: the affordance is settled by O1+O2 (S8), and the dialog title/message + unchanged wait line + unchanged cancel line constitute the complete copy outcome. The designer's contrary holds were both premised on claims the Skeptic refuted by execution. No open judgment remains on this item.

### S10. Scope exclusions (settled by uncontested convergence)

- **No opener wiring in EV-16** — follow-up card (principal r2 concession, owner agreement).
- **No `getArgumentCompletions` in EV-16** — owner r1, uncontested; a future card would owe the explicit R-TYPE-1 re-diff.

## 2. OPEN JUDGMENT

**None.** Candidates weighed:

- **(a) §7.2 false claim** — settled; see S7. The residual binary was decided by existing governance policy, not by a seat's taste. If `product-owner` disagrees with classifying it as governed-implementation-detail, it reopens as a one-line ruling — but nothing in the record sustains it as a values dispute.
- **(b) EV-17 design-pass completeness** — settled; see S8/S9. Both of the designer's contrary holds were closed by Skeptic tests, not by seat preference.
- **(c) Other candidates scanned and found settled:** opener-wiring scope (S10), `getArgumentCompletions` (S10), the final `rc:login` string (S1 — owner's explicit yield, no surviving contrary).

Nothing routes to `product-owner` for a substantive ruling; nothing escalates to `steward` (no security-model surface is touched — the governance page's escalation boundary does not apply to S7's prose-sync).

## 3. OPEN OBJECTIONS

**None.** The Skeptic's step-4 verdict is explicit: no open objections; O1–O7 all closed-green; `bun test` 314 pass / 1 skip / 0 fail; typecheck clean at HEAD `5dcb26e`. No objection reopens on re-reading the record.

One non-objection residual, recorded for honesty: the designer's P1 palette-truncation smoke was never run. It was a designer prediction, never a Skeptic objection, and O6 measured the converged string at 77 chars — the shortest final candidate. The owner's r2 contingency (a shorter fallback form, still satisfying the acceptance's literal `--headless` + condition constraints) remains available as implementation detail if a real-host check ever shows truncation cutting the token.

## Hand-off

**Ready: yes — owner, for EV-16 implementation.** All acceptance constraints are pinned (O6), the flow changes are specified (S2/S3), the harness shape is declared (S4), the copy mechanics are closed (S5), the PR claims boundary is drawn (S6/S7), and EV-17 is unblocked (S9).

*Wiki page consulted: `vault/wiki/Spec Correction Governance.md` (for the S7 classification). The wiki does not cover the `openUrl`-unpopulated seam directly — as the principal noted, that gap is worth a page once the follow-up opener card lands.*
