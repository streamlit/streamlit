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

from streamlit.errors import StreamlitAPIException
from streamlit.report_thread import _StringSet
from streamlit.state.session_state import SessionState


# TODO: Mock widget values and modify the tests below to account for this once
#       session_state and widget state are unified.
class SessionStateTests(unittest.TestCase):
    def setUp(self):
        self.session_state = SessionState(
            old_state={"foo": "bar"},
            new_state={"baz": "qux"},
        )

    def test_make_state_old(self):
        self.session_state.make_state_old()
        self.assertEqual(self.session_state._new_state, {})
        self.assertEqual(self.session_state._old_state, {"foo": "bar", "baz": "qux"})

    def test_merged_state(self):
        self.assertEqual(self.session_state._merged_state, {"foo": "bar", "baz": "qux"})

    def test_merged_state_new_state_priority(self):
        session_state = SessionState(
            old_state={"foo": "bar"},
            new_state={"foo": "baz"},
        )
        self.assertEqual(session_state._merged_state, {"foo": "baz"})

    def test_is_new_value(self):
        self.assertFalse(self.session_state.is_new_value("foo"))
        self.assertTrue(self.session_state.is_new_value("baz"))

    def test_contains(self):
        # does not contain key
        self.assertFalse("corge" in self.session_state)
        # key in new state
        self.assertTrue("foo" in self.session_state)
        # key in old state
        self.assertTrue("baz" in self.session_state)

    def test_iter(self):
        state_iter = iter(self.session_state)
        self.assertEqual(next(state_iter), "foo")
        self.assertEqual(next(state_iter), "baz")
        with self.assertRaises(StopIteration):
            next(state_iter)

    def test_len(self):
        self.assertEqual(len(self.session_state), 2)

    def test_str(self):
        self.assertEqual(str(self.session_state), "{'foo': 'bar', 'baz': 'qux'}")

    def test_getitem(self):
        self.assertEqual(self.session_state["foo"], "bar")

    def test_getitem_error(self):
        with self.assertRaisesRegex(KeyError, "nonexistent"):
            self.session_state["nonexistent"]

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setitem(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        patched_get_report_ctx.return_value = mock_ctx

        self.session_state["corge"] = "grault"
        self.assertEqual(self.session_state["corge"], "grault")

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setitem_error(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        mock_ctx.widget_ids_this_run.add("corge")
        patched_get_report_ctx.return_value = mock_ctx

        with self.assertRaisesRegex(StreamlitAPIException, "Setting the value"):
            self.session_state["corge"] = "grault"

    def test_delitem(self):
        del self.session_state["foo"]
        self.assertEqual(self.session_state._merged_state, {"baz": "qux"})

    def test_delitem_error(self):
        with self.assertRaisesRegex(KeyError, "nonexistent"):
            del self.session_state["nonexistent"]

    def test_getattr(self):
        self.assertEqual(self.session_state.foo, "bar")

    def test_getattr_error(self):
        with self.assertRaisesRegex(AttributeError, "nonexistent"):
            self.session_state.nonexistent

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setattr(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        patched_get_report_ctx.return_value = mock_ctx

        self.session_state.corge = "grault"
        self.assertEqual(self.session_state.corge, "grault")

    @patch("streamlit.state.session_state.get_report_ctx")
    def test_setattr_error(self, patched_get_report_ctx):
        mock_ctx = MagicMock()
        mock_ctx.widget_ids_this_run = _StringSet()
        mock_ctx.widget_ids_this_run.add("corge")
        patched_get_report_ctx.return_value = mock_ctx

        with self.assertRaisesRegex(StreamlitAPIException, "Setting the value"):
            self.session_state.corge = "grault"

    def test_delattr(self):
        del self.session_state.foo
        self.assertEqual(self.session_state._merged_state, {"baz": "qux"})

    def test_delattr_error(self):
        with self.assertRaisesRegex(AttributeError, "nonexistent"):
            del self.session_state.nonexistent
