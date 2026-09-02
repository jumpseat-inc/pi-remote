# Council Board

State columns. Each card appears exactly once, on one line under the column
matching its frontmatter `state`, as `- <ID> — <Title>` with an em dash
(U+2014). `python3 council/validate.py` enforces this.

## Backlog
- EPIC-2 — "Server-side specification — a self-contained implementation spec for the pi-remote relay and control plane"
- FLLWUP-17 — "Key ALREADY_LIVE_COPY as tunnel.alreadyLive and localize it (OJ1 follow-up)"
- FLLWUP-13 — "Clean up registerPrompt signature to {promptId}"
- FLLWUP-14 — "Document remote raise-UI best-effort behavior for select, editor, and custom prompt kinds"
- FLLWUP-15 — "Settle the pending prompt entry on ui_prompt_end so host-local answers stop emitting stale tracked resolutions"
- FLLWUP-11 — "Reconcile the ExtensionAPI stand-in's non-on members with the real SDK surface"
- FLLWUP-12 — "Reconcile handler payload narrowing with real SDK event payloads"


## Ready
- EV-10 — "Enrollment and identity spec — discovery, both grant flows, tokens and claims"
- EV-11 — "Tunnel lifecycle spec — POST /tunnels, signed one-time URL, DELETE, error taxonomy"
- EV-12 — "Data-plane relay spec — envelope, seq/ack, resume and resync, fan-out"
- EV-13 — "Device registry, grants, push reservation, and the server-side trust model"
- EV-14 — "Assembly, self-containment audit, and cross-spec conformance pass"

## Deliberating

## In Progress
- EV-9 — "Conformance framing — purpose, scope, invariants, normative keywords, reference-client link"

## In Review


## Needs Human

## Done
- EPIC-1 — "pi-remote — remote control for a live pi session over AG-UI"

- FLLWUP-16 — "Give the Windows SDDL read-back test an explicit timeout sized for process cold start"

- FLLWUP-4 — "EV-2 localization seam: second (en→id) message lookup and resolver"

- FLLWUP-7 — "EV-7 Windows ACL for credential-file user-only readability"
- FLLWUP-8 — "Wire the ui_prompt_start raise path end-to-end (runtime-observable acceptance for FLLWUP-5 contract b)"

- FLLWUP-9 — "Replace the local ExtensionAPI stand-in with the real SDK typed on()"
- FLLWUP-3 — "Map EV-4's unmapped live pi events (queue_update, bash_execution_update, auto_retry_*)"

- FLLWUP-10 — "Sync spec §8 /rc:login row with the while-live refusal"

- FLLWUP-1 — "Sync README with the OAuth2 enrollment reality"

- FLLWUP-6 — "Remove or document the dead user_input PiEvent in translate.ts"

- FLLWUP-5 — "Emit pi.human_input.resolved host-side completion event"

- EV-8 — "Command surface and lifecycle wiring"

- FLLWUP-2 — "Reconcile EV-8 card text with the seven-state footer set"

- EV-7 — "/rc:login OAuth2 enrollment command"

- EV-6 — "Remote input injection"

- EV-5 — "JSONL history replay and resync"

- EV-3 — "Outbound wss transport with seq-ack envelope"
- EV-2 — "Control-plane tunnel REST client"
- EV-4 — "Pure pi-to-AG-UI translation mapper"
- EV-1 — "Sync PI-SPEC with the /rc:login OAuth2 enrollment design and colon command naming"
