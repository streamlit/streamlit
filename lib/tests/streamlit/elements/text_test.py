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

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StTextAPITest(DeltaGeneratorTestCase):
    """Test st.text API."""

    def test_st_text(self):
        """Test st.text."""
        st.text("some text")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, "some text")

    def test_st_text_with_help(self):
        """Test st.text with help."""
        st.text("some text", help="help text")
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, "some text")
        self.assertEqual(el.text.help, "help text")
