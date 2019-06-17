# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import mock
import time
import unittest

from streamlit.watcher import PollingFileWatcher


PollingFileWatcher._POLLING_PERIOD_SECS = 0.001


class PollingFileWatcherTest(unittest.TestCase):
    """Test PollingFileWatcher."""

    def setUp(self):
        super(PollingFileWatcherTest, self).setUp()
        self.util_patcher = mock.patch(
            'streamlit.watcher.PollingFileWatcher.util')
        self.os_patcher = mock.patch('streamlit.watcher.PollingFileWatcher.os')
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
        self.mock_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = PollingFileWatcher.PollingFileWatcher('/this/is/my/file.py', cb)

        try:
            time.sleep(2 * PollingFileWatcher._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: '2'

        time.sleep(4 * PollingFileWatcher._POLLING_PERIOD_SECS)
        cb_marker.assert_called_once()

        ro.close()

    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        cb_marker = mock.Mock()

        def cb(x):
            cb_marker()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = PollingFileWatcher.PollingFileWatcher('/this/is/my/file.py', cb)

        try:
            time.sleep(2 * PollingFileWatcher._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        # self.os.stat = lambda x: FakeStat(102)  # Same mtime!
        self.mock_util.calc_md5_with_blocking_retries = lambda x: '2'

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
        self.mock_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = PollingFileWatcher.PollingFileWatcher('/this/is/my/file.py', cb)

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


class FakeStat(object):
    """Emulates the output of os.stat()."""
    def __init__(self, mtime):
        self.st_mtime = mtime


