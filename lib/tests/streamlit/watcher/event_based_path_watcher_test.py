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
from unittest import mock

from watchdog import events

from streamlit.watcher import event_based_path_watcher


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
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    def test_works_with_bytes_path(self):
        """Test that when a file path in bytes, the callback is called."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent(b"/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    def test_works_with_directories(self):
        """Test that when a directory is modified, the callback is called."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/dir", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

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
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

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
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

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
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "42"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/dir", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "64"

        ev = events.FileSystemEvent("/this/is/my/dir")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        ev.is_directory = True
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    def test_kwargs_plumbed_to_calc_md5(self):
        """Test that we pass the glob_pattern and allow_nonexistent kwargs to
        calc_md5_with_blocking_retries.

        `EventBasedPathWatcher`s can be created with optional kwargs allowing
        the caller to specify what types of files to watch (when watching a
        directory) and whether to allow watchers on paths with no files/dirs.
        This test ensures that these optional parameters make it to our hash
        calculation helpers across different on_changed events.
        """
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher(
            "/this/is/my/dir",
            cb,
            glob_pattern="*.py",
            allow_nonexistent=True,
        )

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        _, kwargs = self.mock_util.calc_md5_with_blocking_retries.call_args
        assert kwargs == {"glob_pattern": "*.py", "allow_nonexistent": True}
        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(return_value="3")

        ev = events.FileSystemEvent("/this/is/my/dir")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        ev.is_directory = True
        folder_handler.on_modified(ev)

        _, kwargs = self.mock_util.calc_md5_with_blocking_retries.call_args
        assert kwargs == {"glob_pattern": "*.py", "allow_nonexistent": True}
        cb.assert_called_once()

        ro.close()

    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Same mtime!
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.close()

    def test_callback_not_called_if_same_md5(self):
        """Test that we ignore files with same md5."""
        cb = mock.Mock()

        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        # Same MD5!

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
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

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
            self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: (
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
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "2"

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
        # that we always proceed past the mtime/md5 checks.
        self.mock_util.calc_md5_with_blocking_retries.return_value = "md5"
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

        # Ensure initial md5/mtime allow watcher creation
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = lambda _, **kwargs: "1"

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
        2. Calculate MD5 on the actual file (to detect content changes)
        """
        watched_dir = "/app/.streamlit"

        # Directory exists
        mock_exists.return_value = True
        mock_is_dir.side_effect = lambda p: p == watched_dir

        cb = mock.Mock()

        # Initial setup
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(
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
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(
            return_value="file_content_hash"
        )

        config_file_path = f"{watched_dir}/config.toml"
        ev = events.FileSystemEvent(config_file_path)
        ev.event_type = events.EVENT_TYPE_CREATED
        folder_handler.on_created(ev)

        # Verify calc_md5 was called with the FILE path (not directory)
        # This ensures file content changes are detected
        call_args = self.mock_util.calc_md5_with_blocking_retries.call_args
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

        # Initial MD5 when file doesn't exist (uses path string as content)
        self.mock_util.path_modification_time = lambda *args: 0.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(
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
        # MD5 changes because file now exists with content
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(
            return_value="initial_content_hash"
        )

        ev = events.FileSystemEvent(watched_file)
        ev.event_type = events.EVENT_TYPE_CREATED
        folder_handler.on_created(ev)

        # Callback SHOULD be triggered (file was created)
        assert cb.call_count == 1

        # Step 2: Simulate file being modified
        self.mock_util.path_modification_time = lambda *args: 102.0
        # MD5 changes because file content changed
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(
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

        Scenario: MD5 changes initially, but reverts on second read (transient change)
        Expected: Callback should NOT be triggered
        """
        cb = mock.Mock()

        # Initial state
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Simulate a transient change:
        # - First read: MD5 = "2" (different from stored "1")
        # - Second read (after stability delay): MD5 = "1" (reverted to original)
        self.mock_util.path_modification_time = lambda *args: 102.0

        call_count = [0]

        def transient_md5(*args, **kwargs):
            call_count[0] += 1
            # First call returns different MD5, second call returns original
            return "2" if call_count[0] == 1 else "1"

        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(
            side_effect=transient_md5
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

        # Verify calc_md5 was called twice (initial + stability check)
        assert self.mock_util.calc_md5_with_blocking_retries.call_count == 2

        ro.close()

    @mock.patch("streamlit.env_util.IS_WINDOWS", True)
    @mock.patch("time.sleep")
    def test_windows_stability_check_allows_real_changes(
        self, mock_sleep: mock.Mock
    ) -> None:
        """Test that real file changes on Windows are still detected.

        The stability check should NOT filter out genuine file modifications.

        Scenario: MD5 changes initially and stays changed on second read
        Expected: Callback SHOULD be triggered
        """
        cb = mock.Mock()

        # Initial state
        self.mock_util.path_modification_time = lambda *args: 101.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # Simulate a real change:
        # Both reads return the new MD5 value
        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(return_value="2")

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # Real change should trigger the callback
        cb.assert_called_once()

        # Verify time.sleep was called for stability delay
        mock_sleep.assert_called_once_with(
            event_based_path_watcher._WINDOWS_STABILITY_DELAY_SECS
        )

        # Verify calc_md5 was called twice (initial + stability check)
        assert self.mock_util.calc_md5_with_blocking_retries.call_count == 2

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
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(return_value="1")

        ro = event_based_path_watcher.EventBasedPathWatcher("/this/is/my/file.py", cb)

        fo = event_based_path_watcher._MultiPathWatcher.get_singleton()
        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # File changes
        self.mock_util.path_modification_time = lambda *args: 102.0
        self.mock_util.calc_md5_with_blocking_retries = mock.Mock(return_value="2")

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # Change should trigger callback
        cb.assert_called_once()

        # Verify calc_md5 was only called once (no stability re-check)
        # Note: On non-Windows, we don't do the stability check
        assert self.mock_util.calc_md5_with_blocking_retries.call_count == 1

        ro.close()
