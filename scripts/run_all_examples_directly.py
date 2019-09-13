#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""Runs all the scripts in the examples and e2e folders.

Uses `python [script]` as opposed to `streamlit run [script]`.
"""

import os
import click

# Where we expect to find the example files.
EXAMPLE_DIR = 'examples'
E2E_DIR = 'e2e/scripts'

# These are all the files we excliude
EXCLUDED_FILENAMES = ()


def _get_filenames(dir):
    dir = os.path.abspath(dir)
    return [
        os.path.join(dir, filename) for filename in sorted(os.listdir(dir))
        if filename.endswith('.py') and filename not in EXCLUDED_FILENAMES
    ]


def run_commands(section_header, commands, comment=None):
    """Run a list of commands, displaying them within the given section."""
    failed_commands = []

    for i, command in enumerate(commands):
        # Display the status.
        vars = {
            'section_header': section_header,
            'total': len(commands),
            'command': command,
            'v': i + 1,
        }
        click.secho(
            '\nRunning %(section_header)s %(v)s/%(total)s : %(command)s' % vars,
            bold=True)
        click.secho(
            '\n%(v)s/%(total)s : %(command)s' % vars,
            fg='yellow', bold=True)

        if comment:
            click.secho(comment)

        # Run the command.
        result = os.system(command)
        if result != 0:
            failed_commands.append(command)

    return failed_commands


def main():
    filenames = _get_filenames(EXAMPLE_DIR) + _get_filenames(E2E_DIR)
    commands = ['python %s' % filename for filename in filenames]
    failed = run_commands('tests', commands)

    click.secho('%s failed commands\n%s' % (len(failed), '\n'.join(failed)))


if __name__ == '__main__':
    main()
