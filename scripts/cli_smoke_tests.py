#!/usr/bin/env python
# Copyright 2018-2022 Streamlit Inc.
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

import subprocess
import sys

import click


def main():
    standard_cli = ["streamlit", "help"]
    if not _can_run_streamlit_help(standard_cli):
        sys.exit("Failed to run `streamlit help`")

    # When calling from module, the called argv[0] is updated by
    # __main__.py to be "streamlit" instead of "__main__.py".
    # If this doesn't occur, an assert stops execution of the program.
    module_cli = ["python", "-m", "streamlit", "help"]
    if not _can_run_streamlit_help(module_cli):
        sys.exit("Failed to run `python -m streamlit help`")

    # Invoking streamlit via `python -m streamlit.cli <command>` is a method
    # that we previously accidentally supported, but we decided that we should
    # only keep official support for the similar `python -m streamlit <command>`
    # invocation.
    unsupported_module_cli = ["python", "-m", "streamlit.cli", "help"]
    if _can_run_streamlit_help(unsupported_module_cli):
        sys.exit("`python -m streamlit.cli help` should not run")

    click.secho("CLI smoke tests succeeded!", fg="green", bold=True)


def _can_run_streamlit_help(command_list):
    result = subprocess.run(command_list, stdout=subprocess.DEVNULL)
    return result.returncode == 0


if __name__ == "__main__":
    main()
