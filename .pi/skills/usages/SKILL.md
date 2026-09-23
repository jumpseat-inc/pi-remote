---
name: usages
description: Report per-seat and main-agent token/dollar usage for a pi-council repository over a time range, cross-matched against OpenRouter billed activity. Use when the user runs /usages or asks what the council cost.
---

# Usages report

Report what this repository's pi/council workflow cost over a time range:
token volumes and dollar values per council seat and per main-agent session,
cross-matched against OpenRouter's billed activity.

## Precondition

`OPENROUTER_MANAGEMENT_KEY` must be set. If it is not, stop and tell the user
to mint a *provisioning* key at OpenRouter → Settings → Keys → "Provisioning
key", then `export OPENROUTER_MANAGEMENT_KEY=sk-or-…` in the environment that
launches pi. Never substitute `OPENROUTER_API_KEY`.

## Run

```bash
python3 .pi/skills/usages/scripts/usages.py --range "last 30 days"
```

The range argument accepts English and ISO forms: `today`, `yesterday`,
`last 30 days`, `last 2 weeks`, `this month`, `last month`,
`2026-09-01`, `2026-09-01 to 2026-09-15`. Ranges longer than 30 days are
split into ≤30-day windows; windows older than 30 completed UTC days carry
exact generation figures but no account-activity reconciliation.

## Outputs

- `.pi/council/usages/usages-<start>_<end>.json` — the machine-readable report.
- `.pi/council/usages/usages-<start>_<end>.md` — the same data, rendered.
- `.pi/council/usages/.cache.json` — immutable per-generation figures, so
  reruns are cheap.

The directory is gitignored.

## Basis legend

- `exact` — the provider-reported charge for that generation.
- `catalogue-estimate` — pi's catalogue rates, not a bill.
- `interpolated` — derived or split; the reason is named in `limitations`.

Surface the tool's printed summary verbatim; never re-derive or paraphrase
dollar figures.