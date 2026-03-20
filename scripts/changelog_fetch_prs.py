#!/usr/bin/env python
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
    python scripts/changelog_fetch_prs.py <prev-tag> <new-tag> [--output path]

Extracts PR numbers from `git log`, batches them into GraphQL queries
(50 per batch), and writes a JSON array of
{number, title, labels, author, related_issues, related_issues_truncated}
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


def _is_pr_not_found_error(stderr: str) -> bool:
    return "Could not resolve to a PullRequest" in stderr


def _validate_tag(tag: str) -> None:
    result = _run(["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag}"])
    if result.returncode != 0:
        print(
            f"Error: tag '{tag}' not found or invalid: {result.stderr}", file=sys.stderr
        )
        sys.exit(1)


def _extract_pr_numbers(prev_tag: str, new_tag: str) -> list[int]:
    result = _run(["git", "log", "--oneline", f"{prev_tag}..{new_tag}"])
    if result.returncode != 0:
        print(f"Error running git log: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    numbers = {int(m.group(1)) for m in re.finditer(r"\(#(\d+)\)", result.stdout)}
    return sorted(numbers)


def _build_graphql_query(pr_numbers: list[int]) -> str:
    fields = []
    for pr in pr_numbers:
        fields.append(
            f"pr{pr}: pullRequest(number:{pr}) {{ "
            f"number title labels(first:100) {{ nodes {{ name }} }} "
            f"author {{ login }} "
            f"closingIssuesReferences(first:10) {{ "
            f"nodes {{ number reactions(content:THUMBS_UP) {{ totalCount }} }} "
            f"pageInfo {{ hasNextPage }} "
            f"}} "
            f"}}"
        )
    return (
        'query { repository(owner:"streamlit",name:"streamlit") { '
        + " ".join(fields)
        + " } }"
    )


def _parse_graphql_response(stdout: str) -> list[dict[str, Any]]:
    data = json.loads(stdout).get("data", {}) or {}
    repo_data = data.get("repository") or {}
    prs = []
    for _alias, pr_data in repo_data.items():
        if pr_data is None:
            continue

        closing_issues = pr_data.get("closingIssuesReferences") or {}
        related_issues = []
        for issue in closing_issues.get("nodes", []):
            if issue is None:
                continue
            related_issues.append(
                {
                    "number": issue.get("number"),
                    "thumbs_up": (issue.get("reactions") or {}).get("totalCount", 0),
                }
            )

        prs.append(
            {
                "number": pr_data["number"],
                "title": pr_data["title"],
                "labels": [
                    n["name"] for n in pr_data.get("labels", {}).get("nodes", [])
                ],
                "author": (pr_data.get("author") or {}).get("login", "ghost"),
                "related_issues": sorted(
                    [
                        issue
                        for issue in related_issues
                        if issue.get("number") is not None
                    ],
                    key=operator.itemgetter("thumbs_up"),
                    reverse=True,
                ),
                "related_issues_truncated": bool(
                    (closing_issues.get("pageInfo") or {}).get("hasNextPage")
                ),
            }
        )
    return prs


def _fetch_batch(pr_numbers: list[int]) -> list[dict[str, Any]]:
    query = _build_graphql_query(pr_numbers)
    result = _run(["gh", "api", "graphql", "-f", f"query={query}"])

    # gh can return non-zero when a queried number is not a valid PR. The
    # response may still contain valid data for other PRs, so try to parse it
    # regardless of the exit code.
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
    failures = 0
    for pr in pr_numbers:
        single_result = _run(
            ["gh", "api", "graphql", "-f", f"query={_build_graphql_query([pr])}"]
        )
        if single_result.stdout.strip():
            try:
                prs.extend(_parse_graphql_response(single_result.stdout))
                continue
            except (json.JSONDecodeError, KeyError):
                pass
        if single_result.returncode != 0 and _is_pr_not_found_error(
            single_result.stderr
        ):
            print(f"    Skipping #{pr} (not a valid PR)", file=sys.stderr)
            continue

        failures += 1
        print(
            f"Error: failed to fetch #{pr}: {single_result.stderr.strip()}",
            file=sys.stderr,
        )

    if failures and not prs:
        print("Error: failed to fetch PR metadata from GitHub API.", file=sys.stderr)
        sys.exit(1)
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

    print(f"Extracting PR numbers from {args.prev_tag}..{args.new_tag}")
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
