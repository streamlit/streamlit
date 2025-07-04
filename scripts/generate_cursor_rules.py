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

MAKE_COMMANDS_RULE_TEMPLATE = """---
description: List of all available make commands
globs:
alwaysApply: false
---

# Available `make` commands

List of all `make` commands that are available for execution from the repository root folder:

{make_commands}
"""


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


if __name__ == "__main__":
    generate_make_commands_rule()
