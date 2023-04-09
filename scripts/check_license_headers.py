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

import re
import subprocess
import sys
from pathlib import Path

if __name__ not in ("__main__", "__mp_main__"):
    raise SystemExit(
        "This file is intended to be executed as an executable program. You cannot use "
        f"it as a module.To run this script, run the ./{__file__} command"
    )

SCRIPT_DIR = Path(__file__).resolve().parent
# We just check if the first line of the license is in the file. This is
# enough to check that the file is okay.
LICENSE_TEXT = (SCRIPT_DIR / "license-template.txt").read_text().splitlines()[0]

IGNORE_PATTERN = re.compile(
    # Exclude CI files.
    r"^\.(github|circleci)/"
    # Exclude images.
    r"|\.(?:png|jpg|jpeg|gif|ttf|woff|otf|eot|woff2|ico|svg)$"
    # Exclude files, because they make it obvious which product they relate to.
    r"|(LICENSE|NOTICES|CODE_OF_CONDUCT\.md|README\.md|CONTRIBUTING\.md)$"
    # Exclude files, because they do not support comments
    r"|\.(json|prettierrc|nvmrc)$"
    # Exclude generated files, because they don't have any degree of creativity.
    r"|yarn\.lock$"
    # Exclude empty files, because they don't have any degree of creativity.
    r"|py\.typed$"
    # Exclude dev-tools configuration files, because they don't have any
    # degree of creativity.
    r"|^(\.dockerignore|\.editorconfig|\.gitignore|\.gitmodules)$"
    r"|^frontend/(\.dockerignore|\.eslintrc|\.prettierignore)$"
    r"|^lib/(\.coveragerc|\.dockerignore|MANIFEST\.in|mypy\.ini|pytest\.ini)$"
    r"|^lib/(test-requirements-with-tensorflow\.txt|(test|dev)-requirements\.txt)$"
    r"|\.isort\.cfg$"
    r"|\.credentials/\.gitignore$"
    # Excluding test files, because adding headers may cause tests to fail.
    r"|/(fixtures|__snapshots__|vendor|test_data|data)/"
    # Exclude vendored files.
    r"|/vendor/|^component-lib/declarations/apache-arrow"
    r"|proto/streamlit/proto/openmetrics_data_model\.proto"
    r"|lib/tests/isolated_asyncio_test_case\.py",
    re.IGNORECASE,
)


def main():
    git_files = sorted(
        subprocess.check_output(["git", "ls-files", "--no-empty-directory"])
        .decode()
        .strip()
        .splitlines()
    )

    invalid_files_count = 0
    for fileloc in git_files:
        if IGNORE_PATTERN.search(fileloc):
            continue
        filepath = Path(fileloc)
        # Exclude submodules
        if not filepath.is_file():
            continue

        try:
            file_content = filepath.read_text()
            if LICENSE_TEXT not in file_content:
                print("Found file without license header", fileloc)
                invalid_files_count += 1
        except:
            print(
                f"Failed to open the file: {fileloc}. Is it binary file?",
            )
            invalid_files_count += 1

    print("Invalid files count:", invalid_files_count)
    if invalid_files_count > 0:
        sys.exit(1)


main()
