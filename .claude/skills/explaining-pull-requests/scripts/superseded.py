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

"""Has this PR already landed some other way? Answer it without getting the diff direction wrong.

For a PR that has gone quiet, the single most valuable thing you can discover is
that its content already merged via someone else's PR — the answer is then "close
it", not "here's how to chase a review". But this check is easy to get exactly
backwards, and backwards is worse than not checking: it sends someone off to
salvage code that is already on the base branch.

The trap: `git diff A B` reports what changing *from A to B* would do. So in
`git diff --numstat <base> <head>`, the first column is lines the HEAD has that
the base lacks, and the second is lines the BASE has that the head lacks. Read
those two numbers the wrong way round and "the base already has this test"
becomes "this test is all that's left".

This script only ever reports in the direction-explicit form: "head-only" and
"base-only", never "added" or "removed". It also separates comment-only surplus
from executable surplus, because a branch whose only remaining difference is
reworded JSDoc is fully superseded even though `git diff` is non-empty.

Usage:
    uv run python scripts/superseded.py <base-ref> <head-ref> [--repo DIR]

Both refs must exist locally. Fetch them first:
    git fetch origin pull/<N>/head:pr-<N>
    git fetch origin develop:refs/remotes/origin/develop
"""

from __future__ import annotations

import argparse
import subprocess
import sys

COMMENT_STARTS = ("//", "/*", "*/", "*", "#", "<!--", "-->", '"""', "'''", "--")


def git(repo: str, *args: str) -> str:
    p = subprocess.run(
        ["git", "-C", repo, *args], capture_output=True, text=True, check=False
    )
    if p.returncode != 0:
        raise SystemExit(f"git {' '.join(args)}\n{p.stderr.strip()}")
    return p.stdout


def is_comment_or_blank(line: str) -> bool:
    s = line.strip()
    return not s or s.startswith(COMMENT_STARTS)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "base", help="e.g. origin/develop — the CURRENT base, not the merge base"
    )
    ap.add_argument("head", help="e.g. pr-16042")
    ap.add_argument("--repo", default=".")
    args = ap.parse_args()

    mb = git(args.repo, "merge-base", args.head, args.base).strip()
    files = [
        f
        for f in git(args.repo, "diff", "--name-only", mb, args.head).splitlines()
        if f
    ]
    if not files:
        print("PR touches no files relative to its merge base — nothing to compare.")
        return 0

    rows = []
    total_exec_head_only = 0
    for f in files:
        # +lines are present in HEAD and absent from BASE. -lines are the reverse.
        diff = git(args.repo, "diff", args.base, args.head, "--", f).splitlines()
        head_only = [
            line[1:]
            for line in diff
            if line.startswith("+") and not line.startswith("+++")
        ]
        base_only = [
            line[1:]
            for line in diff
            if line.startswith("-") and not line.startswith("---")
        ]
        exec_head_only = [line for line in head_only if not is_comment_or_blank(line)]
        total_exec_head_only += len(exec_head_only)
        rows.append((f, len(head_only), len(exec_head_only), len(base_only)))

    w = max(len(f.split("/")[-1]) for f, *_ in rows)
    print(f"base = {args.base}   head = {args.head}   merge-base = {mb[:10]}\n")
    print(f"{'file':<{w}}  head-only  (of which executable)  base-only")
    for f, ho, eho, bo in rows:
        print(f"{f.split('/')[-1]:<{w}}  {ho:>9}  {eho:>20}  {bo:>9}")

    print("\nDirection, spelled out so it cannot be misread:")
    print(f"  head-only = lines {args.head} has that {args.base} does NOT have")
    print(f"  base-only = lines {args.base} has that {args.head} does NOT have")

    surplus_base = sum(bo for *_, bo in rows)
    print()
    if total_exec_head_only == 0:
        print(
            f"VERDICT: fully superseded. {args.head} has 0 executable lines that "
            f"{args.base} lacks"
            + (
                " — its only surplus is comments/blank lines."
                if any(ho for _, ho, _, _ in rows)
                else "."
            )
        )
        if surplus_base:
            print(
                f"         Note the other direction: {args.base} has {surplus_base} line(s) "
                f"{args.head} lacks, so the base is AHEAD, not behind. There is nothing "
                f"here to salvage."
            )
    else:
        print(
            f"VERDICT: not superseded. {args.head} still has {total_exec_head_only} "
            f"executable line(s) absent from {args.base}."
        )
        if surplus_base:
            print(
                f"         {args.base} also has {surplus_base} line(s) {args.head} lacks — "
                f"the branch is behind as well as ahead, so it needs a rebase, and any "
                f"'what's left' claim must name both directions."
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
