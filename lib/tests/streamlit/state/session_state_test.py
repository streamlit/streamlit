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
from unittest.mock import MagicMock, patch

import pytest
import tornado.testing

from streamlit.errors import StreamlitAPIException
from streamlit.report_session import ReportSession
from streamlit.report_thread import _StringSet
from streamlit.state.session_state import (
    get_session_state,
    _get_widget_mgr,
    SessionState,
)
from streamlit.state.widgets import WidgetManager
from streamlit.uploaded_file_manager import UploadedFileManager
from tests.server_test_case import ServerTestCase


# TODO: Mock widget values and modify the tests below to account for this once
#       session_state and widget state are unified.
class SessionStateTests(unittest.TestCase):
    def setUp(self):
        self.session_state = SessionState(
            old_state={"foo": "bar"},
            new_state={"baz": "qux"},
        )

        patcher = patch("streamlit.state.session_state._get_widget_mgr")
        self.addCleanup(patcher.stop)

        mock_get_widget_mgr = patcher.start()
        mock_widget_mgr = MagicMock()
        mock_widget_mgr.get_keyed_widget_values.return_value = {"foo2": "bar2"}
        mock_get_widget_mgr.return_value = mock_widget_mgr

    def test_mapping_invariants(self):
        s = self.session_state

        assert len(s.values()) == len(s.keys()) == len(s.items()) == len(s)
        assert list(s.values()) == [s[k] for k in s.keys()]
        assert list(s.items()) == [(k, s[k]) for k in s.keys()]

    def test_make_state_old(self):
        self.session_state.make_state_old()
        assert self.session_state._new_state == {}
        assert self.session_state._old_state == {"foo": "bar", "baz": "qux"}

    def test_merged_state(self):
        assert self.session_state._merged_state == {
            "foo": "bar",
            "foo2": "bar2",
            "baz": "qux",
        }

    def test_merged_state_new_state_priority(self):
        session_state = SessionState(
            old_state={"foo": "bar", "foo2": "bar1"},
            new_state={"foo": "baz"},
        )
        assert session_state._merged_state == {"foo": "baz", "foo2": "bar2"}

        session_state = SessionState(old_state={}, new_state={"foo2": "baz"})
        assert session_state._merged_state == {"foo2": "baz"}

    def test_is_new_value(self):
        assert not self.session_state.is_new_value("foo")
        assert not self.session_state.is_new_value("foo2")
        assert self.session_state.is_new_value("baz")

    def test_contains(self):
        assert "corge" not in self.session_state  # does not contain key
        assert "foo" in self.session_state  # key in new state
        assert "foo2" in self.session_state  # key in widget manager state
        assert "baz" in self.session_state  # key in old state

    def test_iter(self):
        state_iter = iter(self.session_state)
        assert next(state_iter) == "foo"
        assert next(state_iter) == "foo2"
        assert next(state_iter) == "baz"

        with pytest.raises(StopIteration):
            next(state_iter)

    def test_len(self):
        assert len(self.session_state) == 3

    def test_str(self):
        assert str(self.session_state) == "{'foo': 'bar', 'foo2': 'bar2', 'baz': 'qux'}"

    def test_getitem(self):
        assert self.session_state["foo"] == "bar"

    def test_getitem_error(self):
        with pytest.raises(KeyError) as e:
            self.session_state["nonexistent"]
        assert "nonexistent" in str(e.value)

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setitem(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        patched_get_report_ctx.return_value = mock_ctx

        self.session_state["corge"] = "grault"
        assert self.session_state["corge"] == "grault"

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setitem_error(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        mock_ctx.widget_ids_this_run.add("corge")
        patched_get_report_ctx.return_value = mock_ctx

        with pytest.raises(StreamlitAPIException) as e:
            self.session_state["corge"] = "grault"

        assert "Setting the value of a widget after its creation is disallowed." == str(
            e.value
        )

    def test_delitem(self):
        del self.session_state["foo"]
        assert self.session_state._merged_state == {"baz": "qux", "foo2": "bar2"}

    def test_delitem_error(self):
        with pytest.raises(KeyError) as e:
            self.session_state["nonexistent"]
        assert "nonexistent" in str(e.value)

    def test_getattr(self):
        assert self.session_state.foo == "bar"

    def test_getattr_error(self):
        with pytest.raises(AttributeError) as e:
            self.session_state.nonexistent
        assert "nonexistent" in str(e.value)

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setattr(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        patched_get_report_ctx.return_value = mock_ctx

        self.session_state.corge = "grault"
        assert self.session_state.corge == "grault"

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setattr_error(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        mock_ctx.widget_ids_this_run.add("corge")
        patched_get_report_ctx.return_value = mock_ctx

        with pytest.raises(StreamlitAPIException) as e:
            self.session_state.corge = "grault"

        assert "Setting the value of a widget after its creation is disallowed." == str(
            e.value
        )

    def test_delattr(self):
        del self.session_state.foo
        assert self.session_state._merged_state == {"baz": "qux", "foo2": "bar2"}

    def test_delattr_error(self):
        with pytest.raises(AttributeError) as e:
            self.session_state.nonexistent
        assert "nonexistent" in str(e.value)


# LocalSourcesWatcher needs to be patched so that the side effects of the
# ReportSession instantiating one below are suppressed.
@patch("streamlit.report_session.LocalSourcesWatcher")
@patch("streamlit.state.session_state.get_report_ctx")
class SessionStateHelperTests(ServerTestCase):
    @tornado.testing.gen_test
    def test_get_session_state(self, patched_get_report_ctx, _):
        yield self.start_server_loop()

        ws_client = yield self.ws_connect()
        session = list(self.server._session_info_by_id.values())[0].session

        mock_ctx = MagicMock()
        mock_ctx.session_id = session.id
        patched_get_report_ctx.return_value = mock_ctx

        assert isinstance(get_session_state(), SessionState)
        assert isinstance(_get_widget_mgr(), WidgetManager)

    def test_get_session_state_error_if_no_ctx(self, patched_get_report_ctx, _):
        patched_get_report_ctx.return_value = None

        with pytest.raises(RuntimeError) as e:
            get_session_state()
        assert "We were unable to retrieve your Streamlit session." in str(e.value)

    @tornado.testing.gen_test
    def test_get_session_state_error_if_no_session(self, patched_get_report_ctx, _):
        yield self.start_server_loop()

        mock_ctx = MagicMock()
        mock_ctx.session_id = "nonexistent"
        patched_get_report_ctx.return_value = mock_ctx

        with pytest.raises(RuntimeError) as e:
            get_session_state()
        assert "We were unable to retrieve your Streamlit session." in str(e.value)
