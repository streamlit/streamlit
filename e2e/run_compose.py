#!/usr/bin/env python3
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

import os
import subprocess
import sys
import textwrap
from pathlib import Path
from typing import List

PROG = Path(__file__).name

if __name__ not in ("__main__", "__mp_main__"):
    raise SystemExit(
        "This file is intended to be executed as an executable program. You cannot use "
        f"it as a module. To run this script, run the ./{PROG} command"
    )


E2E_DIR = Path(__file__).resolve().parent
ROOT_DIR = E2E_DIR.parent

IN_CONTAINER_HOME = Path("/home/circleci/repo")


def is_relative_to(path: Path, *other):
    """Return True if the path is relative to another path or False.

    This function is backported from Python 3.9 - Path.is_relative_to.
    """
    try:
        path.relative_to(*other)
        return True
    except ValueError:
        return False


def display_usage():
    print(
        textwrap.dedent(
            f"""\
    usage: {PROG} [-h] [ARGS ...]

    Runs the compose environment for E2E tests

    If additional arguments are passed, it will be executed as a command
    in the environment.

    If no additional arguments are passed, the bash console will be started.

    The script automatically enters the corresponding directory in the container,
    so you can safely pass relatively paths as script arguments.

    example:

    To run a single test, run command:
    ./{PROG} ../scripts/run_e2e_tests.py -u ./specs/st_code.spec.js

    positional arguments:
      ARGS  sequence of program arguments

    optional arguments:
      -h, --help    show this help message and exit\
    """
        )
    )


def parse_args() -> List[str]:
    if len(sys.argv) == 2 and sys.argv[1] in ("-h", "--help"):
        display_usage()
        sys.exit(0)

    return sys.argv[1:]


def get_container_cwd():

    cwd_path = Path(os.getcwd())
    if not is_relative_to(cwd_path, ROOT_DIR):
        print(
            textwrap.dedent(
                "You must be in your repository directory to run this command.\n"
                "To go to the repository, run command:\n"
                f"    cd {str(ROOT_DIR)}"
            ),
            file=sys.stderr,
        )
        sys.exit(1)
    return str(IN_CONTAINER_HOME / cwd_path.relative_to(ROOT_DIR))


def main():
    subprocess_args = parse_args()
    (ROOT_DIR / "frontend" / "test_results").mkdir(parents=True, exist_ok=True)

    in_container_working_directory = get_container_cwd()
    compose_file = str(E2E_DIR / "docker-compose.yml")

    docker_compose_args = [
        "docker-compose",
        f"--file={compose_file}",
        "run",
        "--rm",
        "--name=streamlit_e2e_tests",
        f"--workdir={in_container_working_directory}",
        "streamlit_e2e_tests",
        *subprocess_args,
    ]
    try:
        subprocess.run(docker_compose_args, check=True)
    except subprocess.CalledProcessError as ex:
        sys.exit(ex.returncode)


main()
