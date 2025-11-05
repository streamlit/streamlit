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

"""Combine configured AGENTS.md files into a single copilot-instructions.md file.

This script reads a curated list of AGENTS.md files from the repository
and combines them into a single copilot-instructions.md file with markdown
dividers (---) separating each section.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Final

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
OUTPUT_FILE = BASE_DIR / ".github" / "copilot-instructions.md"

# List of AGENTS.md files to include (relative to repo root)
# Follows the order here:
AGENTS_FILES: Final[list[str]] = [
    # Repo Overview:
    "AGENTS.md",
    # Protobuf Guide:
    "proto/streamlit/proto/AGENTS.md",
    # Python Development Guide:
    "lib/AGENTS.md",
    # Streamlit Lib Python Guide:
    "lib/streamlit/AGENTS.md",
    # Python Unit Test Guide:
    "lib/tests/AGENTS.md",
    # TypeScript Development Guide:
    "frontend/AGENTS.md",
    # E2E Playwright Guide:
    "e2e_playwright/AGENTS.md",
]


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


def get_agents_files() -> list[Path]:
    """Get all configured AGENTS.md files that exist in the repository."""
    files: list[Path] = []
    for rel_path in AGENTS_FILES:
        path = (BASE_DIR / rel_path).resolve()
        if path.exists() and path.is_file():
            files.append(path)
        else:
            print(f"Warning: AGENTS file not found, skipping: {rel_path}")

    return files


def read_agents_file(file_path: Path) -> str:
    """Read and return the content of an AGENTS file with headings indented.

    We also convert YAML frontmatter to HTML comments if present (harmless if absent).
    """
    try:
        content = file_path.read_text(encoding="utf-8").strip()
        content = convert_frontmatter_to_comment(content)
        content = indent_markdown_headings(content)
        return content
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}")
        return ""


def combine_agents_files() -> None:
    """Combine all configured AGENTS files into a single copilot-instructions.md file."""
    agent_files = get_agents_files()

    if not agent_files:
        print("No AGENTS.md files found from configured list")
        return

    print(f"Found {len(agent_files)} AGENTS files:")
    for file_path in agent_files:
        # Show path relative to repo root for readability
        rel = file_path.relative_to(BASE_DIR)
        print(f"  - {rel}")

    # Combine all files
    combined_content: list[str] = []

    # Add header
    combined_content.append("# Streamlit Library Development Rules")
    combined_content.append("")

    # Process each file
    for i, file_path in enumerate(agent_files):
        content = read_agents_file(file_path)
        if content:
            combined_content.append(content)

            # Add divider between files (except for the last one)
            if i < len(agent_files) - 1:
                combined_content.append("")
                combined_content.append("---")
                combined_content.append("")

    # Write combined content to output file
    output_content = "\n".join(combined_content) + "\n"
    OUTPUT_FILE.write_text(output_content, encoding="utf-8")

    print(f"Successfully combined {len(agent_files)} AGENTS files into {OUTPUT_FILE}")
    print(f"Total output size: {len(output_content):,} characters")


def main() -> None:
    """Main function."""
    try:
        combine_agents_files()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
