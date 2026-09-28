---
title: EPIC-8 Run (EV-18, EV-19)
type: source
summary: The two-card autonomous run (2026-09-28) that passed the resolved control-plane URL as the /rc:login prompt's placeholder argument (EV-18) and verified at the installed pi 0.87.1 host that the placeholder is discarded (EV-19) — the wiki's first real-host rendered-TUI observation and first real-host enrollment round-trip.
aliases: [EPIC-8 run, placeholder residual run, EV-18 run, EV-19 run, control-plane URL placeholder run]
tags: [council/run, real-host, login, doctrine]
sources: ["[[EPIC-8 Run (EV-18, EV-19)]]"]
created: 2026-09-28
updated: 2026-09-28
---
An autonomous `/features-deliver EPIC-8` run (2026-09-28) delivered the epic the product-owner placeholder-residual ruling had scoped: the attended `/rc:login` URL prompt now passes the resolved control-plane URL as the host `ui.input` **placeholder** argument (EV-18), while the installed pi 0.87.1 host **discards** it, so the prompt title stays the rendered consent surface (EV-19). Both children merged with `gates`/`gates-windows` `SUCCESS` on head and merged SHAs, mode **Deliberate**, all five [[Deterministic Merge Check]] criteria ([[Execution-Mode Recording]]).

**Provenance.** Unlike the EPIC-3/4/6 run precedents, this run **did** archive raw material — `vault/raw/2026-09-28-ev19-observation.md` (EV-19's committed observation record) and `vault/raw/2026-09-27-po-epic-8-placeholder-residual.md` (the product-owner ruling naming the residual as host-side). Authority is those two files plus the card faces and the run ledger.

**What shipped.**
- **EV-18 (PR #54, merge `0fdf1d9`)** — `RemoteControllerDeps.inputPrompt` widened to `(prompt: string, placeholder?: string)`; the attended call site (`index.ts:677-679`) passes `resolved` as the second argument and the entry wiring (`index.ts:979`) forwards both into `ctx.ui.input`. The title stays byte-unchanged — still `Control-plane server URL [<resolved>]:` plus the consent sentence. Empty submit enrolls against the resolved URL, typed input overrides, Escape cancels; the replacement-confirm prompt receives no placeholder. PI-SPEC §7.2/§8 updated in the same PR; no copy key added, changed, or removed.
- **EV-19 (PR #55, merge `b848464`)** — a real installed-host observation that the placeholder does **not** render on pi 0.87.1, plus a real attended enrollment round-trip (empty-Enter) against a local mock control plane, with the persisted `serverUrl` byte-equal to the resolved URL (`cmp` exit 0). The named residual is recorded.

**The decisive method (EV-19).** Three independently sourced facts join: (1) the extension **forwards** `resolved` (EV-18's in-repo pin), (2) the installed host **renders no placeholder** (the boundary observation), (3) the host component **discards** its `_placeholder` parameter (`extension-input.js:25` declares it and never references it). Fact 1 alone cannot distinguish host-discard from forwarding-failure; facts 1+3 make the negative legible. The extension-side obligation ends at forwarding the documented argument; the greyed in-box render is host-side and not deliverable by extension code ([[Real-Surface Verification]], [[Fixture-Green Honesty]]).

**Two observation vehicles, one resolution tier.** The render negative was captured in a tmux pane (`capture-pane -e` primary, `-p` companion) and re-confirmed in a pty-driven enrollment transcript, both at `PI_REMOTE_SERVER_URL=http://127.0.0.1:18119`. The anti-splice property holds: one `resolved` value across title, authorize URL, and persisted credential ([[Real-Host TUI Observation]]).

**Process overshoot, flagged.** EV-19's runner died twice (`job-7` stalled after its implementing-owner child died; `job-8` was killed by a 20-minute stall window mid-observation) before `job-9` completed with `stall_minutes: 45`. The orchestrator then made a **third** dispatch, which council.md's dispatch discipline forbids ("if the re-dispatch also stalls, return HALT — do not dispatch a third time"). The exception is recorded, not silently overwritten: the seat had produced substantial verified output (the observation was already complete on disk) rather than no output, and the corrected window resolved the environmental cause. See [[Runner Stall Recovery]].

**Security hygiene incident.** The real-host pane captures carried the typed shell-echo line with a live `OPENROUTER_API_KEY` value. It was redacted in every committed copy before the record was written (artifact SHA-256s are of the redacted bytes; pty `.bin` artifacts verified key-free), but the key remained live in `/tmp` captures — rotation advised. This is the first instance of [[Capture Redaction]].

**Ruling and governance mechanics.**
- The Phase-1 record in `council/phase1-*.json` was **stale** (scoped to EPIC-7); the orchestrator read the EPIC-8 scope, surfaced the five class-enumeration decisions, recorded fresh run-scoped rulings + the two [[Record-Push Discipline]] authorizations, and `steward` issued the build order (EV-18 → promotion gate → EV-19).
- `product-owner` exercised **promotion ratification** (EV-19 `Backlog → Ready`) and **follow-up dispositions** (step 13): the P-E CDP-smoke candidate **merged into EV-19**; the future-honoring-host double-render residual **dropped** (no observation point today). Nothing new was filed as a `FLLWUP-` card.
- `steward`'s **fallback ending** (close after EV-18, EV-19 to Backlog, epic un-Done) was *not* triggered: the real-host observation proved producible, so promotion was ratified.
- EPIC-8 closed `Done` (`281a30f`); `bunx tsc --noEmit` exit 0, `bun test` 340 pass / 7 skip / 0 fail.

**Contradiction flagged (referent-less key).** EV-19's record §6 found that `login.urlPrompt` — named in the Phase-1 "surface copy" ruling and the product-owner ruling as the consent sentence's key — has **zero referents** in `src/` (`grep -rn 'login.urlPrompt' src/` → no hits). The consent sentence is a **keyless inline literal** at `index.ts:676-678`. The ruling prose presupposed a landed key that was never minted. Flagged, not silently overwritten, on [[Stable Keys]], [[Record Accuracy]], [[login.ts]], and [[copy.ts]].

## Related
[[EPIC-8 Decision Record]], [[Real-Surface Verification]], [[Real-Host TUI Observation]], [[Capture Redaction]], [[Fixture-Green Honesty]], [[Record Accuracy]], [[Stable Keys]], [[Deterministic Merge Check]], [[Execution-Mode Recording]], [[Runner Stall Recovery]], [[Record-Push Discipline]], [[Council Seats]], [[pi-remote]], [[index.ts]], [[login.ts]], [[copy.ts]]

## Sources
`vault/raw/2026-09-28-ev19-observation.md`, `vault/raw/2026-09-27-po-epic-8-placeholder-residual.md`; card faces EPIC-8 / EV-18 / EV-19; PRs #54/#55 (merges `0fdf1d9`, `b848464`); run ledger (orchestrator Phase 3 report).