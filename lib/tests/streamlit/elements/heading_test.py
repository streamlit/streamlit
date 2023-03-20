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

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StHeaderTest(DeltaGeneratorTestCase):
    """Test ability to marshall header protos."""

    def test_st_header(self):
        """Test st.header."""
        st.header("some header")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some header")
        self.assertEqual(el.heading.tag, "h2")
        self.assertFalse(el.heading.hide_anchor, False)

    def test_st_header_with_anchor(self):
        """Test st.header with anchor."""
        st.header("some header", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some header")
        self.assertEqual(el.heading.tag, "h2")
        self.assertEqual(el.heading.anchor, "some-anchor")
        self.assertFalse(el.heading.hide_anchor, False)

    def test_st_header_with_hidden_anchor(self):
        """Test st.header with hidden anchor."""
        st.header("some header", anchor=False)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some header")
        self.assertEqual(el.heading.tag, "h2")
        self.assertEqual(el.heading.anchor, "")
        self.assertTrue(el.heading.hide_anchor, True)

    def test_st_header_with_invalid_anchor(self):
        """Test st.header with invalid anchor."""
        with pytest.raises(StreamlitAPIException):
            st.header("some header", anchor=True)

    def test_st_header_with_help(self):
        """Test st.header with help."""
        st.header("some header", help="help text")
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some header")
        self.assertEqual(el.heading.tag, "h2")
        self.assertEqual(el.heading.help, "help text")


class StSubheaderTest(DeltaGeneratorTestCase):
    """Test ability to marshall subheader protos."""

    def test_st_subheader(self):
        """Test st.subheader."""
        st.subheader("some subheader")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some subheader")
        self.assertEqual(el.heading.tag, "h3")
        self.assertFalse(el.heading.hide_anchor)

    def test_st_subheader_with_anchor(self):
        """Test st.subheader with anchor."""
        st.subheader("some subheader", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some subheader")
        self.assertEqual(el.heading.tag, "h3")
        self.assertEqual(el.heading.anchor, "some-anchor")
        self.assertFalse(el.heading.hide_anchor)

    def test_st_subheader_with_hidden_anchor(self):
        """Test st.subheader with hidden anchor."""
        st.subheader("some subheader", anchor=False)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some subheader")
        self.assertEqual(el.heading.tag, "h3")
        self.assertEqual(el.heading.anchor, "")
        self.assertTrue(el.heading.hide_anchor, True)

    def test_st_subheader_with_invalid_anchor(self):
        """Test st.subheader with invalid anchor."""
        with pytest.raises(StreamlitAPIException):
            st.subheader("some header", anchor=True)

    def test_st_subheader_with_help(self):
        """Test st.subheader with help."""
        st.subheader("some subheader", help="help text")
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some subheader")
        self.assertEqual(el.heading.tag, "h3")
        self.assertEqual(el.heading.help, "help text")


class StTitleTest(DeltaGeneratorTestCase):
    """Test ability to marshall subheader protos."""

    def test_st_title(self):
        """Test st.title."""
        st.title("some title")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some title")
        self.assertEqual(el.heading.tag, "h1")
        self.assertFalse(el.heading.hide_anchor)

    def test_st_title_with_anchor(self):
        """Test st.title with anchor."""
        st.title("some title", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some title")
        self.assertEqual(el.heading.tag, "h1")
        self.assertEqual(el.heading.anchor, "some-anchor")
        self.assertFalse(el.heading.hide_anchor)

    def test_st_title_with_hidden_anchor(self):
        """Test st.title with hidden anchor."""
        st.title("some title", anchor=False)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some title")
        self.assertEqual(el.heading.tag, "h1")
        self.assertEqual(el.heading.anchor, "")
        self.assertTrue(el.heading.hide_anchor)

    def test_st_title_with_invalid_anchor(self):
        """Test st.title with invalid anchor."""
        with pytest.raises(
            StreamlitAPIException, match="Anchor parameter has invalid value:"
        ):
            st.title("some header", anchor=True)
        with pytest.raises(
            StreamlitAPIException, match="Anchor parameter has invalid type:"
        ):
            st.title("some header", anchor=6)

    def test_st_title_with_help(self):
        """Test st.title with help."""
        st.title("some title", help="help text")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some title")
        self.assertEqual(el.heading.tag, "h1")
        self.assertEqual(el.heading.help, "help text")
