---
title: Capture Redaction
type: concept
summary: A real-host pane/pty capture echoes the typed command line, so it can carry a live secret — verify key-free, redact before committing, hash the redacted bytes, and treat the raw capture as sensitive.
aliases: [capture hygiene, secret redaction, pane capture redaction]
tags: [concept/process, security, testing]
sources: ["[[EPIC-8 Run (EV-18, EV-19)]]"]
created: 2026-09-28
updated: 2026-09-28
---
A [[Real-Host TUI Observation]] captures an interactive terminal. The terminal echoes everything typed at it — including the environment assignment that launched the host. In EV-19 the launch line carried a live `OPENROUTER_API_KEY`, so all four raw pane captures contained the secret.

**The rule.**
1. **Assume the capture is sensitive.** The typed shell-echo line is the usual leak; environment dumps, URLs carrying codes, and token responses are others.
2. **Redact before committing** — replace the value with a placeholder (`OPENROUTER_API_KEY=[REDACTED]`); never commit the raw bytes.
3. **Hash the redacted bytes**, and say so, so the artifact inventory's integrity claims match what actually landed ([[Record Accuracy]]).
4. **Verify the binary artifacts key-free** (`strings` scan) — pane text and pty `.bin` transcripts are different leak surfaces.
5. **The raw capture remains sensitive after redaction of the committed copy.** Redacting the copy is not rotating the secret: surface it and advise rotation (the raw `/tmp` artifacts still hold it).

This is the capture-layer form of [[Copy Honesty Doctrine]]'s "never print secrets" — the host's own echo is an emitter the extension does not control.

## Related
[[Real-Host TUI Observation]], [[Real-Surface Verification]], [[Record Accuracy]], [[Copy Honesty Doctrine]], [[EPIC-8 Decision Record]]

## Sources
[[EPIC-8 Run (EV-18, EV-19)]]