# Duplicated message-family role decoder — tracking record (FLLWUP-37)

Status: **tracked duplication, intentionally retained.** This document records
where the duplication lives, why it exists, what pins it, and exactly what its
removal would involve. It does **not** request, schedule, or authorize removal:
lifting the constraint that forces the duplication (G-12) is steward authority
and out of scope for FLLWUP-37.

## What is duplicated

The message-family role decoder — back-deriving `"assistant" | "user"` from a
`<role>:<timestamp>` messageId — exists twice:

| Side | Symbol | File | Role |
| --- | --- | --- | --- |
| Shared (mint + decode) | `messageFrameRole` (exported) | `src/pi-sdk-events.ts` (~line 167) | Decodes ids minted by `agentMessageId` (~line 156), which gates on `roleOfAgentMessage` (~line 142). |
| Local (decode only) | `messageFrameRoleLocal` (private) | `src/translate.ts` (~line 254) | Same decoding rule, copied into the pure translate fold. |

Both bodies are character-for-character the same rule:

```ts
const idx = messageId.indexOf(":");
if (idx <= 0) return undefined;
const role = messageId.slice(0, idx);
return role === "assistant" || role === "user" ? role : undefined;
```

The duplication was introduced by FLLWUP-12, which vendored the real payload
interfaces and derivation helpers into `src/pi-sdk-events.ts` (per R-TYPE-1)
while `src/translate.ts` already carried the decoder for its mid-join fold
path (`translate.ts` calls `messageFrameRoleLocal` at ~line 433 when a
`message_update` arrives with no prior `message_start`).

## Why it exists

G-12 (purity rule, enforced by the static guard test
"static guard: no socket/session/transport module imports in translate.ts
(G-12)" in `test/translate.test.ts`): `src/translate.ts` must contain **no
runtime imports** — it brings in type definitions only. Importing
`messageFrameRole` from `src/pi-sdk-events.ts` at runtime would violate G-12,
so the decode rule is copied locally. The local copy's doc comment states this
and carries a cross-reference back to this document.

## What pins the pairing today

`test/translate.test.ts` — test "FLLWUP-12 static pairing: translate.ts
messageFrameRoleLocal decodes pi-sdk-events.ts agentMessageId ids (G-12 keeps
them separate, so pin both directions)" (~line 428) performs a static
source-text pairing of both sides. It pins exactly two things:

- **Derivation-text presence**: both files must contain the
  `messageId.indexOf(":")` derivation text.
- **Role vocabulary within the signature windows**: the 400-character slice
  anchored at `export function messageFrameRole` (pi-sdk-events.ts) and at
  `function messageFrameRoleLocal` (translate.ts) must each contain
  `"assistant"` and `"user"` and must not contain `"system"` /
  `"toolResult"`.

The test does **not** pin the value-level decode comparison itself. The
signature windows include the return-type annotation
(`): "assistant" | "user" | undefined {`), so the vocabulary assertions are
satisfied by the type annotation regardless of what the body's decode
comparison allows. This is a demonstrated false-green, not a hypothetical:
dropping `"user"` from the decode comparison in `messageFrameRoleLocal`
(`return role === "assistant" ? role : undefined;`) leaves the full suite
green (273 pass / 1 skip / 0 fail, EV-69). A silent regression in the decode
rule can therefore pass every gate in this repository. The pairing test is a
textual-drift tripwire for the derivation text and role vocabulary, not a
behavioral guard on the decode rule.

Do not weaken this test while the duplication exists — but do not rely on it
to catch value-level decode drift either; it will not.

## Removal scope (if G-12 is ever lifted)

This is a statement of scope, not a plan or an approval. If the steward lifts
G-12 for `src/translate.ts`, removal of the duplication would consist of:

1. **Delete** `messageFrameRoleLocal` from `src/translate.ts` — the function
   and its doc comment (the comment cites FLLWUP-12 and the lockstep
   requirement; both become obsolete with the copy).
2. **Retarget the single call site** (`translate.ts`, ~line 433:
   `messageFrameRoleLocal(input.messageId)`) to the shared export
   `messageFrameRole` from `src/pi-sdk-events.ts`.
3. **Retire the pairing test** — the FLLWUP-12 static pairing test in
   `test/translate.test.ts` pins two separate copies of one rule; once the
   decoder exists once, it has nothing left to pin and should be removed with
   the duplication it guarded (not left failing, not silently kept as a
   no-op).
4. **Update this document** to record that the duplication was removed, or
   delete it.

Nothing else is in scope: `roleOfAgentMessage` and `agentMessageId`
(pi-sdk-events.ts) are the minting side, stay put, and are unaffected. G-12's
own guard test is steward business and is not touched by a decoder removal
except as a consequence of whatever form the lift takes.
