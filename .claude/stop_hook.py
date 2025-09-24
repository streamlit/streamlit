#!/usr/bin/env python3
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""
Stop hook for Claude Code in Streamlit repository.
Runs quality checks before allowing Claude to complete tasks.
"""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Final

# Constants
# Total hook timeout is 150s (set in settings.json)
# TODO: Optimize these checks to only run on changed files to reduce execution time
# This will be addressed in a follow-up PR
# We have 4 checks total: python-lint, python-types, frontend-lint, frontend-types
# Give each command a reasonable timeout, but fast ones get less
PYTHON_COMMAND_TIMEOUT: Final = 10  # Python checks are fast
FRONTEND_COMMAND_TIMEOUT: Final = (
    70  # Frontend checks are slower (can take 50+ seconds)
)
SEPARATOR: Final = "=" * 60

# Keywords for filtering relevant error lines
PYTHON_ERROR_KEYWORDS: Final = ["error", "would reformat", "failed", "***", ".py:"]
FRONTEND_ERROR_KEYWORDS: Final = [
    "error",
    "failed",
    "***",
    ".ts:",
    ".tsx:",
    ".js:",
    ".jsx:",
]
NODE_MODULES_KEYWORDS: Final = ["node_modules", "findpackagelocation"]


def run_command(
    cmd: list[str], timeout: int = 10, cwd: str | None = None
) -> tuple[int, str, str]:
    """Run a command and return exit code, stdout, and stderr."""
    try:
        result = subprocess.run(  # noqa: S603
            cmd,
            check=False,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", f"Command timed out after {timeout}s: {' '.join(cmd)}"
    except Exception as e:
        return 1, "", str(e)


def filter_relevant_lines(output: str, keywords: list[str]) -> list[str]:
    """Filter output lines that contain any of the specified keywords."""
    lines = output.split("\n")
    return [
        line for line in lines if any(keyword in line.lower() for keyword in keywords)
    ]


def format_check_result(
    exit_code: int,
    stdout: str,
    stderr: str,
    check_name: str,
    error_keywords: list[str],
    make_command: str,
) -> str | None:
    """
    Format the result of a quality check command.

    Returns None if check passed, error message string if failed.
    """
    if exit_code == 0:
        return None

    output = (stdout + "\n" + stderr).strip()
    relevant_lines = filter_relevant_lines(output, error_keywords)

    if relevant_lines:
        # Check for specific error types
        if "would reformat" in output.lower():
            return f"{check_name} formatting issues found:\n" + "\n".join(
                relevant_lines
            )
        return f"{check_name} failed:\n" + "\n".join(relevant_lines)

    return f"{check_name} failed (run '{make_command}' for details)"


def check_python_quality() -> list[str]:
    """Run Python linting and type checking.

    TODO: Optimize to only check modified files to reduce execution time.
    This will be addressed in a follow-up PR.
    """
    issues = []

    # Python linting (includes formatting check via ruff format --check)
    exit_code, stdout, stderr = run_command(
        ["make", "python-lint"], timeout=PYTHON_COMMAND_TIMEOUT
    )
    if issue := format_check_result(
        exit_code,
        stdout,
        stderr,
        "Python linting/formatting",
        PYTHON_ERROR_KEYWORDS,
        "make python-lint",
    ):
        issues.append(issue)

    # Python type checking
    exit_code, stdout, stderr = run_command(
        ["make", "python-types"], timeout=PYTHON_COMMAND_TIMEOUT
    )
    if issue := format_check_result(
        exit_code,
        stdout,
        stderr,
        "Python type checking",
        PYTHON_ERROR_KEYWORDS,
        "make python-types",
    ):
        issues.append(issue)

    return issues


def check_frontend_quality() -> list[str]:
    """Run frontend linting and type checking.

    TODO: Optimize to only check modified files to reduce execution time.
    This will be addressed in a follow-up PR.
    """
    issues = []

    # Check each frontend command
    commands = [
        ("frontend-lint", "Frontend linting/formatting"),
        ("frontend-types", "Frontend type checking"),
    ]

    for make_target, check_name in commands:
        exit_code, stdout, stderr = run_command(
            ["make", make_target], timeout=FRONTEND_COMMAND_TIMEOUT
        )

        if exit_code != 0:
            output = (stdout + "\n" + stderr).strip()

            # Skip if node_modules is missing
            if any(keyword in output.lower() for keyword in NODE_MODULES_KEYWORDS):
                print(  # noqa: T201
                    "⚠️  Skipping frontend checks - node_modules not installed",
                    file=sys.stderr,
                )
                return []

            if issue := format_check_result(
                exit_code,
                stdout,
                stderr,
                check_name,
                FRONTEND_ERROR_KEYWORDS,
                f"make {make_target}",
            ):
                issues.append(issue)

    return issues


def print_results(issues: list[str]) -> None:
    """Print the results of all quality checks to stderr."""
    if issues:
        print(  # noqa: T201
            "❌ Quality checks failed! Please fix the following issues:",
            file=sys.stderr,
        )
        print(SEPARATOR, file=sys.stderr)  # noqa: T201

        for issue in issues:
            print(f"\n{issue}", file=sys.stderr)  # noqa: T201

        print(SEPARATOR, file=sys.stderr)  # noqa: T201
        print(  # noqa: T201
            "\n💡 Run 'make autofix' to automatically fix formatting issues",
            file=sys.stderr,
        )
    else:
        print("✅ All quality checks passed!", file=sys.stderr)  # noqa: T201


def main():
    """Main entry point for the stop hook."""
    # Check if stop_hook_active is set to prevent infinite loops
    stdin_input = sys.stdin.read() if not sys.stdin.isatty() else "{}"

    try:
        hook_input = json.loads(stdin_input)
    except json.JSONDecodeError:
        hook_input = {}

    if hook_input.get("stop_hook_active"):
        # Already in a stop hook, allow normal stoppage
        sys.exit(0)

    # Run all quality checks
    all_issues = []
    all_issues.extend(check_python_quality())
    all_issues.extend(check_frontend_quality())

    # Print results and exit with appropriate code
    print_results(all_issues)
    sys.exit(2 if all_issues else 0)  # Exit code 2 blocks stoppage


if __name__ == "__main__":
    main()
