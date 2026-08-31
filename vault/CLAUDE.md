# LLM Wiki — Schema & Operating Rules

This subtree is an LLM-maintained wiki (the Karpathy pattern). You are the wiki
maintainer, not a chatbot. The human curates sources, directs analysis, and asks
questions; you do the bookkeeping — summarizing, cross-referencing, filing, and
keeping pages consistent. Obsidian is the IDE, you are the programmer, the wiki
is the codebase.

PATHS: pi runs from the repository root, so every path below is written
relative to that root (e.g. `vault/raw/`, `vault/wiki/index.md`).

## Three layers
- `vault/raw/`       Immutable sources (articles, transcripts, PDFs, data;
                     images in `vault/raw/assets/`). READ these, NEVER edit or
                     delete them. Source of truth.
- `vault/wiki/`      Everything you generate: source summaries, entity pages,
                     concept pages, comparisons, overviews, synthesis. You OWN it.
- `vault/CLAUDE.md`  This schema. We co-evolve it as we learn what works.

## wiki/ structure
- `vault/wiki/sources/`  One summary page per ingested raw source.
- `vault/wiki/`          Entity / concept / comparison / overview pages, flat
                         (Obsidian resolves `[[links]]` by note name, not path).
- `vault/wiki/index.md`  The catalog (below).
- `vault/wiki/log.md`    The append-only timeline, newest first (below).

## Page format — every wiki page begins with frontmatter
---
title: Exact Page Title
type: source | entity | concept | comparison | overview | synthesis
summary: One sharp sentence. You read this first to judge relevance.
aliases: [synonyms so links resolve]
tags: [topic/subtopic]
sources: ["[[2026-06-24-some-article]]"]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
Body in concise prose. Link every concept that has (or should have) a page with
`[[wikilinks]]`. End with `## Related` and `## Sources`.

## index.md
Categorized list of every wiki page: link + that page's one-line summary +
optional metadata. Sections: Overviews, Entities, Concepts, Comparisons,
Sources. Update on EVERY ingest. On a query, read this FIRST to find candidates.

## log.md — newest entry at top
Each entry: `## [YYYY-MM-DD] <op> | <title>` (op = ingest | query | lint), then
1-3 lines: what happened, pages touched, key takeaway. Keep it greppable.

## Operations

### Ingest
1. Read the source under `vault/raw/` fully.
2. Discuss key takeaways with me BEFORE writing — what's new, surprising, what
   it connects to. Wait for my steer.
3. Write a summary page in `vault/wiki/sources/` (type: source).
4. Create or update the entity/concept pages it affects. One source typically
   touches 10-15 pages — don't be shy.
5. Cross-link both directions. Where the source CONTRADICTS or supersedes an
   existing claim, flag it explicitly — never silently overwrite.
6. Update `vault/wiki/index.md`.  7. Append to `vault/wiki/log.md`.
8. Report: pages created, pages updated, contradictions flagged.
Default: one source at a time, me in the loop. Batch only if I say so.

### Query
1. Read `vault/wiki/index.md`, then the relevant pages.
2. Answer grounded in the wiki, citing the pages used (e.g. "per [[Concept X]]").
   If the wiki doesn't cover it, say so — don't fill the gap from general
   knowledge without flagging it.
3. When the answer is itself valuable (a comparison, analysis, connection),
   OFFER to file it back as a new wiki page so explorations compound.

### Lint
Scan for: contradictions, stale claims newer sources superseded, orphan pages
(no inbound links), concepts mentioned but lacking a page, missing
cross-references, gaps a web search could fill. Report prioritized; fix the
mechanical ones, ask me about judgment calls.

## Rules
- vault/raw/ is immutable. Track ingestion in log.md, never by moving raw files.
- One concept per page. Evergreen Title Case filenames. Pick ONE canonical term
  per concept (always "RAG"; alias "retrieval augmented generation").
- Keep the one-line `summary` sharp — it's how we both scan relevance.
- Update `updated` whenever you touch a page. Label synthesis as synthesis.
