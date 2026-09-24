# EPIC-6 SDK Residuals (FLLWUP-39 + FLLWUP-40) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two Verify-mode residuals: declare the vendored `PiThinkingContent`'s optional signature fields against the installed dist types (FLLWUP-39), and correct the FLLWUP-12 pairing test's source comment to state what the test actually pins (FLLWUP-40).

**Architecture:** FLLWUP-39 follows the exact FLLWUP-38 precedent (commit 7e050cb): extend the vendored type declarations in `src/pi-sdk-events.ts` with the dist-carried optional fields plus provenance comments. FLLWUP-40 is a comment-only edit in `test/translate.test.ts`, worded from `docs/ROLE-DECODER-DUPLICATION.md` § "What pins the pairing today". One branch, one PR covering both cards (R-ONE-RUN-1).

**Tech Stack:** TypeScript, Bun test. No new dependencies — the SDK is never added as a dependency (R-TYPE-1); shapes are vendored verbatim.

**Spec:** None on disk by design (mechanical path — the cards themselves are the design handoff). Card text is quoted in the work log below; dist-type evidence re-verified at implementation time (see Task 1, step 1).

## Global Constraints

- Work only in `/home/tista/codes/pi-remote-epic6` (branch `owner/epic6-sdk-residuals`, cut from `origin/main`). Main repo `/home/tista/codes/pi-remote` is immutable: never `git checkout` / `git switch` / `git reset` against it (R-CONV-1).
- Do NOT add the SDK as a dependency; vendor the shape verbatim with a provenance comment (R-TYPE-1).
- FLLWUP-40 scope: comment-only. Zero assertion changes, zero behavior changes, no G-12 touch.
- Do not touch `council/` records, EPIC-6.md, or any other card.
- Gates in full: `bunx tsc --noEmit` exit 0 AND `bun test` green (only expected non-pass: the Windows-gated credential-ACL skip on non-Windows runners).
- Conventional Commits; PR title conventional-commit-style; one PR, base `main`.

## Dist-type evidence (re-verified 2026-07-22, worktree head 074069e)

File: `/home/tista/.nvm/versions/node/v24.21.0/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/types.d.ts`

- `export interface ThinkingContent` :247–255 — `type: "thinking"` :248, `thinking: string` :249, `thinkingSignature?: string` :250, `redacted?: boolean` :254 (doc comment: when true, the encrypted payload is stored in `thinkingSignature`).
- No `thoughtSignature` on `ThinkingContent`.
- `export interface ToolCall` :261–269 — `thoughtSignature?: string` :266, plus `namespace?: string` :268 (not in scope).
- `export interface TextContent` :242–246, `textSignature?` :245 — already declared on `PiTextContent` by FLLWUP-38.

## Review Focus

- FLLWUP-39: declarations must mirror the dist types verbatim (names, optionality, order irrelevant) with line-referenced provenance; the honesty axis must state what was deliberately omitted (`redacted`, `namespace`, JsonObject narrowing) and why.
- FLLWUP-40: comment must match the doc's true scope (derivation-text presence + role vocabulary in the 400-char windows; windows include the return-type annotation; decode comparison NOT pinned). Assertions byte-identical.

## Tasks

### Task 1 — FLLWUP-39: declare PiThinkingContent.thinkingSignature (+ PiToolCall.thoughtSignature)

- [ ] 1.1 Re-verify dist evidence (grep with `-n` on the installed `pi-ai/dist/types.d.ts`; record line numbers in the plan's Dist-type evidence section — done above).
- [ ] 1.2 Edit `src/pi-sdk-events.ts`:
  - Replace `export interface PiThinkingContent { type: "thinking"; thinking: string }` with a block form declaring `thinkingSignature?: string`, plus a provenance comment citing `ThinkingContent` at pi-ai `dist/types.d.ts:247–255`, `thinkingSignature` at `:250`. Note the adjacent `redacted?: boolean` (:254) is deliberately omitted — pi-remote never consumes it and treats redacted thinking as inert payload.
  - Replace `export interface PiToolCall { ... }` with a block form declaring `thoughtSignature?: string`, provenance `ToolCall` at `:261–269`, `thoughtSignature` at `:266`. Note the adjacent `namespace?: string` (:268) is deliberately omitted (OpenAI Responses-namespaced tools; never consumed).
  - Update the sibling provenance comment on the content-block group (the `/** Real pi-ai content blocks ... */` header) to reference the ThinkingContent/ToolCall declarations.
- [ ] 1.3 `bunx tsc --noEmit` → exit 0.
- [ ] 1.4 Commit: `fix(sdk-events): declare vendored thinking/thoughtSignature fields (FLLWUP-39)`.

### Task 2 — FLLWUP-40: correct the pairing test's source comment

- [ ] 2.1 Edit `test/translate.test.ts` (~:431–433): replace the three-line comment with wording that states the true scope per `docs/ROLE-DECODER-DUPLICATION.md` § "What pins the pairing today": this is a textual-drift tripwire pinning (1) derivation-text presence (`messageId.indexOf(":")` in both files) and (2) role vocabulary within the 400-char signature windows; the windows include the return-type annotation, so the vocabulary assertions are satisfied by the annotation regardless of the body's decode comparison; the test does NOT pin the value-level decode comparison. Assertions untouched.
- [ ] 2.2 `bunx tsc --noEmit` → exit 0 (comment change; formality).
- [ ] 2.3 Commit: `test(translate): correct FLLWUP-12 pairing test comment to its real scope (FLLWUP-40)`.

### Task 3 — Gates, push, PR

- [ ] 3.1 `bunx tsc --noEmit` → exit 0.
- [ ] 3.2 `bun test` → all-pass (273 pass / 1 skip / 0 fail expected; the 1 skip is the Windows-gated credential-ACL test on non-Windows).
- [ ] 3.3 AGENTS.md check: no Current-state claim becomes false (type declarations and a comment; no behavior change) — no edit.
- [ ] 3.4 Push: `git -c credential.helper='!gh auth git-credential' push origin owner/epic6-sdk-residuals`.
- [ ] 3.5 Open ONE PR (base `main`) covering both cards: conventional title, body naming FLLWUP-39 + FLLWUP-40, dist-type evidence, honest-scope correction.

## Work log

- 2026-07-22: dist evidence re-verified (grep -n, file read verbatim) at worktree head 074069e.
- 2026-07-22: Task 1 done — PiThinkingContent declares `thinkingSignature?: string`; PiToolCall declares `thoughtSignature?: string`; `redacted` (:254) and `namespace` (:268) deliberately omitted with stated reasons; header content-block range corrected 242–266 → 242–269.
- 2026-07-22: Task 2 done — comment-only edit in test/translate.test.ts, assertions byte-identical (verified via git diff: 11 insertions / 3 deletions in the test file are all comment lines).
- 2026-07-22: Gates — `bunx tsc --noEmit` exit 0; `bun test` 279 pass / 1 skip / 0 fail (skip = Windows-gated credential-ACL test on Linux; count grew 273→279 vs EV-69 because origin/main moved since that run, not from this change).
