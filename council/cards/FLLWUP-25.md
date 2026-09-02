---
id: FLLWUP-25
title: "Surface the device-flow token endpoint's error_description in login failure output"
state: Backlog
owner: null
epic: EPIC-2
goal: When a device-flow token poll or exchange fails with an error_description, the /rc:login failure output includes that server-provided description, so the user sees why the identity provider refused rather than only the client's generic failure line.
---

## Intent

Filed from FLLWUP-22's deferred items (the §2.3 poll-shape fix, PR #26, left
this deliberately out of its boundary). The driver currently ignores the
`error_description` field that OAuth2 servers provide alongside `error` — the
user sees the client's generic failure line with no hint of the IdP's actual
reason (e.g. scope mismatch vs account issue). Touches verbatim-ruled
user-visible copy, so it needs a product-owner copy ruling before its
deliberation (the [[Copy Honesty Doctrine]] cuts both ways: honest about the
server's reason, without over-promising what the user can fix, and never
printing untrusted server text unescaped into the terminal).

## Acceptance

- The failure output includes the server's `error_description` when present,
  rendered safely (no unescaped control characters or terminal-escape
  sequences from server text).
- Absent `error_description`, output is unchanged from the ruled lines.
- The product-owner copy ruling (which exact line format, and the safety
  rules) precedes implementation and is recorded on the card.
- Fixtures cover present, absent, and hostile `error_description` values;
  bunx tsc --noEmit exit 0; bun test full suite green.
