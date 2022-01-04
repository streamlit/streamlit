#!/usr/bin/env python
# Copyright 2018-2021 Streamlit Inc.
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

"""Runs all the scripts in the examples folder (except this one)."""

import os
import sys
import click

# True means we run through all tests automatically.
auto_run = False

# Where we expect to find the example files.
EXAMPLE_DIR = "examples"

# These are all the files we excliude
EXCLUDED_FILENAMES = (
    # Exclude mnist becuase it takes so long to run.
    "mnist-cnn.py",
    # Exclude caching because we special case it.
    "caching.py",
)


def run_commands(section_header, commands, skip_last_input=False, comment=None):
    """Run a list of commands, displaying them within the given section."""
    global auto_run

    for i, command in enumerate(commands):
        # Display the status.
        vars = {
            "section_header": section_header,
            "total": len(commands),
            "command": command,
            "v": i + 1,
        }
        click.secho(
            f"\nRunning {vars['section_header']} {vars['v']}/{vars['total']} : {vars['command']}",
            bold=True,
        )
        click.secho(
            f"\n{vars['v']}/{vars['total']} : {vars['command']}", fg="yellow", bold=True
        )

        if comment:
            click.secho(comment)

        # Run the command.
        os.system(command)

        last_command = i + 1 == len(commands)
        if not (auto_run or (last_command and skip_last_input)):
            click.secho(
                "Press [enter] to continue or [a] to continue on auto:\n> ", nl=False
            )
            response = click.getchar()
            if response == "a":
                print("Turning on auto run.")
                auto_run = True


def main():
    # First run the 'streamlit commands'
    run_commands("Basic Commands", ["streamlit version"])

    run_commands(
        "Standard System Errors",
        ["streamlit run does_not_exist.py"],
        comment="Checks to see that file not found error is caught",
    )

    run_commands("Hello script", ["streamlit hello"])

    run_commands(
        "Examples",
        [
            f"streamlit run {EXAMPLE_DIR}/{filename}"
            for filename in os.listdir(EXAMPLE_DIR)
            if filename.endswith(".py") and filename not in EXCLUDED_FILENAMES
        ],
    )

    run_commands(
        "Caching",
        ["streamlit cache clear", f"streamlit run {EXAMPLE_DIR}/caching.py"],
    )

    run_commands(
        "MNIST", [f"streamlit run {EXAMPLE_DIR}/mnist-cnn.py"], skip_last_input=True
    )

    click.secho("\n\nCompleted all tests!", bold=True)


if __name__ == "__main__":
    main()
