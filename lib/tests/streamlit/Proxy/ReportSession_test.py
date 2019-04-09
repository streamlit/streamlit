# Copyright 2018 Streamlit Inc. All rights reserved.

"""ReportObserver unit tests"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import mock

from streamlit.proxy.ReportSession import ReportSession
from streamlit.proxy import ProxyConnection
from streamlit import forward_msg_proto

# An arbitrary UUID constant
REPORT_ID = '16fd2706-8baf-433b-82eb-8c7fada847da'


def _mock_listener():
    """Return a Mock object that can be used as a Signal listener"""
    # the MagicMock must have a spec, even if it's empty, to
    # act as a signal listener
    return mock.MagicMock(spec={})


def _create_proxy_connection(report_name='mock_report'):
    """Returns a ProxyConnection for testing against"""
    file_name = '%s.py' % report_name
    new_report_msg = forward_msg_proto.new_report_msg(
        report_id=REPORT_ID,
        cwd='',
        command_line='python %s' % file_name,
        source_file_path=file_name,
    )
    return ProxyConnection(new_report_msg.new_report, report_name)


def _create_report_session():
    """Return a ReportSession for testing against"""
    return ReportSession(_create_proxy_connection())


class ReportSessionTest(unittest.TestCase):
    """Test ReportObserver."""

    def setUp(self):
        self.file_observer_class_patcher = mock.patch(
            'streamlit.proxy.ReportSession.FileObserver')
        self.file_observer_class_patcher.start()

    def tearDown(self):
        self.file_observer_class_patcher.stop()

    def test_close(self):
        session = _create_report_session()
        proxy_conn = session._proxy_connection
        session.register_browser('one')
        session.register_browser('two')
        session.register_browser('three')
        session.close()
        self.assertFalse(session.has_registered_browsers)

        # Old ProxyConnection should not have a listener
        self.assertIsNone(session._proxy_connection)
        self.assertFalse(
            proxy_conn.on_client_connection_closed.has_receivers_for(proxy_conn))

    def test_run_on_save_state_changed(self):
        """Test that a signal is emitted when a report's state changes"""
        session = _create_report_session()
        listener = _mock_listener()

        session.state_changed.connect(listener)
        session.set_run_on_save(session.state.run_on_save)
        listener.assert_not_called()

        session.set_run_on_save(not session.state.run_on_save)
        listener.assert_called_once_with(session, state=session.state)

    def test_report_is_running_signal(self):
        """Tests that the report_is_running state changed signal is
        emitted"""
        session = _create_report_session()
        listener = _mock_listener()
        session.state_changed.connect(listener)

        # Should not emit a state-changed event
        session.set_proxy_connection(session._proxy_connection)
        listener.assert_not_called()

        # Should also not emit a state-changed event
        session.set_proxy_connection(_create_proxy_connection())
        listener.assert_not_called()

        # Should emit when our connection is closed
        session._proxy_connection.close_client_connection()
        listener.assert_called_once_with(
            session, state=session.state._replace(report_is_running=False))

        # Should emit when a new connection is added
        listener.reset_mock()
        session.set_proxy_connection(_create_proxy_connection())
        listener.assert_called_once_with(
            session, state=session.state._replace(report_is_running=True))

        # When setting a new proxy_connection, the ReportSession
        # should stop listening to the previous connection's
        # client_connection_closed signal, and should start listening to
        # the new one.
        prev_conn = session._proxy_connection
        new_conn = _create_proxy_connection()
        self.assertTrue(
            prev_conn.on_client_connection_closed.has_receivers_for(prev_conn))
        self.assertFalse(
            new_conn.on_client_connection_closed.has_receivers_for(new_conn))
        session.set_proxy_connection(new_conn)
        self.assertFalse(
            prev_conn.on_client_connection_closed.has_receivers_for(prev_conn))
        self.assertTrue(
            new_conn.on_client_connection_closed.has_receivers_for(new_conn))
