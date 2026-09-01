# FLLWUP-8 Design — Wire the ui_prompt_start raise path end-to-end

Status: settled by Council deliberation (card `council/cards/FLLWUP-8.md`, steps 1–6,
2026-09-01). This document is the sole implementation handoff; it writes up the
settled design and derives nothing. Binding riders from the card face apply.

## 1. Goal

Make FLLWUP-5's `pi.human_input.resolved` runtime-observable end to end: a host
that receives an SDK `ui_prompt_start` raises a `pi.human_input` CUSTOM frame
with `(promptId, occurrence)` stamped, the host that resolves it emits
`pi.human_input.resolved` live, and a reconnecting client sees the resolved
frame in the live stream after replay (J-REPLAY — replay need not be
self-sufficient). This re-opens FLLWUP-5 acceptance (b) from fixture-green to
runtime-observable.

Out of scope (binding): FLLWUP-11 (non-`on` SDK members) and FLLWUP-12
(payload-shape honesty reconciliation); `registerPrompt` signature cleanup; a
raise-time fallback explanation; any change to the steering-fallback model
(steward R3 Side B: the raise is OBSERVATION — the host already receives the
prompt; the fallback is the permanent live resolution path).

## 2. Grounded SDK facts (facilitator-verified, skeptic-confirmed O2/O3)

- `UIPromptKind = "select" | "confirm" | "input" | "editor" | "custom"`
  (installed SDK `dist/core/extensions/types.d.ts:563`).
- `UIPromptStartEvent { type:"ui_prompt_start"; reason:"ui_prompt";
  kind:UIPromptKind; title?:string }` (types.d.ts:565-570); `UIPromptEndEvent`
  identical shape (:572-577).
- Emitted from `runner.js` `withUIPrompt` (depth-guarded:
  `uiPromptDepth++ === 0` — only the outermost prompt emits);
  `wrapUIPromptContext` passes `message`/`placeholder`/`prefill`/`options`/
  `factory` to the UI call but ONLY `{kind, title}` reach the event. For
  `kind:"custom"` there is no title at all. **The live event carries no prompt
  body** (skeptic F1, closed-green).
- Typed `on("ui_prompt_start", ExtensionHandler<UIPromptStartEvent>)` at
  types.d.ts:927; `"ui_prompt_start"` is already in the vendored
  `PiSDKOnEvent` union (`src/pi-sdk-on.ts`). `pi-sdk-on.ts` is NOT modified by
  this card.
- `registerPrompt` (ours, `src/inject.ts:179-190`) is
  `registerPrompt(input: {promptId: string; kind: string; prompt: string}):
  {occurrence: number}` and its body reads **only** `input.promptId`
  (skeptic F2, closed-green). Not modified by this card.

## 3. Settled design

### 3.1 New PiEvent variant (`src/translate.ts`)

Add beside the existing `ui_prompt_end` variant (~line 142):

```ts
| { event: "ui_prompt_start"; kind: UIPromptKind; title?: string }
```

The `ui.confirm` variant stays byte-identical (it is the fixture-only synthetic
seam; 5 tests are load-bearing on it — FLLWUP-9 deletion probe).

### 3.2 Mapper case (`src/translate.ts`)

```ts
case "ui_prompt_start":
  frames.push({
    type: "CUSTOM",
    name: "pi.human_input",
    value: {
      pi: "ui_prompt_start",
      data: {
        kind: input.kind,
        title: input.title,
        schemaVersion: 1,
        promptId: fnv1a(`${input.kind}\u0000${input.title ?? ""}`),
      },
    },
  });
  break;
```

Exactly four data keys. **No `prompt`, no `promptKind`, no backward-compat
aliases** — no live client ever consumed the synthetic shape (the guard bridge
at root `index.ts` early-returns `"ui.confirm"` before reaching `pi.on`), and
the live event has no prompt body to put in a field named `prompt` (F1).
`value.pi` is `"ui_prompt_start"` for honest provenance, symmetric with the
close side; the name `pi.human_input` is the sole dispatch key. The raise data
shape mirrors the close side (`pi.human_input.closed`: `{kind, title,
schemaVersion:1}`) plus `promptId`. Purity: no clock, no entropy — G-11/G-12
stay green. The `entryId`-based live/JSONL discriminator is unaffected (the
new event has no `entryId`; runtime probe confirmed no kind-collision
misroute — skeptic O4).

### 3.3 Subscription (`index.ts`, `createRemoteController`)

Add a `deps.on("ui_prompt_start", …)` handler **mirroring the existing
`ui_prompt_end` handler exactly**: manual field validation (never
`ev as PiEvent`), `isUIPromptKind` guard on `kind` with the same coercion the
`ui_prompt_end` handler performs (invalid kind → `"custom"` and forward — see
§3.6 O9), `title` forwarded as `string | undefined`:

```ts
deps.on("ui_prompt_start", (ev) => {
  const e = ev as { kind?: unknown; title?: unknown } | null | undefined;
  if (!e) return;
  forward({
    event: "ui_prompt_start",
    kind: isUIPromptKind(e.kind) ? e.kind : "custom",
    title: typeof e.title === "string" ? e.title : undefined,
  });
});
```

(The exact shape mirrors `ui_prompt_end`'s handler; keep the two handlers
symmetric. `"ui_prompt_start"` already typechecks against `DepsOnEvent` —
skeptic O7.)

### 3.4 `forward()` collapse (`index.ts`)

Replace the `ui.confirm`-specific special case with a **general post-translate
stamp**: for every emitted frame with `name === "pi.human_input"` and a string
`data.promptId`, call
`injector.registerPrompt({ promptId, kind: data.kind ?? data.promptKind ?? "", prompt: data.title ?? data.prompt ?? "" })`
and stamp `f.value.data = { ...data, occurrence }` before sending.

The `promptKind`/`prompt` fallback reads exist **solely** so the 5 synthetic
`ui.confirm` fixtures keep working through the same stamp path (their frames
carry `promptKind`/`prompt`; live frames carry `kind`/`title`). One raise
path, one `(promptId, occurrence)` stamping site, one `registerPrompt` call
site. The old `input.event === "ui.confirm"` branch is removed (grep-able:
zero matches after the change).

### 3.5 Resolved observability — zero change

`inject.ts` and the `onInbound → injector.handle → emitResolved` path
(`resolved` and `steered_fallback` with `tracked:true`) are untouched. Today
the path is dead because `registerPrompt` is never called live. Once the raise
registers, a remote answer matches a pending entry → tracked →
`pi.human_input.resolved {promptId, occurrence, deviceId, ts}` fires live.
Resolved frames are sent directly on the transport, never folded into replay —
J-REPLAY satisfied by construction. Offline raises are silent (`forward`
early-returns without a transport; no registration; no phantom ack is
reachable — skeptic O10).

### 3.6 Skeptic O9 resolution (binding on the implementation)

Bogus-kind semantics: the converged design mirrors `ui_prompt_end`, whose
handler **coerces** an invalid kind to `"custom"` and forwards — it does not
drop. Owner round-1 claim (4) (`kind:"bogus" → no frame, no registration`) is
**dropped from the test list** and must NOT be resurrected. The implementation
pins the mirroring semantics with a fixture (T5 below): a coerced frame is
emitted and `promptId = fnv1a("custom\u0000")` is registered, disambiguated
from a genuine `custom` raise only by `occurrence`. (The SDK's types guarantee
`kind` is a `UIPromptKind` in practice; this is the defensive path only.)

## 4. Spec amendments (same PR — card-face rider)

In `docs/PI-SPEC.md`:

1. **§5.4, the sentence this PR falsifies** (~line 227): the text ending
   "…fixture-green today, runtime-observable once the raise path lands
   (FLLWUP-8)" is amended to state the raise path is wired and contract (b) is
   runtime-observable as of this card.
2. Add a one-line note: on the live raise path `promptId` is a bucket hash
   over `(kind, title)`; `occurrence` is the true discriminator and the
   counter restarts per session — `promptId` alone is never a global identity.
3. Add a prompt-body fidelity-loss caveat: the installed SDK discards the
   message body (`select`/`editor`/`custom` prompts carry only `kind` + `title?`
   on the wire; for `custom` there is no title).
4. Add a `value.pi` provenance note: the client must not dispatch on
   `value.pi`; the CUSTOM `name` is the sole dispatch key.

**Do NOT change** the FLLWUP-3 §4 runtime-unreachability caveat (scoped to
`queue_update`, `bash_execution_update`, `auto_retry_*`,
`summarization_retry_*` — none of which this card makes live; skeptic O8
confirmed none exists in `PiSDKOnEvent`).

## 5. Fixture list (T1–T12; owner implements all)

| # | Fixture |
|---|---------|
| T1 | Live raise e2e: `h.emit("ui_prompt_start", {type:"ui_prompt_start", reason:"ui_prompt", kind:"confirm", title:"Allow rm -rf?"})` while live → relay receives exactly one CUSTOM `pi.human_input` with `data.kind==="confirm"` (verbatim), `data.title`, `data.promptId===fnv1a("confirm\u0000Allow rm -rf?")`, `occurrence:1`, `schemaVersion:1`, `value.pi==="ui_prompt_start"` |
| T2 | Resolved e2e (the red→green of FLLWUP-5 (b)): after T1's raise, broadcast `pi.human_input.response {promptId, occurrence:1, response:"yes"}` with production `resolvePendingPrompt:()=>false` → relay receives `pi.human_input.resolved` with exactly `{promptId, occurrence, deviceId, ts}`; the identical sequence pre-wiring yields no resolved frame |
| T3 | Occurrence counter on two identical raises → 1 then 2 |
| T4 | Title absent (`{kind:"input"}`) → frame emitted, `data.title === undefined`, `promptId === fnv1a("input\u0000")` |
| T5 | Bogus kind (`{kind:"bogus"}`) → mirroring coercion: frame emitted with `data.kind==="custom"`, registration fires (replaces owner R1 claim 4 — see §3.6) |
| T6 | Synthetic seam untouched: all 5 existing `ui.confirm` fixtures pass unmodified; guard bridge unchanged |
| T7 | Mapper shape: data keys exactly `[kind, occurrence, promptId, schemaVersion, title]`; `"prompt" in data === false` |
| T8 | Gates: `bunx tsc --noEmit` exit 0; `bun test` green on the 172 baseline + new fixtures |
| T9 | PI-SPEC: the §5.4 "fixture-green today…" sentence is gone (grep-able); the §4 FLLWUP-3 caveat unchanged |
| T10 | Close/raise symmetry: raise data = close data (`{kind, title, schemaVersion:1}`) + `promptId` |
| T11 | `forward()` collapse: the old `ui.confirm` special-case branch has 0 matches; exactly one general stamp site |
| T12 | FLLWUP-9 `@ts-expect-error` probe stays red-on-widen (compile gate) |

## 6. Gates

`bunx tsc --noEmit` exit 0; `bun test` exit 0 with the full suite green (172
baseline + new fixtures). No Mongo, no boot gate. All git work in an isolated
worktree; never on `main` directly.
