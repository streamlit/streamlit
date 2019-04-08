# Copyright 2018 Streamlit Inc. All rights reserved.

"""ReportObserver unit tests"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import mock

from streamlit.proxy.ReportSession import ReportSession


def _mock_listener():
    """Return a Mock object that can be used as a Signal listener"""
    # the MagicMock must have a spec, even if it's empty, to
    # act as a signal listener
    return mock.MagicMock(spec={})


def _create_report_session():
    """Return a ReportSession for testing against"""
    return ReportSession(
        report_name='mock_report',
        source_file_path='mock_report.py',
        command_line='python mock_report.py',
        cwd='')


class ReportSessionTest(unittest.TestCase):
    """Test ReportObserver."""

    def setUp(self):
        self.file_observer_class_patcher = mock.patch(
            'streamlit.proxy.ReportSession.FileObserver')
        self.file_observer_class_patcher.start()

    def tearDown(self):
        self.file_observer_class_patcher.stop()

    def test_create_wrapped_observer(self):
        # The wrapped observer shouldn't be created as long as
        # enabled is False or there are no active browsers
        session = _create_report_session()
        session._create_file_observer = mock.MagicMock()

        session.register_browser('one')
        session.deregister_browser('one')
        session.set_run_on_save(True)
        session.set_run_on_save(False)
        session._create_file_observer.assert_not_called()

        # Registering a browser and then enabling will create
        # the wrapped observer
        session.register_browser('two')
        session.register_browser('three')
        session.set_run_on_save(True)
        session._create_file_observer.assert_called_once()

    def test_close(self):
        session = _create_report_session()
        session.register_browser('one')
        session.register_browser('two')
        session.register_browser('three')
        session.close()
        self.assertFalse(session.has_registered_browsers)

    def test_state_changed_signal(self):
        """Test that a signal is emitted when a report's state changes"""
        session = _create_report_session()
        listener = _mock_listener()

        session.state_changed.connect(listener)
        session.set_run_on_save(session.state.run_on_save)
        listener.assert_not_called()

        session.set_run_on_save(not session.state.run_on_save)
        listener.assert_called_once_with(session, state=session.state)

