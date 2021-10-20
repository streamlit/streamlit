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

"""Unit tests for the Streamlit CLI."""

from unittest import mock
from unittest.mock import MagicMock, patch
import unittest

import os
import sys

import requests
import requests_mock
from click.testing import CliRunner
from parameterized import parameterized
from testfixtures import tempdir

import streamlit
from streamlit import cli
from streamlit import config
from streamlit.cli import _convert_config_option_to_click_option
from streamlit.config_option import ConfigOption


class CliTest(unittest.TestCase):
    """Unit tests for the cli."""

    def setUp(self):
        cli.name = "test"
        self.runner = CliRunner()
        streamlit._is_running_with_streamlit = False

        self.patches = [
            patch.object(config._on_config_parsed, "send"),
            # Make sure the calls to `streamlit run` in this file don't unset
            # the config options loaded in conftest.py.
            patch.object(cli.bootstrap, "load_config_options"),
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()

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
        """streamlit run should fail if a not allowed file extension is passed."""

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
        mock_main_run.assert_called_once()
        positional_args = mock_main_run.call_args[0]
        self.assertEqual(positional_args[0], "some script.py")
        self.assertEqual(
            positional_args[1],
            ("argument with space", "argument with another space"),
        )
        self.assertEqual(0, result.exit_code)

    def test_run_command_with_flag_config_options(self):
        with patch("validators.url", return_value=False), patch(
            "streamlit.cli._main_run"
        ), patch("os.path.exists", return_value=True):

            result = self.runner.invoke(
                cli, ["run", "file_name.py", "--server.port=8502"]
            )

        cli.bootstrap.load_config_options.assert_called_once()
        _args, kwargs = cli.bootstrap.load_config_options.call_args
        self.assertEqual(kwargs["flag_options"]["server_port"], 8502)
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

    def test_get_command_line_without_parent_context(self):
        """Test that _get_command_line_as_string correctly returns None when
        there is no context parent
        """
        mock_context = MagicMock()
        mock_context.parent = None
        with patch("click.get_current_context", return_value=mock_context):
            result = cli._get_command_line_as_string()
            self.assertIsNone(result)

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

    def test_convert_depecated_config_option_to_click_option(self):
        """Test that configurator_options adds extra deprecation information
        to config option's description
        """
        config_option = ConfigOption(
            "deprecated.customKey",
            description="Custom description.\n\nLine one.",
            deprecated=True,
            deprecation_text="Foo",
            expiration_date="Bar",
            type_=int,
        )

        result = _convert_config_option_to_click_option(config_option)

        self.assertEqual(
            "Custom description.\n\nLine one.\n Foo - Bar", result["description"]
        )

    def test_credentials_headless_no_config(self):
        """If headless mode and no config is present,
        activation should be None."""
        from streamlit import config

        config._set_option("server.headless", True, "test")

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

        config._set_option("server.headless", headless_mode, "test")

        with patch("validators.url", return_value=False), patch(
            "streamlit.bootstrap.run"
        ), patch("os.path.exists", return_value=True), mock.patch(
            "streamlit.credentials.Credentials._check_activated"
        ) as mock_check, patch(
            "streamlit.credentials._check_credential_file_exists", return_value=True
        ):
            result = self.runner.invoke(cli, ["run", "some script.py"])
        self.assertTrue(mock_check.called)
        self.assertEqual(0, result.exit_code)

    def test_help_command(self):
        """Tests the help command redirects to using the --help flag"""
        with patch.object(sys, "argv", ["streamlit", "help"]) as args:
            self.runner.invoke(cli, ["help"])
            self.assertEqual("--help", args[1])

    def test_version_command(self):
        """Tests the version command redirects to using the --version flag"""
        with patch.object(sys, "argv", ["streamlit", "version"]) as args:
            self.runner.invoke(cli, ["version"])
            self.assertEqual("--version", args[1])

    def test_docs_command(self):
        """Tests the docs command opens the browser"""
        with patch("streamlit.util.open_browser") as mock_open_browser:
            self.runner.invoke(cli, ["docs"])
            mock_open_browser.assert_called_once_with("https://docs.streamlit.io")

    def test_hello_command(self):
        """Tests the hello command runs the hello script in streamlit"""
        from streamlit.hello import hello

        with patch("streamlit.cli._main_run") as mock_main_run:
            self.runner.invoke(cli, ["hello"])

            mock_main_run.assert_called_once()
            positional_args = mock_main_run.call_args[0]
            self.assertEqual(positional_args[0], hello.__file__)

    def test_hello_command_with_logs(self):
        """Tests the log level gets specified (using hello as an example"""
        from streamlit.hello import hello

        with patch("streamlit.cli._main_run"), patch(
            "streamlit.logger.set_log_level"
        ) as mock_set_log_level:
            self.runner.invoke(cli, ["--log_level", "error", "hello"])
            mock_set_log_level.assert_called_with("ERROR")

    def test_hello_command_with_flag_config_options(self):
        with patch("validators.url", return_value=False), patch(
            "streamlit.cli._main_run"
        ), patch("os.path.exists", return_value=True):

            result = self.runner.invoke(cli, ["hello", "--server.port=8502"])

        cli.bootstrap.load_config_options.assert_called_once()
        _args, kwargs = cli.bootstrap.load_config_options.call_args
        self.assertEqual(kwargs["flag_options"]["server_port"], 8502)
        self.assertEqual(0, result.exit_code)

    def test_config_show_command(self):
        """Tests the config show command calls the corresponding method in
        config
        """
        with patch("streamlit.config.show_config") as mock_config:
            self.runner.invoke(cli, ["config", "show"])
            mock_config.assert_called()

    def test_config_show_command_with_flag_config_options(self):
        with patch("validators.url", return_value=False), patch(
            "streamlit.cli._main_run"
        ), patch("os.path.exists", return_value=True):

            result = self.runner.invoke(cli, ["config", "show", "--server.port=8502"])

        cli.bootstrap.load_config_options.assert_called_once()
        _args, kwargs = cli.bootstrap.load_config_options.call_args
        self.assertEqual(kwargs["flag_options"]["server_port"], 8502)
        self.assertEqual(0, result.exit_code)

    @patch("streamlit.legacy_caching.clear_cache")
    @patch("streamlit.caching.clear_memo_cache")
    @patch("streamlit.caching.clear_singleton_cache")
    def test_cache_clear_all_caches(
        self, clear_singleton_cache, clear_memo_cache, clear_legacy_cache
    ):
        """cli.clear_cache should clear st.cache, st.memo and st.singleton"""
        self.runner.invoke(cli, ["cache", "clear"])
        clear_singleton_cache.assert_called_once()
        clear_memo_cache.assert_called_once()
        clear_legacy_cache.assert_called_once()

    @patch("builtins.print")
    def test_cache_clear_command_with_cache(self, mock_print):
        """Tests clear cache announces that cache is cleared when completed"""
        with patch(
            "streamlit.legacy_caching.clear_cache", return_value=True
        ) as mock_clear_cache:
            self.runner.invoke(cli, ["cache", "clear"])
            mock_clear_cache.assert_called()
            first_call = mock_print.call_args[0]
            first_arg = first_call[0]
            self.assertTrue(first_arg.startswith("Cleared directory"))

    @patch("builtins.print")
    def test_cache_clear_command_without_cache(self, mock_print):
        """Tests clear cache announces when there is nothing to clear"""
        with patch(
            "streamlit.legacy_caching.clear_cache", return_value=False
        ) as mock_clear_cache:
            self.runner.invoke(cli, ["cache", "clear"])
            mock_clear_cache.assert_called()
            first_call = mock_print.call_args[0]
            first_arg = first_call[0]
            self.assertTrue(first_arg.startswith("Nothing to clear"))

    def test_activate_command(self):
        """Tests activating a credential"""
        mock_credential = MagicMock()
        with mock.patch(
            "streamlit.credentials.Credentials.get_current",
            return_value=mock_credential,
        ):
            self.runner.invoke(cli, ["activate"])
            mock_credential.activate.assert_called()

    def test_activate_without_command(self):
        """Tests that it doesn't activate the credential when not specified"""
        mock_credential = MagicMock()
        with mock.patch(
            "streamlit.credentials.Credentials.get_current",
            return_value=mock_credential,
        ):
            self.runner.invoke(cli)
            mock_credential.activate.assert_not_called()

    def test_reset_command(self):
        """Tests resetting a credential"""
        mock_credential = MagicMock()
        with mock.patch(
            "streamlit.credentials.Credentials.get_current",
            return_value=mock_credential,
        ):
            self.runner.invoke(cli, ["activate", "reset"])
            mock_credential.reset.assert_called()
