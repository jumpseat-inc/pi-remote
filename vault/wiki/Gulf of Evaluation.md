---
title: Gulf of Evaluation
type: concept
summary: The designer seat's standing lens — can the user perceive what state the system is in without archaeology? — cited in nearly every surface-touching design position.
aliases: [gulf-of-evaluation]
tags: [concept/design, doctrine]
sources: ["[[EV-7 Design Position r1]]", "[[EV-8 Design Position r1]]", "[[EV-6 Design Position]]", "[[FLLWUP-7 Design Position r2]]", "[[BUG-2 Run]]"]
created: 2026-09-02
updated: 2026-09-27
---
Every design-position doc carries a "Gulf closed" section: which user misperception this change eliminates. **Attribution:** the lens is Don Norman's Gulf of Evaluation, from *The Design of Everyday Things* (1986/2013) — borrowed as a design instrument, not a source the corpus depends on. Applied consistently, it decided:

- A stated sentence beats a glyph ack — "already connected" must be readable as a state, not inferred from silence (EV-2 Item 3).
- The 403 row must not collapse into the 401 row — a driver who cannot be helped by re-consent must not be sent around the loop again (EV-2 Item 1).
- `message_end` gets its own §4 row — a boundary event a reader must infer from another row's note is a doc-level Gulf failure (FLLWUP-6 form (a)).
- The failure notice must say "nothing was saved" — fail-closed behavior the user cannot otherwise perceive (FLLWUP-7 r2).
- Replay is a snapshot and live frames continue — clients that never process post-replay live frames are broken for every lifecycle frame, not just one (FLLWUP-5 J-REPLAY).
- A finished login must not still show `Authorizing with the control plane…` under `Off`. The [[BUG-2 Run]] closed that gulf without changing copy or the footer machine: the old sentence was leftover redraw from `console.log` in the prompt box, not a state the user was meant to read ([[Notify Sink]]). No `designer` sat — the card had already named the sink — but the lens still applies.

The doctrine pairs with [[Copy Honesty Doctrine]]: the Gulf lens decides *what the user needs to perceive*; copy honesty decides *what the line is allowed to promise*. Where the line is painted is a third question, answered by [[Notify Sink]], not by either of those.

## Related
[[Copy Honesty Doctrine]], [[Notify Sink]], [[Closed Vocabulary Discipline]], [[EV-8 Design Position r1]], [[FLLWUP-7 Design Position r2]]

## Sources
[[EV-6 Design Position]], [[EV-7 Design Position r1]], [[EV-7 Design Position r2]], [[EV-8 Design Position r1]], [[FLLWUP-7 Design Position r2]], [[BUG-2 Run]]
