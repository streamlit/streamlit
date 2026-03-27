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

"""Update project name across the entire repo.

The streamlit-nightly CI job uses this to set the project name to "streamlit-nightly".
"""

from __future__ import annotations

import fileinput
import os
import re
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# A dict of [filename:regex]. For each filename, we modify all lines
# matched by the regex.
#
# Regexes should start with a "<pre_match>" named group and end with a
# "<post_match>" named group. Text between these pre- and post-match
# groups will be replaced with the specified project_name text.
FILES_AND_REGEXES = {
    "lib/pyproject.toml": r'(?P<pre_match>^name = ").*(?P<post_match>"$)',
    "lib/streamlit/version.py": r"(?P<pre_match>.*_version\(\").*(?P<post_match>\"\)$)",
}


def update_root_pyproject_toml(project_name: str) -> None:
    """Update the root pyproject.toml to use the new package name.

    This is required for uv to correctly resolve the local package
    when its name changes (e.g., from 'streamlit' to 'streamlit-nightly').
    """
    file_path = os.path.join(BASE_DIR, "pyproject.toml")

    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    # Update [tool.uv.sources] section - change the key from 'streamlit' to new name
    uv_sources_pattern = r'^streamlit = \{ path = "lib", editable = true \}$'
    content, uv_sources_count = re.subn(
        uv_sources_pattern,
        rf'{project_name} = {{ path = "lib", editable = true }}',
        content,
        flags=re.MULTILINE,
    )
    if uv_sources_count == 0:
        raise Exception(
            f'In file "{file_path}", did not find regex "{uv_sources_pattern}"'
        )

    # Update dependency references in dependency-groups from "streamlit" to new name
    # These appear as standalone "streamlit", entries in the arrays
    dep_groups_pattern = r'^  "streamlit",$'
    content, dep_groups_count = re.subn(
        dep_groups_pattern,
        rf'  "{project_name}",',
        content,
        flags=re.MULTILINE,
    )
    if dep_groups_count == 0:
        raise Exception(
            f'In file "{file_path}", did not find regex "{dep_groups_pattern}"'
        )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def update_files(project_name: str, files: dict[str, str]) -> None:
    """Update files with new project name."""
    for filename, regex in files.items():
        file_path = os.path.join(BASE_DIR, filename)
        matched = False
        pattern = re.compile(regex)
        for line in fileinput.input(file_path, inplace=True):
            updated_line = line.rstrip()
            if pattern.match(updated_line):
                updated_line = re.sub(
                    regex, rf"\g<pre_match>{project_name}\g<post_match>", updated_line
                )
                matched = True
            print(updated_line)
        if not matched:
            raise Exception(f'In file "{file_path}", did not find regex "{regex}"')


def main() -> None:
    if len(sys.argv) != 2:
        raise Exception(f'Specify project name, e.g: "{sys.argv[0]} streamlit-nightly"')
    project_name = sys.argv[1]
    update_files(project_name, FILES_AND_REGEXES)
    update_root_pyproject_toml(project_name)


if __name__ == "__main__":
    main()
