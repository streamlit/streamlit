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

import sys
import unittest

from io import StringIO
from unittest import mock
from unittest.mock import Mock, patch
import matplotlib

import click

import streamlit
from streamlit import bootstrap, cli, config, SECRETS_FILE_LOC, version
from streamlit import config
from streamlit.report import Report
from tests import testutil
from streamlit.bootstrap import NEW_VERSION_TEXT

report = Report("the/path", "test command line")


class BootstrapTest(unittest.TestCase):
    @patch("streamlit.bootstrap.tornado.ioloop")
    @patch("streamlit.bootstrap.Server")
    def test_fix_matplotlib_crash(self, _1, _2):
        """Test that bootstrap.run sets the matplotlib backend to
        "Agg" if config.runner.fixMatplotlib=True.
        """
        # TODO: Find a proper way to mock sys.platform
        ORIG_PLATFORM = sys.platform

        for platform, do_fix in [("darwin", True), ("linux2", True)]:
            sys.platform = platform

            matplotlib.use("pdf", force=True)

            config._set_option("runner.fixMatplotlib", True, "test")
            bootstrap.run("/not/a/script", "", [], {})
            if do_fix:
                self.assertEqual("agg", matplotlib.get_backend().lower())
            else:
                self.assertEqual("pdf", matplotlib.get_backend().lower())

            # Reset
            matplotlib.use("pdf", force=True)

            config._set_option("runner.fixMatplotlib", False, "test")
            bootstrap.run("/not/a/script", "", [], {})
            self.assertEqual("pdf", matplotlib.get_backend().lower())

        sys.platform = ORIG_PLATFORM


class BootstrapPrintTest(unittest.TestCase):
    """Test bootstrap.py's printing functions."""

    def setUp(self):
        self.orig_stdout = sys.stdout
        sys.stdout = StringIO()

    def tearDown(self):
        sys.stdout.close()  # sys.stdout is a StringIO at this point.
        sys.stdout = self.orig_stdout

    def test_print_hello_message(self):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": True}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"browser.serverAddress": "the-address"}
        )

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(True)

        out = sys.stdout.getvalue()
        self.assertTrue(
            "Welcome to Streamlit. Check out our demo in your browser." in out
        )
        self.assertTrue("URL: http://the-address" in out)

    def test_print_new_version_message(self):
        with patch(
            "streamlit.version.should_show_new_version_notice", return_value=True
        ), patch("click.secho") as mock_echo:
            bootstrap._print_new_version_message()
            mock_echo.assert_called_once_with(NEW_VERSION_TEXT)

    def test_print_urls_configured(self):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": True}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"browser.serverAddress": "the-address"}
        )

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("You can now view your Streamlit app in your browser." in out)
        self.assertTrue("URL: http://the-address" in out)

    @patch("streamlit.net_util.get_external_ip")
    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_remote(self, mock_get_internal_ip, mock_get_external_ip):

        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": True}
        )

        mock_get_internal_ip.return_value = "internal-ip"
        mock_get_external_ip.return_value = "external-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("Network URL: http://internal-ip" in out)
        self.assertTrue("External URL: http://external-ip" in out)

    @patch("streamlit.net_util.get_external_ip")
    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_remote_no_external(
        self, mock_get_internal_ip, mock_get_external_ip
    ):

        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": True}
        )

        mock_get_internal_ip.return_value = "internal-ip"
        mock_get_external_ip.return_value = None

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("Network URL: http://internal-ip" in out)
        self.assertTrue("External URL: http://external-ip" not in out)

    @patch("streamlit.net_util.get_external_ip")
    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_remote_no_internal(
        self, mock_get_internal_ip, mock_get_external_ip
    ):

        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": True}
        )

        mock_get_internal_ip.return_value = None
        mock_get_external_ip.return_value = "external-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("Network URL: http://internal-ip" not in out)
        self.assertTrue("External URL: http://external-ip" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_local(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {"server.headless": False}
        )

        mock_get_internal_ip.return_value = "internal-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost" in out)
        self.assertTrue("Network URL: http://internal-ip" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_port(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {
                "server.headless": False,
                "server.port": 9988,
                "global.developmentMode": False,
            }
        )

        mock_get_internal_ip.return_value = "internal-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost:9988" in out)
        self.assertTrue("Network URL: http://internal-ip:9988" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_base(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {
                "server.headless": False,
                "server.baseUrlPath": "foo",
                "server.port": 8501,
                "global.developmentMode": False,
            }
        )

        mock_get_internal_ip.return_value = "internal-ip"

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost:8501/foo" in out)
        self.assertTrue("Network URL: http://internal-ip:8501/foo" in out)

    @patch("streamlit.net_util.get_internal_ip")
    def test_print_urls_base_no_internal(self, mock_get_internal_ip):
        mock_is_manually_set = testutil.build_mock_config_is_manually_set(
            {"browser.serverAddress": False}
        )
        mock_get_option = testutil.build_mock_config_get_option(
            {
                "server.headless": False,
                "server.baseUrlPath": "foo",
                "server.port": 8501,
                "global.developmentMode": False,
            }
        )

        mock_get_internal_ip.return_value = None

        with patch.object(config, "get_option", new=mock_get_option), patch.object(
            config, "is_manually_set", new=mock_is_manually_set
        ):
            bootstrap._print_url(False)

        out = sys.stdout.getvalue()
        self.assertTrue("Local URL: http://localhost:8501/foo" in out)
        self.assertTrue("Network URL: http://internal-ip:8501/foo" not in out)

    @patch("streamlit.bootstrap.GitRepo")
    def test_print_old_git_warning(self, mock_git_repo):
        mock_git_repo.return_value.is_valid.return_value = False
        mock_git_repo.return_value.git_version = (1, 2, 3)

        bootstrap._maybe_print_old_git_warning("script_path")
        out = sys.stdout.getvalue()
        self.assertTrue(
            "Streamlit requires Git 2.7.0 or later, but you have 1.2.3." in out
        )

    @patch("streamlit.config.get_config_options")
    def test_load_config_options(self, patched_get_config_options):
        """Test that bootstrap.load_config_options parses the keys properly and
        passes down the parameters.
        """

        flag_options = {
            "server_port": 3005,
            "server_headless": True,
            "browser_serverAddress": "localhost",
            "logger_level": "error",
            # global_minCachedMessageSize shouldn't be set below since it's None.
            "global_minCachedMessageSize": None,
        }

        bootstrap.load_config_options(flag_options)

        patched_get_config_options.assert_called_once_with(
            force_reparse=True,
            options_from_flags={
                "server.port": 3005,
                "server.headless": True,
                "browser.serverAddress": "localhost",
                "logger.level": "error",
            },
        )

    @patch("streamlit.bootstrap.secrets.load_if_toml_exists")
    def test_load_secrets(self, mock_load_secrets):
        """We should load secrets.toml on startup."""
        bootstrap._on_server_start(Mock())
        mock_load_secrets.assert_called_once()

    @patch("streamlit.bootstrap.LOGGER.error")
    @patch("streamlit.bootstrap.secrets.load_if_toml_exists")
    def test_log_secret_load_error(self, mock_load_secrets, mock_log_error):
        """If secrets throws an error on startup, we catch and log it."""
        mock_exception = Exception("Secrets exploded!")
        mock_load_secrets.side_effect = mock_exception

        bootstrap._on_server_start(Mock())
        mock_log_error.assert_called_once_with(
            f"Failed to load {SECRETS_FILE_LOC}",
            exc_info=mock_exception,
        )

    @patch("streamlit.config.get_config_options")
    @patch("streamlit.bootstrap.watch_file")
    def test_install_config_watcher(
        self, patched_watch_file, patched_get_config_options
    ):
        with patch("os.path.exists", return_value=True):
            bootstrap._install_config_watchers(flag_options={"server_port": 8502})
        self.assertEqual(patched_watch_file.call_count, 2)

        args, _kwargs = patched_watch_file.call_args_list[0]
        on_config_changed = args[1]

        # Simulate a config file change being detected.
        on_config_changed("/unused/nonexistent/file/path")

        patched_get_config_options.assert_called_once_with(
            force_reparse=True,
            options_from_flags={
                "server.port": 8502,
            },
        )
