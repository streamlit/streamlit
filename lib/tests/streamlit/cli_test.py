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

"""Unit tests for the cli."""

import unittest
from unittest.mock import MagicMock
from click.testing import CliRunner

import tempfile

from streamlit import cli


class CliTest(unittest.TestCase):
    """Unit tests for the cli."""

    def test_help(self):
        """streamlit help should show the expected help text"""
        expected_help = """Usage: _jb_pytest_runner.py [OPTIONS] COMMAND [ARGS]...

  Try out a demo with:

      $ streamlit hello

  Or use the line below to run your own script:

      $ streamlit run your_script.py

Options:
  --log_level [error|warning|info|debug]
  --version                       Show the version and exit.
  --help                          Show this message and exit.

Commands:
  activate  Activate Streamlit by entering your email.
  cache     Manage the Streamlit cache.
  config    Manage Streamlit's config settings.
  docs      Show help in browser.
  hello     Runs the Hello World script.
  help      Print this help message.
  run       Run a Python script, piping stderr to Streamlit.
  version   Print Streamlit's version number.
"""
        runner = CliRunner()
        result = runner.invoke(cli, ['help'])
        self.assertEqual(0, result.exit_code)
        self.assertEqual(expected_help, result.output)

    def test_run_no_arguments(self):
        """streamlit run should fail if run with no arguments"""
        runner = CliRunner()
        result = runner.invoke(cli, ['run'])
        self.assertNotEqual(0, result.exit_code)

    def test_run_existing_file_argument(self):
        """streamlit run succeeds if an existing file is passed"""
        runner = CliRunner()

        # Mocking _main_run
        cli._main_run = MagicMock()

        with tempfile.NamedTemporaryFile() as file:
            result = runner.invoke(cli, ['run', file.name])
        self.assertEqual(0, result.exit_code)

    def test_run_non_existing_file_argument(self):
        """streamlit run should fail if a non existing file is passed"""
        runner = CliRunner()

        # Mocking _main_run
        cli._main_run = MagicMock()

        result = runner.invoke(cli, ['run', '/non-existing-streamlit-script'])
        self.assertNotEqual(0, result.exit_code)

    def test_run_valid_url(self):
        """streamlit run succeeds if an existing url is passed"""
        runner = CliRunner()

        # Mocking _main_run
        cli._main_run = MagicMock()

        result = runner.invoke(cli, ['run', 'http://www.cnn.com'])
        self.assertEqual(0, result.exit_code)

    def test_run_non_valid_url(self):
        """streamlit run should fail if a non valid url is passed"""
        runner = CliRunner()

        # Mocking _main_run
        cli._main_run = MagicMock()

        result = runner.invoke(cli, ['run', 'odd_protocol://www.cnn.com'])
        self.assertNotEqual(0, result.exit_code)

    def test_run_non_existing_url(self):
        """streamlit run should fail if a non existing but valid
         url is passed
         """
        runner = CliRunner()

        # Mocking _main_run
        cli._main_run = MagicMock()

        result = runner.invoke(cli, [
            'run',
            'http://www.cnn.com/some-cnn-streamlit-script'
        ])
        self.assertNotEqual(0, result.exit_code)
