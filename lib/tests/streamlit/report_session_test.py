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

from unittest.mock import MagicMock, patch, mock_open
import unittest
import pytest

import tornado.gen
import tornado.testing

import streamlit.report_session as report_session
from streamlit import config
from streamlit.report_session import ReportSession, ReportSessionState
from streamlit.report_thread import ReportContext
from streamlit.report_thread import add_report_ctx
from streamlit.report_thread import get_report_ctx
from streamlit.script_runner import ScriptRunner
from streamlit.script_runner import ScriptRunnerEvent
from streamlit.uploaded_file_manager import UploadedFileManager
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.StaticManifest_pb2 import StaticManifest
from streamlit.errors import StreamlitAPIException
from streamlit.widgets import Widgets
from tests.mock_storage import MockStorage
import streamlit as st


@pytest.fixture
def del_path(monkeypatch):
    monkeypatch.setenv("PATH", "")


class ReportSessionTest(unittest.TestCase):
    @patch("streamlit.report_session.config")
    @patch("streamlit.report_session.Report")
    @patch("streamlit.report_session.LocalSourcesWatcher")
    def test_enqueue_without_tracer(self, _1, _2, patched_config):
        """Make sure we try to handle execution control requests."""

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

        mock_msg = MagicMock()
        rs.enqueue(mock_msg)

        func = mock_script_runner.maybe_handle_execution_control_request

        # Expect func to be called only once, inside enqueue().
        func.assert_called_once()

    @patch("streamlit.report_session.LocalSourcesWatcher")
    @pytest.mark.usefixtures("del_path")
    def test_get_deploy_params_with_no_git(self, _1):
        """Make sure we try to handle execution control requests."""
        rs = ReportSession(None, report_session.__file__, "", UploadedFileManager())

        self.assertIsNone(rs.get_deploy_params())

    @patch("streamlit.report_session.config")
    @patch("streamlit.report_session.Report")
    @patch("streamlit.report_session.LocalSourcesWatcher")
    @patch("streamlit.util.os.makedirs")
    @patch("streamlit.file_util.open", mock_open())
    def test_enqueue_with_tracer(self, _1, _2, patched_config, _4):
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

        mock_msg = MagicMock()
        rs.enqueue(mock_msg)

        func = mock_script_runner.maybe_handle_execution_control_request

        # In reality, outside of a testing environment func should be called
        # once. But in this test we're actually not installing a tracer here,
        # since Report is mocked. So the correct behavior here is for func to
        # never be called. If you ever see it being called once here it's
        # likely because there's a bug in the enqueue function (which should
        # skip func when installTracer is on).
        func.assert_not_called()

    @patch("streamlit.report_session.LocalSourcesWatcher")
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

    @patch("streamlit.report_session.LocalSourcesWatcher")
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
    @patch("streamlit.report_session.LocalSourcesWatcher")
    @tornado.testing.gen_test
    def test_handle_save_request(self, _1):
        """Test that handle_save_request serializes files correctly."""
        # Create a ReportSession with some mocked bits
        rs = ReportSession(self.io_loop, "mock_report.py", "", UploadedFileManager())
        rs._report.report_id = "TestReportID"

        orig_ctx = get_report_ctx()
        ctx = ReportContext(
            "TestSessionID", rs._report.enqueue, "", Widgets(), UploadedFileManager()
        )
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


def _mock_get_options_for_section(overrides=None):
    if not overrides:
        overrides = {}

    theme_opts = {
        "base": "dark",
        "primaryColor": "coral",
        "backgroundColor": "white",
        "secondaryBackgroundColor": "blue",
        "textColor": "black",
        "font": "serif",
    }

    for k, v in overrides.items():
        theme_opts[k] = v

    def get_options_for_section(section):
        if section == "theme":
            return theme_opts
        return config.get_options_for_section(section)

    return get_options_for_section


class ReportSessionNewReportTest(tornado.testing.AsyncTestCase):
    @patch("streamlit.report_session.config")
    @patch("streamlit.report_session.LocalSourcesWatcher")
    @patch("streamlit.util.os.makedirs")
    @patch("streamlit.metrics_util.os.path.exists", MagicMock(return_value=False))
    @patch("streamlit.file_util.open", mock_open(read_data=""))
    @tornado.testing.gen_test
    def test_enqueue_new_report_message(self, _1, _2, patched_config):
        def get_option(name):
            if name == "server.runOnSave":
                # Just to avoid starting the watcher for no reason.
                return False

            return config.get_option(name)

        patched_config.get_option.side_effect = get_option
        patched_config.get_options_for_section.side_effect = (
            _mock_get_options_for_section()
        )

        # Create a ReportSession with some mocked bits
        rs = ReportSession(self.io_loop, "mock_report.py", "", UploadedFileManager())
        rs._report.report_id = "testing _enqueue_new_report"

        orig_ctx = get_report_ctx()
        ctx = ReportContext("TestSessionID", rs._report.enqueue, "", None, None)
        add_report_ctx(ctx=ctx)

        rs._on_scriptrunner_event(ScriptRunnerEvent.SCRIPT_STARTED)

        sent_messages = rs._report._master_queue._queue
        self.assertEqual(len(sent_messages), 2)  # NewReport and SessionState messages

        # Note that we're purposefully not very thoroughly testing new_report
        # fields below to avoid getting to the point where we're just
        # duplicating code in tests.
        new_report_msg = sent_messages[0].new_report
        self.assertEqual(new_report_msg.report_id, rs._report.report_id)

        self.assertEqual(new_report_msg.HasField("config"), True)
        self.assertEqual(
            new_report_msg.config.allow_run_on_save,
            config.get_option("server.allowRunOnSave"),
        )

        self.assertEqual(new_report_msg.HasField("custom_theme"), True)
        self.assertEqual(new_report_msg.custom_theme.text_color, "black")

        init_msg = new_report_msg.initialize
        self.assertEqual(init_msg.HasField("user_info"), True)

        add_report_ctx(ctx=orig_ctx)


class PopulateCustomThemeMsgTest(unittest.TestCase):
    @patch("streamlit.report_session.config")
    def test_no_custom_theme_prop_if_no_theme(self, patched_config):
        patched_config.get_options_for_section.side_effect = (
            _mock_get_options_for_section(
                {
                    "base": None,
                    "primaryColor": None,
                    "backgroundColor": None,
                    "secondaryBackgroundColor": None,
                    "textColor": None,
                    "font": None,
                }
            )
        )

        msg = ForwardMsg()
        new_report_msg = msg.new_report
        report_session._populate_theme_msg(new_report_msg.custom_theme)

        self.assertEqual(new_report_msg.HasField("custom_theme"), False)

    @patch("streamlit.report_session.config")
    def test_can_specify_some_options(self, patched_config):
        patched_config.get_options_for_section.side_effect = _mock_get_options_for_section(
            {
                # Leave base, primaryColor, and font defined.
                "backgroundColor": None,
                "secondaryBackgroundColor": None,
                "textColor": None,
            }
        )

        msg = ForwardMsg()
        new_report_msg = msg.new_report
        report_session._populate_theme_msg(new_report_msg.custom_theme)

        self.assertEqual(new_report_msg.HasField("custom_theme"), True)
        self.assertEqual(new_report_msg.custom_theme.primary_color, "coral")
        # In proto3, primitive fields are technically always required and are
        # set to the type's zero value when undefined.
        self.assertEqual(new_report_msg.custom_theme.background_color, "")

    @patch("streamlit.report_session.config")
    def test_can_specify_all_options(self, patched_config):
        patched_config.get_options_for_section.side_effect = (
            # Specifies all options by default.
            _mock_get_options_for_section()
        )

        msg = ForwardMsg()
        new_report_msg = msg.new_report
        report_session._populate_theme_msg(new_report_msg.custom_theme)

        self.assertEqual(new_report_msg.HasField("custom_theme"), True)
        self.assertEqual(new_report_msg.custom_theme.primary_color, "coral")
        self.assertEqual(new_report_msg.custom_theme.background_color, "white")

    @patch("streamlit.report_session.LOGGER")
    @patch("streamlit.report_session.config")
    def test_logs_warning_if_base_invalid(self, patched_config, patched_logger):
        patched_config.get_options_for_section.side_effect = (
            _mock_get_options_for_section({"base": "blah"})
        )

        msg = ForwardMsg()
        new_report_msg = msg.new_report
        report_session._populate_theme_msg(new_report_msg.custom_theme)

        patched_logger.warning.assert_called_once_with(
            'theme.base cannot be "blah". Defaulting to light.'
        )

    @patch("streamlit.report_session.LOGGER")
    @patch("streamlit.report_session.config")
    def test_logs_warning_if_font_invalid(self, patched_config, patched_logger):
        patched_config.get_options_for_section.side_effect = (
            _mock_get_options_for_section({"font": "comic sans"})
        )

        msg = ForwardMsg()
        new_report_msg = msg.new_report
        report_session._populate_theme_msg(new_report_msg.custom_theme)

        patched_logger.warning.assert_called_once_with(
            'theme.font cannot be "comic sans". Defaulting to sans serif.'
        )
