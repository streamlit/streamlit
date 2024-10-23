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
Runs all the scripts in the e2e_playwright folder in "bare" mode - that is,
using `python [script]` as opposed to `streamlit run [script]`.

If any script exits with a non-zero status, this will also exit
with a non-zero status.
"""

import multiprocessing
import os
import subprocess
import sys
from multiprocessing import Lock
from multiprocessing.pool import ThreadPool
from typing import Set

import click

# Where we expect to find the example files.
E2E_DIR = "e2e_playwright"

# the hostframe_app.py script does not work because without a script_context
# the navigation function will raise an exception when trying some non-existing page properties.
EXCLUDED_FILENAMES: Set[str] = set(["compilation_error_dialog.py", "hostframe_app.py"])

# Since there is not DISPLAY set (and since Streamlit is not actually running
# and fixing Matplotlib in these tests), we set the MPL backend to something
# that doesn't require a display.
os.environ["MPLBACKEND"] = "Agg"


def _command_to_string(command):
    return " ".join(command) if isinstance(command, list) else command


def _get_filenames(folder):
    folder_path = os.path.abspath(folder)
    return [
        os.path.join(folder_path, filename)
        for filename in sorted(os.listdir(folder_path))
        if filename.endswith(".py")
        and not filename.endswith("_test.py")
        and filename not in EXCLUDED_FILENAMES
    ]


def run_commands(section_header, commands):
    """Run a list of commands, displaying them within the given section."""

    pool = ThreadPool(processes=max(1, multiprocessing.cpu_count() - 1))
    lock = Lock()
    failed_commands = []

    def process_command(arg):
        i, command = arg

        # Display the status.
        click.secho(
            f"\nRunning {section_header} {i + 1}/{len(commands)} : {_command_to_string(command)}",
            bold=True,
        )

        # Run the command.
        result = subprocess.call(
            command.split(" "), stdout=subprocess.DEVNULL, stderr=None
        )
        if result != 0:
            with lock:
                failed_commands.append(command)

    pool.map(process_command, enumerate(commands))
    return failed_commands


def main():
    filenames = _get_filenames(E2E_DIR)
    commands = [f"python {filename}" for filename in filenames]
    failed = run_commands("bare scripts", commands)

    if len(failed) == 0:
        click.secho("All scripts succeeded!", fg="green", bold=True)
        sys.exit(0)
    else:
        click.secho(
            "\n".join(_command_to_string(command) for command in failed), fg="red"
        )
        click.secho(f"\n{ len(failed)} failed scripts", fg="red", bold=True)
        sys.exit(-1)


if __name__ == "__main__":
    main()
