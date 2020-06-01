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

"""Unit tests for the Streamlit CLI."""

import unittest

import os

import requests
import requests_mock
import mock
from click.testing import CliRunner
from mock import patch, MagicMock
from parameterized import parameterized
from testfixtures import tempdir

import streamlit
from streamlit import cli
from streamlit import config
from streamlit.cli import _convert_config_option_to_click_option
from streamlit.cli import _apply_config_options_from_cli
from streamlit.ConfigOption import ConfigOption


class CliTest(unittest.TestCase):
    """Unit tests for the cli."""

    def setUp(self):
        cli.name = "test"
        self.runner = CliRunner()
        streamlit._is_running_with_streamlit = False
        patch.object(config._on_config_parsed, "send").start()

    def test_run_no_arguments(self):
        """streamlit run should fail if run with no arguments."""
        result = self.runner.invoke(cli, ["run"])
        self.assertNotEqual(0, result.exit_code)

    def test_run_existing_file_argument(self):
        """streamlit run succeeds if an existing file is passed."""
        with patch("validators.url", return_value=False), patch(
            "streamlit.cli._main_run"
        ), patch("os.path.exists", return_value=True):

            result = self.runner.invoke(cli, ["run", "file_name.py"])
        self.assertEqual(0, result.exit_code)

    def test_run_non_existing_file_argument(self):
        """streamlit run should fail if a non existing file is passed."""

        with patch("validators.url", return_value=False), patch(
            "streamlit.cli._main_run"
        ), patch("os.path.exists", return_value=False):

            result = self.runner.invoke(cli, ["run", "file_name.py"])
        self.assertNotEqual(0, result.exit_code)
        self.assertTrue("File does not exist" in result.output)

    def test_run_not_allowed_file_extension(self):
        """streamlit run should fail if a not allowed file extension is passed.
        """

        result = self.runner.invoke(cli, ["run", "file_name.doc"])

        self.assertNotEqual(0, result.exit_code)
        self.assertTrue(
            "Streamlit requires raw Python (.py) files, not .doc." in result.output
        )

    @tempdir()
    def test_run_valid_url(self, temp_dir):
        """streamlit run succeeds if an existing url is passed."""

        with patch("validators.url", return_value=True), patch(
            "streamlit.cli._main_run"
        ), requests_mock.mock() as m:

            file_content = b"content"
            m.get("http://url/app.py", content=file_content)
            with patch("streamlit.temporary_directory.TemporaryDirectory") as mock_tmp:
                mock_tmp.return_value.__enter__.return_value = temp_dir.path
                result = self.runner.invoke(cli, ["run", "http://url/app.py"])
                with open(os.path.join(temp_dir.path, "app.py"), "rb") as f:
                    self.assertEqual(file_content, f.read())

        self.assertEqual(0, result.exit_code)

    @tempdir()
    def test_run_non_existing_url(self, temp_dir):
        """streamlit run should fail if a non existing but valid
         url is passed.
         """

        with patch("validators.url", return_value=True), patch(
            "streamlit.cli._main_run"
        ), requests_mock.mock() as m:

            m.get("http://url/app.py", exc=requests.exceptions.RequestException)
            with patch("streamlit.temporary_directory.TemporaryDirectory") as mock_tmp:
                mock_tmp.return_value.__enter__.return_value = temp_dir.path
                result = self.runner.invoke(cli, ["run", "http://url/app.py"])

        self.assertNotEqual(0, result.exit_code)
        self.assertTrue("Unable to fetch" in result.output)

    def test_run_arguments(self):
        """The correct command line should be passed downstream."""
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
        with patch("streamlit.cli.bootstrap.run"), mock.patch(
            "streamlit.credentials.Credentials._check_activated"
        ), patch("streamlit.cli._get_command_line_as_string"):

            cli._main_run("/not/a/file", None)
            self.assertTrue(streamlit._is_running_with_streamlit)

    def test_convert_config_option_to_click_option(self):
        """Test that configurator_options adds dynamic commands based on a
        config lists.
        """
        config_option = ConfigOption(
            "server.customKey",
            description="Custom description.\n\nLine one.",
            deprecated=False,
            type_=int,
        )

        result = _convert_config_option_to_click_option(config_option)

        self.assertEqual(result["option"], "--server.customKey")
        self.assertEqual(result["param"], "server_customKey")
        self.assertEqual(result["type"], config_option.type)
        self.assertEqual(result["description"], config_option.description)
        self.assertEqual(result["envvar"], "STREAMLIT_SERVER_CUSTOM_KEY")

    @patch("streamlit.cli._config._on_config_parsed.send")
    @patch("streamlit.cli._config._set_option")
    def test_apply_config_options_from_cli(
        self, patched__set_option, patched___send_on_config_parsed
    ):
        """Test that _apply_config_options_from_cli parses the key properly and
        passes down the parameters.
        """

        kwargs = {
            "server_port": 3005,
            "server_headless": True,
            "browser_serverAddress": "localhost",
            "global_minCachedMessageSize": None,
            "global_logLevel": "error",
        }

        _apply_config_options_from_cli(kwargs)

        patched__set_option.assert_has_calls(
            [
                mock.call(
                    "server.port", 3005, "command-line argument or environment variable"
                ),
                mock.call(
                    "server.headless",
                    True,
                    "command-line argument or environment variable",
                ),
                mock.call(
                    "browser.serverAddress",
                    "localhost",
                    "command-line argument or environment variable",
                ),
                mock.call(
                    "global.logLevel",
                    "error",
                    "command-line argument or environment variable",
                ),
            ],
            any_order=True,
        )
        self.assertTrue(patched___send_on_config_parsed.called)

    def test_credentials_headless_no_config(self):
        """If headless mode and no config is present,
        activation should be None."""
        from streamlit import config

        config.set_option("server.headless", True)

        with patch("validators.url", return_value=False), patch(
            "streamlit.bootstrap.run"
        ), patch("os.path.exists", return_value=True), patch(
            "streamlit.credentials._check_credential_file_exists", return_value=False
        ):
            result = self.runner.invoke(cli, ["run", "some script.py"])
        from streamlit.credentials import Credentials

        credentials = Credentials.get_current()
        self.assertIsNone(credentials.activation)
        self.assertEqual(0, result.exit_code)

    @parameterized.expand([(True,), (False,)])
    def test_credentials_headless_with_config(self, headless_mode):
        """If headless, but a config file is present, activation should be
        defined.
        So we call `_check_activated`.
        """
        from streamlit import config

        config.set_option("server.headless", headless_mode)

        with patch("validators.url", return_value=False), patch(
            "streamlit.bootstrap.run"
        ), patch("os.path.exists", side_effect=[True, True]), mock.patch(
            "streamlit.credentials.Credentials._check_activated"
        ) as mock_check, patch(
            "streamlit.credentials._check_credential_file_exists", return_value=True
        ):
            result = self.runner.invoke(cli, ["run", "some script.py"])
        self.assertTrue(mock_check.called)
        self.assertEqual(0, result.exit_code)
