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

OVERVIEW_RULE_TEMPLATE = """---
description:
globs:
alwaysApply: true
---

# Streamlit Repo Overview

## Repo Structure

- `lib/`: Core Python library containing the Streamlit backend code.
- `lib/streamlit/`: The main Python package with all Streamlit functionality.
- `lib/streamlit/elements/`: UI elements and widgets.
- `lib/streamlit/runtime/`: Runtime execution engine.
- `lib/streamlit/web/`: Web server implementation.
- `frontend/`: TypeScript code for the web interface.
- `frontend/app/`: Main application UI.
- `frontend/lib/`: Shared frontend library that contains elements, widgets, and layouts.
- `frontend/utils/`: Some shared utils used across Streamlit frontend.
- `frontend/connection/`: WebSocket connection handling logic.
- `proto/`: Protobuf definitions for client-server communication.
- `e2e_playwright/`: End-to-end tests using playwright and pytest for testing the UI.
- `scripts/`: Utility scripts for development and CI/CD.
- `component-lib/`: Library for building custom components.

## Available `make` commands

Available `make` commands that can be run from the repository root:

{make_commands}
"""


def generate_overview_rule() -> None:
    """Generate the overview rule file."""
    # Run `make help` and capture the output
    result = subprocess.run(
        ["make", "help"], capture_output=True, text=True, check=True
    )
    make_commands = result.stdout.strip()

    # Format the template with the make commands
    formatted_content = OVERVIEW_RULE_TEMPLATE.format(make_commands=make_commands)

    # Define the output path
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(workspace_root, ".cursor", "rules")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "overview.mdc")

    # Write the formatted content to the file
    with open(output_path, "w") as f:
        f.write(formatted_content)
    print(f"Generated rule file: {output_path}")


if __name__ == "__main__":
    generate_overview_rule()
