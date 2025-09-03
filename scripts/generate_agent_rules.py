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

import os
import subprocess
from typing import Final, TypedDict

MAKE_COMMANDS_CURSOR_RULE_TEMPLATE: Final[str] = """---
description: List of all available make commands
globs:
alwaysApply: false
---

# Available `make` commands

List of all `make` commands that are available for execution from the repository root folder:

{make_commands}
"""

CURSOR_RULE_TEMPLATE_GLOBS: Final[str] = """---
description:
globs: {globs}
alwaysApply: false
---

{agents_md_content}
"""


CURSOR_RULE_TEMPLATE_GLOBAL: Final[str] = """---
description:
globs:
alwaysApply: true
---

{agents_md_content}
"""

GITHUB_COPILOT_RULE_TEMPLATE_GLOBS: Final[str] = """---
applyTo: "{globs}"
---

{agents_md_content}
"""

GITHUB_COPILOT_RULE_TEMPLATE_GLOBAL: Final[str] = """{agents_md_content}
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
        "cursor_mdc": ".cursor/rules/overview.mdc",
        # Use repository-wide instructions file:
        "github_copilot": ".github/copilot-instructions.md",
        "agents_md": "AGENTS.md",
        "globs": "**",
        "always_apply": True,
    },
]


def generate_make_commands_rule() -> None:
    """Generate the make commands cursor rule file."""
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

    # Format the template with the make commands
    formatted_content = MAKE_COMMANDS_CURSOR_RULE_TEMPLATE.format(
        make_commands=make_commands
    )

    # Define the output path
    output_dir = os.path.join(workspace_root, ".cursor", "rules")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "make_commands.mdc")

    # Write the formatted content to the file
    with open(output_path, "w") as f:
        f.write(formatted_content)
    print(f"Generated rule file: {output_path}")


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
        with open(agents_md_path) as f:
            agents_md_content = f.read()

        # Write cursor rule file:

        if always_apply:
            content = CURSOR_RULE_TEMPLATE_GLOBAL.format(
                agents_md_content=agents_md_content.strip(),
            )
        else:
            content = CURSOR_RULE_TEMPLATE_GLOBS.format(
                globs=globs, agents_md_content=agents_md_content.strip()
            )

        with open(cursor_mdc_path, "w") as f:
            f.write(content)
        print(f"Generated Cursor rule file: {cursor_mdc_path}")

        # Write github copilot rule file:

        if always_apply:
            content = GITHUB_COPILOT_RULE_TEMPLATE_GLOBAL.format(
                agents_md_content=agents_md_content.strip(),
            )
        else:
            content = GITHUB_COPILOT_RULE_TEMPLATE_GLOBS.format(
                globs=globs, agents_md_content=agents_md_content.strip()
            )

        with open(github_copilot_path, "w") as f:
            f.write(content)
        print(f"Generated GitHub Copilot rule file: {github_copilot_path}")


if __name__ == "__main__":
    generate_make_commands_rule()
    generate_agent_rules()
