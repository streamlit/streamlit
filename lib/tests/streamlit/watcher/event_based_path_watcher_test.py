# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
            self.mock_util.calc_md5_with_blocking_retries = (
                lambda _, **kwargs: f"{mod_count[0]}"
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
