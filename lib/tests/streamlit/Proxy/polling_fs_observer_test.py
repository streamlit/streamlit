# Copyright 2018 Streamlit Inc. All rights reserved.

"""polling_fs_observer unit test."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json
import unittest

from tornado.testing import AsyncTestCase, gen_test
from watchdog import events
import mock

from streamlit.proxy import polling_fs_observer


polling_fs_observer._POLLING_PERIOD_SECS = 0.001


class PollingFsObserverTest(AsyncTestCase):
    """Test polling_fs_observer.ReportObserver."""

    def setUp(self):
        super(PollingFsObserverTest, self).setUp()
        # Mock watchdog.observers.Observer in polling_fs_observer
        self.proxy_util_patcher = mock.patch(
            'streamlit.proxy.polling_fs_observer.proxy_util')
        self.os_patcher = mock.patch('streamlit.proxy.polling_fs_observer.os')
        self.mock_proxy_util = self.proxy_util_patcher.start()
        self.os = self.os_patcher.start()

    def tearDown(self):
        super(PollingFsObserverTest, self).tearDown()
        self.proxy_util_patcher.stop()
        self.os_patcher.stop()

    @gen_test
    def test_register(self):
        """Test that register/deregister works."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = polling_fs_observer.ReportObserver('/this/is/my/file.py', cb)
        self.assertFalse(ro.is_observing_file())

        ro.register_browser(1234)
        self.assertTrue(ro.is_observing_file())

        ro.deregister_browser(1234)
        self.assertFalse(ro.is_observing_file())

        ro.register_browser('abc')
        self.assertTrue(ro.is_observing_file())

        ro.register_browser('def')
        self.assertTrue(ro.is_observing_file())

        ro.deregister_browser('abc')
        self.assertTrue(ro.is_observing_file())

        ro.register_browser('xyz')
        self.assertTrue(ro.is_observing_file())

        ro.deregister_browser('xyz')
        self.assertTrue(ro.is_observing_file())

        ro.deregister_browser('def')
        self.assertFalse(ro.is_observing_file())

    # Using stop/wait, so don't annotate this with @gen_test.
    def test_file_watch_and_callback(self):
        """Test that when a file is modified, the callback is called."""
        cb_marker = mock.Mock()

        def cb():
            cb_marker()
            self.stop()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = polling_fs_observer.ReportObserver('/this/is/my/file.py', cb)

        ro.register_browser(1234)

        try:
            self.wait(timeout=2 * polling_fs_observer._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '2'

        self.wait(timeout=4 * polling_fs_observer._POLLING_PERIOD_SECS)
        cb_marker.assert_called_once()

        ro.deregister_browser(1234)

    # Using stop/wait, so don't annotate this with @gen_test.
    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        cb_marker = mock.Mock()

        def cb():
            cb_marker()
            self.stop()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = polling_fs_observer.ReportObserver('/this/is/my/file.py', cb)

        ro.register_browser(1234)

        try:
            self.wait(timeout=2 * polling_fs_observer._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        # self.os.stat = lambda x: FakeStat(102)  # Same mtime!
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '2'

        # This is the test:
        try:
            self.wait(timeout=2 * polling_fs_observer._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        ro.deregister_browser(1234)

    # Using stop/wait, so don't annotate this with @gen_test.
    def test_callback_not_called_if_same_md5(self):
        """Test that we ignore files with same md5."""
        cb_marker = mock.Mock()

        def cb():
            cb_marker()
            self.stop()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = polling_fs_observer.ReportObserver('/this/is/my/file.py', cb)

        ro.register_browser(1234)

        try:
            self.wait(timeout=2 * polling_fs_observer._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        # Same MD5:
        # self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '2'

        # This is the test:
        try:
            self.wait(timeout=2 * polling_fs_observer._POLLING_PERIOD_SECS)
        except AssertionError:
            pass
        cb_marker.assert_not_called()

        ro.deregister_browser(1234)


class FakeStat(object):
    """Emulates the output of os.stat()."""
    def __init__(self, mtime):
        self.st_mtime = mtime


