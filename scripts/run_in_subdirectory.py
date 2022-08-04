#!/usr/bin/env python
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
    if not (Path(arg).exists() and Path(arg).is_relative_to(subdirectory)):
        return arg
    return str(Path(arg).relative_to(subdirectory))


def main():
    subdirectory, subprocess_args = parse_args()

    fixed_args = [fix_arg(subdirectory, arg) for arg in subprocess_args]
    try:
        subprocess.run(fixed_args, cwd=subdirectory, check=True)
    except subprocess.CalledProcessError as ex:
        sys.exit(ex.returncode)


main()
