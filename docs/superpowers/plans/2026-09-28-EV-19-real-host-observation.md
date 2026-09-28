# EV-19 Real-Host Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record, at the installed pi 0.87.1 host, what the attended `/rc:login` URL prompt actually renders with the EV-18 placeholder argument (anticipated negative: not rendered), and discharge enrollment byte-equality via a local mock control plane — zero product diff.

**Architecture:** One owner branch (`owner/EV-19-real-host-observation`, cut from `origin/main`) carries: a ~50-line Bun mock control-plane script under `scripts/` with a unit test, a raw observation record at `vault/raw/2026-09-28-ev19-observation.md`, and this plan. The evidence is produced by one real-host tmux run with a single resolution input (`PI_REMOTE_SERVER_URL=http://127.0.0.1:<mockport>`), captured twice (`-e` primary, `-p -J` companion), plus a mock enrollment completed by `curl -sL` of the printed authorize URL.

**Tech Stack:** Bun (script + test runner), tmux (real-host driver), curl, jq, cmp, sha256sum, gh (PR).

**Spec:** `docs/superpowers/specs/2026-09-28-EV-19-design.md` (settled design; the card is `council/cards/EV-19.md`, whose deliberation record carries O1–O8 and the corrected P1 method).

## Global Constraints

- Zero product diff: `git diff origin/main...HEAD --stat` touches no `src/**` and no `index.ts`. Only records, the mock script, its test, and this plan.
- The mock script is committed tooling, not product code — it mints no copy, touches no surface.
- One run, one resolution input: `PI_REMOTE_SERVER_URL=http://127.0.0.1:<mockport>` for the entire observation session; the tier is named in the record.
- Loopback mock only — never enroll against any real control plane.
- P1 corrected method, adopted verbatim (Skeptic O7): span := the `>`-marker line carrying the CURSOR_MARKER (`\x1b_pi:c\x07`); expected-present: exactly one `\x1b[7m … \x1b[27m` inverse-video cursor space; assert absence of any *other* style SGR in the span (not a dim-only search).
- Title substrings (P2) asserted on the SGR-stripped projection (the `-p -J` companion), never raw-`-e`-vs-source.
- (c) is a real-host empty-Enter keystroke in tmux — never a fixture `accept:inputPrompt -> ""` injection.
- Credential bytes quoted as evidence carry only the `serverUrl` field — tokens redacted.
- Card record (`council/cards/EV-19.md`) and `council/board.md` are NOT edited by the owner (facilitator's job).
- All commits Conventional Commits. Every command bounded (explicit timeouts). No background process left running.
- Record language: (c) is "construction re-derived as boundary observation," never "discovered."

## Review Focus

- **SGR-stripped capture mistaken for evidence:** a `-p`-only capture cannot support the style negative — the record must rest the negative on the `-e` bytes (O5 proved `-p` strips SGR to zero `033` bytes).
- **Wrong span:** "last non-blank line" is the bottom `DynamicBorder`, not the input line (O7.1) — the span is the `>`-marker line carrying CURSOR_MARKER.
- **Spurious SGR assertion:** the at-rest input span legitimately contains the `\x1b[7m` cursor space (O7.2); a "no SGR" phrasing fires spuriously.
- **Mock log surprises:** any request beyond discovery GET, `/authorize` GET, `/token` POST falsifies (c) — the log is the falsifier, so the mock must log *every* request including unexpected ones.
- **Truncated authorize URL:** the notify-sink URL can wrap/truncate in the pane; widen the pane before the run and parse from the `-J` (joined) companion capture.

---

### Task 1: Mock control-plane script (TDD — committed tooling)

**Files:**
- Create: `scripts/ev19-mock-control-plane.ts`
- Test: `test/ev19-mock-control-plane.test.ts`

**Interfaces:**
- Consumes: nothing in-tree (self-contained; uses `Bun.serve`).
- Produces: CLI `bun scripts/ev19-mock-control-plane.ts --port <p> --log <path>` serving exactly three endpoints — `GET /.well-known/oauth-authorization-server` (JSON doc with absolute `authorizationEndpoint` + `tokenEndpoint`), `GET /authorize` (302 to the request's `redirect_uri` with `code` + echoed `state`), `POST /token` (JSON `{access_token, refresh_token, expires_in}`) — and appending one JSON line per request (including unexpected ones) to `--log`.

- [ ] **Step 1: Write the failing test**

Test spawns the script on an ephemeral port with a temp log file, then asserts:
1. Discovery GET returns 200 JSON whose `authorizationEndpoint` and `tokenEndpoint` are absolute URLs on the mock origin.
2. `/authorize?redirect_uri=<enc>&state=<s>` returns 302 with `Location` = `<redirect_uri>?code=…&state=<s>` (state echoed).
3. `POST /token` returns 200 JSON with a string `access_token`.
4. The log file contains one JSON line per request, method + path recorded.
5. An unexpected path (e.g. `GET /nope`) returns 404 and is still logged.

- [ ] **Step 2: Run test, verify it fails** — `bun test test/ev19-mock-control-plane.test.ts` → FAIL (script does not exist).

- [ ] **Step 3: Implement the minimal script** (~50 lines) to satisfy the test.

- [ ] **Step 4: Run test, verify green.** Commit: `feat(scripts): add EV-19 mock control plane for real-host enrollment observation`.

### Task 2: Real-host render observation (acceptance (a)+(b)) — tmux run

**Files:**
- Create: `vault/raw/2026-09-28-ev19-observation.md` (started here; completed in Task 4)
- Artifacts (committed inside the record): `-e` capture (primary), `-p -J` capture (companion)

**Procedure (bounded):**
1. Fresh tmp agent dir; mock NOT yet required for (a)/(b) but the same run continues into Task 3, so start the mock first (Task 1 script) with a fixed port and log path.
2. `tmux new-session -d -s ev19 -x 220 -y 40` (wide pane — URL must not truncate), `cd` to the owner worktree, run `env PI_CODING_AGENT_DIR=<tmp> OPENROUTER_API_KEY=$OPENROUTER_API_KEY PI_REMOTE_SERVER_URL=http://127.0.0.1:<port> pi --no-session --extension <worktree>/index.ts`.
3. Accept the trust prompt via `tmux send-keys`. Type `/rc:login`, Enter.
4. Wait ~2 s (post-render, pre-keystroke; P4 — confirm no transient frame). Capture BOTH: `tmux capture-pane -e -p -J -t ev19` (primary, SGR preserved) and `tmux capture-pane -p -J -t ev19` (companion).
5. P1 corrected negative on the `-e` bytes: isolate the span = the line beginning with `>` and carrying `\x1b_pi:c\x07`; assert exactly one `\x1b[7m … \x1b[27m` cursor space present and NO other style SGR (`\x1b\[[0-9;]*m`) in the span.
6. P2 on the `-p -J` companion: `[<resolved>]` and `Press Enter to enroll this host against <resolved>, or type a different URL to override:` appear as exact substrings (resolved = `http://127.0.0.1:<port>`).
7. Record SHA-256 of both captures; kill nothing yet (Task 3 continues in the same session).

### Task 3: Mock enrollment (acceptance (c)) — same tmux session

**Procedure (bounded):**
1. In the same pane, send empty-Enter (a real keystroke: `tmux send-keys -t ev19 Enter`).
2. Wait ~2 s; capture the `-p -J` companion again.
3. Parse the printed authorize URL (the `login.attended.fallback` line) from the companion capture.
4. `curl -sL` the URL (bounded, e.g. `--max-time 15`) — follows the 302 into the driver's own loopback listener; the driver exchanges at `/token` and persists.
5. Wait for the success line; read the mock log; assert exactly three requests: discovery GET, `/authorize` GET, `/token` POST — nothing else.
6. `cmp <(jq -r .serverUrl <tmpAgentDir>/pi-remote/credentials.json) <(printf %s "$PI_REMOTE_SERVER_URL")` → exit 0.
7. Redact: quote only `jq '{serverUrl}'` output in the record — never the token fields.
8. Teardown: `curl`-free; kill the mock process, `tmux kill-session -t ev19`. Verify no listener remains on the mock port.

### Task 4: The raw observation record

**Files:**
- Modify: `vault/raw/2026-09-28-ev19-observation.md`

Contents (per spec §6, all inside the artifact):
- Both captures inline (fenced, ANSI preserved for `-e`) + SHA-256 of each + line-range pointers.
- Signed negative with the corrected P1 method (span definition, expected-present cursor, style-SGR search set).
- Title-substring assertions (P2) with the exact literal from `index.ts:676-678` and the capture SHA.
- EV-18 forward-pin citation by file:line (`index.ts:677-679` second arg; `index.ts:979` forwards both args) — inside the artifact.
- Host-source fact (pi 0.87.1 `extensions/interactive/components/extension-input.js:25`, `_placeholder` never referenced; `interactive-mode.js:2095` forwards both args).
- Tier naming (`PI_REMOTE_SERVER_URL=http://127.0.0.1:<port>`) + one-sentence tier-independence argument.
- `login.urlPrompt` honesty sentence (keyless inline literal; the Phase-1/PO prose key name has no tree referent; keying is FLLWUP-41, Backlog).
- Mock script name + port + full request log + the three-request assertion.
- Redacted `serverUrl` bytes + the `cmp` command and its exit status.
- Named residual: the greyed placeholder does not render on pi 0.87.1; clear-on-type/backspace dynamics unexercised (P6 hypothesized-only).
- Record language: "construction re-derived as boundary observation."

Commit: `docs(vault): record EV-19 real-host observation (placeholder non-render, mock enrollment)`.

### Task 5: Gates, diff check, push, PR

1. `bunx tsc --noEmit` → exit 0.
2. `bun test` → green.
3. PI-SPEC §7.2/§8 sync check: no wire-format, replay, auth, or copy change in this diff → expected no-op; state the check in the PR body.
4. `git diff origin/main...HEAD --stat` → no `src/**`, no `index.ts`.
5. Push `owner/EV-19-real-host-observation`; `gh pr create` against main with the raw artifact linked, the (d) status (expected: none / record the deviation if the mock path could not complete), and the sync-check statement.
