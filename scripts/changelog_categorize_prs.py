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

"""Filter and categorize PR data for changelog generation.

Usage:
    python scripts/changelog_categorize_prs.py [--input path] [--output path]

Reads the PR data JSON produced by changelog_fetch_prs.py, excludes noise
(bots, release PRs, internal-only), categorizes by labels, and writes
a categorized JSON file plus a human-readable summary to stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

_BOT_AUTHORS = {
    "dependabot[bot]",
    "github-actions",
    "github-actions[bot]",
    "dependabot",
    "snyk-bot",
    "renovate[bot]",
    "codecov[bot]",
}

_KNOWN_INTERNAL_AUTHORS = {
    "kmcgrady",
    "lukasmasuch",
    "mayagbarnes",
    "raethlein",
    "vdonato",
}

_RELEASE_PATTERNS = [
    re.compile(r"(?i)release/\d+\.\d+"),
    re.compile(r"(?i)merge.*release"),
    re.compile(r"(?i)bump version"),
    re.compile(r"(?i)version bump"),
    re.compile(r"(?i)docstrings for"),
]


def _is_bot(author: str) -> bool:
    return author in _BOT_AUTHORS


def _is_internal_author(author: str) -> bool:
    return author.startswith("sfc-gh-") or author in _KNOWN_INTERNAL_AUTHORS


def _is_release_noise(title: str) -> bool:
    return any(p.search(title) for p in _RELEASE_PATTERNS)


def categorize_prs(prs: list[dict[str, Any]]) -> dict[str, Any]:
    categories: dict[str, list[dict[str, Any]]] = {
        "breaking": [],
        "features": [],
        "bugfixes": [],
        "other_changes": [],
        "unlabeled": [],
        "excluded": [],
    }

    for pr in prs:
        labels = set(pr.get("labels", []))
        author = pr.get("author", "")
        title = pr.get("title", "")

        # Exclude bots
        if _is_bot(author):
            categories["excluded"].append({**pr, "exclude_reason": "bot"})
            continue

        # Exclude release noise
        if _is_release_noise(title):
            categories["excluded"].append({**pr, "exclude_reason": "release/version"})
            continue

        has_change = any(label.startswith("change:") for label in labels)
        has_impact_users = "impact:users" in labels
        has_impact_internal = "impact:internal" in labels

        # Exclude internal-only (impact:internal without impact:users)
        if has_impact_internal and not has_impact_users:
            categories["excluded"].append({**pr, "exclude_reason": "internal-only"})
            continue

        # Flag external contributors
        is_external = not _is_bot(author) and not _is_internal_author(author)
        pr_entry = {**pr, "is_external": is_external}

        # Categorize by label priority
        if "change:breaking" in labels:
            categories["breaking"].append(pr_entry)
        elif "change:feature" in labels:
            categories["features"].append(pr_entry)
        elif "change:bugfix" in labels:
            categories["bugfixes"].append(pr_entry)
        elif has_impact_users or has_change:
            categories["other_changes"].append(pr_entry)
        else:
            categories["unlabeled"].append(pr_entry)

    return categories


def print_summary(categories: dict[str, Any], total: int) -> None:
    excluded = categories["excluded"]
    bot_count = sum(1 for p in excluded if p.get("exclude_reason") == "bot")
    release_count = sum(
        1 for p in excluded if p.get("exclude_reason") == "release/version"
    )
    internal_count = sum(
        1 for p in excluded if p.get("exclude_reason") == "internal-only"
    )

    print(f"\n{'=' * 60}")
    print(f"Total PRs: {total}")
    print(
        f"Excluded: {len(excluded)} "
        f"(bots: {bot_count}, release/version: {release_count}, internal-only: {internal_count})"
    )
    print(f"{'=' * 60}")
    print(f"Breaking Changes: {len(categories['breaking'])}")
    print(f"Features:         {len(categories['features'])}")
    print(f"Bug Fixes:        {len(categories['bugfixes'])}")
    print(f"Other Changes:    {len(categories['other_changes'])}")
    print(f"Unlabeled:        {len(categories['unlabeled'])}")
    print(f"{'=' * 60}\n")

    for cat_name, display_name in [
        ("breaking", "Breaking Changes"),
        ("features", "Features"),
        ("bugfixes", "Bug Fixes"),
        ("other_changes", "Other Changes"),
        ("unlabeled", "Unlabeled (needs review)"),
    ]:
        items = categories[cat_name]
        if not items:
            continue
        print(f"--- {display_name} ({len(items)}) ---")
        for pr in items:
            ext_marker = " [EXTERNAL]" if pr.get("is_external") else ""
            print(f"  #{pr['number']}: {pr['title']}{ext_marker}")
        print()

    # Print external contributor summary
    all_active = []
    for cat_name in ("breaking", "features", "bugfixes", "other_changes", "unlabeled"):
        all_active.extend(categories[cat_name])
    external_authors = sorted(
        {pr["author"] for pr in all_active if pr.get("is_external")}
    )
    if external_authors:
        print(f"--- External Contributors ({len(external_authors)}) ---")
        for author in external_authors:
            print(f"  {author}")
        print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Categorize PR data for changelog")
    parser.add_argument(
        "--input", default="work-tmp/pr-data.json", help="Input JSON path"
    )
    parser.add_argument(
        "--output", default="work-tmp/pr-categorized.json", help="Output JSON path"
    )
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: input file '{args.input}' not found", file=sys.stderr)
        sys.exit(1)

    with open(args.input, encoding="utf-8") as f:
        prs = json.load(f)

    categories = categorize_prs(prs)
    print_summary(categories, len(prs))

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(categories, f, indent=2)

    print(f"Wrote categorized data to {args.output}")


if __name__ == "__main__":
    main()
