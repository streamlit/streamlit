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

"""Generate hierarchical CLAUDE.md files from cursor rule files.

This script reads all .mdc files from the .cursor/rules directory
and generates CLAUDE.md files in appropriate locations throughout
the codebase based on the globs patterns in each rule.

This maintains DRY principles by using the same source rules for
both Cursor and Claude Code.
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Final

import yaml  # type: ignore[import-untyped]

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
RULES_DIR = BASE_DIR / ".cursor" / "rules"

# Rule file extensions to process
RULE_EXTENSIONS: Final[set[str]] = {".mdc"}

# Default target for rules without explicit target
DEFAULT_TARGET: Final[str] = "CLAUDE.md"


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


def parse_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    """Parse YAML frontmatter from content.

    Returns
    -------
        Tuple of (frontmatter_dict, content_without_frontmatter)
    """
    # Pattern to match frontmatter at the beginning of the file
    frontmatter_pattern = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL | re.MULTILINE)

    match = frontmatter_pattern.match(content)
    if match:
        frontmatter_yaml = match.group(1)
        try:
            frontmatter = yaml.safe_load(frontmatter_yaml) or {}
        except yaml.YAMLError:
            frontmatter = {}
        content_without_frontmatter = content[match.end() :]
        return frontmatter, content_without_frontmatter

    return {}, content


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


def read_rule_file(file_path: Path) -> tuple[dict[str, Any], str]:
    """Read and return the frontmatter and content of a rule file.

    Returns
    -------
        Tuple of (frontmatter_dict, content)
    """
    try:
        content = file_path.read_text(encoding="utf-8").strip()
        return parse_frontmatter(content)
    except Exception as e:
        print(f"Warning: Could not read {file_path}: {e}")
        return {}, ""


def parse_makefile_commands() -> dict[str, str]:
    """Parse Makefile to extract command descriptions.

    Returns
    -------
        Dict mapping command names to their descriptions
    """
    makefile_path = BASE_DIR / "Makefile"
    if not makefile_path.exists():
        return {}

    commands = {}
    try:
        content = makefile_path.read_text(encoding="utf-8")
        lines = content.split("\n")

        for i in range(len(lines)):
            line = lines[i]
            # Look for .PHONY declarations
            if line.strip().startswith(".PHONY:"):
                # Extract the target name from the .PHONY line
                phony_parts = line.strip().split()
                if len(phony_parts) >= 2:
                    target_name = phony_parts[1]
                    # Check if there's a comment on the next line
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if next_line.startswith("#"):
                            description = next_line[1:].strip()
                            commands[target_name] = description
    except Exception as e:
        print(f"Warning: Could not parse Makefile: {e}")

    return commands


def generate_toc(content: str) -> str:
    """Generate table of contents from markdown headers.

    Args:
        content: Markdown content

    Returns
    -------
        Table of contents as markdown string
    """
    lines = content.split("\n")
    toc_lines = []

    for line in lines:
        # Match markdown headers (##, ###, ####)
        match = re.match(r"^(#{2,4})\s+(.+)$", line)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            # Create anchor link
            anchor = re.sub(r"[^a-z0-9\s-]", "", title.lower())
            anchor = re.sub(r"\s+", "-", anchor)

            # Add appropriate indentation
            indent = "  " * (level - 2)
            toc_lines.append(f"{indent}- [{title}](#{anchor})")

    if not toc_lines:
        return ""

    return "## Table of Contents\n\n" + "\n".join(toc_lines) + "\n"


def organize_rules_by_target() -> dict[str, list[tuple[Path, dict[str, Any], str]]]:
    """Organize rules by their target CLAUDE.md location.

    Returns
    -------
        Dict mapping target paths to list of (rule_file, frontmatter, content) tuples
    """
    rule_files = get_rule_files()
    organized = defaultdict(list)

    for rule_file in rule_files:
        frontmatter, content = read_rule_file(rule_file)
        if not content:
            continue

        # Determine target location from frontmatter or use default
        # Priority: 1. claudeTarget field, 2. alwaysApply -> root, 3. default
        target = frontmatter.get("claudeTarget")
        if not target:
            if frontmatter.get("alwaysApply", False):
                target = DEFAULT_TARGET
            elif "python" in rule_file.name and "test" in rule_file.name:
                target = "lib/tests/CLAUDE.md"
            elif "python" in rule_file.name or "lib" in rule_file.name:
                target = "lib/streamlit/CLAUDE.md"
            elif "typescript" in rule_file.name or "frontend" in rule_file.name:
                target = "frontend/CLAUDE.md"
            elif "e2e" in rule_file.name or "playwright" in rule_file.name:
                target = "e2e_playwright/CLAUDE.md"
            elif "proto" in rule_file.name:
                target = "proto/CLAUDE.md"
            else:
                target = DEFAULT_TARGET

        organized[target].append((rule_file, frontmatter, content))

    return organized


def format_claude_content(
    rules: list[tuple[Path, dict[str, Any], str]],
    target_path: str,
    all_commands: dict[str, str],
) -> str:
    """Format content for a CLAUDE.md file from multiple rules.

    Args:
        rules: List of (rule_file, frontmatter, content) tuples
        target_path: The target CLAUDE.md path for context
        all_commands: All available make commands

    Returns
    -------
        Formatted content for the CLAUDE.md file
    """
    sections = []

    # Add header based on location
    if target_path == "CLAUDE.md":
        sections.append("# CLAUDE.md")
        sections.append("")
        sections.append(
            "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository."
        )
        sections.append("")
    elif "lib/streamlit" in target_path:
        sections.append("# Python Backend Instructions")
        sections.append("")
        sections.append(
            "This file provides guidance to Claude Code for the Python backend code in lib/streamlit/."
        )
        sections.append("")
    elif "lib/tests" in target_path:
        sections.append("# Python Testing Instructions")
        sections.append("")
        sections.append("This file provides guidance to Claude Code for Python tests.")
        sections.append("")
    elif "frontend" in target_path:
        sections.append("# Frontend Instructions")
        sections.append("")
        sections.append(
            "This file provides guidance to Claude Code for TypeScript/React frontend code."
        )
        sections.append("")
    elif "e2e_playwright" in target_path:
        sections.append("# E2E Testing Instructions")
        sections.append("")
        sections.append(
            "This file provides guidance to Claude Code for Playwright E2E tests."
        )
        sections.append("")
    elif "proto" in target_path:
        sections.append("# Protobuf Instructions")
        sections.append("")
        sections.append(
            "This file provides guidance to Claude Code for Protocol Buffer definitions."
        )
        sections.append("")

    # Collect all content first to generate TOC
    all_content_sections = []
    for i, (_rule_file, _frontmatter, content) in enumerate(rules):
        all_content_sections.append(content)
        if i < len(rules) - 1:
            all_content_sections.append("\n---\n")

    full_content = "\n".join(all_content_sections)

    # Generate and add TOC if content has multiple sections
    toc = generate_toc(full_content)
    if toc and len(rules) > 1:
        sections.append(toc)
        sections.append("")

    # Collect make commands from frontmatter of all rules
    relevant_commands = set()
    for _rule_file, frontmatter, _content in rules:
        # Check for makeCommands in frontmatter
        make_cmds = frontmatter.get("makeCommands", [])
        if isinstance(make_cmds, str):
            make_cmds = [make_cmds]
        if make_cmds:
            relevant_commands.update(make_cmds)

    # If no commands specified in frontmatter, use sensible defaults based on location
    if not relevant_commands and target_path != DEFAULT_TARGET:
        if "lib/streamlit" in target_path:
            relevant_commands = {
                "python-lint",
                "python-format",
                "python-types",
                "autofix",
            }
        elif "lib/tests" in target_path:
            relevant_commands = {
                "python-tests",
                "python-integration-tests",
                "python-performance-tests",
            }
        elif "frontend" in target_path:
            relevant_commands = {
                "frontend-dev",
                "frontend-tests",
                "frontend-lint",
                "autofix",
            }
        elif "e2e" in target_path:
            relevant_commands = {"run-e2e-test", "debug-e2e-test", "update-snapshots"}
        elif "proto" in target_path:
            relevant_commands = {"protobuf"}

    # Add make commands section if we have any
    if relevant_commands:
        filtered_commands = {
            cmd: desc for cmd, desc in all_commands.items() if cmd in relevant_commands
        }

        if filtered_commands:
            sections.append("## Quick Commands")
            sections.append("")
            sections.append("Relevant `make` commands for this area:")
            sections.append("")
            for cmd in sorted(relevant_commands):
                if cmd in filtered_commands:
                    sections.append(f"- `make {cmd}` - {filtered_commands[cmd]}")
            sections.append("")

    # Build cross-references dynamically based on logical relationships
    related_files = []
    if target_path != DEFAULT_TARGET:
        # Always link back to root
        related_files.append("CLAUDE.md")

        # Add logical relationships
        if "lib/streamlit" in target_path:
            related_files.extend(
                ["proto/CLAUDE.md", "frontend/CLAUDE.md", "lib/tests/CLAUDE.md"]
            )
        elif "lib/tests" in target_path:
            related_files.append("lib/streamlit/CLAUDE.md")
        elif "frontend" in target_path:
            related_files.extend(["proto/CLAUDE.md", "lib/streamlit/CLAUDE.md"])
        elif "e2e" in target_path:
            related_files.extend(["frontend/CLAUDE.md", "lib/streamlit/CLAUDE.md"])
        elif "proto" in target_path:
            related_files.extend(["lib/streamlit/CLAUDE.md", "frontend/CLAUDE.md"])

    if related_files:
        sections.append("## Related Documentation")
        sections.append("")
        for related in related_files:
            # Create a nice display name
            if related == "CLAUDE.md":
                display_name = "Root project documentation"
            elif "lib/streamlit" in related:
                display_name = "Python backend documentation"
            elif "lib/tests" in related:
                display_name = "Python testing documentation"
            elif "frontend" in related:
                display_name = "Frontend documentation"
            elif "e2e_playwright" in related:
                display_name = "E2E testing documentation"
            elif "proto" in related:
                display_name = "Protobuf documentation"
            else:
                display_name = related

            sections.append(f"- [{display_name}](/{related})")
        sections.append("")

    # Add content from each rule
    for i, (_rule_file, _frontmatter, content) in enumerate(rules):
        # Add the content (already stripped of frontmatter)
        sections.append(content)

        # Add separator between rules (except for the last one)
        if i < len(rules) - 1:
            sections.append("")
            sections.append("---")
            sections.append("")

    # Add common footer for non-root files
    if target_path != "CLAUDE.md":
        sections.append("")
        sections.append("## Additional Context")
        sections.append("")
        sections.append(
            "For general project information and common commands, see the root CLAUDE.md file."
        )

    return "\n".join(sections) + "\n"


def write_claude_files() -> None:
    """Generate and write all CLAUDE.md files."""
    organized_rules = organize_rules_by_target()

    if not organized_rules:
        print("No rules found to process")
        return

    # Parse make commands once
    all_commands = parse_makefile_commands()

    generated_files = []

    for target_path, rules in organized_rules.items():
        output_path = BASE_DIR / target_path

        # Create parent directory if needed
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Format and write content
        content = format_claude_content(rules, target_path, all_commands)
        output_path.write_text(content, encoding="utf-8")

        generated_files.append(output_path)
        print(f"Generated: {output_path.relative_to(BASE_DIR)}")

        # Log which rules contributed to this file
        for rule_file, _, _ in rules:
            print(f"  - From: {rule_file.name}")

    print(f"\nSuccessfully generated {len(generated_files)} CLAUDE.md files")


def main() -> None:
    """Main function."""
    try:
        write_claude_files()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
