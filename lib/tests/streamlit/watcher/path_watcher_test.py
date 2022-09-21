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

"""Tests the public utility functions in path_watcher.py"""

import unittest
from unittest.mock import call, Mock, patch


import streamlit.watcher.path_watcher
from streamlit.watcher.path_watcher import (
    get_default_path_watcher_class,
    NoOpPathWatcher,
    watch_dir,
    watch_file,
)
from tests.testutil import patch_config_options


class FileWatcherTest(unittest.TestCase):
    def test_report_watchdog_availability_mac(self):
        with patch(
            "streamlit.watcher.path_watcher.watchdog_available", new=False
        ), patch("streamlit.env_util.IS_DARWIN", new=True), patch(
            "click.secho"
        ) as mock_echo:
            streamlit.watcher.path_watcher.report_watchdog_availability()

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
            "streamlit.watcher.path_watcher.watchdog_available", new=False
        ), patch("streamlit.env_util.IS_DARWIN", new=False), patch(
            "click.secho"
        ) as mock_echo:
            streamlit.watcher.path_watcher.report_watchdog_availability()

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

    @patch("streamlit.watcher.path_watcher.PollingPathWatcher")
    @patch("streamlit.watcher.path_watcher.EventBasedPathWatcher")
    def test_watch_file(self, mock_event_watcher, mock_polling_watcher):
        """Test all possible outcomes of both `get_default_path_watcher_class` and
        `watch_file`, based on config.fileWatcherType and whether
        `watchdog_available` is true.
        """
        subtest_params = [
            (None, False, NoOpPathWatcher),
            (None, True, NoOpPathWatcher),
            ("poll", False, mock_polling_watcher),
            ("poll", True, mock_polling_watcher),
            ("watchdog", False, NoOpPathWatcher),
            ("watchdog", True, mock_event_watcher),
            ("auto", False, mock_polling_watcher),
            ("auto", True, mock_event_watcher),
        ]
        for watcher_config, watchdog_available, path_watcher_class in subtest_params:
            test_name = f"config.fileWatcherType={watcher_config}, watcher_available={watchdog_available}"
            with self.subTest(test_name):
                with patch_config_options(
                    {"server.fileWatcherType": watcher_config}
                ), patch(
                    "streamlit.watcher.path_watcher.watchdog_available",
                    watchdog_available,
                ):
                    # Test get_default_path_watcher_class() result
                    self.assertEqual(
                        path_watcher_class, get_default_path_watcher_class()
                    )

                    # Test watch_file(). If path_watcher_class is
                    # NoOpPathWatcher, nothing should happen. Otherwise,
                    # path_watcher_class should be called with the watch_file
                    # params.
                    on_file_changed = Mock()
                    watching_file = watch_file("some/file/path", on_file_changed)
                    if path_watcher_class is not NoOpPathWatcher:
                        path_watcher_class.assert_called_with(
                            "some/file/path",
                            on_file_changed,
                            glob_pattern=None,
                            allow_nonexistent=False,
                        )
                        self.assertTrue(watching_file)
                    else:
                        self.assertFalse(watching_file)

    @patch("streamlit.watcher.path_watcher.watchdog_available", Mock(return_value=True))
    @patch("streamlit.watcher.path_watcher.EventBasedPathWatcher")
    def test_watch_dir_kwarg_plumbing(self, mock_event_watcher):
        # NOTE: We only test kwarg plumbing for watch_dir since watcher_class
        # selection is tested extensively in test_watch_file, and the two
        # functions are otherwise identical.
        on_file_changed = Mock()

        watching_dir = watch_dir(
            "some/dir/path",
            on_file_changed,
            watcher_type="watchdog",
            glob_pattern="*.py",
            allow_nonexistent=True,
        )

        self.assertTrue(watching_dir)
        mock_event_watcher.assert_called_with(
            "some/dir/path",
            on_file_changed,
            glob_pattern="*.py",
            allow_nonexistent=True,
        )
