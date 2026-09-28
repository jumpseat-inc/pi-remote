# EV-19 real-host observation — attended `/rc:login` URL prompt on installed pi 0.87.1

Card: `council/cards/EV-19.md` (EPIC-8). Spec: `docs/superpowers/specs/2026-09-28-EV-19-design.md`.
Branch: `owner/EV-19-real-host-observation`. Run date: 2026-09-28.

This record joins three independently sourced facts (spec §2): the extension
forwards the placeholder argument (fact 1, in-repo pin), the installed host
renders no placeholder in the input box (fact 2, this observation), and the
host component discards the argument (fact 3, host source). The anticipated
non-render is the card's honest success.

## 1. Run configuration — one resolution tier, two observation vehicles

One tier throughout: `PI_REMOTE_SERVER_URL=http://127.0.0.1:18119` set in the
host environment of every run; the resolved URL equals the env value verbatim
(env is the first resolution tier — `index.ts` resolve chain). The same single
`resolved` value appears in the title substrings (§3), the authorize URL (§4),
and the persisted credential `serverUrl` (§4).

Host: installed production pi, banner `pi v0.87.1`. Extension loaded from this
worktree: `--extension <worktree>/index.ts`. No prior credential in any agent
dir used.

Two observation vehicles, both at that same tier:

1. **Render-observation runs (tmux).** The committed pane captures come from a
   tmux session whose typed launch line is visible in the captures
   (`PI_CODING_AGENT_DIR=/tmp/ev19-agent-4jf4` — that dir has since been
   deleted; the capture bytes are the record of it). The after-Enter frame
   shows the run was cancelled at the "Cancel sign-in?" prompt — these runs
   carried no enrollment, and no credential claim rides on them.
2. **Enrollment run (pty-driven).** Driver `/tmp/ev19-pty-run.py` (SHA-256
   `4091a7bc…`) spawns the installed pi as a pty child with agent dir
   `/tmp/ev19-agent4-Vbll`, waits for the prompt to reach rest, then sends a
   synthetic Enter keystroke. **The (c) mechanism is the real host's
   empty-Enter — never an injected `inputPrompt → ""` fixture** (spec §1;
   designer round-2 retraction). Its raw transcript (`/tmp/ev19-pty-transcript.bin`,
   SHA-256 `5407e55f…`) carries the same at-rest render (§2) and the
   enrollment completion.

The at-rest render is therefore evidenced in **both** vehicles' bytes, and
(a)/(b)/(c) join on the enrollment run's own transcript — the anti-splice
property the single-resolution-input design protects (never mixing resolution
inputs across claims) holds: one tier, one `resolved` value.

Tier independence of the render negative: the host component discards its
`_placeholder` parameter regardless of the title's content (fact 3 below),
so the non-render observed at the mock tier holds at every tier.

## 2. Acceptance (a) — render observation and signed negative

Capture modes (spec §6): `tmux capture-pane -e -p` primary (ANSI preserved)
and `tmux capture-pane -p` companion (plain text). Both inline below.

**Input-line span** (per the Skeptic's O7 corrections — the span is the line
beginning with the `>` prompt marker carrying the cursor, NOT the last
non-blank line, which is the bottom `DynamicBorder`): line 30 of both captures.

**Signed negative** (greps run over the exact span bytes of the `-e` capture):

- Expected-present (O7.2): the single inverse-video cursor space —
  `> ` followed by `\x1b[7m \x1b[0m`. Present. ✓
- `\x1b[2m` (dim): **0 occurrences**. ✓
- `\x1b[90m` (bright-black dim): **0 occurrences**. ✓
- `\x1b[38;5;` (256-color, would cover any dim-class draw): **0 occurrences**. ✓
- No reverse-video-wrapped glyphs beyond the one cursor space (O7.3: this
  host's own placeholder mechanism renders reverse-video, not dim — the search
  covers style SGR, not dim-only). ✓

The same probes re-run on the enrollment run's own transcript bytes
(`ev19-pty-transcript.bin`, the run that persisted §4's credential): the
at-rest span is `> ` followed by `\x1b[7m \x1b[27m` (the cursor space, in
exactly the form the host source at `input.js:343-413` produces), and
`\x1b[2m` / `\x1b[90m` / `\x1b[38;5;` have **0 occurrences in the entire
transcript**; the title and consent sentence each appear exactly once. The
negative is thus observed identically in both vehicles.

**Result: no placeholder rendered in the input box.** The box at rest contains
only the prompt marker and the cursor. This is the anticipated negative and
the card's named residual: the placeholder argument reaches a host that does
not render it on pi 0.87.1. The conditional branch of acceptance (a) — greyed
render, clear-on-type, backspace-to-empty dynamics — is **unexercised** and
remains hypothesized-only (designer P6) for a future placeholder-honoring host.

## 3. Acceptance (b) — title still displays the resolved URL

Both title substrings, asserted on the SGR-stripped projection of the `-e`
capture (spec §6: raw-vs-raw against the source literal would fail spuriously)
and directly in the `-p` companion (lines 27–28 of both captures):

- `Control-plane server URL [http://127.0.0.1:18119]:`
- `Press Enter to enroll this host against http://127.0.0.1:18119, or type a
  different URL to override:`

In the `-e` capture both lines are accent-styled (`\x1b[38;2;138;190;183m`)
and the URL characters are byte-identical inside the styled spans — no inner
ANSI mutates the URL. The literal is the **keyless inline literal** at
`index.ts:678` (see §6 for the `login.urlPrompt` honesty note).

## 4. Acceptance (c) — empty-Enter enrollment, persisted credential byte-equal

- Mock control plane: `scripts/ev19-mock-control-plane.ts` on
  `http://127.0.0.1:18119` (three endpoints: RFC 8414 discovery, `/authorize`
  302 back to the driver's loopback redirect_uri, `/token`).
- Mock request log — exactly the three expected requests, no surprises
  (designer P3 falsifier: an unexpected request would have fired):

  ```
  {"ts":"2026-09-28T07:55:27.267Z","method":"GET","path":"/.well-known/oauth-authorization-server"}
  {"ts":"2026-09-28T07:55:34.601Z","method":"GET","path":"/authorize"}
  {"ts":"2026-09-28T07:55:34.605Z","method":"POST","path":"/token"}
  ```

- Agent dir of the enrollment run: `/tmp/ev19-agent4-Vbll`.
- Persisted credential — only the `serverUrl` field is quoted (tokens never
  enter any committed artifact):

  ```json
  { "serverUrl": "http://127.0.0.1:18119" }
  ```

- Byte comparison (note `jq -j`, not `-r` — `-r` appends a newline and would
  break byte-equality spuriously):

  ```
  jq -j .serverUrl /tmp/ev19-agent4-Vbll/pi-remote/credentials.json \
    | cmp - <(printf %s 'http://127.0.0.1:18119')
  → CMP_EXIT=0
  ```

- Epistemics (settled in deliberation): the `serverUrl = resolved` mapping is
  **by construction** (`index.ts:688`); this boundary run re-derives it as a
  boundary observation — it discharges the non-construction residue: env
  propagation into the real pi process, the loopback listener bind
  (`login.ts:531`), discovery → authorize → token over live HTTP, and the
  atomic 0600 write into the real configDir. Transcript tail shows the
  attended waiting notify ("Waiting for browser…") and the
  "enrollment credentials saved" line.
- Authorize-URL provenance (method deviation — see §9): the host's notify
  surface is latest-wins per frame and **deterministically never paints the
  fallback URL line** (`login.attended.fallback`, `src/login.ts:587`) — the
  committed captures show only the "Waiting for browser…" state. The full
  authorize URL (PKCE + state) was therefore **assembled from memory windows
  dumped around the driver's authorize-URL string**
  (`/tmp/ev19-mem-windows.txt`, SHA-256 `6c489bf0…`; assembled URL preserved
  in `/tmp/ev19-full-url.txt`, SHA-256 `01d11c33…`, query part in
  `/tmp/ev19-authorize-url.txt`, SHA-256 `68205d6e…`) and `curl -sL`-followed
  externally to complete the round-trip. The (c) conclusion does not rest on
  the URL's provenance: the driver constructed and used the URL, the mock log
  shows the round-trip, and the persisted credential byte-equals the resolved
  URL.

## 5. Join facts 1 and 3 (why the negative is not a forwarding failure)

- **Fact 1 — forward pin (in-repo):** `index.ts:677-679` passes `resolved` as
  the second argument of `deps.inputPrompt(...)` (`679: resolved, // EV-18:
  …placeholder`); `index.ts:979` forwards both arguments into
  `RemoteControllerDeps.inputPrompt`. Pinned by EV-18's merged wiring tests
  over the injected `ExtensionAPI` stand-in (`test/index.test.ts`).
- **Fact 3 — host source:** the installed
  `@earendil-works/pi-coding-agent@0.87.1` dist
  (`dist/modes/interactive/components/extension-input.js:25` on disk; the
  product-owner ruling's prose cites an `extensions/…` prefix — the content
  verifies identically on every on-disk 0.87.1 copy) declares
  `constructor(title, _placeholder, onSubmit, onCancel, opts)` and never
  references `_placeholder` anywhere in the file; `interactive-mode.js:2095`
  forwards `title, placeholder` into the component. Per the product-owner
  ruling `vault/raw/2026-09-27-po-epic-8-placeholder-residual.md`, verified
  against the installed dist on this machine (Skeptic O7.5).

Without fact 1 the empty box could not distinguish host-discard from
forwarding-failure; with both, the negative is legible from the artifact set
alone (designer P5).

## 6. `login.urlPrompt` honesty note

The consent sentence is a **keyless inline literal** at `index.ts:676-678`;
`src/copy.ts` already describes it as keyless. The Phase-1 "surface copy"
ruling and the product-owner ruling prose both refer to a `login.urlPrompt`
key — **that key has no referent in the tree** (`grep -rn 'login.urlPrompt'
src/` → zero hits; it survives only in council records and FLLWUP-41,
Backlog). This record cites the literal by exact string (§3), never as a
landed key.

## 7. Redaction note

The operator's typed environment line (carrying a live `OPENROUTER_API_KEY`
value) appears in the raw pane captures. That token was redacted to
`OPENROUTER_API_KEY=[REDACTED]` in every committed copy before this record was
written; the SHA-256 values in §8 are of the **redacted committed bytes**. The
pty `.bin` artifacts were verified key-free before recording (`strings` scan:
zero matches for key patterns).

## 8. Artifact inventory

| Artifact | SHA-256 | Where |
| --- | --- | --- |
| `-e` capture (primary, redacted) | `dec178bd7aa1ed693da2a020c36ba47463ced12a96ed986d52f70aead3cafefa` | inline below |
| `-p` capture (companion, redacted) | `441b36938d53503991e57d81197e9680d7043004dcc7b280ec26396760fe8932` | inline below |
| pty `prompt-at-rest.bin` | `d8ef59003099a941ed69b4fc3c530e6a633e01d1f116b6802d1330e792c24f5e` | ephemeral `/tmp` |
| pty `after-enter.bin` | `7fc67aee7ee7e3298bda959c05fa5c461db4dea3136d117aac9c09e70fa382c3` | ephemeral `/tmp` |
| pty `final.bin` = `transcript.bin` | `5407e55f876c19d8bbb9a62a00e751536f812cb44e320a1de1b51394de504555` | ephemeral `/tmp` |
| `full-url.txt` (authorize URL) | `01d11c33270f0c1e769430943902d3354fbf9ee2f7b511b5c6a040779de13d7b` | ephemeral `/tmp` |
| `authorize-url.txt` (query part) | `68205d6e218068da7386df102a9e4a23483bacd500b3ce519a90ac435bad63ca` | ephemeral `/tmp` |
| pty driver `ev19-pty-run.py` | `4091a7bc003b1478b692c79562dbda16b2b1fe58d16cbba9cef49204e42111dd` | ephemeral `/tmp` |
| `mem-windows.txt` (URL-assembly source) | `6c489bf08d63e4caac0023d3bb35a821c8e50e592cdb1099f90bd4cade970f3c` | ephemeral `/tmp` |
| mock request log `mock-log.jsonl` | quoted in §4 | ephemeral `/tmp` |
| persisted credential | `serverUrl` quoted in §4 (tokens never recorded) | ephemeral, deleted agent dir |

Line-range pointers for both inline captures: title lines 27–28, input-line
span line 30, key-hint line 32, bottom border line 34.

## 9. Acceptance (d) — deviations

Two method deviations, recorded; neither touches the (a)–(c) conclusions:

1. **Authorize-URL provenance.** The settled procedure named parsing the
   printed fallback URL from the capture; the notify surface (latest-wins per
   frame) deterministically never paints that line, so the URL was assembled
   from memory windows around the driver's authorize-URL string and driven
   externally (§4). The enrollment round-trip itself — real driver, mock
   control plane, persisted credential — is unaffected, and (c) does not rest
   on the URL's provenance.
2. **Render observation and enrollment across two vehicles.** The settled
   design aimed at one session carrying (a)/(b)/(c) together. In practice the
   tmux render-observation runs were cancelled before enrollment (their
   after-Enter frames show the cancel dialog), and the enrollment completed on
   the pty-driven run. Both vehicles ran at the same single resolution tier,
   the at-rest render is byte-evidenced in both, and (a)/(b)/(c) join on the
   enrollment run's own transcript — the anti-splice property (one `resolved`
   value across title, authorize URL, and credential) is preserved.

## 10. Reproducibility

```bash
bun scripts/ev19-mock-control-plane.ts --port 18119 --log /tmp/ev19-mock-log.jsonl &
PI_REMOTE_SERVER_URL=http://127.0.0.1:18119 \
PI_CODING_AGENT_DIR=$(mktemp -d) \
  pi --no-session --extension <worktree>/index.ts
# press Enter on the empty prompt, then:
jq -j .serverUrl "$PI_CODING_AGENT_DIR/pi-remote/credentials.json" \
  | cmp - <(printf %s 'http://127.0.0.1:18119')
```

---

## Inline artifact: `-e` capture (primary, ANSI preserved, redacted)

```text
cd /home/tista/codes/pi-remote-ev19

[1m[36mpi-remote[0m [3m[36mmain[0m [1m[36m❯[0m cd /home/tista/codes/pi-remote-ev19

[1m[36mpi-remote-ev19[0m [3m[36mowner/EV-19-real-host-observation[0m [36m [1m❯[0m env PI_CODING_AGENT_DIR=/tmp/ev19-agent-4jf4 OPENROUTER_API_KEY=OPENROUTER_API_KEY=[REDACTED] PI_REMOTE_SERVER_URL=http://127.0.0.1:18119 pi --no-session --extension /home/tista/codes/pi-remote-ev19/index.ts

 [1m[38;2;138;190;183mpi[0m[38;2;102;102;102m v0.87.1[39m                                                                                                                                                                                                                 
 [38;2;102;102;102mescape[38;2;128;128;128m interrupt · [38;2;102;102;102mctrl+c/ctrl+d[38;2;128;128;128m clear/exit · [38;2;102;102;102m/[38;2;128;128;128m commands · [38;2;102;102;102m![38;2;128;128;128m bash · [38;2;102;102;102mctrl+o[38;2;128;128;128m more[39m                                                                                                                                            
 [38;2;102;102;102mPress ctrl+o to show full startup help and loaded resources.[39m                                                                                                                                                               
                                                                                                                                                                                                                            
 [38;2;102;102;102mPi can explain its own features and look up its docs. Ask it how to use or extend Pi.[39m                                                                                                                                      


[38;2;240;198;116m[Context][39m                                                                                                                                                                                                                   
[38;2;102;102;102m  AGENTS.md[39m                                                                                                                                                                                                                 

[38;2;240;198;116m[Skills][39m                                                                                                                                                                                                                    
[38;2;102;102;102m  brainstorming, diagnose-crash, diagnosing-superpowers, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, omarchy, receiving-code-review, requesting-code-review, subagent-driven-development, 
systematic-debugging, test-driven-development, usages, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills[39m                                                                

[38;2;240;198;116m[Extensions][39m                                                                                                                                                                                                                
[38;2;102;102;102m  @juicesharp/rpiv-ask-user-question, obra/superpowers:.pi/extensions/superpowers.ts, pi-remote-ev19[39m                                                                                                                        


[38;2;95;135;255m────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

[39m [38;2;138;190;183mControl-plane server URL [http://127.0.0.1:18119]:                                                                                                                                                                         
[39m [38;2;138;190;183mPress Enter to enroll this host against http://127.0.0.1:18119, or type a different URL to override:[39m                                                                                                                       

> [7m [0m                                                                                                                                                                                                                         

 [38;2;102;102;102menter[38;2;128;128;128m submit[39m  [38;2;102;102;102mescape/ctrl+c[38;2;128;128;128m cancel[39m                                                                                                                                                                                         

[38;2;95;135;255m────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
[38;2;102;102;102m~/codes/pi-remote-ev19 (owner/EV-19-real-host-observation)
0.0%/262k (auto)                                                                                                                                                                               moonshotai/kimi-k2.6 • medium




```

---

## Inline artifact: `-p` capture (companion, plain text, redacted)

```text
cd /home/tista/codes/pi-remote-ev19

pi-remote main ❯ cd /home/tista/codes/pi-remote-ev19

pi-remote-ev19 owner/EV-19-real-host-observation  ❯ env PI_CODING_AGENT_DIR=/tmp/ev19-agent-4jf4 OPENROUTER_API_KEY=OPENROUTER_API_KEY=[REDACTED] PI_REMOTE_SERVER_URL=http://127.0.0.1:18119 pi --no-session --extension /home/tista/codes/pi-remote-ev19/index.ts

 pi v0.87.1                                                                                                                                                                                                                 
 escape interrupt · ctrl+c/ctrl+d clear/exit · / commands · ! bash · ctrl+o more                                                                                                                                            
 Press ctrl+o to show full startup help and loaded resources.                                                                                                                                                               
                                                                                                                                                                                                                            
 Pi can explain its own features and look up its docs. Ask it how to use or extend Pi.                                                                                                                                      


[Context]                                                                                                                                                                                                                   
  AGENTS.md                                                                                                                                                                                                                 

[Skills]                                                                                                                                                                                                                    
  brainstorming, diagnose-crash, diagnosing-superpowers, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, omarchy, receiving-code-review, requesting-code-review, subagent-driven-development, 
systematic-debugging, test-driven-development, usages, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills                                                                

[Extensions]                                                                                                                                                                                                                
  @juicesharp/rpiv-ask-user-question, obra/superpowers:.pi/extensions/superpowers.ts, pi-remote-ev19                                                                                                                        


────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

 Control-plane server URL [http://127.0.0.1:18119]:                                                                                                                                                                         
 Press Enter to enroll this host against http://127.0.0.1:18119, or type a different URL to override:                                                                                                                       

>                                                                                                                                                                                                                           

 enter submit  escape/ctrl+c cancel                                                                                                                                                                                         

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
~/codes/pi-remote-ev19 (owner/EV-19-real-host-observation)
0.0%/262k (auto)                                                                                                                                                                               moonshotai/kimi-k2.6 • medium




```
