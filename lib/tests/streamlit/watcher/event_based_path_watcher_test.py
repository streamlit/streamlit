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

from __future__ import annotations

import threading
import unittest
from typing import TYPE_CHECKING, Any
from unittest import mock

import pytest
from watchdog import events

from streamlit.errors import StreamlitMaxRetriesError
from streamlit.watcher import event_based_path_watcher

if TYPE_CHECKING:
    from collections.abc import Generator


class EventBasedPathWatcherTest(unittest.TestCase):
    """Test EventBasedPathWatcher."""

    def setUp(self):
        # This test suite patches MultiPathWatcher. A MultiPathWatcher may
        # already exist (another test may have directly or indirectly created
        # one), so we first close any existing watcher instance here.
        if event_based_path_watcher._MultiPathWatcher._singleton is not None:
            event_based_path_watcher._MultiPathWatcher.get_singleton().close()
            event_based_path_watcher._MultiPathWatcher._singleton = None

        self.observer_class_patcher = mock.patch(
            "streamlit.watcher.event_based_path_watcher.Observer"
        )
        self.util_patcher = mock.patch(
            "streamlit.watcher.event_based_path_watcher.util"
        )
        self.MockObserverClass = self.observer_class_patcher.start()
        self.mock_util = self.util_patcher.start()

    def tearDown(self):
        # The test suite patches MultiPathWatcher. We need to close
        # any existing watcher instance here to not break other tests.
        if event_based_path_watcher._MultiPathWatcher._singleton is not None:
            fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
            fo.close()
            fo._observer.start.reset_mock()
            fo._observer.schedule.reset_mock()
            event_based_path_watcher._MultiPathWatcher._singleton = None

        self.observer_class_patcher.stop()
        self.util_patcher.stop()

    def test_file_watch_and_callback(self):
        """Test that when a file is modified, the callback is called."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    def test_works_with_bytes_path(self):
        """Test that when a file path in bytes, the callback is called."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent(b"/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    def test_works_with_directories(self):
        """Test that when a directory is modified, the callback is called."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/dir", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent("/this/is/my/dir")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        ev.is_directory = True
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    @mock.patch("os.path.isdir")
    def test_correctly_resolves_watched_folder_path(self, mock_is_dir):
        mock_is_dir.return_value = True
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/dir", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_path = fo._observer.schedule.call_args[0][1]
        assert folder_path == "/this/is/my/dir"

        ro.close()

    @mock.patch("os.path.isdir")
    def test_correctly_resolves_watched_file_path(self, mock_is_dir):
        mock_is_dir.return_value = False
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher(
            "/this/is/my/dir/file.txt", cb
        )

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_path = fo._observer.schedule.call_args[0][1]
        assert folder_path == "/this/is/my/dir"

        ro.close()

    def test_changed_modification_time_0_0(self):
        """Test that when a directory is modified, but modification time is 0.0,
        the callback is called anyway."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 0.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "42"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/dir", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "64"

        ev = events.FileSystemEvent("/this/is/my/dir")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        ev.is_directory = True
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    def test_kwargs_plumbed_to_calc_hash(self):
        """Test that we pass the glob_pattern and allow_nonexistent kwargs to
        calc_hash_with_blocking_retries.

        `EventBasedPathWatcher`s can be created with optional kwargs allowing
        the caller to specify what types of files to watch (when watching a
        directory) and whether to allow watchers on paths with no files/dirs.
        This test ensures that these optional parameters make it to our hash
        calculation helpers across different on_changed events.
        """
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher(
            "/this/is/my/dir",
            cb,
            glob_pattern="*.py",
            allow_nonexistent=True,
        )

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        _, kwargs = self.mock_util.calc_hash_with_blocking_retries.call_args
        assert kwargs == {"glob_pattern": "*.py", "allow_nonexistent": True}
        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="3")

        ev = events.FileSystemEvent("/this/is/my/dir")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        ev.is_directory = True
        folder_handler.on_modified(ev)

        _, kwargs = self.mock_util.calc_hash_with_blocking_retries.call_args
        assert kwargs == {"glob_pattern": "*.py", "allow_nonexistent": True}
        cb.assert_called_once()

        ro.close()

    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Same mtime!
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.close()

    def test_callback_not_called_if_same_hash(self):
        """Test that we ignore files with same content hash."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        # Same hash!

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.close()

    def test_callback_not_called_if_wrong_event_type(self):
        """Test that we ignore created files."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_DELETED  # Wrong type
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.close()

    def test_multiple_watchers_same_file(self):
        """Test that we can have multiple watchers of the same file."""

        filename = "/this/is/my/file.py"

        mod_count = [0.0]

        def modify_mock_file():
            self.mock_util.path_modification_time = lambda *args: mod_count[0]
            self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: (
                f"{mod_count[0]}"
            )

            ev = events.FileSystemEvent(filename)
            ev.event_type = events.EVENT_TYPE_MODIFIED
            folder_handler.on_modified(ev)

            mod_count[0] += 1.0

        cb1 = mock.Mock()
        cb2 = mock.Mock()

        watcher1 = event_based_path_watcher.EventBasedPathWatcher(filename, cb1)
        watcher2 = event_based_path_watcher.EventBasedPathWatcher(filename, cb2)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb1.assert_not_called()
        cb2.assert_not_called()

        # "Modify" our file
        modify_mock_file()

        assert cb1.call_count == 1
        assert cb2.call_count == 1

        # Close watcher1. Only watcher2's callback should be called after this.
        watcher1.close()

        # Modify our file again
        modify_mock_file()

        assert cb1.call_count == 1
        assert cb2.call_count == 2

        watcher2.close()

        # Modify our file a final time
        modify_mock_file()

        # Both watchers are now closed, so their callback counts
        # should not have increased.
        assert cb1.call_count == 1
        assert cb2.call_count == 2

    @mock.patch("os.path.isdir")
    def test_dir_watcher_file_event_precedence(self, mock_is_dir):
        """Test that file-specific watchers are prioritized for file events.

        If we're watching both a directory and a file inside that directory,
        an event on the file should be handled by the file's watcher, not the
        directory's.
        """
        dir_path = "/this/is/my/dir"
        file_path = "/this/is/my/dir/file.py"
        mock_is_dir.side_effect = lambda path: path == dir_path

        dir_cb = mock.Mock()
        event_based_path_watcher.EventBasedPathWatcher(dir_path, dir_cb)

        file_cb = mock.Mock()
        event_based_path_watcher.EventBasedPathWatcher(file_path, file_cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = next(iter(fo._folder_handlers.values()))

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent(file_path)
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        dir_cb.assert_not_called()
        file_cb.assert_called_once()

    @mock.patch("os.path.isdir")
    def test_no_race_condition_on_path_change(self, mock_is_dir):
        """Test for race condition when modifying watchers during event handling.

        This test creates two threads:
        1. Simulates file modification events, which reads from _watched_paths.
        2. Adds and removes watchers, which writes to _watched_paths.

        Without a lock, this would cause a "dictionary changed size during
        iteration" RuntimeError.
        """
        dir_path = "/this/is/my/dir"
        mock_is_dir.side_effect = lambda path: path == dir_path

        # Initial watcher for the directory
        event_based_path_watcher.EventBasedPathWatcher(dir_path, mock.Mock())

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = next(iter(fo._folder_handlers.values()))

        # Mock fs-related utils to avoid disk access and to ensure
        # that we always proceed past the mtime/hash checks.
        self.mock_util.calc_hash_with_blocking_retries.return_value = "hash"
        mod_time = [1.0]

        def mock_mod_time(*args, **kwargs):
            mod_time[0] += 1.0
            return mod_time[0]

        self.mock_util.path_modification_time.side_effect = mock_mod_time

        def event_handler_thread():
            ev = events.FileSystemEvent(f"{dir_path}/some_file.py")
            ev.event_type = events.EVENT_TYPE_MODIFIED
            for _ in range(50):
                folder_handler.on_modified(ev)

        def watcher_management_thread():
            for i in range(50):
                path = f"{dir_path}/file_{i}.py"
                watcher = event_based_path_watcher.EventBasedPathWatcher(
                    path, mock.Mock()
                )
                watcher.close()

        t1 = threading.Thread(target=event_handler_thread)
        t2 = threading.Thread(target=watcher_management_thread)

        t1.start()
        t2.start()

        t1.join(timeout=5)
        t2.join(timeout=5)

        # The test succeeds if no exceptions were thrown.
        assert t1.is_alive() is False
        assert t2.is_alive() is False

    @mock.patch("os.path.isdir")
    def test_handles_value_error_from_commonpath(self, mock_is_dir):
        """Ensure mixed-drive-like paths (commonpath ValueError) don't crash and are ignored.

        We simulate Windows mixed-drive behavior by forcing os.path.commonpath to raise
        ValueError. The event should be ignored and no callback invoked.
        """
        watched_dir = "/watched"
        mock_is_dir.side_effect = lambda p: p == watched_dir

        cb = mock.Mock()

        # Ensure initial hash/mtime allow watcher creation
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher(watched_dir, cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        # Simulate an event on a different "drive" by making commonpath raise
        with mock.patch(
            "streamlit.watcher.event_based_path_watcher.os.path.commonpath",
            side_effect=ValueError,
        ):
            ev = events.FileSystemEvent("/other_drive/some_file.py")
            ev.event_type = events.EVENT_TYPE_MODIFIED
            folder_handler.on_modified(ev)

        # The event is ignored; callback not called and no exception raised
        cb.assert_not_called()

        ro.close()

    @mock.patch("os.path.isdir")
    @mock.patch("os.path.exists")
    def test_detects_file_creation_in_watched_directory(
        self, mock_exists: mock.Mock, mock_is_dir: mock.Mock
    ) -> None:
        """Test that file creation inside a watched directory triggers callback.

        When watching a directory, file events inside the directory should:
        1. Trigger the callback with the actual file path (not directory path)
        2. Calculate hash on the actual file (to detect content changes)
        """
        watched_dir = "/app/.streamlit"

        # Directory exists
        mock_exists.return_value = True
        mock_is_dir.side_effect = lambda p: p == watched_dir

        cb = mock.Mock()

        # Initial setup
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(
            return_value="initial_hash"
        )

        ro = event_based_path_watcher.EventBasedPathWatcher(
            watched_dir,
            cb,
            glob_pattern="*.toml",
            allow_nonexistent=True,
        )

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Simulate config.toml being created
        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(
            return_value="file_content_hash"
        )

        config_file_path = f"{watched_dir}/config.toml"
        ev = events.FileSystemEvent(config_file_path)
        ev.event_type = events.EVENT_TYPE_CREATED
        folder_handler.on_created(ev)

        # Verify calc_hash was called with the FILE path (not directory)
        # This ensures file content changes are detected
        call_args = self.mock_util.calc_hash_with_blocking_retries.call_args
        assert call_args[0][0] == config_file_path

        # Callback should receive the actual file path (not directory)
        # This is important for path-specific filtering like _is_in_ignored_directory
        cb.assert_called_once_with(config_file_path)

        ro.close()

    @mock.patch("os.path.isdir")
    @mock.patch("os.path.exists")
    def test_detects_file_creation_and_modification_with_allow_nonexistent(
        self, mock_exists: mock.Mock, mock_is_dir: mock.Mock
    ) -> None:
        """Test watching a nonexistent file detects both creation and modification.

        This tests the scenario where:
        1. config.toml doesn't exist at startup
        2. User creates config.toml → callback triggered
        3. User modifies config.toml → callback triggered again

        This is the fix for the bug where watching a directory with glob_pattern
        would not detect file content changes (only file list changes).
        """
        watched_file = "/app/.streamlit/config.toml"

        # Initially file doesn't exist
        mock_exists.return_value = False
        mock_is_dir.return_value = False

        cb = mock.Mock()

        # Initial hash when file doesn't exist (uses path string as content)
        self.mock_util.path_modification_time = lambda *args: 0.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(
            return_value="nonexistent_hash"
        )

        ro = event_based_path_watcher.EventBasedPathWatcher(
            watched_file,
            cb,
            allow_nonexistent=True,
        )

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Step 1: Simulate file being created
        mock_exists.return_value = True
        mock_is_dir.return_value = False

        self.mock_util.path_modification_time = lambda *args: 101.0
        # Hash changes because file now exists with content
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(
            return_value="initial_content_hash"
        )

        ev = events.FileSystemEvent(watched_file)
        ev.event_type = events.EVENT_TYPE_CREATED
        folder_handler.on_created(ev)

        # Callback SHOULD be triggered (file was created)
        assert cb.call_count == 1

        # Step 2: Simulate file being modified
        self.mock_util.path_modification_time = lambda *args: 102.0
        # Hash changes because file content changed
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(
            return_value="modified_content_hash"
        )

        ev = events.FileSystemEvent(watched_file)
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # Callback SHOULD be triggered again (file was modified)
        assert cb.call_count == 2

        ro.close()

    @mock.patch("streamlit.env_util.IS_WINDOWS", True)
    @mock.patch("time.sleep")
    def test_windows_stability_check_filters_transient_changes(
        self, mock_sleep: mock.Mock
    ) -> None:
        """Test that transient file changes on Windows are filtered out.

        On Windows, background processes (Windows Defender, Search Indexer, etc.)
        can temporarily modify files, causing spurious change events. The stability
        check should filter these out by re-reading the file after a brief delay.

        Scenario: Hash changes initially, but reverts on second read (transient change)
        Expected: Callback should NOT be triggered
        """
        cb = mock.Mock()

        # Initial state
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Simulate a transient change:
        # - First read: hash = "2" (different from stored "1")
        # - Second read (after stability delay): hash = "1" (reverted to original)
        self.mock_util.path_modification_time = lambda *args: 102.0

        call_count = [0]

        def transient_hash(*args, **kwargs):
            call_count[0] += 1
            # First call returns different hash, second call returns original
            return "2" if call_count[0] == 1 else "1"

        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(
            side_effect=transient_hash
        )

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # Stability check should have detected the transient change
        # and NOT triggered the callback
        cb.assert_not_called()

        # Verify time.sleep was called for stability delay
        mock_sleep.assert_called_once_with(
            event_based_path_watcher._WINDOWS_STABILITY_DELAY_SECS
        )

        # Verify calc_hash was called twice (initial + stability check)
        assert self.mock_util.calc_hash_with_blocking_retries.call_count == 2

        ro.close()

    @mock.patch("streamlit.env_util.IS_WINDOWS", True)
    @mock.patch("time.sleep")
    def test_windows_stability_check_allows_real_changes(
        self, mock_sleep: mock.Mock
    ) -> None:
        """Test that real file changes on Windows are still detected.

        The stability check should NOT filter out genuine file modifications.

        Scenario: Hash changes initially and stays changed on second read
        Expected: Callback SHOULD be triggered
        """
        cb = mock.Mock()

        # Initial state
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Simulate a real change:
        # Both reads return the new hash value
        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="2")

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # Real change should trigger the callback
        cb.assert_called_once()

        # Verify time.sleep was called for stability delay
        mock_sleep.assert_called_once_with(
            event_based_path_watcher._WINDOWS_STABILITY_DELAY_SECS
        )

        # Verify calc_hash was called twice (initial + stability check)
        assert self.mock_util.calc_hash_with_blocking_retries.call_count == 2

        ro.close()

    @mock.patch("streamlit.env_util.IS_WINDOWS", False)
    def test_non_windows_skips_stability_check(self) -> None:
        """Test that stability check is skipped on non-Windows platforms.

        The stability check adds latency, so it should only run on Windows
        where spurious events from background processes are common.
        """
        cb = mock.Mock()

        # Initial state
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # File changes
        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="2")

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # Change should trigger callback
        cb.assert_called_once()

        # Verify calc_hash was only called once (no stability re-check)
        # Note: On non-Windows, we don't do the stability check
        assert self.mock_util.calc_hash_with_blocking_retries.call_count == 1

        ro.close()


@pytest.fixture
def ebpw_mocks() -> Generator[tuple[mock.MagicMock, mock.MagicMock], None, None]:
    """Patch Observer/util and reset the ``_MultiPathWatcher`` singleton around tests."""
    if event_based_path_watcher._MultiPathWatcher._singleton is not None:
        event_based_path_watcher._MultiPathWatcher.get_singleton().close()
        event_based_path_watcher._MultiPathWatcher._singleton = None

    with (
        mock.patch(
            "streamlit.watcher.event_based_path_watcher.Observer"
        ) as mock_observer_class,
        mock.patch("streamlit.watcher.event_based_path_watcher.util") as mock_util,
    ):
        yield mock_observer_class, mock_util

        if event_based_path_watcher._MultiPathWatcher._singleton is not None:
            fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
            fo.close()
            fo._observer.start.reset_mock()
            fo._observer.schedule.reset_mock()
            event_based_path_watcher._MultiPathWatcher._singleton = None


def _folder_handler_after_simulated_change(
    mock_util: mock.MagicMock, watched_path: str
) -> tuple[Any, mock.Mock]:
    """Register a file watcher and set default before/after mtime and hash values."""
    mock_util.path_modification_time = lambda *args, **kwargs: 101.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "1"
    cb = mock.Mock()
    event_based_path_watcher.EventBasedPathWatcher(watched_path, cb)
    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    folder_handler = fo._observer.schedule.call_args[0][0]
    mock_util.path_modification_time = lambda *args, **kwargs: 102.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "2"
    return folder_handler, cb


def test_event_based_path_watcher_repr(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """``EventBasedPathWatcher.__repr__`` returns a readable class-based string."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "h"

    watcher = event_based_path_watcher.EventBasedPathWatcher(
        "/tmp/watched.py", lambda _p: None
    )
    assert "EventBasedPathWatcher" in repr(watcher)
    watcher.close()


def test_multi_path_watcher_direct_ctor_raises_when_singleton_exists(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """Constructing ``_MultiPathWatcher`` directly must fail once the singleton exists."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "h"

    event_based_path_watcher._MultiPathWatcher.get_singleton()
    with pytest.raises(RuntimeError, match=r"Use \.get_singleton\(\) instead"):
        event_based_path_watcher._MultiPathWatcher()


def test_multi_path_watcher_repr(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """``_MultiPathWatcher.__repr__`` identifies the singleton instance."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "h"

    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    assert "_MultiPathWatcher" in repr(fo)


def test_event_based_path_watcher_close_all(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """``EventBasedPathWatcher.close_all`` stops the shared observer."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "h"

    event_based_path_watcher.EventBasedPathWatcher("/q/z.py", mock.Mock())
    event_based_path_watcher.EventBasedPathWatcher.close_all()

    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    fo._observer.stop.assert_called()


@pytest.mark.parametrize(
    "schedule_error",
    [FileNotFoundError(), RuntimeError("schedule failed")],
    ids=["file_not_found", "generic_exception"],
)
def test_watch_path_observer_schedule_failure_skips_registration(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
    schedule_error: BaseException,
) -> None:
    """If ``Observer.schedule`` fails, the folder handler is not registered."""
    mock_observer_class, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "h"
    mock_observer_class.return_value.schedule.side_effect = schedule_error

    cb = mock.Mock()
    event_based_path_watcher.EventBasedPathWatcher("/missing/parent/file.txt", cb)

    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    assert fo._folder_handlers == {}


def test_stop_watching_path_no_op_when_folder_not_registered(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """``stop_watching_path`` returns quietly when the folder was never scheduled."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "h"

    event_based_path_watcher.EventBasedPathWatcher("/alpha/file.py", mock.Mock())
    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()

    fo.stop_watching_path("/omega/other.py", mock.Mock())


def test_folder_event_handler_repr(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """``_FolderEventHandler.__repr__`` includes the handler class name."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "h"

    event_based_path_watcher.EventBasedPathWatcher("/x/y.py", mock.Mock())
    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    folder_handler = fo._observer.schedule.call_args[0][0]
    assert "_FolderEventHandler" in repr(folder_handler)


def test_add_path_skipped_when_initial_hash_raises_max_retries(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """If initial hash calculation fails, the path is not added and events are ignored."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = mock.Mock(
        side_effect=StreamlitMaxRetriesError("locked")
    )

    cb = mock.Mock()
    event_based_path_watcher.EventBasedPathWatcher("/only/path.py", cb)

    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    folder_handler = fo._observer.schedule.call_args[0][0]
    assert folder_handler.is_watching_paths() is False

    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "2"
    mock_util.path_modification_time = lambda *args, **kwargs: 2.0
    ev = events.FileSystemEvent("/only/path.py")
    ev.event_type = events.EVENT_TYPE_MODIFIED
    folder_handler.on_modified(ev)

    cb.assert_not_called()


def test_stop_watching_unregistered_path_in_same_folder_is_no_op(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """Removing a listener for a path that was never registered does nothing."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 1.0
    mock_util.calc_hash_with_blocking_retries = lambda *args, **kwargs: "1"

    cb = mock.Mock()
    event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)
    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()

    fo.stop_watching_path("/this/is/my/other.py", mock.Mock())


def test_moved_event_uses_destination_path(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """Move events compare hash against the destination file path."""
    _, mock_util = ebpw_mocks
    dest = "/this/is/my/file.py"
    folder_handler, cb = _folder_handler_after_simulated_change(mock_util, dest)

    ev = events.FileSystemMovedEvent("/this/is/my/old.py", dest)
    folder_handler.on_moved(ev)

    cb.assert_called_once_with(dest)


def test_modified_event_ignores_editor_backup_suffix(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """Paths ending with ``~`` are treated as editor backups and ignored."""
    _, mock_util = ebpw_mocks
    folder_handler, cb = _folder_handler_after_simulated_change(
        mock_util, "/this/is/my/file.py"
    )

    ev = events.FileSystemEvent("/this/is/my/file.py~")
    ev.event_type = events.EVENT_TYPE_MODIFIED
    folder_handler.on_modified(ev)

    cb.assert_not_called()


@mock.patch("streamlit.env_util.IS_WINDOWS", True)
@mock.patch("time.sleep", mock.Mock())
def test_windows_stability_hash_verification_max_retries_keeps_initial_change(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """If the stability re-read fails, the first new hash is still applied."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 101.0
    mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="1")

    cb = mock.Mock()
    event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    folder_handler = fo._observer.schedule.call_args[0][0]

    mock_util.path_modification_time = lambda *args, **kwargs: 102.0

    hash_phase = 0

    def hash_side_effect(*_args: object, **_kwargs: object) -> str:
        nonlocal hash_phase
        hash_phase += 1
        if hash_phase == 1:
            return "2"
        raise StreamlitMaxRetriesError("verification failed")

    mock_util.calc_hash_with_blocking_retries = mock.Mock(side_effect=hash_side_effect)

    ev = events.FileSystemEvent("/this/is/my/file.py")
    ev.event_type = events.EVENT_TYPE_MODIFIED
    folder_handler.on_modified(ev)

    cb.assert_called_once_with("/this/is/my/file.py")


@mock.patch("streamlit.env_util.IS_WINDOWS", True)
@mock.patch("time.sleep", mock.Mock())
def test_windows_stability_uses_post_delay_hash_when_it_differs_from_both(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """When verification reads a third hash, that value becomes the stored hash."""
    _, mock_util = ebpw_mocks
    mock_util.path_modification_time = lambda *args, **kwargs: 101.0
    mock_util.calc_hash_with_blocking_retries = mock.Mock(return_value="1")

    cb = mock.Mock()
    event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    folder_handler = fo._observer.schedule.call_args[0][0]

    mock_util.path_modification_time = lambda *args, **kwargs: 102.0
    sequence = iter(["2", "3"])

    def hash_side_effect(*_args: object, **_kwargs: object) -> str:
        return next(sequence)

    mock_util.calc_hash_with_blocking_retries = mock.Mock(side_effect=hash_side_effect)

    ev = events.FileSystemEvent("/this/is/my/file.py")
    ev.event_type = events.EVENT_TYPE_MODIFIED
    folder_handler.on_modified(ev)

    cb.assert_called_once_with("/this/is/my/file.py")


@mock.patch(
    "streamlit.watcher.event_based_path_watcher.os.path.isdir",
    return_value=False,
)
def test_nested_file_event_ignores_unrelated_file_watcher(
    mock_is_dir: mock.Mock,
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """When only a file is watched, sibling file events skip the dir-walk branch."""
    _, mock_util = ebpw_mocks
    folder_handler, cb = _folder_handler_after_simulated_change(
        mock_util, "/this/is/my/file.py"
    )

    ev = events.FileSystemEvent("/this/is/my/other.py")
    ev.event_type = events.EVENT_TYPE_MODIFIED
    folder_handler.on_modified(ev)

    cb.assert_not_called()


def test_handle_path_change_ignores_event_when_hash_raises_max_retries(
    ebpw_mocks: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    """``StreamlitMaxRetriesError`` during change hash calculation drops the event."""
    _, mock_util = ebpw_mocks
    hash_calls = 0

    def hash_fn(*_args: object, **_kwargs: object) -> str:
        nonlocal hash_calls
        hash_calls += 1
        if hash_calls == 1:
            return "1"
        raise StreamlitMaxRetriesError("cannot read")

    mock_util.path_modification_time = lambda *args, **kwargs: 101.0
    mock_util.calc_hash_with_blocking_retries = hash_fn

    cb = mock.Mock()
    event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

    fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
    folder_handler = fo._observer.schedule.call_args[0][0]

    mock_util.path_modification_time = lambda *args, **kwargs: 102.0

    ev = events.FileSystemEvent("/this/is/my/file.py")
    ev.event_type = events.EVENT_TYPE_MODIFIED
    folder_handler.on_modified(ev)

    cb.assert_not_called()
