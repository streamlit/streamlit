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
import enum
import fnmatch
import json
import os
import subprocess
import sys
from typing import Dict, List

if __name__ not in ("__main__", "__mp_main__"):
    raise SystemExit(
        "This file is intended to be executed as an executable program. You cannot use "
        f"it as a module. To run this script, run the ./{__file__} command"
    )

GITHUB_CONTEXT_ENV_VAR = "GITHUB_CONTEXT"
GITHUB_OUTPUT_ENV_VAR = "GITHUB_OUTPUT"
GITHUB_ENV_ENV_VAR = "GITHUB_ENV"

# The walrus operator requires Python 3.8 or newer
if missing_envs := [
    env_var
    for env_var in [GITHUB_CONTEXT_ENV_VAR, GITHUB_OUTPUT_ENV_VAR, GITHUB_ENV_ENV_VAR]
    if env_var not in os.environ
]:
    raise SystemExit(f"Missing environment variables: {', '.join(missing_envs)}")


FILES_WITH_PYTHON_DEPENDENCIES = [
    "lib/test-requirements*.txt",
    "lib/setup.py",
    "lib/Pipfile",
    "lib/Pipfile.lock",
]
# +1 to make range inclusive.
ALL_PYTHON_VERSIONS = [f"3.{d}" for d in range(7, 11 + 1)]
LABEL_FULL_MATRIX = "dev:full-matrix"

GITHUB_CONTEXT = json.loads(os.environ[GITHUB_CONTEXT_ENV_VAR])
GITHUB_EVENT = GITHUB_CONTEXT["event"]
GITHUB_EVENT_NAME = GITHUB_CONTEXT["event_name"]


class GithubEvent(enum.Enum):
    PULL_REQUEST = "pull_request"
    PUSH = "push"


def get_changed_files() -> List[str]:
    git_output = subprocess.check_output(
        [
            "git",
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            f"HEAD^",
            "HEAD",
        ]
    )
    return [line for line in git_output.decode().splitlines() if line]


def should_test_all_python_versions() -> bool:
    print(f"Current github event name: {GITHUB_EVENT_NAME!r}")
    if GITHUB_EVENT_NAME == GithubEvent.PULL_REQUEST.value:
        pr_labels = [
            label["name"] for label in GITHUB_EVENT["pull_request"].get("labels", [])
        ]
        if LABEL_FULL_MATRIX in pr_labels:
            print(f"PR has the following labels: {pr_labels}")
            print(
                f"All Python versions will be tested, "
                f"because PR has {LABEL_FULL_MATRIX!r} label."
            )
            return True
        changed_files = get_changed_files()
        changed_dependencies_files = sorted(
            path
            for pattern in FILES_WITH_PYTHON_DEPENDENCIES
            for path in fnmatch.filter(changed_files, pattern)
        )
        if changed_dependencies_files:
            print(f"{len(changed_dependencies_files)} files changed in this build.")
            print(
                "All Python versions will be tested, because "
                "the following files have been modified:"
            )
            print("- " + "- ".join(changed_dependencies_files))
            return True
        return False
    elif GITHUB_EVENT_NAME == GithubEvent.PUSH.value:
        default_branch = GITHUB_EVENT["repository"]["default_branch"]
        is_default_branch = (
            GITHUB_CONTEXT["ref_type"] == "branch"
            and default_branch == GITHUB_CONTEXT["ref_name"]
        )
        if is_default_branch:
            print(
                f"All Python versions will be tested, because "
                f"the default branch ({default_branch!r}) is checked."
            )
            return True
        return False
    print(
        f"All Python versions will be tested, "
        f"because current github event name is {GITHUB_EVENT_NAME!r}"
    )
    return True


def get_output_variables() -> Dict[str, str]:
    return {
        "PYTHON_MIN_VERSION": ALL_PYTHON_VERSIONS[0],
        "PYTHON_MAX_VERSION": ALL_PYTHON_VERSIONS[-1],
        "PYTHON_VERSIONS": json.dumps(
            ALL_PYTHON_VERSIONS
            if should_test_all_python_versions()
            else [ALL_PYTHON_VERSIONS[0], ALL_PYTHON_VERSIONS[-1]]
        ),
    }


def save_env_variables(variables) -> None:
    print("Saving output variables")
    with open(os.environ[GITHUB_ENV_ENV_VAR], "w+") as github_env_file, open(
        os.environ[GITHUB_OUTPUT_ENV_VAR], "w+"
    ) as github_output_file:
        for target_file in [sys.stdout, github_env_file, github_output_file]:
            for name, value in variables.items():
                target_file.write(f"{name}={value}\n")
            target_file.flush()


def main() -> None:
    output_variables = get_output_variables()
    save_env_variables(output_variables)


main()
