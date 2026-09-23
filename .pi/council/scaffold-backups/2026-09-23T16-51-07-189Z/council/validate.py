#!/usr/bin/env python3
r"""Validate the Council's durable state under council/.

Checks every card in council/cards/ against:
  - required frontmatter keys
  - id pattern ^(EV|FLLWUP|BUG|EPIC)-[1-9]\d*$, matching the filename
  - state in the allowed set
  - goal present and containing no colon-space sequence (frontmatter is
    parsed as plain `key: value` lines, so a `: ` truncates the value)
  - board.md contains exactly one `- <ID> — <Title>` line per card, under
    the column matching its state, with an em dash (U+2014)
  - board.md contains no orphan lines (entries with no matching card)

Exits non-zero and prints a FAIL: line per finding. Prints
`All council artifacts valid` only when clean.

Run from the repo root: `python3 council/validate.py`.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "council" / "cards"
BOARD = ROOT / "council" / "board.md"

ID_RE = re.compile(r"^(EV|FLLWUP|BUG|EPIC)-[1-9]\d*$")
STATE_COLUMNS = [
    "Backlog",
    "Ready",
    "Deliberating",
    "In Progress",
    "In Review",
    "Needs Human",
    "Done",
]
REQUIRED_KEYS = ["id", "title", "state", "owner", "epic", "goal"]

failures = []


def fail(msg: str) -> None:
    failures.append(msg)


def parse_frontmatter(text: str) -> dict:
    """Parse plain `key: value` frontmatter, stopping at a value truncation."""
    meta = {}
    if not text.startswith("---"):
        return meta
    lines = text.splitlines()
    # skip leading ---
    i = 1
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ": " in line:
            key, value = line.split(": ", 1)
            meta[key.strip()] = value.strip()
        elif line.strip():
            # a bare non-`key: value` line ends frontmatter per convention
            break
        i += 1
    return meta


def board_columns(board_text: str) -> dict:
    """Map each board '- <ID> — ...' entry to the ## column it sits under.

    Returns {card_id: [column, ...]} — a list, so a duplicated entry keeps
    every column it appears in rather than silently keeping one.
    """
    columns: dict = {}
    current = None
    for line in board_text.splitlines():
        if line.startswith("## "):
            current = line[3:].strip()
            continue
        stripped = line.strip()
        if stripped.startswith("- "):
            m = re.match(r"^- ([A-Z]+-\d+) — ", stripped)
            if m:
                columns.setdefault(m.group(1), []).append(current)
    return columns


def main() -> int:
    board_text = ""
    if not BOARD.exists():
        fail(f"missing board file: {BOARD}")
    else:
        board_text = BOARD.read_text()
    board_cols = board_columns(board_text)

    card_files = sorted(CARDS.glob("*.md")) if CARDS.exists() else []
    card_ids = set()
    seen_in_board = set()

    for path in card_files:
        if path.name == "_template.md":
            continue
        text = path.read_text()
        meta = parse_frontmatter(text)
        cid = meta.get("id")
        card_ids.add(cid)
        fname = path.stem

        if cid != fname:
            fail(f"{fname}: frontmatter id {cid!r} does not match filename {fname!r}")
        for key in REQUIRED_KEYS:
            if key not in meta:
                fail(f"{fname}: missing required key '{key}'")
                continue
        if not cid or not ID_RE.match(cid):
            fail(f"{fname}: id {cid!r} does not match {ID_RE.pattern}")
            continue

        state = meta.get("state")
        if state not in STATE_COLUMNS:
            fail(f"{cid}: state {state!r} not in {STATE_COLUMNS}")
        goal = meta.get("goal")
        if goal is not None and ": " in goal:
            fail(f"{cid}: goal contains a colon-space sequence (value truncates)")
        title = meta.get("title")

        # board presence: exactly one line under its state column
        marker = f"- {cid} — {title}"
        occurrence = board_text.count(marker) if title else 0
        if occurrence == 0:
            fail(f"{cid}: no board line '{marker}'")
        elif occurrence > 1:
            fail(f"{cid}: board line appears {occurrence} times (should be once)")
        else:
            # column agreement: the line must sit under the ## section named
            # by the card's frontmatter state (FLLWUP-9 — the docstring
            # promised this; the count alone let board/state drift silently)
            found = board_cols.get(cid, [None])[0]
            if state in STATE_COLUMNS and found != state:
                fail(
                    f"{cid}: board line sits under column {found!r} "
                    f"but frontmatter state is {state!r}"
                )
        seen_in_board.add(cid)

    # orphan board lines — entries with no matching card file
    if BOARD.exists():
        for line in BOARD.read_text().splitlines():
            line = line.strip()
            if not line.startswith("- "):
                continue
            m = re.match(r"^- ([A-Z]+-\d+) — ", line)
            if not m:
                fail(f"board line not in '<ID> — <Title>' form: {line!r}")
                continue
            bid = m.group(1)
            if bid not in card_ids:
                fail(f"board entry {bid} has no matching card file")

    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        sys.exit(1)
    print("All council artifacts valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
