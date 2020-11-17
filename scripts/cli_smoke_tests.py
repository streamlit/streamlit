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

import pathlib
import subprocess
import json

import click

HERE = pathlib.Path(__file__).parent.resolve()
SCRIPT_PATH = HERE.joinpath("test_data", "print_command_line.py")


def main():
    standard_cli_command = ["streamlit", "run", str(SCRIPT_PATH)]
    command_line_seen_for_standard = _get_command_line_seen_by_server(
        standard_cli_command
    )

    _test_agrees_with_expected_with_click_feedback(
        provided=standard_cli_command,
        seen=command_line_seen_for_standard,
        expected=standard_cli_command,
    )

    command_via_module = ["python", "-m", "streamlit", "run", str(SCRIPT_PATH)]
    command_expected_to_be_seen = ["__main__.py", "run", str(SCRIPT_PATH)]

    command_line_seen_for_module = _get_command_line_seen_by_server(command_via_module)

    _test_agrees_with_expected_with_click_feedback(
        provided=command_via_module,
        seen=command_line_seen_for_module,
        expected=command_expected_to_be_seen,
    )

    click.secho("CLI smoke tests succeeded!", fg="green", bold=True)


def _test_agrees_with_expected_with_click_feedback(provided, seen, expected):
    provided_as_string = " ".join(provided)
    expected_as_string = " ".join(expected)

    feedback_string = (
        f"\nWhen the following was called:\n\n    {provided_as_string}\n\n"
        f"The Streamlit server saw:\n\n    {seen}\n\n"
        "Which {agreement} with what was expected:\n\n"
        f"    {expected_as_string}\n\n"
    )

    if expected_as_string == seen:
        click.secho(
            feedback_string.format(agreement="agrees"),
            fg="green",
            bold=True,
        )
    else:
        click.secho(
            feedback_string.format(agreement="disagrees"),
            fg="red",
            bold=True,
        )
        raise AssertionError("Unexpected command line seen")


def _get_command_line_seen_by_server(command):
    result = subprocess.Popen(command, stdout=subprocess.PIPE)

    key = "server._command_line"

    all_command_line_json_found = [
        item.decode()
        for item in result.stdout.readlines()
        if item.decode().startswith(f'{{"{key}": ')
    ]
    assert len(all_command_line_json_found) == 1
    command_line_json = all_command_line_json_found[0]

    command_line = json.loads(command_line_json)[key]
    return command_line


if __name__ == "__main__":
    main()
