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

from tests import testutil

import streamlit as st
from streamlit.errors import StreamlitAPIException


class FormTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall form protos."""

    def test_multiple_forms_same_key(self):
        """Multiple forms with the same key are not allowed."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            st.beta_form(key="foo")
            st.beta_form(key="foo")

        self.assertIn(
            "There are multiple identical forms with `key='foo'`", str(ctx.exception)
        )

    def test_multiple_forms_same_labels_different_keys(self):
        """Multiple forms with different keys are allowed."""

        try:
            st.beta_form(key="foo")
            st.beta_form(key="bar")

        except Exception:
            self.fail("Forms with same labels and different keys failed to create.")

    def test_form_in_form(self):
        """Test that forms cannot be nested in other forms."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            with st.beta_form("foo"):
                with st.beta_form("bar"):
                    pass

        self.assertEqual(str(ctx.exception), "Forms cannot be nested in other forms.")

    def test_button_in_form(self):
        """Test that buttons are not allowed in forms."""

        with self.assertRaises(StreamlitAPIException) as ctx:
            with st.beta_form("foo"):
                st.button("foo")

        self.assertEqual(str(ctx.exception), "Button can't be used in a form.")

    def test_form_block_id(self):
        """Test that a form creates a block element with a correct id."""

        # Calling `with` will invoke `__exit__` on `DeltaGenerator`
        with st.beta_form(key="foo"):
            pass

        # Check that we create a form block element
        self.assertEqual(len(self.get_all_deltas_from_queue()), 1)
        form_proto = self.get_delta_from_queue(0).add_block
        self.assertIn("foo", form_proto.form_id)

    def test_form_block_data(self):
        """Test that a form creates a block element with correct data."""

        form_data = st.beta_form(key="bar")._form_data
        self.assertIn("bar", form_data.form_id)

    # (HK) TODOs:
    # - columns inside a form
    # - a form inside of columns
    # - file uploader (after Tim's refactor)
