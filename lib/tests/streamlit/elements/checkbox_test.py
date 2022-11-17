# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""checkbox unit tests."""

from unittest.mock import MagicMock, patch

from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.type_util import _LOGGER
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class SomeObj:
    pass


class CheckboxTest(DeltaGeneratorTestCase):
    """Test ability to marshall checkbox protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.checkbox("the label")

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, False)
        self.assertEqual(c.disabled, False)
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.checkbox("the label", disabled=True)

        c = self.get_delta_from_queue(0).new_element.checkbox
        self.assertEqual(c.disabled, True)

    @parameterized.expand(
        [
            ("some str", True),
            (123, True),
            (0, False),
            (None, False),
            ({}, False),
            (SomeObj(), True),
        ]
    )
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.checkbox("the label", arg_value)

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, proto_value)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.checkbox("foo")

        proto = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.checkbox("foo")

        # 2 elements will be created: a block and a checkbox
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block.form
        checkbox_proto = self.get_delta_from_queue(1).new_element.checkbox
        self.assertEqual(checkbox_proto.form_id, form_proto.form_id)

    def test_checkbox_help_dedents(self):
        """Test that the checkbox help properly dedents in order to avoid code blocks"""
        st.checkbox(
            "Checkbox label",
            value=True,
            help="""\
hello
 world
""",
        )
        c = self.get_delta_from_queue(0).new_element.checkbox
        self.assertEqual(c.label, "Checkbox label")
        self.assertEqual(c.default, True)
        self.assertEqual(c.help, "hello\n world\n")

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.checkbox("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.checkbox("the label", label_visibility="wrong_value")
        self.assertEqual(
            str(e.exception),
            "Unsupported label_visibility option 'wrong_value'. Valid values are "
            "'visible', 'hidden' or 'collapsed'.",
        )

    def test_empty_label_warning(self):
        """Test that a warning is logged if st.checkbox was called with empty label."""

        with self.assertLogs(_LOGGER) as logs:
            st.checkbox(label="")

        self.assertIn(
            "`label` got an empty value. This is discouraged for accessibility reasons",
            logs.records[0].msg,
        )
