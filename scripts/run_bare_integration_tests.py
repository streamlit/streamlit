#!/usr/bin/env python
# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Runs all the scripts in the e2e/scripts folder in "bare" mode - that is,
using `python [script]` as opposed to `streamlit run [script]`.

If any script exits with a non-zero status, this will also exit
with a non-zero status.
"""

import os
import subprocess
import sys
from typing import Set

import click

IS_PYTHON_3_6 = sys.version_info[:2] == (3, 6)

# Where we expect to find the example files.
E2E_DIR = "e2e/scripts"

EXCLUDED_FILENAMES = set()  # type: Set[str]

# Since there is not DISPLAY set (and since Streamlit is not actually running
# and fixing Matplotlib in these tests), we set the MPL backend to something
# that doesn't require a display.
os.environ["MPLBACKEND"] = "Agg"

# Scripts that rely on matplotlib can't be run in Python2. matplotlib
# dropped Py2 support, and so we don't install it in our virtualenv.
try:
    import matplotlib
except ImportError:
    EXCLUDED_FILENAMES |= set(["empty_charts.py", "pyplot.py", "pyplot_kwargs.py"])

# magic.py uses contextlib.asynccontextmanager, which is Python 3.7+
if IS_PYTHON_3_6:
    EXCLUDED_FILENAMES.add("st_magic.py")


def _command_to_string(command):
    if isinstance(command, list):
        return " ".join(command)
    else:
        return command


def _get_filenames(dir):
    dir = os.path.abspath(dir)
    return [
        os.path.join(dir, filename)
        for filename in sorted(os.listdir(dir))
        if filename.endswith(".py") and filename not in EXCLUDED_FILENAMES
    ]


def run_commands(section_header, commands):
    """Run a list of commands, displaying them within the given section."""
    failed_commands = []

    for i, command in enumerate(commands):
        # Display the status.
        vars = {
            "section_header": section_header,
            "total": len(commands),
            "command": _command_to_string(command),
            "v": i + 1,
        }
        click.secho(
            "\nRunning %(section_header)s %(v)s/%(total)s : %(command)s" % vars,
            bold=True,
        )

        # Run the command.
        result = subprocess.call(
            command.split(" "), stdout=subprocess.DEVNULL, stderr=None
        )
        if result != 0:
            failed_commands.append(command)

    return failed_commands


def main():
    filenames = _get_filenames(E2E_DIR)
    commands = ["python %s" % filename for filename in filenames]
    failed = run_commands("bare scripts", commands)

    if len(failed) == 0:
        click.secho("All scripts succeeded!", fg="green", bold=True)
        sys.exit(0)
    else:
        click.secho(
            "\n".join(_command_to_string(command) for command in failed), fg="red"
        )
        click.secho("\n%s failed scripts" % len(failed), fg="red", bold=True)
        sys.exit(-1)


if __name__ == "__main__":
    main()
