# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import unittest
from unittest.mock import Mock, call, patch

import streamlit.watcher.path_watcher
from streamlit.watcher.path_watcher import (
    _WSL_POLLING_INFO,
    NoOpPathWatcher,
    get_default_path_watcher_class,
    watch_dir,
    watch_file,
)
from tests.testutil import patch_config_options


class FileWatcherTest(unittest.TestCase):
    def setUp(self) -> None:
        streamlit.watcher.path_watcher._report_wsl_polling_once.cache_clear()

    @patch_config_options({"server.fileWatcherType": "watchdog"})
    def test_report_watchdog_availability_mac(self):
        with (
            patch(
                "streamlit.watcher.path_watcher._is_watchdog_available",
                return_value=False,
            ),
            patch("streamlit.env_util.IS_DARWIN", new=True),
            patch("click.secho") as mock_echo,
        ):
            streamlit.watcher.path_watcher.report_watchdog_availability()

        msg = "\n  $ xcode-select --install"
        calls = [
            call(
                "  For better performance, install the Watchdog module:",
                fg="blue",
                bold=True,
            ),
            call(
                f"""{msg}
  $ pip install watchdog
            """
            ),
        ]
        mock_echo.assert_has_calls(calls)

    @patch_config_options({"server.fileWatcherType": "auto"})
    def test_report_wsl_polling_for_auto(self) -> None:
        """In WSL with "auto", report polling once without probing watchdog."""
        with (
            patch("streamlit.env_util.IS_WSL", new=True),
            patch(
                "streamlit.watcher.path_watcher._is_watchdog_available",
                return_value=False,
            ) as mock_watchdog_available,
            patch("click.secho") as mock_echo,
        ):
            streamlit.watcher.path_watcher.report_watchdog_availability()
            streamlit.watcher.path_watcher.report_watchdog_availability()

        mock_watchdog_available.assert_not_called()
        mock_echo.assert_called_once_with(_WSL_POLLING_INFO, fg="blue")

    @patch_config_options({"server.fileWatcherType": "poll"})
    def test_no_watchdog_suggestion_for_poll_type(self):
        with (
            patch(
                "streamlit.watcher.path_watcher._is_watchdog_available",
                return_value=False,
            ),
            patch("streamlit.env_util.IS_DARWIN", new=False),
            patch("click.secho") as mock_echo,
        ):
            streamlit.watcher.path_watcher.report_watchdog_availability()
        mock_echo.assert_not_called()

    @patch_config_options({"server.fileWatcherType": "none"})
    def test_no_watchdog_suggestion_for_none_type(self):
        with (
            patch(
                "streamlit.watcher.path_watcher._is_watchdog_available",
                return_value=False,
            ),
            patch("streamlit.env_util.IS_DARWIN", new=False),
            patch("click.secho") as mock_echo,
        ):
            streamlit.watcher.path_watcher.report_watchdog_availability()
        mock_echo.assert_not_called()

    def test_report_watchdog_availability_nonmac(self):
        with (
            patch(
                "streamlit.watcher.path_watcher._is_watchdog_available",
                return_value=False,
            ),
            patch("streamlit.env_util.IS_DARWIN", new=False),
            patch("streamlit.env_util.IS_WSL", new=False),
            patch("click.secho") as mock_echo,
        ):
            streamlit.watcher.path_watcher.report_watchdog_availability()

        msg = ""
        calls = [
            call(
                "  For better performance, install the Watchdog module:",
                fg="blue",
                bold=True,
            ),
            call(
                f"""{msg}
  $ pip install watchdog
            """
            ),
        ]
        mock_echo.assert_has_calls(calls)

    @patch("streamlit.watcher.polling_path_watcher.PollingPathWatcher")
    @patch("streamlit.watcher.event_based_path_watcher.EventBasedPathWatcher")
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
            with (
                self.subTest(test_name),
                patch_config_options({"server.fileWatcherType": watcher_config}),
                patch("streamlit.env_util.IS_WSL", new=False),
                patch(
                    "streamlit.watcher.path_watcher._is_watchdog_available",
                    return_value=watchdog_available,
                ),
            ):
                # Test get_default_path_watcher_class() result
                assert path_watcher_class == get_default_path_watcher_class()

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
                    assert watching_file
                else:
                    assert not watching_file

    @patch("streamlit.watcher.polling_path_watcher.PollingPathWatcher")
    @patch("streamlit.watcher.event_based_path_watcher.EventBasedPathWatcher")
    def test_watch_file_auto_uses_polling_in_wsl(
        self, mock_event_watcher: Mock, mock_polling_watcher: Mock
    ) -> None:
        """In WSL, "auto" uses polling even when watchdog is available."""
        on_file_changed = Mock()

        with (
            patch_config_options({"server.fileWatcherType": "auto"}),
            patch("streamlit.env_util.IS_WSL", new=True),
            patch(
                "streamlit.watcher.path_watcher._is_watchdog_available",
                return_value=True,
            ) as mock_watchdog_available,
        ):
            assert get_default_path_watcher_class() == mock_polling_watcher
            assert watch_file("some/file/path", on_file_changed)

        mock_watchdog_available.assert_not_called()
        mock_polling_watcher.assert_called_once_with(
            "some/file/path",
            on_file_changed,
            glob_pattern=None,
            allow_nonexistent=False,
        )
        mock_event_watcher.assert_not_called()

    @patch("streamlit.watcher.polling_path_watcher.PollingPathWatcher")
    @patch("streamlit.watcher.event_based_path_watcher.EventBasedPathWatcher")
    def test_watchdog_config_still_uses_watchdog_in_wsl(
        self, mock_event_watcher: Mock, mock_polling_watcher: Mock
    ) -> None:
        """An explicit "watchdog" config overrides the WSL polling default."""
        on_file_changed = Mock()

        with (
            patch_config_options({"server.fileWatcherType": "watchdog"}),
            patch("streamlit.env_util.IS_WSL", new=True),
            patch(
                "streamlit.watcher.path_watcher._is_watchdog_available",
                return_value=True,
            ),
        ):
            assert get_default_path_watcher_class() == mock_event_watcher
            assert watch_file("some/file/path", on_file_changed)

        mock_event_watcher.assert_called_once_with(
            "some/file/path",
            on_file_changed,
            glob_pattern=None,
            allow_nonexistent=False,
        )
        mock_polling_watcher.assert_not_called()

    @patch(
        "streamlit.watcher.path_watcher._is_watchdog_available", Mock(return_value=True)
    )
    @patch("streamlit.watcher.event_based_path_watcher.EventBasedPathWatcher")
    def test_watch_file_allow_nonexistent(self, mock_event_watcher: Mock) -> None:
        """Test that watch_file passes allow_nonexistent to the watcher class."""
        on_file_changed = Mock()

        watching_file = watch_file(
            "some/file/path",
            on_file_changed,
            watcher_type="watchdog",
            allow_nonexistent=True,
        )

        assert watching_file
        mock_event_watcher.assert_called_with(
            "some/file/path",
            on_file_changed,
            glob_pattern=None,
            allow_nonexistent=True,
        )

    @patch(
        "streamlit.watcher.path_watcher._is_watchdog_available", Mock(return_value=True)
    )
    @patch("streamlit.watcher.event_based_path_watcher.EventBasedPathWatcher")
    def test_watch_dir_kwarg_plumbing(self, mock_event_watcher: Mock) -> None:
        """Test that watch_dir passes kwargs to the watcher class."""
        on_file_changed = Mock()

        watching_dir = watch_dir(
            "some/dir/path",
            on_file_changed,
            watcher_type="watchdog",
            glob_pattern="*.py",
            allow_nonexistent=True,
        )

        assert watching_dir
        mock_event_watcher.assert_called_with(
            "some/dir/path/",
            on_file_changed,
            glob_pattern="*.py",
            allow_nonexistent=True,
        )

    def test_no_op_path_watcher_accepts_full_watcher_signature(self) -> None:
        """NoOpPathWatcher mirrors the constructor signature of real watchers.

        Acts as a structural regression check: if a new keyword-only argument
        is added to other watcher classes, NoOpPathWatcher must keep parity so
        ``watch_file``/``watch_dir`` can pass through the same kwargs without
        choking when no watcher is installed.
        """
        NoOpPathWatcher(
            "/some/path",
            Mock(),
            glob_pattern="*.py",
            allow_nonexistent=True,
        )
