---
id: FLLWUP-1
title: "Sync README with the OAuth2 enrollment reality"
state: Ready
owner: null
epic: EPIC-1
goal: README.md no longer references PI_REMOTE_HOST_KEY or env-var-based enrollment and documents /rc:login OAuth2 enrollment as the setup path, matching the spec as rewritten by EV-1.
---

## Intent

Filed from EV-1's step 13 (objection O-13, closed-green, out of EV-1's
docs-only scope). EV-1 retired `PI_REMOTE_HOST_KEY` entirely (product-owner
ruling Q1, binding) and made settings-based OAuth2 enrollment the setup path,
but README.md line 93 still presents the old env-var setup. User-visible
surface — the README's setup section, the first thing a new host operator
reads; it currently instructs a setup path that no longer exists.

## Acceptance

- No occurrence of `PI_REMOTE_HOST_KEY` anywhere in README.md.
- The README's setup section names `/rc:login` (attended and unattended) as
  the enrollment path and matches docs/PI-SPEC.md §7.2's post-EV-1 text.
- Any other README prose contradicting the rewritten spec (command names,
  footer states) is brought in line in the same pass.
