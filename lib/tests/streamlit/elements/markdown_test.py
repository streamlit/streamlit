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


class StMarkdownAPITest(DeltaGeneratorTestCase):
    """Test st.markdown API."""

    def test_st_markdown(self):
        """Test st.markdown."""
        st.markdown("    some markdown  ")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.body, "some markdown")

        # test the unsafe_allow_html keyword
        st.markdown("    some markdown  ", unsafe_allow_html=True)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.body, "some markdown")
        self.assertTrue(el.markdown.allow_html)

        # test the help keyword
        st.markdown("    some markdown  ", help="help text")
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.body, "some markdown")
        self.assertEqual(el.markdown.help, "help text")


class StCaptionAPITest(DeltaGeneratorTestCase):
    """Test st.caption APIs."""

    def test_st_caption_with_help(self):
        """Test st.caption with help."""
        st.caption("some caption", help="help text")
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.help, "help text")


class StLatexAPITest(DeltaGeneratorTestCase):
    """Test st.latex APIs."""

    def test_st_latex_with_help(self):
        """Test st.latex with help."""
        st.latex(
            r"""
            a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
            \sum_{k=0}^{n-1} ar^k =
            a \left(\frac{1-r^{n}}{1-r}\right)
            """,
            help="help text",
        )
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.help, "help text")
