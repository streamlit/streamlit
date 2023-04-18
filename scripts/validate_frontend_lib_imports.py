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

"""
Iterate all Typescript files in the frontend/lib directory and ensure they don't import from
'src/app'. Exit with a non-zero error code if any file has an illegal import.

We're doing this ahead of splitting the frontend into two distinct packages (app and lib).
Once the split is complete, this script will be unnecessary and can be removed!
"""

import os
import re
import sys


def validate_files(directory: str) -> None:
    search_pattern = r"from\s+['\"]src\/app\/[^'\"]+['\"]"
    regex = re.compile(search_pattern)

    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith(".ts") and not file.endswith(".tsx"):
                continue

            file_path = os.path.join(root, file)

            with open(file_path, "r") as f:
                file_lines = f.readlines()

                for line_number, line in enumerate(file_lines, start=1):
                    if regex.search(line):
                        print(
                            f"Error: TypeScript import from 'src/app' found in {file_path} (line {line_number}): {line.strip()}"
                        )
                        sys.exit(1)

    print(f"No imports from 'src/app' found in '{directory}'")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {os.path.basename(__file__)} [directory]")
        sys.exit(1)

    directory = sys.argv[1]

    if not os.path.exists(directory):
        print(f"Error: Directory '{directory}' does not exist")
        sys.exit(1)

    validate_files(directory)
