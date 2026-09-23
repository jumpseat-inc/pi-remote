#!/usr/bin/env python3
r"""Validate the Council's durable state under council/.

Checks every card in council/cards/ against:
  - required frontmatter keys
  - id pattern ^(EV|FLLWUP|BUG|EPIC)-[1-9]\d*$, matching the filename
  - state in the allowed set
  - goal present on a single line and last in the block; the value is
    everything after the first `: ` of the line, edge-whitespace-trimmed —
    a colon-space inside the value does not truncate, and the judge reads
    the same text. The loader refuses (named FAIL, not a silent green):
    a wrapped goal, a key-shaped line after `goal:`, a non-`key: value`
    line inside the block, and an unclosed block. A not-`key: value`
    line's diagnostic names both a wrapped/continued value and a missing
    closing `---` because the parser cannot tell them apart.
  - board.md contains exactly one `- <ID> — <Title>` line per card, under
    the column matching its state, with an em dash (U+2014)
  - board.md contains no orphan lines (entries with no matching card)
  - gate policy pre-registration: council/gate/policy.json's policyVersion
    must have a matching entry in council/gate/registrations.jsonl (a
    version moved with no pre-registration record is a threshold moved by
    taste). No policy.json, nothing to pre-register (seed/scaffold trees).
    A torn registrations line or an unreadable policy.json is a named FAIL,
    never a traceback or a silent skip.

Exits non-zero and prints a FAIL: line per finding. Prints
`All council artifacts valid` only when clean.

Run from the repo root: `python3 council/validate.py`.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "council" / "cards"
BOARD = ROOT / "council" / "board.md"
GATE_POLICY = ROOT / "council" / "gate" / "policy.json"
GATE_REGISTRATIONS = ROOT / "council" / "gate" / "registrations.jsonl"

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


class FrontmatterError(Exception):
    """A structural frontmatter failure (see parse_frontmatter for the
    grammar). Carries the failing line's number and text, plus the keys
    parsed before the failure, so main() can keep reporting missing keys
    and board drift from the partial metadata instead of losing the whole
    card's report.
    """

    def __init__(self, message, line_no=None, line_text=None, partial_meta=None):
        super().__init__(message)
        self.line_no = line_no
        self.line_text = line_text
        self.partial_meta = partial_meta if partial_meta is not None else {}


def parse_frontmatter(text: str) -> dict:
    """Parse plain `key: value` frontmatter, refusing a structurally broken
    leading block instead of silently truncating it.

    Grammar: the leading block (after the opening `---`) is a run of
    `key: value` lines — the first `: ` of a line splits key from value,
    edge whitespace is trimmed, and colons/colon-spaces inside the value
    are literal characters — terminated by a closing `---`. The value ends
    at a line break (never wrap a value onto a second line); a line without
    the `key: value` shape inside the block is a parse error, not a block
    terminator.

    Three structural rules raise FrontmatterError:

      - Positional rule: once a `goal` key has been seen, only blank lines
        and the closing `---` may follow. A wrapped goal continuation
        parses as a key, so a key-shaped line after `goal:` is refused.
      - A non-blank line that is not `key: value`-shaped is refused. The
        diagnostic names both a wrapped/continued value and a missing
        closing `---` because they are indistinguishable inside the scan.
      - A block never terminated by `---` (EOF reached) is refused with a
        distinct "not closed" message. It is naturally suppressed when the
        bare-line rule already fired — that raise never returns.

    Scope is the leading block only: the scan stops at the first closing
    `---`, so body-embedded fences are never parsed.
    """
    meta = {}
    if not text.startswith("---"):
        return meta
    lines = text.splitlines()
    seen_goal = False
    closed = False
    # skip leading ---; physical line numbers start at 2
    for line_no, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            closed = True
            break
        if ": " in line:
            key, value = line.split(": ", 1)
            key = key.strip()
            if seen_goal:
                raise FrontmatterError(
                    f"frontmatter line {line_no} '{line.strip()}' comes after "
                    "'goal' — a wrapped goal continuation parses as a key; "
                    "keep the goal on one line, and keep goal last in the block.",
                    line_no=line_no,
                    line_text=line.strip(),
                    partial_meta=dict(meta),
                )
            meta[key] = value.strip()
            if key == "goal":
                seen_goal = True
        elif line.strip():
            raise FrontmatterError(
                f"frontmatter line {line_no} '{line.strip()}' is not "
                "'key: value' — a wrapped/continued value, or the closing "
                "'---' is missing (a line break ends the value; keep the "
                "goal on one line).",
                line_no=line_no,
                line_text=line.strip(),
                partial_meta=dict(meta),
            )
    if not closed:
        raise FrontmatterError(
            "frontmatter block is not closed — the closing '---' is missing "
            "(a line break ends the value; keep each key on one line).",
            partial_meta=dict(meta),
        )
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


def check_gate_registrations() -> None:
    """Every gate policy version needs a pre-registration record (EV-72).

    The FAIL line carries the remedy inline — it names the version, where
    the entry is added, and what the entry must name — so the maintainer is
    never sent to open another file to learn what to do.
    """
    if not GATE_POLICY.exists():
        return  # no gate policy → nothing to pre-register
    try:
        policy = json.loads(GATE_POLICY.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        fail(f"council/gate/policy.json is not readable JSON: {exc}")
        return
    if not isinstance(policy, dict) or not policy.get("policyVersion"):
        fail("council/gate/policy.json has no policyVersion — name the policy version to pre-register it")
        return
    version = policy["policyVersion"]
    registered = False
    if GATE_REGISTRATIONS.exists():
        for line_no, line in enumerate(GATE_REGISTRATIONS.read_text().splitlines(), start=1):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                fail(
                    f"council/gate/registrations.jsonl line {line_no} {line.strip()!r} is not "
                    f"valid JSON ({exc}) — one JSON object per line; fix or remove the torn line"
                )
                continue
            if isinstance(entry, dict) and entry.get("policyVersion") == version:
                registered = True
    if not registered:
        fail(
            f"gate policy version {version} has no pre-registration record in "
            "council/gate/registrations.jsonl \u2014 add an entry naming that version, "
            "the coefficient or floor that changed, and the ledger evidence that motivated it"
        )


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
        fname = path.stem
        meta = {}
        try:
            meta = parse_frontmatter(text)
        except FrontmatterError as exc:
            # one structural FAIL per card; downstream checks below run
            # against the partial metadata so the missing-key class and
            # board checks still report
            fail(f"{fname}: {exc}")
            meta = exc.partial_meta
        cid = meta.get("id")
        card_ids.add(cid)

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

    check_gate_registrations()

    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        sys.exit(1)
    print("All council artifacts valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
