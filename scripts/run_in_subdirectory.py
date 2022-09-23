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

import subprocess
import sys
import textwrap
from pathlib import Path
from typing import Tuple, List

if __name__ not in ("__main__", "__mp_main__"):
    raise SystemExit(
        "This file is intended to be executed as an executable program. You cannot use "
        "it as a module.To run this script, run the ./{__file__} command"
    )


def is_relative_to(path: Path, *other):
    """Return True if the path is relative to another path or False.

    This function is backported from Python 3.9 - Path.relativeto.
    """
    try:
        path.relative_to(*other)
        return True
    except ValueError:
        return False


def display_usage():
    prog = Path(__file__).name
    print(
        textwrap.dedent(
            f"""\
    usage: {prog} [-h] SUBDIRECTORY ARGS [ARGS ...]

    Runs the program in a subdirectory and fix paths in arguments.

    example:

    When this program is executed with the following command:
       {prog} frontend/ yarn eslint frontend/src/index.ts
    Then the command will be executed:
        yarn eslint src/index.ts
    and the current working directory will be set to frontend/

    positional arguments:
      SUBDIRECTORY  subdirectory within which the subprocess will be executed
      ARGS  sequence of program arguments

    optional arguments:
      -h, --help    show this help message and exit\
    """
        )
    )


def parse_args() -> Tuple[str, List[str]]:
    if len(sys.argv) == 2 and sys.argv[1] in ("-h", "--help"):
        display_usage()
        sys.exit(0)
    if len(sys.argv) < 3:
        print("Missing arguments")
        display_usage()
        sys.exit(1)
    print(sys.argv)

    return sys.argv[1], sys.argv[2:]


def fix_arg(subdirectory: str, arg: str) -> str:
    arg_path = Path(arg)
    if not (arg_path.exists() and is_relative_to(arg_path, subdirectory)):
        return arg
    return str(arg_path.relative_to(subdirectory))


def main():
    subdirectory, subprocess_args = parse_args()

    fixed_args = [fix_arg(subdirectory, arg) for arg in subprocess_args]
    try:
        subprocess.run(fixed_args, cwd=subdirectory, check=True)
    except subprocess.CalledProcessError as ex:
        sys.exit(ex.returncode)


main()
