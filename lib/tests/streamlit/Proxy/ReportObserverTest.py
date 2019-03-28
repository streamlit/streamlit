# Copyright 2018 Streamlit Inc. All rights reserved.

"""ReportObserver unit tests"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import mock

from streamlit.proxy.ReportObserver import ReportObserver


class ReportObserverTest(unittest.TestCase):
    """Test ReportObserver."""

    def setUp(self):
        self.file_observer_class_patcher = mock.patch(
            'streamlit.proxy.ReportObserver.FileObserver')
        self.file_observer_class_patcher.start()

    def tearDown(self):
        self.file_observer_class_patcher.stop()

    def test_initially_enabled(self):
        enabled = ReportObserver(True, 'some_file.py', mock.Mock())
        disabled = ReportObserver(False, 'some_file.py', mock.Mock())
        self.assertEqual(enabled.get_enabled(), True)
        self.assertEqual(disabled.get_enabled(), False)

    def test_create_wrapped_observer(self):
        # The wrapped observer shouldn't be created as long as
        # enabled is False or there are no active browsers
        observer = ReportObserver(False, 'some_file.py', mock.Mock())
        observer._create_file_observer = mock.MagicMock()

        observer.register_browser('one')
        observer.deregister_browser('one')
        observer.set_enabled(True)
        observer.set_enabled(False)
        observer._create_file_observer.assert_not_called()

        # Registering a browser and then enabling will create
        # the wrapped observer
        observer.register_browser('two')
        observer.register_browser('three')
        observer.set_enabled(True)
        observer._create_file_observer.assert_called_once()

    def test_close(self):
        observer = ReportObserver(True, 'some_file.py', mock.Mock())
        observer.register_browser('one')
        observer.register_browser('two')
        observer.register_browser('three')
        observer.close()
        self.assertFalse(observer.has_registered_browsers)
