#!/usr/bin/env python3
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

"""Fetch PR metadata between two git tags via GitHub GraphQL API.

Usage:
    python3 scripts/changelog_fetch_prs.py <prev-tag> <new-tag> [--output path]

Extracts PR numbers from `git log`, batches them into GraphQL queries
(50 per batch), and writes a JSON array of {number, title, labels, author}
objects sorted by PR number.
"""

from __future__ import annotations

import argparse
import json
import operator
import os
import re
import subprocess
import sys
from typing import Any

_BATCH_SIZE = 50


def _run(cmd: list[str], **kwargs: Any) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, check=False, **kwargs)


def _validate_tag(tag: str) -> None:
    result = _run(["git", "tag", "-l", tag])
    if result.returncode != 0:
        print(f"Error: git tag lookup failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    if not result.stdout.strip():
        print(f"Error: tag '{tag}' not found", file=sys.stderr)
        sys.exit(1)


def _extract_pr_numbers(prev_tag: str, new_tag: str) -> list[int]:
    result = _run(["git", "log", "--oneline", f"{prev_tag}...{new_tag}"])
    if result.returncode != 0:
        print(f"Error running git log: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    numbers = {int(m.group(1)) for m in re.finditer(r"#(\d+)", result.stdout)}
    return sorted(numbers)


def _build_graphql_query(pr_numbers: list[int]) -> str:
    fields = []
    for pr in pr_numbers:
        fields.append(
            f'pr{pr}: repository(owner:"streamlit",name:"streamlit") '
            f"{{ pullRequest(number:{pr}) {{ "
            f"number title labels(first:10) {{ nodes {{ name }} }} "
            f"author {{ login }} "
            f"}} }}"
        )
    return "query { " + " ".join(fields) + " }"


def _parse_graphql_response(stdout: str) -> list[dict[str, Any]]:
    data = json.loads(stdout).get("data", {})
    prs = []
    for _key, repo_data in data.items():
        if repo_data is None:
            continue
        pr_data = repo_data.get("pullRequest")
        if pr_data is None:
            continue
        prs.append(
            {
                "number": pr_data["number"],
                "title": pr_data["title"],
                "labels": [
                    n["name"] for n in pr_data.get("labels", {}).get("nodes", [])
                ],
                "author": (pr_data.get("author") or {}).get("login", "ghost"),
            }
        )
    return prs


def _fetch_batch(pr_numbers: list[int]) -> list[dict[str, Any]]:
    query = _build_graphql_query(pr_numbers)
    result = _run(["gh", "api", "graphql", "-f", f"query={query}"])

    # gh returns non-zero when some PRs don't exist (e.g. issue numbers picked
    # up from commit messages).  The response still contains valid data for the
    # PRs that *do* exist, so try to parse it regardless of the exit code.
    if result.stdout.strip():
        try:
            prs = _parse_graphql_response(result.stdout)
            if result.returncode != 0:
                skipped = len(pr_numbers) - len(prs)
                if skipped:
                    print(
                        f"    {skipped} number(s) were not valid PRs (skipped)",
                        file=sys.stderr,
                    )
            return prs
        except (json.JSONDecodeError, KeyError):
            pass  # fall through to individual fetching

    # Total failure (no parseable response). Fall back to fetching one-by-one.
    print(
        f"    Batch query failed, retrying individually ({len(pr_numbers)} PRs)...",
        file=sys.stderr,
    )
    prs = []
    for pr in pr_numbers:
        single_result = _run(
            ["gh", "api", "graphql", "-f", f"query={_build_graphql_query([pr])}"]
        )
        if single_result.returncode == 0:
            prs.extend(_parse_graphql_response(single_result.stdout))
        else:
            print(f"    Skipping #{pr} (not found or error)", file=sys.stderr)
    return prs


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch PR metadata between two git tags"
    )
    parser.add_argument("prev_tag", help="Previous release tag")
    parser.add_argument("new_tag", help="New release tag")
    parser.add_argument(
        "--output", default="work-tmp/pr-data.json", help="Output JSON path"
    )
    args = parser.parse_args()

    _validate_tag(args.prev_tag)
    _validate_tag(args.new_tag)

    print(f"Extracting PR numbers from {args.prev_tag}...{args.new_tag}")
    pr_numbers = _extract_pr_numbers(args.prev_tag, args.new_tag)
    print(f"Found {len(pr_numbers)} PRs")

    if not pr_numbers:
        print("No PRs found between the given tags.")
        sys.exit(0)

    # Batch into groups of _BATCH_SIZE
    batches = [
        pr_numbers[i : i + _BATCH_SIZE] for i in range(0, len(pr_numbers), _BATCH_SIZE)
    ]
    print(f"Fetching metadata in {len(batches)} batch(es)...")

    all_prs = []
    for i, batch in enumerate(batches, 1):
        print(f"  Batch {i}/{len(batches)} ({len(batch)} PRs)")
        all_prs.extend(_fetch_batch(batch))

    all_prs.sort(key=operator.itemgetter("number"))

    # Ensure output directory exists
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(all_prs, f, indent=2)

    print(f"Wrote {len(all_prs)} PRs to {args.output}")


if __name__ == "__main__":
    main()
