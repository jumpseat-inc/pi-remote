# Council Board

State columns. Each card appears exactly once, on one line under the column
matching its frontmatter `state`, as `- <ID> — <Title>` with an em dash
(U+2014). `python3 council/validate.py` enforces this.

## Backlog
- FLLWUP-41 — "Key the /rc:login consent sentence as login.urlPrompt with a verified Indonesian row (EV-15 boundary-expansion follow-up)"
- FLLWUP-42 — "Fix src/copy.ts's section comment that still says \"exactly the 22 settled keys\" after EV-15's 21-key landing"
- FLLWUP-26 — "Scope §1.2/§5.7's 'security decision' vocabulary across per-delivery grant enforcement"
- FLLWUP-19 — "Align PI-SPEC §7.2's no-lookup-state prose with the governing spec's server-state position"
- FLLWUP-20 — "Align PI-SPEC §7.3's per-device lastAckedSeq sentence with the shipped single-watermark reality"
- FLLWUP-17 — "Key ALREADY_LIVE_COPY as tunnel.alreadyLive and localize it (OJ1 follow-up)"
- FLLWUP-13 — "Clean up registerPrompt signature to {promptId}"
- FLLWUP-14 — "Document remote raise-UI best-effort behavior for select, editor, and custom prompt kinds"
- FLLWUP-15 — "Settle the pending prompt entry on ui_prompt_end so host-local answers stop emitting stale tracked resolutions"
- EPIC-7 — "Default relay URL, attended-login cancellation, and --headless discoverability"
- EV-17 — "Let the user cancel an attended `/rc:login`"

## Ready
- EV-16 — "Make `--headless` discoverable from the `/rc:login` command surface"

## Deliberating

## In Progress

## In Review

## Needs Human

## Done
- EV-15 — "Default the control-plane URL to `https://relay.jumpseat.sh`"
- EPIC-6 — "SDK vendoring residuals — FLLWUP-39/40 delivered in one council run"
- FLLWUP-39 — "Declare or annotate the vendored PiThinkingContent's omitted optional thinkingSignature/thoughtSignature fields"
- FLLWUP-40 — "Correct the FLLWUP-12 pairing test's source comment, which overstates what the test pins"
- EPIC-5 — "SDK reconciliation residuals — the EPIC-4 run's seven follow-ups"
- FLLWUP-36 — "Ground emission-semantics claims in the event-constructing layer, not only the pass-through emitter"
- FLLWUP-33 — "Correct the member-count discrepancy in FLLWUP-11's record"
- FLLWUP-32 — "Fix the load-smoke test-2 header's overstated compile-time claim"
- FLLWUP-37 — "Watch the duplicated message-family role decoder between translate.ts and pi-sdk-events.ts"
- FLLWUP-38 — "Declare or annotate the vendored PiTextContent's omitted optional textSignature field"
- FLLWUP-35 — "Add a fold-bookkeeping probe that catches a dropped message_start masked by the message_update fallback"
- FLLWUP-34 — "Update AGENTS.md's 'Current state' once FLLWUP-12 lands"
- EPIC-4 — "Real-host installability — reconcile the ExtensionAPI stand-in and handler payload narrowing with the installed pi SDK"
- FLLWUP-12 — "Reconcile handler payload narrowing with real SDK event payloads"
- FLLWUP-11 — "Reconcile the ExtensionAPI stand-in's non-on members with the real SDK surface"
- FLLWUP-31 — "Correct AGENTS.md's stale 'Current state' claims (suite count and --headless routing)"
- EPIC-3 — "Run integrity and device-flow coverage — the device-flow polish run's four follow-ups"
- FLLWUP-29 — "Pin the attended PKCE path's no-error_description boundary in the login suite"
- FLLWUP-28 — "Pin cancellation during the device-flow slowdown wait in the login suite"
- FLLWUP-30 — "Keep the shared main worktree's HEAD untouched during a run (no seat checkouts in the main checkout)"
- FLLWUP-27 — "Base owner worktrees on origin/main so card PRs stay product-only"
- FLLWUP-25 — "Surface the device-flow token endpoint's error_description in login failure output"
- FLLWUP-24 — "Honor RFC 8628 §3.2's connection-failure slowdown: retry the device-flow token poll after 5s instead of failing terminal unreachable"
- BUG-1 — "Route /rc:login --headless to the device-flow driver instead of hardcoding attended"
- FLLWUP-18 — "Align the refresh request encoding with RFC 6749 form-encoding or document the divergence permanently (EV-10 follow-up)"
- FLLWUP-21 — "Align §1.2's control/data-plane decision sentence with §5.6's device-upgrade admission checks"
- FLLWUP-23 — "Fix §5.10's inverted RFC-2119 keyword: MUST where MUST NOT is meant in the cross-tenant grant sentence"
- FLLWUP-22 — "Resolve the §2.3 device-flow poll answer shape against the shipped headless driver (400 vs 2xx error body)"
- EPIC-2 — "Server-side specification — a self-contained implementation spec for the pi-remote relay and control plane"
- EV-14 — "Assembly, self-containment audit, and cross-spec conformance pass"
- EV-13 — "Device registry, grants, push reservation, and the server-side trust model"
- EV-12 — "Data-plane relay spec — envelope, seq/ack, resume and resync, fan-out"
- EV-11 — "Tunnel lifecycle spec — POST /tunnels, signed one-time URL, DELETE, error taxonomy"
- EV-10 — "Enrollment and identity spec — discovery, both grant flows, tokens and claims"
- EV-9 — "Conformance framing — purpose, scope, invariants, normative keywords, reference-client link"
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
