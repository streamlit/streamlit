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

"""Tests the public utility funtions in file_watcher.py"""

import unittest
from unittest.mock import call, Mock, patch

import click

from streamlit import env_util
import streamlit.watcher.file_watcher
from streamlit.watcher.file_watcher import (
    get_default_file_watcher_class,
    NoOpFileWatcher,
    watch_file,
)
from tests.testutil import patch_config_options


class FileWatcherTest(unittest.TestCase):
    def test_report_watchdog_availability_mac(self):
        with patch(
            "streamlit.watcher.file_watcher.watchdog_available", new=False
        ), patch("streamlit.env_util.IS_DARWIN", new=True), patch(
            "click.secho"
        ) as mock_echo:
            streamlit.watcher.file_watcher.report_watchdog_availability()

        msg = "\n  $ xcode-select --install"
        calls = [
            call(
                "  %s" % "For better performance, install the Watchdog module:",
                fg="blue",
                bold=True,
            ),
            call(
                """%s
  $ pip install watchdog
            """
                % msg
            ),
        ]
        mock_echo.assert_has_calls(calls)

    def test_report_watchdog_availability_nonmac(self):
        with patch(
            "streamlit.watcher.file_watcher.watchdog_available", new=False
        ), patch("streamlit.env_util.IS_DARWIN", new=False), patch(
            "click.secho"
        ) as mock_echo:
            streamlit.watcher.file_watcher.report_watchdog_availability()

        msg = ""
        calls = [
            call(
                "  %s" % "For better performance, install the Watchdog module:",
                fg="blue",
                bold=True,
            ),
            call(
                """%s
  $ pip install watchdog
            """
                % msg
            ),
        ]
        mock_echo.assert_has_calls(calls)

    @patch("streamlit.watcher.file_watcher.PollingFileWatcher")
    @patch("streamlit.watcher.file_watcher.EventBasedFileWatcher")
    def test_watch_file(self, mock_event_watcher, mock_polling_watcher):
        """Test all possible outcomes of both `get_default_file_watcher_class` and
        `watch_file`, based on config.fileWatcherType and whether
        `watchdog_available` is true.
        """
        subtest_params = [
            (None, False, NoOpFileWatcher),
            (None, True, NoOpFileWatcher),
            ("poll", False, mock_polling_watcher),
            ("poll", True, mock_polling_watcher),
            ("watchdog", False, NoOpFileWatcher),
            ("watchdog", True, mock_event_watcher),
            ("auto", False, mock_polling_watcher),
            ("auto", True, mock_event_watcher),
        ]
        for watcher_config, watchdog_available, file_watcher_class in subtest_params:
            test_name = f"config.fileWatcherType={watcher_config}, watcher_available={watchdog_available}"
            with self.subTest(test_name):
                with patch_config_options(
                    {"server.fileWatcherType": watcher_config}
                ), patch(
                    "streamlit.watcher.file_watcher.watchdog_available",
                    watchdog_available,
                ):
                    # Test get_default_file_watcher_class() result
                    self.assertEqual(
                        file_watcher_class, get_default_file_watcher_class()
                    )

                    # Test watch_file(). If file_watcher_class is
                    # NoOpFileWatcher, nothing should happen. Otherwise,
                    # file_watcher_class should be called with the watch_file
                    # params.
                    on_file_changed = Mock()
                    watching_file = watch_file("some/file/path", on_file_changed)
                    if file_watcher_class is not NoOpFileWatcher:
                        file_watcher_class.assert_called_with(
                            "some/file/path", on_file_changed
                        )
                        self.assertTrue(watching_file)
                    else:
                        self.assertFalse(watching_file)
