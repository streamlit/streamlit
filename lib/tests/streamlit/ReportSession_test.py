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

import unittest

import tornado.gen
import tornado.testing
from mock import MagicMock, patch

from streamlit.ReportSession import ReportSession
from streamlit.ReportSession import ReportSessionState
from streamlit.ReportThread import ReportContext
from streamlit.ReportThread import add_report_ctx
from streamlit.ReportThread import get_report_ctx
from streamlit.ScriptRunner import ScriptRunner
from streamlit.UploadedFileManager import UploadedFileManager
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.StaticManifest_pb2 import StaticManifest
from tests.MockStorage import MockStorage
import streamlit as st


class ReportSessionTest(unittest.TestCase):
    @patch("streamlit.ReportSession.config")
    @patch("streamlit.ReportSession.Report")
    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_enqueue_without_tracer(self, _1, _2, patched_config):
        """Make sure we try to handle execution control requests.
        """

        def get_option(name):
            if name == "server.runOnSave":
                # Just to avoid starting the watcher for no reason.
                return False
            if name == "client.displayEnabled":
                return True
            if name == "runner.installTracer":
                return False
            raise RuntimeError("Unexpected argument to get_option: %s" % name)

        patched_config.get_option.side_effect = get_option

        rs = ReportSession(None, "", "", UploadedFileManager())
        mock_script_runner = MagicMock()
        mock_script_runner._install_tracer = ScriptRunner._install_tracer
        rs._scriptrunner = mock_script_runner

        rs.enqueue({"dontcare": 123})

        func = mock_script_runner.maybe_handle_execution_control_request

        # Expect func to be called only once, inside enqueue().
        func.assert_called_once()

    @patch("streamlit.ReportSession.config")
    @patch("streamlit.ReportSession.Report")
    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_enqueue_with_tracer(self, _1, _2, patched_config):
        """Make sure there is no lock contention when tracer is on.

        When the tracer is set up, we want
        maybe_handle_execution_control_request to be executed only once. There
        was a bug in the past where it was called twice: once from the tracer
        and once from the enqueue function. This caused a lock contention.
        """

        def get_option(name):
            if name == "server.runOnSave":
                # Just to avoid starting the watcher for no reason.
                return False
            if name == "client.displayEnabled":
                return True
            if name == "runner.installTracer":
                return True
            raise RuntimeError("Unexpected argument to get_option: %s" % name)

        patched_config.get_option.side_effect = get_option

        rs = ReportSession(None, "", "", UploadedFileManager())
        mock_script_runner = MagicMock()
        rs._scriptrunner = mock_script_runner

        rs.enqueue({"dontcare": 123})

        func = mock_script_runner.maybe_handle_execution_control_request

        # In reality, outside of a testing environment func should be called
        # once. But in this test we're actually not installing a tracer here,
        # since Report is mocked. So the correct behavior here is for func to
        # never be called. If you ever see it being called once here it's
        # likely because there's a bug in the enqueue function (which should
        # skip func when installTracer is on).
        func.assert_not_called()

    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_shutdown(self, _1):
        """Test that ReportSession.shutdown behaves sanely."""
        file_mgr = MagicMock(spec=UploadedFileManager)
        rs = ReportSession(None, "", "", file_mgr)

        rs.shutdown()
        self.assertEqual(ReportSessionState.SHUTDOWN_REQUESTED, rs._state)
        file_mgr.remove_session_files.assert_called_once_with(rs.id)

        # A 2nd shutdown call should have no effect.
        rs.shutdown()
        self.assertEqual(ReportSessionState.SHUTDOWN_REQUESTED, rs._state)
        file_mgr.remove_session_files.assert_called_once_with(rs.id)

    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_unique_id(self, _1):
        """Each ReportSession should have a unique ID"""
        file_mgr = MagicMock(spec=UploadedFileManager)
        rs1 = ReportSession(None, "", "", file_mgr)
        rs2 = ReportSession(None, "", "", file_mgr)
        self.assertNotEqual(rs1.id, rs2.id)


def _create_mock_websocket():
    @tornado.gen.coroutine
    def write_message(*args, **kwargs):
        raise tornado.gen.Return(None)

    ws = MagicMock()
    ws.write_message.side_effect = write_message
    return ws


class ReportSessionSerializationTest(tornado.testing.AsyncTestCase):
    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    @tornado.testing.gen_test
    def test_handle_save_request(self, _1):
        """Test that handle_save_request serializes files correctly."""
        # Create a ReportSession with some mocked bits
        rs = ReportSession(self.io_loop, "mock_report.py", "", UploadedFileManager())
        rs._report.report_id = "TestReportID"

        orig_ctx = get_report_ctx()
        ctx = ReportContext("TestSessionID", rs._report.enqueue, None, None, None)
        add_report_ctx(ctx=ctx)

        rs._scriptrunner = MagicMock()

        storage = MockStorage()
        rs._storage = storage

        # Send two deltas: empty and markdown
        st.empty()
        st.markdown("Text!")

        yield rs.handle_save_request(_create_mock_websocket())

        # Check the order of the received files. Manifest should be last.
        self.assertEqual(3, len(storage.files))
        self.assertEqual("reports/TestReportID/0.pb", storage.get_filename(0))
        self.assertEqual("reports/TestReportID/1.pb", storage.get_filename(1))
        self.assertEqual("reports/TestReportID/manifest.pb", storage.get_filename(2))

        # Check the manifest
        manifest = storage.get_message(2, StaticManifest)
        self.assertEqual("mock_report", manifest.name)
        self.assertEqual(2, manifest.num_messages)
        self.assertEqual(StaticManifest.DONE, manifest.server_status)

        # Check that the deltas we sent match messages in storage
        sent_messages = rs._report._master_queue._queue
        received_messages = [
            storage.get_message(0, ForwardMsg),
            storage.get_message(1, ForwardMsg),
        ]

        self.assertEqual(sent_messages, received_messages)

        add_report_ctx(ctx=orig_ctx)
