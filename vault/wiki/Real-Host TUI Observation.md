---
title: Real-Host TUI Observation
type: concept
summary: Drive the installed interactive host (tmux/pty), capture the rendered pane, and prove a signed negative over the exact targeted span — joining independently sourced forward/render/discard facts at one resolution tier so a boundary claim is legible from the artifact set.
aliases: [rendered-surface observation, tmux observation, pty observation, signed negative]
tags: [concept/process, doctrine, testing, real-host]
sources: ["[[EPIC-8 Run (EV-18, EV-19)]]"]
created: 2026-09-28
updated: 2026-09-28
---
[[Real-Surface Verification]] proves a component works at the installed boundary by loading it and failing the gate non-vacuously. This is its **rendered-output** sibling: proving what a person actually *sees* in an interactive TUI, where a fixture over an injected dependency can only prove that an argument was passed, never what the host drew.

**The EPIC-8 worked example.** EV-18 passed the resolved control-plane URL as `ui.input`'s placeholder; the installed pi 0.87.1 `ExtensionInputComponent` discards it. The negative — no greyed placeholder in the input box — was proved by:

1. **Driving the real host.** Load the local extension into an installed interactive pi (`pi --no-session --extension <worktree>/index.ts`), invoke the command, and capture the pane with `tmux capture-pane -e -p` (ANSI-preserved primary) and `-p` (plain companion). A pty driver is the alternative vehicle when keystrokes must be synthesized.
2. **Naming the exact span.** The input line is the line beginning with the `>` prompt marker carrying the cursor — **not** the last non-blank line (which is the bottom border). Searching the wrong span is how a signed negative goes vacuous (EV-19's Skeptic O7 corrections).
3. **Proving a signed negative.** Assert the expected-present marker (the inverse-video cursor space, `> \x1b[7m \x1b[0m`) **and** the absence of every style that could carry the placeholder (`\x1b[2m`, `\x1b[90m`, `\x1b[38;5;`) — not dim-only, because this host renders its own placeholder mechanism in reverse video. A negative recorded with the wrong span or a style-blind search is gate-integrity-class, not evidence (compare [[Normativity Test]]'s observation-point rule).
4. **Joining independently sourced facts.** Fact 1 (the extension forwards — an in-repo pin) + fact 3 (the host discards — its source) make fact 2 (no render) legible from the artifact set alone. Without fact 1, an empty box cannot distinguish host-discard from forwarding failure.

**One resolution tier, anti-splice.** When a claim joins multiple observations (render, authorize URL, persisted credential), hold a single resolution input across all of them — one env value, one `resolved` — so the joined claim never mixes resolution inputs. EV-19 ran two vehicles at the same tier because a practical cancel interrupted one; the anti-splice property, not a single session, is what the method protects.

**Pair with [[Capture Redaction]].** The real host's pane echoes the typed launch line, so a capture can carry secrets. Redact before committing.

## Related
[[Real-Surface Verification]], [[Fixture-Green Honesty]], [[Capture Redaction]], [[Normativity Test]], [[Notify Sink]], [[Gulf of Evaluation]], [[EPIC-8 Decision Record]], [[login.ts]], [[index.ts]]

## Sources
[[EPIC-8 Run (EV-18, EV-19)]]