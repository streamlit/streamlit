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
from unittest.mock import MagicMock, mock_open, patch

import pytest
import tornado.gen
import tornado.testing
from tests.mock_storage import MockStorage

import streamlit as st
import streamlit.report_session as report_session
from streamlit import config
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.StaticManifest_pb2 import StaticManifest
from streamlit.report_session import ReportSession, ReportSessionState
from streamlit.report_thread import ReportContext, add_report_ctx, get_report_ctx
from streamlit.script_runner import ScriptRunner, ScriptRunnerEvent
from streamlit.state.session_state import SessionState
from streamlit.uploaded_file_manager import UploadedFileManager


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

        send = MagicMock()
        rs = ReportSession(None, "", "", UploadedFileManager(), send)
        mock_script_runner = MagicMock()
        mock_script_runner._install_tracer = ScriptRunner._install_tracer
        rs._scriptrunner = mock_script_runner

        mock_msg = MagicMock()
        rs.enqueue(mock_msg)

        func = mock_script_runner.maybe_handle_execution_control_request

        # Expect func and send to be called only once, inside enqueue().
        func.assert_called_once()
        send.assert_called_once()

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

        rs = ReportSession(None, "", "", UploadedFileManager(), lambda: None)
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

    @patch("streamlit.report_session.secrets._file_change_listener.disconnect")
    @patch("streamlit.report_session.LocalSourcesWatcher")
    def test_shutdown(self, _, patched_disconnect):
        """Test that ReportSession.shutdown behaves sanely."""
        file_mgr = MagicMock(spec=UploadedFileManager)
        rs = ReportSession(None, "", "", file_mgr, None)

        rs.shutdown()
        self.assertEqual(ReportSessionState.SHUTDOWN_REQUESTED, rs._state)
        file_mgr.remove_session_files.assert_called_once_with(rs.id)
        patched_disconnect.assert_called_once_with(rs._on_secrets_file_changed)

        # A 2nd shutdown call should have no effect.
        rs.shutdown()
        self.assertEqual(ReportSessionState.SHUTDOWN_REQUESTED, rs._state)
        file_mgr.remove_session_files.assert_called_once_with(rs.id)

    @patch("streamlit.report_session.LocalSourcesWatcher")
    def test_unique_id(self, _1):
        """Each ReportSession should have a unique ID"""
        file_mgr = MagicMock(spec=UploadedFileManager)
        rs1 = ReportSession(None, "", "", file_mgr, None)
        rs2 = ReportSession(None, "", "", file_mgr, None)
        self.assertNotEqual(rs1.id, rs2.id)

    @patch("streamlit.report_session.LocalSourcesWatcher")
    def test_creates_session_state_on_init(self, _):
        rs = ReportSession(None, "", "", UploadedFileManager(), None)
        self.assertTrue(isinstance(rs.session_state, SessionState))

    @patch("streamlit.report_session.LocalSourcesWatcher")
    def test_clear_cache_resets_session_state(self, _1):
        rs = ReportSession(None, "", "", UploadedFileManager(), None)
        rs._session_state["foo"] = "bar"
        rs.handle_clear_cache_request()
        self.assertTrue("foo" not in rs._session_state)

    @patch("streamlit.legacy_caching.clear_cache")
    @patch("streamlit.caching.clear_memo_cache")
    @patch("streamlit.caching.clear_singleton_cache")
    def test_clear_cache_all_caches(
        self, clear_singleton_cache, clear_memo_cache, clear_legacy_cache
    ):
        rs = ReportSession(MagicMock(), "", "", UploadedFileManager(), None)
        rs.handle_clear_cache_request()
        clear_singleton_cache.assert_called_once()
        clear_memo_cache.assert_called_once()
        clear_legacy_cache.assert_called_once()

    @patch("streamlit.report_session.secrets._file_change_listener.connect")
    @patch("streamlit.report_session.LocalSourcesWatcher")
    def test_request_rerun_on_secrets_file_change(self, _, patched_connect):
        rs = ReportSession(None, "", "", UploadedFileManager(), None)
        patched_connect.assert_called_once_with(rs._on_secrets_file_changed)


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
        rs = ReportSession(
            self.io_loop, "mock_report.py", "", UploadedFileManager(), None
        )
        rs._report.report_id = "TestReportID"

        orig_ctx = get_report_ctx()
        ctx = ReportContext(
            "TestSessionID",
            rs._report.enqueue,
            "",
            SessionState(),
            UploadedFileManager(),
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
        rs = ReportSession(
            self.io_loop, "mock_report.py", "", UploadedFileManager(), lambda: None
        )
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
            '"blah" is an invalid value for theme.base.'
            " Allowed values include ['light', 'dark']. Setting theme.base to \"light\"."
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
            '"comic sans" is an invalid value for theme.font.'
            " Allowed values include ['sans serif', 'serif', 'monospace']. Setting theme.font to \"sans serif\"."
        )

    @patch("streamlit.report_session.LocalSourcesWatcher")
    def test_passes_client_state_on_run_on_save(self, _):
        rs = ReportSession(None, "", "", UploadedFileManager(), None)
        rs._run_on_save = True
        rs.request_rerun = MagicMock()
        rs._on_source_file_changed()

        rs.request_rerun.assert_called_once_with(rs._client_state)
