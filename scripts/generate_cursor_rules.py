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

MAKE_COMMANDS_RULE_TEMPLATE: Final[str] = """---
description: List of all available make commands
globs:
alwaysApply: false
---

# Available `make` commands

List of all `make` commands that are available for execution from the repository root folder:

{make_commands}
"""

CURSOR_RULE_TEMPLATE: Final[str] = """---
description:
globs: {globs}
alwaysApply: {always_apply}
---

{agents_md_content}
"""


class AgentRuleFile(TypedDict):
    cursor_mdc: str
    agents_md: str
    globs: str
    always_apply: bool


AGENT_RULE_FILES: Final[list[AgentRuleFile]] = [
    {
        "cursor_mdc": ".cursor/rules/e2e_playwright.mdc",
        "agents_md": "e2e_playwright/AGENTS.md",
        "globs": "e2e_playwright/**/*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/python.mdc",
        "agents_md": "lib/AGENTS.md",
        "globs": "*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/python_lib.mdc",
        "agents_md": "lib/streamlit/AGENTS.md",
        "globs": "lib/streamlit/**/*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/python_tests.mdc",
        "agents_md": "lib/tests/AGENTS.md",
        "globs": "lib/tests/**/*.py",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/protobuf.mdc",
        "agents_md": "proto/streamlit/proto/AGENTS.md",
        "globs": "*.proto",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/typescript.mdc",
        "agents_md": "frontend/AGENTS.md",
        "globs": "*.ts, *.tsx",
        "always_apply": False,
    },
    {
        "cursor_mdc": ".cursor/rules/overview.mdc",
        "agents_md": "AGENTS.md",
        "globs": "",
        "always_apply": True,
    },
]


def generate_make_commands_rule() -> None:
    """Generate the make commands rule file."""
    # Run `make help` and capture the output
    result = subprocess.run(
        ["make", "help"], capture_output=True, text=True, check=True
    )
    make_commands = result.stdout.strip()

    # Format the template with the make commands
    formatted_content = MAKE_COMMANDS_RULE_TEMPLATE.format(make_commands=make_commands)

    # Define the output path
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(workspace_root, ".cursor", "rules")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "make_commands.mdc")

    # Write the formatted content to the file
    with open(output_path, "w") as f:
        f.write(formatted_content)
    print(f"Generated rule file: {output_path}")


def generate_agent_rules() -> None:
    """Generate agent rule files based on AGENT_RULE_FILES."""
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for rule in AGENT_RULE_FILES:
        cursor_mdc_rel = rule["cursor_mdc"]
        agents_md_rel = rule["agents_md"]
        globs = rule["globs"]
        always_apply = rule["always_apply"]

        output_path = os.path.join(workspace_root, cursor_mdc_rel)
        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        agents_md_abs = os.path.join(workspace_root, agents_md_rel)
        if not os.path.isfile(agents_md_abs):
            raise FileNotFoundError(
                f"Missing AGENTS.md file at '{agents_md_abs}' for rule '{cursor_mdc_rel}'"
            )
        # Read the full content of the AGENTS.md file
        with open(agents_md_abs) as f:
            agents_md_content = f.read()

        content = CURSOR_RULE_TEMPLATE.format(
            globs=globs,
            agents_md_content=agents_md_content.strip(),
            always_apply="true" if always_apply else "false",
        )
        # Removes unnecessary whitespace to fix linting issue:
        content = content.replace("globs: \n", "globs:\n")

        with open(output_path, "w") as f:
            f.write(content)
        print(f"Generated rule file: {output_path}")


if __name__ == "__main__":
    generate_make_commands_rule()
    generate_agent_rules()
