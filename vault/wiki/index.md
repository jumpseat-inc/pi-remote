# Wiki Index

Catalog of every wiki page. On a query, read this first, then drill into the
relevant pages. Each entry: link + one-line summary (+ optional metadata).

## Overviews

- [[EPIC-1 Decision Record]] — synthesis of the two autonomous delivery runs on pi-remote: 18 PRs, the converged doctrine, and the doors left open.
- [[EPIC-2 Decision Record]] — synthesis of the run that produced docs/SERVER-SIDE-SPEC.md: the self-contained server-side spec, the normativity test, and the cross-artifact contradictions (since resolved by the residual run).

## Entities

- [[pi-remote]] — the pi-side extension exposing a live session over AG-UI; the product every ruling governs.
- [[Server-Side Spec]] — docs/SERVER-SIDE-SPEC.md: the self-contained relay/control-plane implementation spec (§1-§5); its four defects (FLLWUP-18/21/22/23) resolved; FLLWUP-26 the one remaining open item.
- [[Seven Footer States]] — off, not enrolled, authorizing, dialing, resyncing, live, error — the authoritative lifecycle-ordered set.
- [[Reason Taxonomy]] — the transport's closed five-value reason set; honest metadata, never terminal.
- [[Council Seats]] — ruling, verification, and working seats, with the authority map and provenance note.
- [[translate.ts]] — the pure pi-to-AG-UI fold; entryId discrimination; CUSTOM conventions; corrected §4 rows.
- [[transport.ts]] — outbound wss, {v,seq,ack,frame} envelope, retry-forever, hardened parseInbound union.
- [[tunnel.ts]] — control-plane REST client; key-based copy table with severity tags; 401-terminal createTunnel.
- [[history.ts]] — active-branch replay; init-only MESSAGES_SNAPSHOT; deterministic frame ids; pi.resync.done.
- [[inject.ts]] — sendUserMessage conversion, (promptId, occurrence) registry, zero transformation of own injections.
- [[login.ts]] — /rc:login OAuth2 drivers (PKCE attended, device flow headless); driver-side prompt gate.
- [[credential.ts]] — 0600 tmp+fsync+rename store; Windows NTFS ACL enforcement; fail-closed WriteResult.
- [[index.ts]] — command surface, live-path wiring, footer merge FSM, teardown for all five shutdown reasons.
- [[copy.ts]] — dependency-free resolver; 22-key en→id table; announced partial-coverage boundary.
- [[pi-sdk-on.ts]] — vendored typed on() union (36 SDK literals + ui.confirm synthetic escape); negative probe.

## Concepts

- [[Copy Honesty Doctrine]] — state what happened; name only remedies a real actor can perform; sentences over glyphs.
- [[Closed Vocabulary Discipline]] — enumerated state/reason/key sets; new values only by ruling; name is the sole dispatch key.
- [[Stable Keys]] — keys are free at authoring time, non-relitigable contract from merge; verbatim-ruled copy changes via own ruling only.
- [[Spec Correction Governance]] — evidence-cited spec corrections ride the implementing PR; security-model changes go to steward.
- [[Judge Object Rule]] — the step-10 judge evaluates the PR branch at the Skeptic-verified SHA, never pre-merge main.
- [[Deterministic Merge Check]] — five mechanical criteria at one head SHA; merge pinned with --match-head-commit; mismatch is a HALT.
- [[Fixture-Green Honesty]] — acceptance claims only what is proven; partial coverage announced at the surface itself.
- [[Cheapest To Reverse]] — the standing tiebreaker when no test can decide; sometimes the pricier-to-write option wins.
- [[Verify Cycle Cap]] — three verify-fix cycles per card; closed-red at the cap exits to the orchestrator; bounded extensions by ruling.
- [[Footer Merge Policy]] — kind-first mergeTransport; live clears error on verified open; N=10 consecutive error-severity dialing.
- [[Retry Policy]] — two seams: transport dials forever; credential terminality stops with the rich reason preserved.
- [[Gulf of Evaluation]] — the designer's lens: can the user perceive the system's state without archaeology?
- [[AG-UI]] — the open event-based protocol pi-remote speaks; taxonomy, transports, CUSTOM escape hatch, external references.
- [[RFC References]] — the five IETF RFCs the system builds on (2119, 6749, 7636, 8628, 8414) and what each governs here.
- [[Self-Containment Audit]] — zero references to sibling specs or codebases; exactly one external link; run on the real artifact.
- [[Normativity Test]] — a MUST/SHOULD must name its observation point; one-sided bounds are never normative; failures are defects.
- [[RFC Conformance Posture]] — when shipped client behavior diverges from a published RFC, the client moves; the spec stays standards-accurate.
- [[Win32 Test Timeout Convention]] — process-spawning Windows tests carry an explicit 30s per-test timeout; provenance is the council record, not vault/raw (deviation stated).

## Comparisons

## Sources

- [[EV-1 Ruling]] — retire PI_REMOTE_HOST_KEY; seven footer states; prose-sync governance seed.
- [[EV-1 Step-10 Judge-Object Ruling]] — the judge measures the verified PR head, not main.
- [[EV-2 Ruling]] — 403 remedy test; key-based copy seam; stated-refusal standard; footer preference (later amended).
- [[EV-3 Ruling]] — retry forever; no terminal kind:"error"; five-value reason taxonomy; footer error is downstream policy.
- [[EV-4 Ruling]] — §4 protocol corrections ride the PR; one RUN pair per past run; runIds input-driven.
- [[EV-5 Ruling]] — MESSAGES_SNAPSHOT init-only; pi.resync.done wire shape; parseInbound union; §2 lock is outbound-only.
- [[EV-7 Ruling]] — conditional tenant display; confirm-before-replace at the driver; POSIX 0600 + Windows caveat.
- [[EV-8 Ruling]] — kind-first footer merge; URL prompt after /rc:login; credential terminality stop; N=10; while-live refusal.
- [[FLLWUP-5 Ruling]] — resolved-frame field set; fixture-green honesty; cast fix folded; typed-on split out.
- [[FLLWUP-4 Ruling]] — 22-key localization; env-over-setting locale; /rc remedy; verbatim-copy general rules.
- [[EV-6 Design Position]] — replay correctness = no transformation; deliverAs is what pi does; promptId correlation.
- [[EV-7 Design Position r1]] — login terminal surface round 1: voice rules and proposed strings.
- [[EV-7 Design Position r2]] — terminal-surface convergence: canonical copy table and distinctness assertions.
- [[EV-8 Design Position r1]] — merge-policy Gulf analysis; the FOOTER test; copy-asymmetry note.
- [[FLLWUP-7 Design Position r1]] — Windows storage notice round 1 (one sentence later proven false under fail-closed).
- [[FLLWUP-7 Design Position r2]] — fail-closed correction: WriteResult narrows, notice becomes reason-keyed.
- [[FLLWUP-3 Design Position r1]] — unmapped live events round 1: proposals and falsifiable predictions.
- [[FLLWUP-3 Design Position r3]] — FINAL: flips to the partialResult split; payload-variant dispatch-key doctrine.
