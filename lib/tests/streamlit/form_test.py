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

"""Form unit tests."""

import textwrap

from tests import testutil

import streamlit as st
from streamlit.errors import StreamlitAPIException


class FormTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall form protos."""

    def test_multiple_forms_no_labels_no_keys(self):
        """Test that multiple forms without labels and keys are not allowed."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            st.beta_form()
            st.beta_form()

        self.assertIn(
            "There are multiple identical forms with the same generated key.",
            str(ctx.exception),
        )

    def test_multiple_forms_same_labels_no_keys(self):
        """Test that multiple forms with same labels and no keys are not allowed."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            st.beta_form(submit_label="foo")
            st.beta_form(submit_label="foo")

        self.assertIn(
            "There are multiple identical forms with the same generated key.",
            str(ctx.exception),
        )

    def test_multiple_forms_different_labels_no_keys(self):
        """Test that multiple forms with different labels and no keys are allowed."""

        try:
            st.beta_form(submit_label="foo")
            st.beta_form(submit_label="bar")

        except Exception:
            self.fail("Forms with different labels and no keys failed to create.")

    def test_multiple_forms_no_labels_same_keys(self):
        """Test that multiple forms with no labels and same keys are not allowed."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            st.beta_form(key="foo")
            st.beta_form(key="foo")

        self.assertIn(
            "There are multiple identical forms with `key='foo'`", str(ctx.exception)
        )

    def test_multiple_forms_same_labels_different_keys(self):
        """Test that multiple forms with same labels and no keys are allowed."""

        try:
            st.beta_form(key="foo")
            st.beta_form(key="bar")

        except Exception:
            self.fail("Forms with same labels and different keys failed to create.")

    def test_form_in_form(self):
        """Test that forms cannot be nested in other forms."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            with st.beta_form():
                with st.beta_form():
                    pass

        self.assertEqual(str(ctx.exception), "Forms cannot be nested in other forms.")

    def test_button_in_form(self):
        """Test that buttons are not allowed in forms."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            with st.beta_form():
                st.button("foo")

        self.assertEqual(str(ctx.exception), "Button can't be used in a form.")

    def test_form_block_id(self):
        """Test that a form creates a block element with a correct id."""

        # Calling `with` will invoke `__exit__` on `DeltaGenerator`
        # which in turn will create the submit button.
        with st.beta_form(key="foo"):
            pass

        # 2 elements will be created: a block, and a submit button.
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        self.assertIn("foo", form_proto.form_id)

    def test_form_block_data(self):
        """Test that a form creates a block element with correct data."""

        form_data = st.beta_form(submit_label="foo", key="bar")._form_data

        self.assertEqual(form_data.submit_button_label, "foo")
        self.assertEqual(form_data.submit_button_key, "bar")
        self.assertIn("bar", form_data.form_id)

    def test_form_submit_button_with_default_label(self):
        """Test that form creates a submit button with default label."""

        # Calling `with` will invoke `__exit__` on `DeltaGenerator`
        # which in turn will create the submit button.
        with st.beta_form(key="foo"):
            pass

        # 2 elements will be created: a block, and a submit button.
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        submit_button_proto = self.get_delta_from_queue(1).new_element.button
        self.assertIn("foo", submit_button_proto.id)
        self.assertEqual(submit_button_proto.label, "Submit")
        self.assertEqual(submit_button_proto.is_form_submitter, True)

    def test_form_submit_button_with_custom_label(self):
        """Test that form creates a submit button with custom label."""

        # Calling `with` will invoke `__exit__` on `DeltaGenerator`
        # which in turn will create the submit button.
        with st.beta_form(submit_label="foo", key="bar"):
            pass

        # 2 elements will be created: a block, and a submit button.
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        submit_button_proto = self.get_delta_from_queue(1).new_element.button
        self.assertIn("bar", submit_button_proto.id)
        self.assertEqual(submit_button_proto.label, "foo")
        self.assertEqual(submit_button_proto.is_form_submitter, True)

    # (HK) TODOs:
    # - columns inside a form
    # - a form inside of columns
    # - file uploader (after Tim's refactor)
