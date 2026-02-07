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

"""Get changed files by category for use in Makefile targets.

Usage:
    python scripts/get_changed_files.py --python
    python scripts/get_changed_files.py --python-tests
    python scripts/get_changed_files.py --frontend
    python scripts/get_changed_files.py --frontend-tests
    python scripts/get_changed_files.py --e2e

    # Include committed changes compared to base branch (for PR-like comparison):
    python scripts/get_changed_files.py --all --base-branch
    python scripts/get_changed_files.py --all --base-branch main

Output is space-separated file paths, suitable for passing to commands.

Note: Files with spaces in their paths are not supported and will be ignored.
This is a limitation of the space-separated output format used for shell consumption.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent.resolve()

# Default base branch for comparison
DEFAULT_BASE_BRANCH = "develop"

# Directory prefixes
LIB_SOURCE_PREFIX = "lib/streamlit/"
LIB_TESTS_PREFIX = "lib/tests/streamlit/"
FRONTEND_PREFIX = "frontend/"
E2E_PREFIX = "e2e_playwright/"

# Paths to exclude from checks
EXCLUDED_PATHS = ("/vendor/", "lib/streamlit/proto/")

# File extension patterns
PYTHON_EXTENSIONS = r"\.(py|pyi)$"
FRONTEND_EXTENSIONS = r"\.(ts|tsx|js|jsx)$"

# Test file patterns
PYTHON_TEST_SUFFIX = "_test.py"
FRONTEND_TEST_PATTERN = r"\.test\.(ts|tsx)$"


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _is_excluded(path: str) -> bool:
    """Check if path should be excluded from checks.

    Excludes:
    - Paths in EXCLUDED_PATHS (vendor, proto)
    - Paths containing spaces (not supported due to space-separated output format)
    """
    if " " in path:
        return True
    return any(excluded in path for excluded in EXCLUDED_PATHS)


def get_changed_files(base_branch: str | None = None) -> list[str]:
    """Get all changed files (staged, unstaged, and untracked, excluding deleted).

    Args:
        base_branch: If provided, also include files changed between this branch
                     and HEAD (useful for getting all changes in a PR).

    Note:
        Files with spaces in their paths are excluded (not supported due to
        space-separated output format).
    """
    files: set[str] = set()

    # Get modified files (staged + unstaged) compared to HEAD
    result = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--diff-filter=d"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )
    if result.returncode == 0:
        files.update(f.strip() for f in result.stdout.strip().split("\n") if f.strip())

    # Get untracked files (new files not yet added to git)
    result = subprocess.run(
        ["git", "ls-files", "--others", "--exclude-standard"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        check=False,
    )
    if result.returncode == 0:
        files.update(f.strip() for f in result.stdout.strip().split("\n") if f.strip())

    # If base_branch is provided, also get committed changes since diverging from base
    if base_branch:
        # Use merge-base to find common ancestor, then diff from there to HEAD
        result = subprocess.run(
            ["git", "merge-base", base_branch, "HEAD"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            check=False,
        )
        if result.returncode == 0:
            merge_base = result.stdout.strip()
            result = subprocess.run(
                ["git", "diff", "--name-only", merge_base, "HEAD", "--diff-filter=d"],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT,
                check=False,
            )
            if result.returncode == 0:
                files.update(
                    f.strip() for f in result.stdout.strip().split("\n") if f.strip()
                )

    # Filter out files with spaces (not supported due to space-separated output)
    return sorted(f for f in files if " " not in f)


def get_python_files(files: list[str]) -> list[str]:
    """Get Python files (excluding vendor, proto, e2e tests)."""
    result = []
    for f in files:
        if _is_excluded(f):
            continue
        # Skip e2e tests - they're handled separately by --e2e
        if f.startswith(E2E_PREFIX):
            continue
        if re.search(PYTHON_EXTENSIONS, f):
            result.append(f)
    return result


def get_python_test_files(files: list[str]) -> list[str]:
    """Get Python unit test files from lib/tests/, including mapped tests from changed source files.

    Note: E2E tests (e2e_playwright/) are excluded - use --e2e for those.
    """
    test_files = set()

    for f in files:
        if _is_excluded(f):
            continue

        if not f.endswith(".py"):
            continue

        # Skip e2e tests - they're handled separately by --e2e
        if f.startswith(E2E_PREFIX):
            continue

        # Direct test file (must be in lib/ directory)
        if f.endswith(PYTHON_TEST_SUFFIX) and f.startswith("lib/"):
            test_files.add(f)
            continue

        # Map source file to test file: lib/streamlit/foo.py -> lib/tests/streamlit/foo_test.py
        if f.startswith(LIB_SOURCE_PREFIX):
            test_file = f.replace(LIB_SOURCE_PREFIX, LIB_TESTS_PREFIX)
            test_file = re.sub(r"\.py$", PYTHON_TEST_SUFFIX, test_file)
            if (REPO_ROOT / test_file).exists():
                test_files.add(test_file)

    return sorted(test_files)


def get_frontend_files(files: list[str]) -> list[str]:
    """Get frontend files (excluding vendor)."""
    result = []
    for f in files:
        if _is_excluded(f):
            continue
        if f.startswith(FRONTEND_PREFIX) and re.search(FRONTEND_EXTENSIONS, f):
            result.append(f)
    return result


def get_frontend_test_files(files: list[str]) -> list[str]:
    """Get frontend test files, including mapped tests from changed source files.

    Maps source files to test files in the same directory:
    - Component.tsx -> Component.test.tsx
    - utils.ts -> utils.test.ts
    """
    test_files: set[str] = set()

    for f in files:
        if _is_excluded(f):
            continue

        if not f.startswith(FRONTEND_PREFIX):
            continue

        if not re.search(FRONTEND_EXTENSIONS, f):
            continue

        # Direct test file
        if re.search(FRONTEND_TEST_PATTERN, f):
            test_files.add(f)
            continue

        # Map source file to test file: Component.tsx -> Component.test.tsx
        # Extract base name and extension
        match = re.search(r"^(.+)\.(tsx?|jsx?)$", f)
        if match:
            base = match.group(1)
            ext = match.group(2)
            test_file = f"{base}.test.{ext}"
            if (REPO_ROOT / test_file).exists():
                test_files.add(test_file)

    return sorted(test_files)


def get_e2e_files(files: list[str]) -> list[str]:
    """Get e2e test files."""
    result = []
    for f in files:
        if f.startswith(E2E_PREFIX) and f.endswith(PYTHON_TEST_SUFFIX):
            result.append(f)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Get changed files by category",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--python",
        action="store_true",
        help="Python files (source and tests, excludes e2e)",
    )
    parser.add_argument(
        "--python-tests",
        action="store_true",
        help="Python test files (includes mapped tests from source)",
    )
    parser.add_argument(
        "--frontend",
        action="store_true",
        help="Frontend files (source and tests)",
    )
    parser.add_argument(
        "--frontend-tests",
        action="store_true",
        help="Frontend test files",
    )
    parser.add_argument(
        "--e2e",
        action="store_true",
        help="E2E test files",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="All changed files (for display)",
    )
    parser.add_argument(
        "--strip-prefix",
        type=str,
        metavar="PREFIX",
        help="Strip prefix from output paths (e.g., 'frontend/' or 'lib/')",
    )
    parser.add_argument(
        "--base-branch",
        type=str,
        metavar="BRANCH",
        nargs="?",
        const=DEFAULT_BASE_BRANCH,
        help=(
            f"Compare against base branch to include committed changes "
            f"(default: {DEFAULT_BASE_BRANCH} if flag is used without value)"
        ),
    )

    args = parser.parse_args()

    # Require at least one category
    if not any(
        [
            args.python,
            args.python_tests,
            args.frontend,
            args.frontend_tests,
            args.e2e,
            args.all,
        ]
    ):
        parser.error("At least one category flag is required")

    changed_files = get_changed_files(base_branch=args.base_branch)
    if not changed_files:
        return 0

    result_files: list[str] = []

    if args.all:
        result_files = changed_files
    else:
        if args.python:
            result_files.extend(get_python_files(changed_files))
        if args.python_tests:
            result_files.extend(get_python_test_files(changed_files))
        if args.frontend:
            result_files.extend(get_frontend_files(changed_files))
        if args.frontend_tests:
            result_files.extend(get_frontend_test_files(changed_files))
        if args.e2e:
            result_files.extend(get_e2e_files(changed_files))

    # Remove duplicates and sort
    result_files = sorted(set(result_files))

    # Strip prefix if requested
    if args.strip_prefix:
        result_files = [f.removeprefix(args.strip_prefix) for f in result_files]

    # Output space-separated for shell consumption
    if result_files:
        print(" ".join(result_files))

    return 0


if __name__ == "__main__":
    sys.exit(main())
