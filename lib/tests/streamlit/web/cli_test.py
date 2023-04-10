# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""Unit tests for the Streamlit CLI."""
import contextlib
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from unittest.mock import MagicMock, patch

import pytest
import requests
import requests_mock
from click.testing import CliRunner
from parameterized import parameterized
from requests.adapters import HTTPAdapter
from testfixtures import tempdir
from urllib3 import Retry

import streamlit
import streamlit.web.bootstrap
from streamlit import config
from streamlit.config_option import ConfigOption
from streamlit.runtime.credentials import Credentials, _verify_email
from streamlit.web import cli
from streamlit.web.cli import _convert_config_option_to_click_option
from tests import testutil


class CliTest(unittest.TestCase):
    """Unit tests for the cli."""

    def setUp(self):
        # Credentials._singleton should be None here, but a mis-behaving
        # test may have left it intact.
        Credentials._singleton = None

        cli.name = "streamlit"
        self.runner = CliRunner()

        self.patches = [
            patch.object(config._on_config_parsed, "send"),
            # Make sure the calls to `streamlit run` in this file don't unset
            # the config options loaded in conftest.py.
            patch.object(streamlit.web.bootstrap, "load_config_options"),
        ]

        for p in self.patches:
            p.start()

    def tearDown(self):
        Credentials._singleton = None

        for p in self.patches:
            p.stop()

    def test_run_no_arguments(self):
        """streamlit run should fail if run with no arguments."""
        result = self.runner.invoke(cli, ["run"])
        self.assertNotEqual(0, result.exit_code)

    def test_run_existing_file_argument(self):
        """streamlit run succeeds if an existing file is passed."""
        with patch("validators.url", return_value=False), patch(
            "streamlit.web.cli._main_run"
        ), patch("os.path.exists", return_value=True):
            result = self.runner.invoke(cli, ["run", "file_name.py"])
        self.assertEqual(0, result.exit_code)

    def test_run_non_existing_file_argument(self):
        """streamlit run should fail if a non existing file is passed."""

        with patch("validators.url", return_value=False), patch(
            "streamlit.web.cli._main_run"
        ), patch("os.path.exists", return_value=False):
            result = self.runner.invoke(cli, ["run", "file_name.py"])
        self.assertNotEqual(0, result.exit_code)
        self.assertIn("File does not exist", result.output)

    def test_run_not_allowed_file_extension(self):
        """streamlit run should fail if a not allowed file extension is passed."""

        result = self.runner.invoke(cli, ["run", "file_name.doc"])

        self.assertNotEqual(0, result.exit_code)
        self.assertIn(
            "Streamlit requires raw Python (.py) files, not .doc.", result.output
        )

    @tempdir()
    def test_run_valid_url(self, temp_dir):
        """streamlit run succeeds if an existing url is passed."""

        with patch("validators.url", return_value=True), patch(
            "streamlit.web.cli._main_run"
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
            "streamlit.web.cli._main_run"
        ), requests_mock.mock() as m:
            m.get("http://url/app.py", exc=requests.exceptions.RequestException)
            with patch("streamlit.temporary_directory.TemporaryDirectory") as mock_tmp:
                mock_tmp.return_value.__enter__.return_value = temp_dir.path
                result = self.runner.invoke(cli, ["run", "http://url/app.py"])

        self.assertNotEqual(0, result.exit_code)
        self.assertIn("Unable to fetch", result.output)

    def test_run_arguments(self):
        """The correct command line should be passed downstream."""
        with patch("validators.url", return_value=False), patch(
            "os.path.exists", return_value=True
        ):
            with patch("streamlit.web.cli._main_run") as mock_main_run:
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
            "streamlit.web.cli._main_run"
        ), patch("os.path.exists", return_value=True):
            result = self.runner.invoke(
                cli, ["run", "file_name.py", "--server.port=8502"]
            )

        streamlit.web.bootstrap.load_config_options.assert_called_once()
        _args, kwargs = streamlit.web.bootstrap.load_config_options.call_args
        self.assertEqual(kwargs["flag_options"]["server_port"], 8502)
        self.assertEqual(0, result.exit_code)

    def test_get_command_line(self):
        """Test that _get_command_line_as_string correctly concatenates values
        from click.
        """
        mock_context = MagicMock()
        mock_context.parent.command_path = "streamlit"
        with patch("click.get_current_context", return_value=mock_context):
            with patch.object(sys, "argv", ["", "os_arg1", "os_arg2"]):
                result = cli._get_command_line_as_string()
                self.assertEqual("streamlit os_arg1 os_arg2", result)

    def test_get_command_line_without_parent_context(self):
        """Test that _get_command_line_as_string correctly returns None when
        there is no context parent
        """
        mock_context = MagicMock()
        mock_context.parent = None
        with patch("click.get_current_context", return_value=mock_context):
            result = cli._get_command_line_as_string()
            self.assertIsNone(result)

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
        with testutil.patch_config_options({"server.headless": True}):
            with patch("validators.url", return_value=False), patch(
                "streamlit.web.bootstrap.run"
            ), patch("os.path.exists", return_value=True), patch(
                "streamlit.runtime.credentials._check_credential_file_exists",
                return_value=False,
            ):
                result = self.runner.invoke(cli, ["run", "some script.py"])
            from streamlit.runtime.credentials import Credentials

            credentials = Credentials.get_current()
            self.assertIsNone(credentials.activation)
            self.assertEqual(0, result.exit_code)

    @parameterized.expand([(True,), (False,)])
    def test_credentials_headless_with_config(self, headless_mode):
        """If headless, but a config file is present, activation should be
        defined.
        So we call `_check_activated`.
        """
        with testutil.patch_config_options({"server.headless": headless_mode}):
            with patch("validators.url", return_value=False), patch(
                "streamlit.web.bootstrap.run"
            ), patch("os.path.exists", return_value=True), mock.patch(
                "streamlit.runtime.credentials.Credentials._check_activated"
            ) as mock_check, patch(
                "streamlit.runtime.credentials._check_credential_file_exists",
                return_value=True,
            ):
                result = self.runner.invoke(cli, ["run", "some script.py"])
            self.assertTrue(mock_check.called)
            self.assertEqual(0, result.exit_code)

    @parameterized.expand([(True,), (False,)])
    def test_headless_telemetry_message(self, headless_mode):
        """If headless mode, show a message about usage metrics gathering."""

        with testutil.patch_config_options({"server.headless": headless_mode}):
            with patch("validators.url", return_value=False), patch(
                "os.path.exists", return_value=True
            ), patch("streamlit.config.is_manually_set", return_value=False), patch(
                "streamlit.runtime.credentials._check_credential_file_exists",
                return_value=False,
            ):
                result = self.runner.invoke(cli, ["run", "file_name.py"])

            self.assertNotEqual(0, result.exit_code)
            self.assertEqual(
                "Collecting usage statistics" in result.output,
                headless_mode,  # Should only be shown if n headless mode
            )

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
        from streamlit.hello import Hello

        with patch("streamlit.web.cli._main_run") as mock_main_run:
            self.runner.invoke(cli, ["hello"])

            mock_main_run.assert_called_once()
            positional_args = mock_main_run.call_args[0]
            self.assertEqual(positional_args[0], Hello.__file__)

    @patch("streamlit.logger.get_logger")
    def test_hello_command_with_logs(self, get_logger):
        """Tests setting log level using --log_level prints a warning."""

        with patch("streamlit.web.cli._main_run"):
            self.runner.invoke(cli, ["--log_level", "error", "hello"])

            mock_logger = get_logger()
            mock_logger.warning.assert_called_once()

    def test_hello_command_with_flag_config_options(self):
        with patch("validators.url", return_value=False), patch(
            "streamlit.web.cli._main_run"
        ), patch("os.path.exists", return_value=True):
            result = self.runner.invoke(cli, ["hello", "--server.port=8502"])

        streamlit.web.bootstrap.load_config_options.assert_called_once()
        _args, kwargs = streamlit.web.bootstrap.load_config_options.call_args
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
            "streamlit.web.cli._main_run"
        ), patch("os.path.exists", return_value=True):
            result = self.runner.invoke(cli, ["config", "show", "--server.port=8502"])

        streamlit.web.bootstrap.load_config_options.assert_called_once()
        _args, kwargs = streamlit.web.bootstrap.load_config_options.call_args
        self.assertEqual(kwargs["flag_options"]["server_port"], 8502)
        self.assertEqual(0, result.exit_code)

    @patch("streamlit.runtime.legacy_caching.clear_cache")
    @patch(
        "streamlit.runtime.caching.storage.local_disk_cache_storage.LocalDiskCacheStorageManager.clear_all"
    )
    @patch("streamlit.runtime.caching.cache_resource.clear")
    def test_cache_clear_all_caches(
        self, clear_resource_caches, clear_data_caches, clear_legacy_cache
    ):
        """cli.clear_cache should clear st.cache, st.cache_data and st.cache_resource"""
        self.runner.invoke(cli, ["cache", "clear"])
        clear_resource_caches.assert_called_once()
        clear_data_caches.assert_called_once()
        clear_legacy_cache.assert_called_once()

    @patch("builtins.print")
    def test_cache_clear_command_with_cache(self, mock_print):
        """Tests clear cache announces that cache is cleared when completed"""
        with patch(
            "streamlit.runtime.legacy_caching.clear_cache", return_value=True
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
            "streamlit.runtime.legacy_caching.clear_cache", return_value=False
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
            "streamlit.runtime.credentials.Credentials.get_current",
            return_value=mock_credential,
        ):
            self.runner.invoke(cli, ["activate"])
            mock_credential.activate.assert_called()

    @tempdir()
    def test_email_send(self, temp_dir):
        """Test that saving a new Credential sends an email"""

        with requests_mock.mock() as m:
            m.post("https://api.segment.io/v1/i", status_code=200)
            creds: Credentials = Credentials.get_current()  # type: ignore
            creds._conf_file = str(Path(temp_dir.path, "config.toml"))
            creds.activation = _verify_email("email@test.com")
            creds.save()
            last_request = m.request_history[-1]
            assert last_request.method == "POST"
            assert last_request.url == "https://api.segment.io/v1/i"
            assert "'userId': 'email@test.com'" in last_request.text

    # @patch("streamlit.runtime.credentials.LOGGER")
    @tempdir()
    def test_email_send_exception_handling(self, temp_dir):
        """
        Test that saving a new Credential and getting an error gets handled and logged
        """

        with requests_mock.mock() as m:
            m.post("https://api.segment.io/v1/i", status_code=403)
            creds: Credentials = Credentials.get_current()  # type: ignore
            creds._conf_file = str(Path(temp_dir.path, "config.toml"))
            creds.activation = _verify_email("email@test.com")
            with self.assertLogs(
                "streamlit.runtime.credentials", level="ERROR"
            ) as mock_logger:
                creds.save()
                assert len(mock_logger.output) == 1
                assert "Error saving email: 403" in mock_logger.output[0]

    def test_activate_without_command(self):
        """Tests that it doesn't activate the credential when not specified"""
        mock_credential = MagicMock()
        with mock.patch(
            "streamlit.runtime.credentials.Credentials.get_current",
            return_value=mock_credential,
        ):
            self.runner.invoke(cli)
            mock_credential.activate.assert_not_called()

    def test_reset_command(self):
        """Tests resetting a credential"""
        mock_credential = MagicMock()
        with mock.patch(
            "streamlit.runtime.credentials.Credentials.get_current",
            return_value=mock_credential,
        ):
            self.runner.invoke(cli, ["activate", "reset"])
            mock_credential.reset.assert_called()


class HTTPServerIntegrationTest(unittest.TestCase):
    def get_http_session(self) -> requests.Session:
        http_session = requests.Session()
        http_session.mount(
            "https://", HTTPAdapter(max_retries=Retry(total=10, backoff_factor=0.2))
        )
        http_session.mount("http://", HTTPAdapter(max_retries=None))
        return http_session

    def test_ssl(self):
        with contextlib.ExitStack() as exit_stack:
            tmp_home = exit_stack.enter_context(tempfile.TemporaryDirectory())
            (Path(tmp_home) / ".streamlit").mkdir()
            (Path(tmp_home) / ".streamlit" / "credentials.toml").write_text(
                '[general]\nemail = ""'
            )
            cert_file = Path(tmp_home) / "cert.cert"
            key_file = Path(tmp_home) / "key.key"
            pem_file = Path(tmp_home) / "public.pem"

            subprocess.check_call(
                [
                    "openssl",
                    "req",
                    "-x509",
                    "-newkey",
                    "rsa:4096",
                    "-keyout",
                    str(key_file),
                    "-out",
                    str(cert_file),
                    "-sha256",
                    "-days",
                    "365",
                    "-nodes",
                    "-subj",
                    "/CN=localhost",
                    # sublectAltName is required by modern browsers
                    # See: https://github.com/urllib3/urllib3/issues/497
                    "-addext",
                    "subjectAltName = DNS:localhost",
                ]
            )
            subprocess.check_call(
                [
                    "openssl",
                    "x509",
                    "-inform",
                    "PEM",
                    "-in",
                    str(cert_file),
                    "-out",
                    str(pem_file),
                ]
            )
            https_session = exit_stack.enter_context(self.get_http_session())
            proc = exit_stack.enter_context(
                subprocess.Popen(
                    [
                        sys.executable,
                        "-m",
                        "streamlit",
                        "hello",
                        "--global.developmentMode=False",
                        "--server.sslCertFile",
                        str(cert_file),
                        "--server.sslKeyFile",
                        str(key_file),
                        "--server.headless",
                        "true",
                        "--server.port=8510",
                    ],
                    env={**os.environ, "HOME": tmp_home},
                )
            )
            try:
                response = https_session.get(
                    "https://localhost:8510/healthz", verify=str(pem_file)
                )
                response.raise_for_status()
                assert response.text == "ok"
                # HTTP traffic is restricted
                with pytest.raises(requests.exceptions.ConnectionError):
                    response = https_session.get("http://localhost:8510/healthz")
                    response.raise_for_status()
            finally:
                proc.kill()
