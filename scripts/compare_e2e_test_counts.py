# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A script to compare collected E2E test IDs between two revisions.

Usage:
    python scripts/compare_e2e_test_counts.py --base BASE_IDS --head HEAD_IDS
        [--threshold 30] [--output summary.json]

Both inputs are files containing the test IDs printed by
`pytest --collect-only -q`, one per line, e.g.:

    st_dialog_test.py::test_dialog_displays_correctly[chromium]

The script diffs the two sets of test IDs and prints a JSON summary to stdout
(or to --output), including a ready-to-post Markdown comment body. Because it
compares test IDs rather than plain totals, it reports what a PR actually
changed even when tests were renamed or moved, and it can attribute the change
to individual test files.

Node IDs come from a `--collect-only` run, so the counts include every browser
parametrization (a single new test function adds one test case per browser).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Final, NamedTuple

# Comment marker used to find and update our own comment on a PR.
COMMENT_MARKER: Final = "<!-- STREAMLIT-E2E-TEST-COUNT-CHECK -->"

# Maximum number of test files listed in the per-file breakdown table.
MAX_LISTED_FILES: Final = 10


class TestIds(NamedTuple):
    """A collected set of test IDs, indexed for comparison."""

    # Full test IDs, one per browser parametrization.
    cases: set[str]
    # Test IDs without their parameters, i.e. one entry per test function.
    functions: set[str]
    # Number of test cases per test file.
    per_file: Counter[str]


def parse_test_ids(path: Path) -> TestIds:
    """Read a `pytest --collect-only -q` output file into a `TestIds`."""
    cases = {
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        # Anything without "::" is a summary line ("6084 tests collected") or
        # a warning, not a test ID.
        if "::" in line
    }

    return TestIds(
        cases=cases,
        # Parameters start at the first "[", e.g. "…::test_foo[chromium-wide]".
        functions={case.split("[", 1)[0] for case in cases},
        per_file=Counter(case.split("::", 1)[0] for case in cases),
    )


def _format_delta(delta: int) -> str:
    """Format a change as a signed number, e.g. "+12" or "-3"."""
    return f"{delta:+d}"


def _build_file_table(base: TestIds, head: TestIds) -> list[str]:
    """Build a Markdown table of the test files whose test count changed."""
    # `Counter.__sub__` keeps only positive counts, so subtract in both
    # directions to catch the files that gained and that lost test cases.
    gained = head.per_file - base.per_file
    lost = base.per_file - head.per_file
    changed = {**gained, **{file: -count for file, count in lost.items()}}

    if not changed:
        return []

    # Largest increases first; the files a reviewer most likely cares about.
    ranked = sorted(changed.items(), key=lambda item: (-item[1], item[0]))
    listed = ranked[:MAX_LISTED_FILES]

    lines = ["", "| Test file | Test cases |", "| --- | --- |"]
    lines += [f"| `{file}` | {_format_delta(delta)} |" for file, delta in listed]

    if len(ranked) > len(listed):
        lines.append("")
        lines.append(f"…and {len(ranked) - len(listed)} more test files.")

    return lines


def _build_comment(
    base: TestIds,
    head: TestIds,
    threshold: int,
    base_ref: str | None,
) -> tuple[str, bool]:
    """Build the PR comment body. Returns the body and whether it's significant.

    A change counts as significant when the PR adds more test cases than the
    threshold allows; that is the only case that warrants a new comment.
    """
    net_change = len(head.cases) - len(base.cases)
    new_functions = len(head.functions - base.functions)
    is_significant = net_change > threshold

    if is_significant:
        header = "### 🧪 Significant E2E test count increase detected"
        message = (
            f"This PR adds **{net_change} E2E test cases** (threshold: {threshold})"
        )
    else:
        header = "### ✅ E2E test count change is within normal range"
        if net_change == 0:
            message = "This PR does **not change** the number of E2E test cases"
        elif net_change > 0:
            message = f"This PR adds **{net_change} E2E test cases**"
        else:
            message = f"This PR removes **{abs(net_change)} E2E test cases**"

    # Only when the count grew: "removes 5 test cases, from 2 new test
    # functions" would read as a contradiction.
    if new_functions and net_change > 0:
        message += (
            f", from {new_functions} new test "
            f"{'function' if new_functions == 1 else 'functions'} "
            "(each test runs once per browser)"
        )

    base_label = f" (`{base_ref}`)" if base_ref else ""
    lines = [
        COMMENT_MARKER,
        header,
        "",
        f"{message}.",
        "",
        f"- Merge base{base_label}: {len(base.cases)} test cases",
        f"- This PR: {len(head.cases)} test cases",
        *_build_file_table(base, head),
    ]

    if is_significant:
        lines += [
            "",
            (
                "> ⚠️ **Note:** E2E tests are expensive to run. Please ensure "
                "you're following best practices:"
            ),
            "> - Prefer aggregated scenario tests over many micro-tests",
            "> - Add tests to existing files when they fit the scope",
            "> - Test each aspect only once per browser run",
        ]

    return "\n".join(lines), is_significant


def compare(
    base_path: Path,
    head_path: Path,
    threshold: int,
    base_ref: str | None = None,
) -> dict[str, Any]:
    """Compare two collected test ID files and summarize the difference."""
    base = parse_test_ids(base_path)
    head = parse_test_ids(head_path)

    if not base.cases or not head.cases:
        raise ValueError(
            "Collected no test IDs for "
            f"{'the merge base' if not base.cases else 'this PR'}. "
            "The pytest collection step probably failed."
        )

    body, is_significant = _build_comment(base, head, threshold, base_ref)

    return {
        "marker": COMMENT_MARKER,
        "body": body,
        "is_significant": is_significant,
        "threshold": threshold,
        "base_total": len(base.cases),
        "head_total": len(head.cases),
        "net_change": len(head.cases) - len(base.cases),
        # Renames and moves show up as an addition and a removal, so these do
        # not have to add up to net_change.
        "added_cases": len(head.cases - base.cases),
        "removed_cases": len(base.cases - head.cases),
        "new_functions": sorted(head.functions - base.functions),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base",
        type=Path,
        required=True,
        help="File with the test IDs collected at the merge base.",
    )
    parser.add_argument(
        "--head",
        type=Path,
        required=True,
        help="File with the test IDs collected on the PR branch.",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=30,
        help="Number of added test cases that is still considered normal.",
    )
    parser.add_argument(
        "--base-ref",
        default=None,
        help="Merge base revision, shown in the comment for traceability.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write the JSON summary to this file instead of stdout.",
    )
    args = parser.parse_args()

    try:
        summary = compare(args.base, args.head, args.threshold, args.base_ref)
    except (OSError, ValueError) as error:
        # A traceback adds nothing here: the interesting failure is upstream, in
        # the collection step whose output we were handed.
        sys.exit(f"Cannot compare E2E test counts: {error}")

    serialized = json.dumps(summary, indent=2)

    if args.output:
        args.output.write_text(serialized, encoding="utf-8")

    # Always log the summary so the numbers are visible in the job logs, even
    # when no comment gets posted.
    print(serialized, file=sys.stdout)


if __name__ == "__main__":
    main()
