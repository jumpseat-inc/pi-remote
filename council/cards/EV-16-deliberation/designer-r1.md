## Designer's round-1 position (verbatim)

Confirmed: `login.cancelled` already exists at line 201 with the exact EV-17 binding text — EV-17 is purely a wiring + surface-copy problem.

# Designer position — EV-16 + EV-17 shared design pass

## Design position

I argue for two paired surface fixes, in one design pass:

**(a)** Replace the single literal `description: "pi-remote"` at `index.ts:940` with three distinct, stated-sentence descriptions that name the action. `/rc:login`'s carries `--headless` **and the condition it exists for** (a remote machine with no usable browser) — discoverability comes from the description, not from the failure line the user may never reach. The failure row (binding, verbatim) names the same remedy token so the user who did reach the failure gets a second chance at it.

**(b)** Pair the `login.attended.waiting` line with a registered `/rc:login:cancel` command that calls the existing `cmd.cancel()` on the in-flight facade (no-op when no login is running, stated refusal per EV-2/J5). The wait line names the cancel token. This is a fourth registered command, parallel to EV-16's lesson that discoverability belongs in the palette description — the same trick that makes `--headless` findable is what makes cancel findable.

## Gulf closed

- **(a) Gulf of Evaluation, at choose-time and at failure-time.** Today a scanning user sees `pi-remote` — a glyph that names the extension, not the action or its variants. A user on a remote machine has zero signal that `--headless` exists; they enter the attended flow, the browser can't open, they wait 5 minutes, they exit with no remedy named. The description carries the condition (`remote machine with no usable browser`) so recognition fires at the palette; the failure row carries the remedy token so recognition fires again at the failure. Two signifiers at two moments, both honest (the binding row names `--headless`; the description names the condition).
- **(b) Gulf of Execution, during the 5-minute wait.** Today the wait surface is a single `print("Waiting for browser…")` at `src/login.ts:541` with no exit; the user must wait out `redirectTimeoutMs` (300 000 ms by default) or kill the process. The cancel command is the second signifier the doctrine already requires for stated refusal (EV-2/J5 precedent): "if the user takes the obvious wrong action, name the state and the next correct action." The wrong action here is *not* cancelling; the doctrine's mirror is "give the user the affordance that matches the surfaced state."

## Principle and evidence

| Principle | File / line | Argument |
| --- | --- | --- |
| **Stated sentence over glyph** (EV-2/J5) | `index.ts:940` (`description: "pi-remote"`) | `pi-remote` is a name, not a sentence; a scanning user reads the noun, not the action. Replace with full sentences naming the action and (for `/rc:login`) the variant. |
| **Remedy names only what a real actor can perform** (Copy Honesty Doctrine, EV-2 Item 1) | `src/login.ts:135` (`browserOpenFailed` row) | The binding row names `/rc:login --headless` — the only remedy that resolves the openUrl-fails-on-remote case. Today the row tells the user to "visit the URL printed above manually" — which is the same broken step on a remote machine. |
| **Loud-once per session, sentence over glyph** (EV-6 R2, FLLWUP-7 r2) | `src/login.ts:541` (`print("Waiting for browser…")`) | The wait line is a sentence today but lacks the affordance clause. The cancel command's description provides the discoverability that the wait line itself cannot carry without becoming a wall of text. |
| **Knowledge in the world beats knowledge in the head** (Norman) | The palette is the only surface a user scans before choosing | A user on a remote machine does not read the wiki; they type `/` and scan. The description is the entire affordance. |
| **Conceptual model — condition then remedy** | `login.failure.browserOpenFailed` (binding) | The binding row says "on a remote machine run /rc:login --headless." The description says "use --headless on a remote machine with no usable browser." Same two facts, same order: condition, then remedy. The user's mental model is built by seeing the same shape twice. |
| **The two gulfs (Norman)** | Wait surface + cancel command | The wait surface evaluates (Gulf of Evaluation — "is anything happening? can I tell?"); the cancel command executes (Gulf of Execution — "I want out, what do I do?"). They are different gulfs; the fix addresses both with separate surfaces. |

## Exact proposed copy

### (a) Registered descriptions (English, command palette)

| Command | Description |
| --- | --- |
| `/rc:login` | `Enroll this host with the control plane — use --headless on a remote machine with no usable browser` |
| `/rc` | `Open a tunnel to a live remote session` |
| `/rc:off` | `Close the tunnel` |

Constraints satisfied:
- `/rc:login` description contains `--headless` AND names the condition (`remote machine with no usable browser`) — EV-16 acceptance 1.
- `/rc` and `/rc:off` descriptions do NOT contain `--headless` — EV-16 acceptance 2 (negative pin).
- All three are stated sentences naming the action — no glyph, no `pi-remote` placeholder.

### Failure row (binding, unchanged verbatim)

- `login.failure.browserOpenFailed` (English): `Could not open a browser — on a remote machine run /rc:login --headless. No credentials were saved.`

### (b) EV-17 wait + cancel copy + new command

| Surface | Copy |
| --- | --- |
| Wait line (`login.attended.waiting`, replaces `"Waiting for browser…"`) | `Waiting for browser… run /rc:login:cancel to abort.` |
| Cancel line (`login.cancelled`, **already exists at `src/login.ts:201` — unchanged**) | `Sign-in cancelled — no credentials were saved.` |
| New registered command `/rc:login:cancel`, description | `Cancel an in-progress /rc:login — no-op if none is running` |
| New refusal line when called with no login in flight | `No /rc:login in progress — nothing to cancel.` (stated refusal, EV-2/J5 form) |

The wait-line change is a one-row edit in `NON_FAILURE_ROWS` at `src/login.ts:191`. The cancel line is already ruled. The new command is one extra `pi.registerCommand("rc:login:cancel", …)` at the bottom of `index.ts`'s wiring block (parallel to lines 920–924), whose handler calls the same `cmd.cancel()` the facade already exposes at `src/login.ts:866` but currently nothing consumes.

## Interaction position for (b)

**I argue for a fourth registered command, not a keypress escape and not a modal prompt.** Reasoning, with the candidates weighed against the pi TUI's real surface:

1. **`ctx.ui.input()` modal prompt** — rejected. `inputPrompt` is a one-shot decision surface with Enter-as-proceed, Escape-as-cancel semantics (FLLWUP-107 ruling pins this). The wait has no "proceed" decision — the loopback listener handles success, not user input — so a modal prompt sits open until Escape or until the user submits a no-op that loses the affordance. Worse, opening a modal prompt during the 5-minute wait would steal TUI focus from the rest of the session, which is a stricter cost than the wait itself. (FLLWUP-107's inputPrompt fix was about a single, fast decision at the start of the flow, not a 5-minute co-resident wait.)

2. **Raw keypress escape (e.g. process.stdin / readline)** — rejected. This is the exact path FLLWUP-107 fixed because it "detaches the TUI's input pipeline when the extension steals the keypress." Reintroducing that bug to add a cancel would undo FLLWUP-107's fix.

3. **`ui.confirm` prompt during the wait** — rejected. `ui.confirm` is yes/no on a one-shot question; the wait is not a question the user is being asked. Misuses the affordance.

4. **A registered `/rc:login:cancel` command** — argued for. Three properties match the doctrine:
   - **Discoverable at choose-time**, not failure-time, because the description carries the action.
   - **Idempotent / no-op when irrelevant**, parallel with EV-2/J5 (`"close the tunnel first with /rc:off"`).
   - **Uses an existing mechanism** (`cmd.cancel()` at `src/login.ts:866`); the surface fix is wiring, not new architecture.
   - **The wait line names the token** so the user already in-flow finds it.

**What I predict a user will do, with each candidate:**

| Candidate | Predicted behavior |
| --- | --- |
| Modal `inputPrompt` with the wait line + cancel hint | User opens it, sees Escape-only affordance, presses Escape (or waits 5 minutes staring at the modal). TUI is locked for the rest of the session. High friction. |
| Raw stdin keypress | Either the keypress is never delivered (TUI focus is on the agent loop) or it works and breaks the rest of the session's typing. |
| `/rc:login:cancel` command | User reads the wait line, types `/rc:login:cancel`, gets the cancel line printed once, returns to idle. Same flow as `/rc:off` — discoverable from the palette, idempotent, mechanical. |

The fourth option is what I would ship.

## Falsifiable predictions

| # | Prediction | What would falsify it (smoke / pure-seam test) |
| --- | --- | --- |
| P1 | The pi TUI palette truncates a 70-character description to a single visible line at ~50–60 columns; a 100-character description is truncated mid-phrase so the user sees only the leading clause ("Enroll this host…"). | CDP smoke: open a real `pi` session, type `/rc:login`, capture the rendered row cell. Assert the visible description column has a length cap and that the truncation point falls inside the proposed description, leaving the user without the `--headless` clause. |
| P2 | With today's `description: "pi-remote"`, a first-time user on a remote machine has **no discoverable signal** that `--headless` exists in either (i) the palette row or (ii) the failure row. After EV-16, both surfaces carry `--headless` and the condition. | Pure-seam: read `login.failure.browserOpenFailed` English row before and after the PR; assert the substring `--headless` is present after, absent before. Pure-seam: assert the registered description for `rc:login` contains both `--headless` and the substring `remote machine`. |
| P3 | With the wait line `"Waiting for browser… run /rc:login:cancel to abort."`, a user who wants to abort types the cancel token and observes exactly one `Sign-in cancelled — no credentials were saved.` line. Without it, the user has no documented exit. | Pure-seam test against `createLoginCommand`: inject a slow `redirectTimeoutMs`, run the attended driver, call `cmd.cancel()` partway through, assert `{ kind: "cancelled" }` plus exactly one line matching the binding cancel text. Also assert no token-endpoint POST happened after the cancel. |
| P4 | Calling `/rc:login:cancel` with no login in flight prints exactly one stated refusal line (`No /rc:login in progress — nothing to cancel.`) and does not throw or print the cancel-confirmation line. | Pure-seam: register the new command, call its handler twice with `cmd` being null, assert the second call's logged output contains the refusal and zero `Sign-in cancelled` lines. |
| P5 | The new `/rc:login:cancel` row in the palette does **not** contain `--headless` (negative pin parallel to `rc` / `rc:off`). | Pure-seam assertion on the registered description string. |
| P6 | A user who runs `/rc:login` on a remote machine with `openUrl` injected as a failing dep reaches the failure row, reads the remedy, re-runs `/rc:login --headless`, and the headless driver runs to completion (or to one of its ruled failure rows, not back to `browserOpenFailed`). | End-to-end smoke: inject `openUrl: () => Promise.resolve(false)`, run `/rc:login`, assert `login.failure.browserOpenFailed` is emitted; then re-run with `--headless`, assert the driver enters `runHeadlessLogin` (the device-endpoint POST happens). |

## Preferences, ranked last (taste, not grounded)

- I slightly prefer `"Enroll this host with the control plane — use --headless on a remote machine with no usable browser"` over `"Enroll this host (use --headless on a remote machine with no usable browser)"`. The em-dash reads as a stronger break between the action and the variant; the parenthetical reads softer. Either is honest. **Taste.** P1's truncation smoke is the falsifier — if the em-dash form truncates to `"Enroll this host with the control plane —"` (cutting off `--headless` entirely), the parenthetical form may survive at typical palette widths because the leading clause is shorter. **This preference would flip based on P1's measurement, which I cannot run from this seat.**
- I slightly prefer `/rc:login:cancel` as the command name over `/rc:cancel` because the action is scoped to the in-progress login. **Taste.** A counter-argument: `/rc:cancel` matches the `rc` / `rc:off` brevity and lets a future tunnel-cancel reuse the slot. **Also taste.**
- I prefer that the no-op refusal line is a stated sentence (`"No /rc:login in progress — nothing to cancel."`) rather than silence, parallel with `rc:login.refusal` at `src/login.ts`. **Doctrine-grounded, not taste** — I think this belongs in the same row as the binding-copy rows, but I would defer to `product-owner` if they prefer silence to one extra line.
