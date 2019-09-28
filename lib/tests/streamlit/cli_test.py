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

"""Unit tests for the Streamlit CLI."""

import unittest

import requests
import requests_mock
from click.testing import CliRunner
from mock import patch, MagicMock
import click

import streamlit
from streamlit import cli


class CliTest(unittest.TestCase):
    """Unit tests for the cli."""

    def setUp(self):
        cli.name = "test"
        self.runner = CliRunner()

    def test_run_no_arguments(self):
        """streamlit run should fail if run with no arguments"""
        result = self.runner.invoke(cli, ["run"])
        self.assertNotEqual(0, result.exit_code)

    def test_run_existing_file_argument(self):
        """streamlit run succeeds if an existing file is passed"""
        with patch("validators.url", return_value=False), patch(
            "streamlit.cli._main_run"
        ), patch("os.path.exists", return_value=True):

            result = self.runner.invoke(cli, ["run", "file_name"])
        self.assertEqual(0, result.exit_code)

    def test_run_non_existing_file_argument(self):
        """streamlit run should fail if a non existing file is passed"""

        with patch("validators.url", return_value=False), patch(
            "streamlit.cli._main_run"
        ), patch("os.path.exists", return_value=False):

            result = self.runner.invoke(cli, ["run", "file_name"])
        self.assertNotEqual(0, result.exit_code)
        self.assertTrue("File does not exist" in result.output)

    def test_run_valid_url(self):
        """streamlit run succeeds if an existing url is passed"""

        with patch("validators.url", return_value=True), patch(
            "streamlit.cli._main_run"
        ), requests_mock.mock() as m:

            m.get("http://url", content=b"content")
            with patch("tempfile.NamedTemporaryFile"):
                result = self.runner.invoke(cli, ["run", "http://url"])

        self.assertEqual(0, result.exit_code)

    def test_run_non_existing_url(self):
        """streamlit run should fail if a non existing but valid
         url is passed
         """

        with patch("validators.url", return_value=True), patch(
            "streamlit.cli._main_run"
        ), requests_mock.mock() as m:

            m.get("http://url", exc=requests.exceptions.RequestException)
            with patch("tempfile.NamedTemporaryFile"):
                result = self.runner.invoke(cli, ["run", "http://url"])

        self.assertNotEqual(0, result.exit_code)
        self.assertTrue("Unable to fetch" in result.output)

    def test_run_arguments(self):
        """The correct command line should be passed downstream"""
        with patch("validators.url", return_value=False), patch(
            "os.path.exists", return_value=True
        ):
            with patch("streamlit.cli._main_run") as mock_main_run:
                result = self.runner.invoke(
                    cli,
                    [
                        "run",
                        "some script.py",
                        "argument with space",
                        "argument with another space",
                    ],
                )
        mock_main_run.assert_called_with(
            "some script.py", ("argument with space", "argument with another space")
        )
        self.assertEqual(0, result.exit_code)

    def test_get_command_line(self):
        """Test that _get_command_line_as_string correctly concatenates values
        from click.
        """
        mock_context = MagicMock()
        mock_context.parent.command_path = "mock_command"
        with patch("click.get_current_context", return_value=mock_context):
            with patch("click.get_os_args", return_value=["os_arg1", "os_arg2"]):
                result = cli._get_command_line_as_string()
                self.assertEqual("mock_command os_arg1 os_arg2", result)

    def test_running_in_streamlit(self):
        """Test that streamlit._running_in_streamlit is True after
        calling `streamlit run...`, and false otherwise.
        """
        self.assertFalse(streamlit._is_running_with_streamlit)
        with patch("streamlit.cli.bootstrap.run"), patch(
            "streamlit.credentials.Credentials"
        ), patch("streamlit.cli._get_command_line_as_string"):

            cli._main_run("/not/a/file", None)
            self.assertTrue(streamlit._is_running_with_streamlit)
