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

import os
import subprocess
from typing import Final, TypedDict

MAKE_COMMANDS_SKILL_TEMPLATE: Final[str] = """---
name: discovering-make-commands
description: Lists available make commands for Streamlit development. Use for build, test, lint, or format tasks.
---

# Available `make` commands

List of all `make` commands available for execution from the repository root folder:

```
{make_commands}
```
"""

GENERATED_FILE_NOTICE: Final[str] = (
    "<!-- Generated from {agents_md}. Edit that file instead, "
    "then run: uv run python scripts/generate_agent_rules.py -->"
)

CURSOR_RULE_TEMPLATE_GLOBS: Final[str] = """---
description:
globs: {globs}
alwaysApply: false
---

{notice}

{agents_md_content}
"""


CURSOR_RULE_TEMPLATE_GLOBAL: Final[str] = """---
description:
globs:
alwaysApply: true
---

{notice}

{agents_md_content}
"""

GITHUB_COPILOT_RULE_TEMPLATE_GLOBS: Final[str] = """---
applyTo: "{globs}"
---

{notice}

{agents_md_content}
"""

GITHUB_COPILOT_RULE_TEMPLATE_GLOBAL: Final[str] = """{notice}

{agents_md_content}
"""


class AgentRuleFile(TypedDict):
    cursor_mdc: str
    agents_md: str
    globs: str
    github_copilot: str
    always_apply: bool


AGENT_RULE_FILES: Final[list[AgentRuleFile]] = [
    {
        "cursor_mdc": ".cursor/rules/e2e_playwright.mdc",
        "github_copilot": ".github/instructions/e2e_playwright.instructions.md",
        "agents_md": "e2e_playwright/AGENTS.md",
        "globs": "e2e_playwright/**/*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/python.mdc",
        "github_copilot": ".github/instructions/python.instructions.md",
        "agents_md": "lib/AGENTS.md",
        "globs": "**/*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/python_lib.mdc",
        "github_copilot": ".github/instructions/python_lib.instructions.md",
        "agents_md": "lib/streamlit/AGENTS.md",
        "globs": "lib/streamlit/**/*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/python_tests.mdc",
        "github_copilot": ".github/instructions/python_tests.instructions.md",
        "agents_md": "lib/tests/AGENTS.md",
        "globs": "lib/tests/**/*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/protobuf.mdc",
        "github_copilot": ".github/instructions/protobuf.instructions.md",
        "agents_md": "proto/streamlit/proto/AGENTS.md",
        "globs": "**/*.proto",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/typescript.mdc",
        "github_copilot": ".github/instructions/typescript.instructions.md",
        "agents_md": "frontend/AGENTS.md",
        "globs": "**/*.ts, **/*.tsx",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/skills.mdc",
        "github_copilot": ".github/instructions/skills.instructions.md",
        "agents_md": ".claude/skills/AGENTS.md",
        "globs": ".claude/skills/**/*",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/workflows.mdc",
        "github_copilot": ".github/instructions/workflows.instructions.md",
        "agents_md": ".github/workflows/AGENTS.md",
        "globs": ".github/workflows/**/*.yml",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/overview.mdc",
        # Use repository-wide instructions file:
        "github_copilot": ".github/copilot-instructions.md",
        "agents_md": "AGENTS.md",
        "globs": "**",
        "always_apply": True,
    },
]


CODE_REVIEW_INSTRUCTIONS_SOURCE: Final[str] = (
    "scripts/assets/code-review-instructions.md"
)

# Files to sync the code review instructions into, starting from the
# "## Review Checklist" section header.
CODE_REVIEW_SYNC_TARGETS: Final[list[str]] = [
    ".claude/agents/reviewing-local-changes.md",
]

REVIEW_CHECKLIST_HEADER: Final[str] = "## Review Checklist"


def sync_code_review_instructions() -> None:
    """Sync the code review instructions into agent files.

    Reads the shared code review instructions from
    ``scripts/assets/code-review-instructions.md`` and replaces everything
    starting from the ``## Review Checklist`` section in each target file.
    """
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    source_path = os.path.join(workspace_root, CODE_REVIEW_INSTRUCTIONS_SOURCE)
    if not os.path.isfile(source_path):
        raise FileNotFoundError(
            f"Missing code review instructions source at '{source_path}'."
        )

    with open(source_path, encoding="utf-8") as f:
        source_content = f.read()

    # The source file should start with the review checklist header
    if not source_content.startswith(REVIEW_CHECKLIST_HEADER):
        raise ValueError(
            f"Source file '{source_path}' must start with '{REVIEW_CHECKLIST_HEADER}'."
        )

    for target_rel_path in CODE_REVIEW_SYNC_TARGETS:
        target_path = os.path.join(workspace_root, target_rel_path)
        if not os.path.isfile(target_path):
            raise FileNotFoundError(f"Missing sync target file at '{target_path}'.")

        with open(target_path, encoding="utf-8") as f:
            target_content = f.read()

        # Find the position of the review checklist header in the target
        header_pos = target_content.find(REVIEW_CHECKLIST_HEADER)
        if header_pos == -1:
            raise ValueError(
                f"Target file '{target_path}' does not contain "
                f"'{REVIEW_CHECKLIST_HEADER}'."
            )

        # Replace everything from the header onwards with the source content
        updated_content = target_content[:header_pos] + source_content.rstrip() + "\n"

        with open(target_path, "w", encoding="utf-8") as f:
            f.write(updated_content)
        print(f"Synced code review instructions into: {target_path}")


def generate_make_commands_skill() -> None:
    """Generate the make commands agent skill."""
    # Determine workspace root and run `make help` without directory trace noise
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    result = subprocess.run(
        ["make", "--no-print-directory", "help"],
        capture_output=True,
        text=True,
        check=True,
        cwd=workspace_root,
    )
    make_commands = result.stdout.strip()

    # Generate agent skill file
    skill_content = MAKE_COMMANDS_SKILL_TEMPLATE.format(make_commands=make_commands)

    skill_dir = os.path.join(
        workspace_root, ".claude", "skills", "discovering-make-commands"
    )
    os.makedirs(skill_dir, exist_ok=True)
    skill_path = os.path.join(skill_dir, "SKILL.md")

    with open(skill_path, "w", encoding="utf-8") as f:
        f.write(skill_content)
    print(f"Generated agent skill file: {skill_path}")


def resolve_rule_path(rule_path: str) -> str:
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    output_path = os.path.join(workspace_root, rule_path)
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)

    return output_path


def generate_agent_rules() -> None:
    """Generate Cursor and Github Copilot agent rule files based on AGENT_RULE_FILES."""

    for rule in AGENT_RULE_FILES:
        cursor_mdc_path = resolve_rule_path(rule["cursor_mdc"])
        github_copilot_path = resolve_rule_path(rule["github_copilot"])
        agents_md_path = resolve_rule_path(rule["agents_md"])
        globs = rule["globs"]
        always_apply = rule["always_apply"]

        if not os.path.isfile(agents_md_path):
            raise FileNotFoundError(f"Missing AGENTS.md file at '{agents_md_path}'.")

        # Read the full content of the AGENTS.md file
        with open(agents_md_path, encoding="utf-8") as f:
            agents_md_content = f.read()

        notice = GENERATED_FILE_NOTICE.format(agents_md=rule["agents_md"])

        # Write cursor rule file:

        if always_apply:
            content = CURSOR_RULE_TEMPLATE_GLOBAL.format(
                notice=notice,
                agents_md_content=agents_md_content.strip(),
            )
        else:
            content = CURSOR_RULE_TEMPLATE_GLOBS.format(
                globs=globs,
                notice=notice,
                agents_md_content=agents_md_content.strip(),
            )

        with open(cursor_mdc_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Generated Cursor rule file: {cursor_mdc_path}")

        # Write github copilot rule file:

        if always_apply:
            content = GITHUB_COPILOT_RULE_TEMPLATE_GLOBAL.format(
                notice=notice,
                agents_md_content=agents_md_content.strip(),
            )
        else:
            content = GITHUB_COPILOT_RULE_TEMPLATE_GLOBS.format(
                globs=globs,
                notice=notice,
                agents_md_content=agents_md_content.strip(),
            )

        with open(github_copilot_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Generated GitHub Copilot rule file: {github_copilot_path}")


if __name__ == "__main__":
    generate_make_commands_skill()
    generate_agent_rules()
    sync_code_review_instructions()
