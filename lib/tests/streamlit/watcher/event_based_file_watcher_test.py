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

import unittest
from unittest import mock

from watchdog import events

from streamlit.watcher import event_based_file_watcher


class EventBasedFileWatcherTest(unittest.TestCase):
    """Test EventBasedFileWatcher."""

    def setUp(self):
        self.observer_class_patcher = mock.patch(
            "streamlit.watcher.event_based_file_watcher.Observer"
        )
        self.util_patcher = mock.patch(
            "streamlit.watcher.event_based_file_watcher.util"
        )
        self.os_patcher = mock.patch("streamlit.watcher.event_based_file_watcher.os")
        self.MockObserverClass = self.observer_class_patcher.start()
        self.mock_util = self.util_patcher.start()
        self.os = self.os_patcher.start()

    def tearDown(self):
        fo = event_based_file_watcher._MultiFileWatcher.get_singleton()
        fo._observer.start.reset_mock()
        fo._observer.schedule.reset_mock()

        self.observer_class_patcher.stop()
        self.util_patcher.stop()
        self.os_patcher.stop()

    def test_file_watch_and_callback(self):
        """Test that when a file is modified, the callback is called."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "1"

        ro = event_based_file_watcher.EventBasedFileWatcher("/this/is/my/file.py", cb)

        fo = event_based_file_watcher._MultiFileWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.close()

    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "1"

        ro = event_based_file_watcher.EventBasedFileWatcher("/this/is/my/file.py", cb)

        fo = event_based_file_watcher._MultiFileWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # self.os.stat = lambda x: FakeStat(102)  # Same mtime!
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.close()

    def test_callback_not_called_if_same_md5(self):
        """Test that we ignore files with same md5."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "1"

        ro = event_based_file_watcher.EventBasedFileWatcher("/this/is/my/file.py", cb)

        fo = event_based_file_watcher._MultiFileWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        # Same MD5:
        # self.mock_util.calc_md5_with_blocking_retries = lambda x: '2'

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.close()

    def test_callback_not_called_if_wrong_event_type(self):
        """Test that we ignore created files."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "1"

        ro = event_based_file_watcher.EventBasedFileWatcher("/this/is/my/file.py", cb)

        fo = event_based_file_watcher._MultiFileWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "2"

        ev = events.FileSystemEvent("/this/is/my/file.py")
        ev.event_type = events.EVENT_TYPE_DELETED  # Wrong type
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.close()

    def test_multiple_watchers_same_file(self):
        """Test that we can have multiple watchers of the same file."""

        filename = "/this/is/my/file.py"

        mod_count = [0]

        def modify_mock_file():
            self.os.stat = lambda x: FakeStat(mod_count[0])
            self.mock_util.calc_md5_with_blocking_retries = (
                lambda x: "%d" % mod_count[0]
            )

            ev = events.FileSystemEvent(filename)
            ev.event_type = events.EVENT_TYPE_MODIFIED
            folder_handler.on_modified(ev)

            mod_count[0] += 1

        cb1 = mock.Mock()
        cb2 = mock.Mock()

        watcher1 = event_based_file_watcher.EventBasedFileWatcher(filename, cb1)
        watcher2 = event_based_file_watcher.EventBasedFileWatcher(filename, cb2)

        fo = event_based_file_watcher._MultiFileWatcher.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb1.assert_not_called()
        cb2.assert_not_called()

        # "Modify" our file
        modify_mock_file()

        assert 1 == cb1.call_count
        assert 1 == cb2.call_count

        # Close watcher1. Only watcher2's callback should be called after this.
        watcher1.close()

        # Modify our file again
        modify_mock_file()

        assert 1 == cb1.call_count
        assert 2 == cb2.call_count

        watcher2.close()

        # Modify our file a final time
        modify_mock_file()

        # Both watchers are now closed, so their callback counts
        # should not have increased.
        assert 1 == cb1.call_count
        assert 2 == cb2.call_count


class FakeStat(object):
    """Emulates the output of os.stat()."""

    def __init__(self, mtime):
        self.st_mtime = mtime
