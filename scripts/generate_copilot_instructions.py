#!/usr/bin/env python

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

"""Combine all cursor rule files into a single copilot-instructions.md file.

This script reads all .mdc files from the .cursor/rules directory
and combines them into a single copilot-instructions.md file with markdown
dividers (---) separating each rule.

Only includes .mdc files that are not gitignored.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Final

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
RULES_DIR = BASE_DIR / ".cursor" / "rules"
OUTPUT_FILE = BASE_DIR / ".github" / "copilot-instructions.md"

# Rule file extensions to process
RULE_EXTENSIONS: Final[set[str]] = {".mdc"}


def is_gitignored(file_path: Path) -> bool:
    """Check if a file is gitignored using git check-ignore.

    Returns True if the file is gitignored, False otherwise.
    """
    try:
        # Run git check-ignore on the file
        result = subprocess.run(
            ["git", "check-ignore", str(file_path)],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        # git check-ignore returns 0 if the file is ignored, 1 if not ignored
        return result.returncode == 0
    except (subprocess.SubprocessError, subprocess.TimeoutExpired):
        # If git command fails, assume file is not ignored
        return False


def convert_frontmatter_to_comment(content: str) -> str:
    """Convert YAML frontmatter to HTML comment format.

    Converts:
    ---
    description:
    globs: e2e_playwright/**/*.py
    alwaysApply: false
    ---

    To:
    <!--
    description:
    globs: e2e_playwright/**/*.py
    alwaysApply: false
    -->
    """
    # Pattern to match frontmatter at the beginning of the file
    frontmatter_pattern = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL | re.MULTILINE)

    def replace_frontmatter(match: re.Match[str]) -> str:
        frontmatter_content = match.group(1)
        return f"<!--\n{frontmatter_content}\n-->\n\n"

    return frontmatter_pattern.sub(replace_frontmatter, content)


def indent_markdown_headings(content: str) -> str:
    """Indent all markdown headings by one level.

    Converts:
    # Title -> ## Title
    ## Subtitle -> ### Subtitle
    ### Section -> #### Section
    etc.
    """
    # Pattern to match markdown headings (# at start of line followed by space)
    heading_pattern = re.compile(r"^(#{1,6}) ", re.MULTILINE)

    def add_heading_level(match: re.Match[str]) -> str:
        current_hashes = match.group(1)
        # Add one more # to increase the heading level
        return f"#{current_hashes} "

    return heading_pattern.sub(add_heading_level, content)


def get_rule_files() -> list[Path]:
    """Get all rule files from the .cursor/rules directory that are not gitignored."""
    if not RULES_DIR.exists():
        raise FileNotFoundError(f"Rules directory not found: {RULES_DIR}")

    rule_files = []
    for file_path in RULES_DIR.iterdir():
        if file_path.is_file() and file_path.suffix in RULE_EXTENSIONS:
            # Only include files that are not gitignored
            if not is_gitignored(file_path):
                rule_files.append(file_path)
            else:
                print(f"Skipping gitignored file: {file_path.name}")

    # Sort files by name for consistent output
    return sorted(rule_files)


def read_rule_file(file_path: Path) -> str:
    """Read and return the content of a rule file with frontmatter converted to comments and headings indented."""
    try:
        content = file_path.read_text(encoding="utf-8").strip()
        # Convert frontmatter to HTML comments
        content = convert_frontmatter_to_comment(content)
        # Indent all markdown headings by one level
        content = indent_markdown_headings(content)
        return content
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}")
        return ""


def combine_rule_files() -> None:
    """Combine all rule files into a single copilot-instructions.md file."""
    rule_files = get_rule_files()

    if not rule_files:
        print("No rule files found in .cursor/rules directory")
        return

    print(f"Found {len(rule_files)} rule files:")
    for file_path in rule_files:
        print(f"  - {file_path.name}")

    # Combine all rule files
    combined_content = []

    # Add header
    combined_content.append("# Streamlit Library Rules")
    combined_content.append("")

    # Process each rule file
    for i, file_path in enumerate(rule_files):
        content = read_rule_file(file_path)
        if content:
            combined_content.append(content)

            # Add divider between files (except for the last one)
            if i < len(rule_files) - 1:
                combined_content.append("")
                combined_content.append("---")
                combined_content.append("")

    # Write combined content to output file
    output_content = "\n".join(combined_content) + "\n"
    OUTPUT_FILE.write_text(output_content, encoding="utf-8")

    print(f"Successfully combined {len(rule_files)} rule files into {OUTPUT_FILE}")
    print(f"Total output size: {len(output_content):,} characters")


def main() -> None:
    """Main function."""
    try:
        combine_rule_files()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
