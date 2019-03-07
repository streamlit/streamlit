# Copyright 2018 Streamlit Inc. All rights reserved.

"""fs_observer unit test."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json
import unittest

import mock
from watchdog import events

from streamlit.proxy import fs_observer


class FsObserverTest(unittest.TestCase):
    """Test fs_observer.ReportObserver."""

    def setUp(self):
        # Mock watchdog.observers.Observer in fs_observer
        self.observer_class_patcher = mock.patch(
            'streamlit.proxy.fs_observer.Observer')
        self.proxy_util_patcher = mock.patch(
            'streamlit.proxy.fs_observer.proxy_util')
        self.os_patcher = mock.patch('streamlit.proxy.fs_observer.os')
        self.MockObserverClass = self.observer_class_patcher.start()
        self.mock_proxy_util = self.proxy_util_patcher.start()
        self.os = self.os_patcher.start()

    def tearDown(self):
        fo = fs_observer._FileObserver.get_singleton()
        fo._observer.start.reset_mock()
        fo._observer.schedule.reset_mock()

        self.observer_class_patcher.stop()
        self.proxy_util_patcher.stop()
        self.os_patcher.stop()

    def test_register(self):
        """Test that register/deregister works."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = fs_observer.ReportObserver('/this/is/my/file.py', cb)
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

    def test_file_watch_and_callback(self):
        """Test that when a file is modified, the callback is called."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = fs_observer.ReportObserver('/this/is/my/file.py', cb)

        ro.register_browser(1234)

        fo = fs_observer._FileObserver.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '2'

        ev = events.FileSystemEvent('/this/is/my/file.py')
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        cb.assert_called_once()

        ro.deregister_browser(1234)

    def test_callback_not_called_if_same_mtime(self):
        """Test that we ignore files with same mtime."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = fs_observer.ReportObserver('/this/is/my/file.py', cb)

        ro.register_browser(1234)

        fo = fs_observer._FileObserver.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        # self.os.stat = lambda x: FakeStat(102)  # Same mtime!
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '2'

        ev = events.FileSystemEvent('/this/is/my/file.py')
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.deregister_browser(1234)

    def test_callback_not_called_if_same_md5(self):
        """Test that we ignore files with same md5."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = fs_observer.ReportObserver('/this/is/my/file.py', cb)

        ro.register_browser(1234)

        fo = fs_observer._FileObserver.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        # Same MD5:
        # self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '2'

        ev = events.FileSystemEvent('/this/is/my/file.py')
        ev.event_type = events.EVENT_TYPE_MODIFIED
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.deregister_browser(1234)

    def test_callback_not_called_if_wrong_event_type(self):
        """Test that we ignore created files."""
        cb = mock.Mock()

        self.os.stat = lambda x: FakeStat(101)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '1'

        ro = fs_observer.ReportObserver('/this/is/my/file.py', cb)

        ro.register_browser(1234)

        fo = fs_observer._FileObserver.get_singleton()
        fo._observer.schedule.assert_called_once()

        folder_handler = fo._observer.schedule.call_args[0][0]

        cb.assert_not_called()

        self.os.stat = lambda x: FakeStat(102)
        self.mock_proxy_util.calc_md5_with_blocking_retries = lambda x: '2'

        ev = events.FileSystemEvent('/this/is/my/file.py')
        ev.event_type = events.EVENT_TYPE_DELETED  # Wrong type
        folder_handler.on_modified(ev)

        # This is the test:
        cb.assert_not_called()

        ro.deregister_browser(1234)


class FakeStat(object):
    """Emulates the output of os.stat()."""
    def __init__(self, mtime):
        self.st_mtime = mtime

