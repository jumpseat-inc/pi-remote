---
id: EV-6
title: "Remote input injection"
state: Ready
owner: null
epic: EPIC-1
goal: inject.ts converts inbound AG-UI user-message frames into pi.sendUserMessage calls with the correct deliverAs mode for idle, mid-stream, and queued input, and resolves pending human-input prompts with the sending deviceId recorded.
---

## Intent

Implements §5.4 in `src/inject.ts`. Remote input must be indistinguishable
from typed input in the session log — the extension does not filter or
transform its own injections — which is what makes EV-5's replay correct by
construction. User-visible surface — on the host, an injected remote prompt
appears in the transcript like typed input; on the remote client, an approval
prompt raised by the session (CUSTOM `pi.human_input`) can be resolved from
the device, and that resolution carries the approving `deviceId` for audit.

## Acceptance

- A prompt sent while idle starts a run identical in effect to typing it
  locally; the `input` event shows `source: "extension"` and the JSONL record
  is indistinguishable from a typed message.
- A prompt sent mid-stream arrives as a steer; one sent during an active run
  with queue intent arrives as a followUp (verified against pi's actual
  delivery behavior).
- Resolving a pending approval via `pi.human_input` unblocks the waiting
  session and the resolution is tagged with the sending deviceId; when the
  mode does not support direct resolution, the reply is surfaced as a
  steering message instead of being dropped.
