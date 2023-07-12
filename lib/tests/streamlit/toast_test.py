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

"""toast unit tests."""

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ToastTest(DeltaGeneratorTestCase):
    def test_just_text(self):
        """Test that it can be called with just text."""
        st.toast("toast text")

        c = self.get_delta_from_queue().new_element.toast
        self.assertEqual(c.body, "toast text")
        self.assertEqual(c.icon, "")

    def test_no_text(self):
        """Test that an error is raised if no text is provided."""
        with self.assertRaises(StreamlitAPIException) as e:
            st.toast("")
        self.assertEqual(
            str(e.exception),
            "Toast body cannot be blank - please provide a message.",
        )

    def test_valid_icon(self):
        """Test that it can be called passing a valid emoji as icon."""
        st.toast("toast text", icon="🦄")

        c = self.get_delta_from_queue().new_element.toast
        self.assertEqual(c.body, "toast text")
        self.assertEqual(c.icon, "🦄")

    def test_invalid_icon(self):
        """Test that an error is raised if an invalid icon is provided."""
        with self.assertRaises(StreamlitAPIException) as e:
            st.toast("toast text", icon="invalid")
        self.assertEqual(
            str(e.exception),
            'The value "invalid" is not a valid emoji. Shortcodes are not allowed, please use a single character instead.',
        )
