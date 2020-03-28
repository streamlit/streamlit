# Copyright 2018-2020 Streamlit Inc.
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

import mock
import time
import unittest

from streamlit.watcher import PollingFileWatcher


PollingFileWatcher._POLLING_PERIOD_SECS = 0.001


class PollingFileWatcherTest(unittest.TestCase):
    """Test PollingFileWatcher."""

    def setUp(self):
        super(PollingFileWatcherTest, self).setUp()
        self.util_patcher = mock.patch("streamlit.watcher.PollingFileWatcher.util")
        self.os_patcher = mock.patch("streamlit.watcher.PollingFileWatcher.os")
        self.mock_util = self.util_patcher.start()
        self.os = self.os_patcher.start()

    def tearDown(self):
        super(PollingFileWatcherTest, self).tearDown()
        self.util_patcher.stop()
        self.os_patcher.stop()

    def test_file_watch_and_callback(self):
        """Test that when a file is modified, the callback is called."""
        cb_marker = mock.Mock()

        def cb(x):
            cb_marker()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "1"

        ro = PollingFileWatcher.PollingFileWatcher("/this/is/my/file.py", cb)

        try:
            time.sleep(2 * PollingFileWatcher._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "2"

        time.sleep(4 * PollingFileWatcher._POLLING_PERIOD_SECS)
        cb_marker.assert_called_once()

        ro.close()

    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        cb_marker = mock.Mock()

        def cb(x):
            cb_marker()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "1"

        ro = PollingFileWatcher.PollingFileWatcher("/this/is/my/file.py", cb)

        try:
            time.sleep(2 * PollingFileWatcher._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        # self.os.stat = lambda x: FakeStat(102)  # Same mtime!
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "2"

        # This is the test:
        try:
            time.sleep(2 * PollingFileWatcher._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        ro.close()

    def test_callback_not_called_if_same_md5(self):
        """Test that we ignore files with same md5."""
        cb_marker = mock.Mock()

        def cb(x):
            cb_marker()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: "1"

        ro = PollingFileWatcher.PollingFileWatcher("/this/is/my/file.py", cb)

        try:
            time.sleep(2 * PollingFileWatcher._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        # Same MD5:
        # self.mock_util.calc_md5_with_blocking_retries = lambda x: '2'

        # This is the test:
        try:
            time.sleep(2 * PollingFileWatcher._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

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

            mod_count[0] += 1

        def sleep():
            try:
                # TODO: Remove dependency on time.sleep!
                time.sleep(5 * PollingFileWatcher._POLLING_PERIOD_SECS)
            except AssertionError:
                pass

        modify_mock_file()

        cb1 = mock.Mock()
        cb2 = mock.Mock()

        watcher1 = PollingFileWatcher.PollingFileWatcher(filename, cb1)
        watcher2 = PollingFileWatcher.PollingFileWatcher(filename, cb2)

        sleep()

        cb1.assert_not_called()
        cb2.assert_not_called()

        # "Modify" our file
        modify_mock_file()
        sleep()

        self.assertEqual(cb1.call_count, 1)
        self.assertEqual(cb2.call_count, 1)

        # Close watcher1. Only watcher2's callback should be called after this.
        watcher1.close()

        # Modify our file again
        modify_mock_file()
        sleep()

        self.assertEqual(cb1.call_count, 1)
        self.assertEqual(cb2.call_count, 2)

        watcher2.close()

        # Modify our file a final time
        modify_mock_file()

        # Both watchers are now closed, so their callback counts
        # should not have increased.
        self.assertEqual(cb1.call_count, 1)
        self.assertEqual(cb2.call_count, 2)


class FakeStat(object):
    """Emulates the output of os.stat()."""

    def __init__(self, mtime):
        self.st_mtime = mtime
