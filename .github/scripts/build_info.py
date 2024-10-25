#!/usr/bin/env python
# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
Generates variables that are needed to execute the Github Action build.

The description of the variables is in the
`.github/actions/build_info/action.yml` file, but variables are also available
in other contexts.

Variables are saved in 3 places to handle 3 use cases:
- The file specified by the GITHUB_OUTPUT environment variable, which
  means the values will be available in the GitHub expression.
  This allows us to have values when communicating between jobs.
  For details, see:
  https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-output-parameter
- The file specified by the GITHUB_ENV environment variable, which
  means the values will be available for other tools run in the following step
  of the same job as environment variable.
  For details, see:
  https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#setting-an-environment-variable
- The standard output, which means the values will be available in the GitHub logs,
  making troubleshooting easier.
"""

from __future__ import annotations

import enum
import fnmatch
import json
import os
import subprocess
import sys

if __name__ not in ("__main__", "__mp_main__"):
    raise SystemExit(
        "This file is intended to be executed as an executable program. You cannot use "
        f"it as a module. To run this script, run the ./{__file__} command"
    )

GITHUB_CONTEXT_ENV_VAR = "GITHUB_CONTEXT"
GITHUB_INPUTS_ENV_VAR = "GITHUB_INPUTS"
GITHUB_OUTPUT_ENV_VAR = "GITHUB_OUTPUT"
GITHUB_ENV_ENV_VAR = "GITHUB_ENV"

REQUIRED_ENV_VAR = (
    [
        GITHUB_CONTEXT_ENV_VAR,
        GITHUB_INPUTS_ENV_VAR,
        GITHUB_OUTPUT_ENV_VAR,
        GITHUB_ENV_ENV_VAR,
    ]
    if "CI" in os.environ
    else [GITHUB_CONTEXT_ENV_VAR]
)
# The walrus operator requires Python 3.8 or newer
if missing_envs := [
    env_var for env_var in REQUIRED_ENV_VAR if env_var not in os.environ
]:
    raise SystemExit(f"Missing environment variables: {', '.join(missing_envs)}")


FILES_WITH_PYTHON_DEPENDENCIES = [
    "lib/dev-requirements.txt",
    "lib/test-requirements*.txt",
    "lib/setup.py",
]
# +1 to make range inclusive.
ALL_PYTHON_VERSIONS = [f"3.{d}" for d in range(9, 13 + 1)]
PYTHON_MIN_VERSION = ALL_PYTHON_VERSIONS[0]
PYTHON_MAX_VERSION = ALL_PYTHON_VERSIONS[-1]

# To avoid the need to update the protected branch, we replace the boundary
# values with fixed literal. We map it to real values in the Github workflow.
ALL_PYTHON_VERSIONS[0] = "min"
ALL_PYTHON_VERSIONS[-1] = "max"

LABEL_FULL_MATRIX = "dev:full-matrix"
LABEL_UPGRADE_DEPENDENCIES = "dev:upgrade-dependencies"

GITHUB_CONTEXT = json.loads(os.environ[GITHUB_CONTEXT_ENV_VAR])
GITHUB_EVENT = GITHUB_CONTEXT["event"]
GITHUB_EVENT_NAME = GITHUB_CONTEXT["event_name"]


class GithubEvent(enum.Enum):
    PULL_REQUEST = "pull_request"
    PUSH = "push"
    SCHEDULE = "schedule"


def get_changed_files() -> list[str]:
    """
    Checks the modified files in the last commit.

    Note that GITHUB_SHA for pull_request event is the last merge commit of the pull
    request merge branch, which means that the last commit for a pull request always
    lists all files modified by PR.

    This script required the repository to have at least two recent commits checked
    out, which means that Github Action actions/checkout must set the a parameter
    fetch-depth to a value equal or greater than 2.

    Example:

      - name: Checkout Streamlit code
        uses: actions/checkout@v3
        with:
          fetch-depth: 2
    """
    git_output = subprocess.check_output(
        [
            "git",
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "HEAD^",
            "HEAD",
        ]
    )
    return [line for line in git_output.decode().splitlines() if line]


def get_current_pr_labels() -> list[str]:
    """
    Returns a list of all tags associated with the current PR.

    Note that this function works only when the current event is `pull_request`.
    """
    if GITHUB_EVENT_NAME != GithubEvent.PULL_REQUEST.value:
        raise Exception(
            f"Invalid github event. "
            f"Current value: {GITHUB_EVENT_NAME}. "
            f"Expected state: {GithubEvent.PULL_REQUEST.value}"
        )
    return [label["name"] for label in GITHUB_EVENT["pull_request"].get("labels", [])]


def get_changed_python_dependencies_files() -> list[str]:
    """
    Gets a list of files that contain Python dependency definitions and have
    been modified.
    """
    changed_files = get_changed_files()
    changed_dependencies_files = sorted(
        path
        for pattern in FILES_WITH_PYTHON_DEPENDENCIES
        for path in fnmatch.filter(changed_files, pattern)
    )
    return changed_dependencies_files


def check_if_pr_has_label(label: str, action: str) -> bool:
    """
    Checks if the PR has the given label.

    The function works for all GitHub events, but returns false
    for any event that is not a PR.
    """
    if GITHUB_EVENT_NAME == GithubEvent.PULL_REQUEST.value:
        pr_labels = get_current_pr_labels()
        if label in pr_labels:
            print(f"PR has the following labels: {pr_labels}")
            print(f"{action}, because PR has {label !r} label.")
            return True
    return False


def get_github_input(input_key: str) -> str | None:
    """
    Get additional data that the script expects to use during runtime.

    For details, see: https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#inputs
    """
    if GITHUB_INPUTS_ENV_VAR not in os.environ:
        return None
    inputs = json.loads(os.environ[GITHUB_INPUTS_ENV_VAR]) or {}
    input_value = inputs.get(input_key)
    return input_value


def is_canary_build() -> bool:
    """
    Checks whether current build is canary.

    Canary builds are tested on all Python versions and do not use constraints.
    Non-canary builds are tested by default on the oldest and latest Python versions
    and use constraints files by default.

    The behavior depends on what event triggered the current GitHub Action build to run.

    For pull_request event, we return true when Python dependencies have been modified
    In other case, we return false.

    For push event, we return true when the default branch is checked. In other case,
    we return false.

    For scheduled event, we always return true.

    For other events, we return false

    Build canary can be enforced by workflow inputs parameter e.g. all "Build Release"
    workflows trigger canary builds.
    """
    force_canary_input = get_github_input("force-canary") or "false"
    if force_canary_input.lower() == "true":
        print("Current build is canary, because it is enforced by input")
        return True
    if GITHUB_EVENT_NAME == GithubEvent.PULL_REQUEST.value:
        changed_dependencies_files = get_changed_python_dependencies_files()
        if changed_dependencies_files:
            print(f"{len(changed_dependencies_files)} files changed in this build.")
            print(
                "Current build is canary, "
                "because the following files have been modified:"
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
                "Current build is canary, "
                f"because the default branch ({default_branch!r}) is checked."
            )
            return True
        return False
    elif GITHUB_EVENT_NAME == GithubEvent.SCHEDULE.value:
        print(
            "Current build is canary, "
            f"because current github event name is {GITHUB_EVENT_NAME!r}"
        )
        return True

    print(
        "Current build is NOT canary, "
        f"because current github event name is {GITHUB_EVENT_NAME!r}"
    )
    return False


def get_output_variables() -> dict[str, str]:
    """
    Compute build variables.
    """
    canary_build = is_canary_build()
    python_versions = (
        ALL_PYTHON_VERSIONS
        if canary_build
        or check_if_pr_has_label(
            LABEL_FULL_MATRIX, "All Python versions will be tested"
        )
        else [ALL_PYTHON_VERSIONS[0], ALL_PYTHON_VERSIONS[-1]]
    )
    use_constraints_file = not (
        canary_build
        or check_if_pr_has_label(
            LABEL_UPGRADE_DEPENDENCIES, "Latest dependencies will be used"
        )
    )
    variables = {
        "PYTHON_MIN_VERSION": PYTHON_MIN_VERSION,
        "PYTHON_MAX_VERSION": PYTHON_MAX_VERSION,
        "PYTHON_VERSIONS": json.dumps(python_versions),
        "USE_CONSTRAINTS_FILE": str(use_constraints_file).lower(),
    }
    # Environment variables can be overridden at job level and we don't want
    # to change them then.
    for key, value in variables.copy().items():
        variables[key] = os.environ.get(key, value)
    return variables


def save_output_variables(variables: dict[str, str]) -> None:
    """
    Saves build variables
    """
    print("Saving output variables")
    with open(
        os.environ.get(GITHUB_ENV_ENV_VAR, "/dev/null"), "w+"
    ) as github_env_file, open(
        os.environ.get(GITHUB_OUTPUT_ENV_VAR, "/dev/null"), "w+"
    ) as github_output_file:
        for target_file in [sys.stdout, github_env_file, github_output_file]:
            for name, value in variables.items():
                target_file.write(f"{name}={value}\n")
            target_file.flush()


def main() -> None:
    print(f"Current github event name: {GITHUB_EVENT_NAME!r}")
    output_variables = get_output_variables()
    save_output_variables(output_variables)


main()
