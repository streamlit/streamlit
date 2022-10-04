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

from unittest.mock import patch

from parameterized import parameterized

import streamlit as st
from tests import testutil


class SomeObj(object):
    pass


class CheckboxTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall checkbox protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.checkbox("the label")

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, False)
        self.assertEqual(c.disabled, False)

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

    @patch("streamlit.runtime.is_running", return_value=True)
    def test_inside_form(self, _):
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
