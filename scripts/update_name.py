#!/usr/bin/env python

# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import fileinput
import os
import re
import sys
from typing import Dict

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# A dict of [filename:regex]. For each filename, we modify all lines
# matched by the regex.
#
# Regexes should start with a "<pre_match>" named group and end with a
# "<post_match>" named group. Text between these pre- and post-match
# groups will be replaced with the specified project_name text.
FILES_AND_REGEXES = {
    "lib/setup.py": r"(?P<pre_match>.*NAME = \").*(?P<post_match>\")",
    "lib/streamlit/version.py": r"(?P<pre_match>.*_version\(\").*(?P<post_match>\"\)$)",
}


def update_files(project_name: str, files: Dict[str, str]) -> None:
    """Update files with new project name."""
    for filename, regex in files.items():
        filename = os.path.join(BASE_DIR, filename)
        matched = False
        pattern = re.compile(regex)
        for line in fileinput.input(filename, inplace=True):
            line = line.rstrip()
            if pattern.match(line):
                line = re.sub(
                    regex, rf"\g<pre_match>{project_name}\g<post_match>", line
                )
                matched = True
            print(line)
        if not matched:
            raise Exception(f'In file "{filename}", did not find regex "{regex}"')


def main() -> None:
    if len(sys.argv) != 2:
        raise Exception(f'Specify project name, e.g: "{sys.argv[0]} streamlit-nightly"')
    project_name = sys.argv[1]
    update_files(project_name, FILES_AND_REGEXES)


if __name__ == "__main__":
    main()
