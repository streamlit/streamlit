# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import pathlib

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StHtmlAPITest(DeltaGeneratorTestCase):
    """Test st.html API."""

    def test_st_html(self):
        """Test st.html."""
        st.html("<i> This is a i tag </i>")

        el = self.get_delta_from_queue().new_element
        assert el.html.body == "<i> This is a i tag </i>"

    def test_st_html_empty_body_throws_error(self):
        """Test st.html with empty body throws error."""
        with pytest.raises(StreamlitAPIException) as ctx:
            st.html("")

        assert "`st.html` body cannot be empty" in str(ctx.value)

    def test_st_html_with_style_tag_only(self):
        """Test st.html with only a style tag."""
        st.html("<style>.stHeading h3 { color: purple; }</style>")

        # The style tag should be enqueued to the event delta generator
        style_msg = self.get_message_from_queue()
        assert style_msg.metadata.delta_path == [2, 0]

        # Check that html body is the expected style tag
        style_el = self.get_delta_from_queue().new_element
        assert style_el.html.body == "<style>.stHeading h3 { color: purple; }</style>"

    def test_st_html_with_style_tag_only_case_insensitive(self):
        """Test st.html with only a style tag (case insensitive)."""
        st.html("<STYLE>.stHeading h3 { color: purple; }</STYLE>")

        # The style tag should be enqueued to the event delta generator
        style_msg = self.get_message_from_queue()
        assert style_msg.metadata.delta_path == [2, 0]

        # Check that html body is the expected STYLE tag
        style_el = self.get_delta_from_queue().new_element
        assert style_el.html.body == "<STYLE>.stHeading h3 { color: purple; }</STYLE>"

    def test_st_html_with_comments(self):
        """Test st.html with comments."""
        # Check comment at start of string
        st.html("<!-- HTML Comment --> <style>.stMarkdown h4 { color: blue; }</style>")
        # The style tag should be enqueued to the event delta generator (comment & its location don't matter)
        style_msg = self.get_message_from_queue()
        assert style_msg.metadata.delta_path == [2, 0]
        style_el = self.get_delta_from_queue().new_element
        assert (
            style_el.html.body
            == "<!-- HTML Comment --> <style>.stMarkdown h4 { color: blue; }</style>"
        )

        # Check comment at end of string
        st.html("<style>.stMarkdown h4 { color: blue; }</style> <!-- HTML Comment -->")
        style_msg = self.get_message_from_queue()
        assert style_msg.metadata.delta_path == [2, 1]
        style_el = self.get_delta_from_queue().new_element
        assert (
            style_el.html.body
            == "<style>.stMarkdown h4 { color: blue; }</style> <!-- HTML Comment -->"
        )

    def test_st_html_with_style_and_other_tags(self):
        """Test st.html with style and other tags."""
        st.html("<style>.stHeading h3 { color: purple; }</style><h1>Hello, World!</h1>")

        # Since there's a mix of style and other tags, html is enqueued to the main delta generator
        msg = self.get_message_from_queue()
        assert msg.metadata.delta_path == [0, 0]
        el = self.get_delta_from_queue().new_element
        assert (
            el.html.body
            == "<style>.stHeading h3 { color: purple; }</style><h1>Hello, World!</h1>"
        )

    def test_st_html_with_css_file(self):
        """Test st.html with CSS file."""
        st.html(pathlib.Path(__file__).parent / "test_html.css")

        el = self.get_delta_from_queue().new_element
        # Check that the CSS file contents are wrapped in a style tag
        assert (
            el.html.body
            == "<style>h1 {\n  color: red;\n}\n\nh2 {\n  color: blue;\n}\n</style>"
        )

    def test_st_html_with_file(self):
        """Test st.html with file."""
        st.html(str(pathlib.Path(__file__).parent / "test_html.js"))

        el = self.get_delta_from_queue().new_element
        assert el.html.body.strip() == "<button>Corgi</button>"

    def test_st_html_with_path(self):
        """Test st.html with path."""
        st.html(pathlib.Path(__file__).parent / "test_html.js")

        el = self.get_delta_from_queue().new_element
        assert el.html.body.strip() == "<button>Corgi</button>"

    def test_st_html_with_dunderstr(self):
        """Test st.html with __str__."""

        class MyClass:
            def __str__(self):
                return "mystr"

        obj = MyClass()

        st.html(obj)

        el = self.get_delta_from_queue().new_element
        assert el.html.body == "mystr"

    def test_st_html_with_repr_html(self):
        """Test st.html with _repr_html_."""

        class MyClass:
            def _repr_html_(self):
                return "<div>html</div>"

        obj = MyClass()

        st.html(obj)

        el = self.get_delta_from_queue().new_element
        assert el.html.body == "<div>html</div>"

    def test_st_html_with_repr_html_and_dunderstr(self):
        """Test st.html with _repr_html_ and dunderstr: html should win."""

        class MyClass:
            def __str__(self):
                return "mystr"

            def _repr_html_(self):
                return "<div>html</div>"

        obj = MyClass()

        st.html(obj)

        el = self.get_delta_from_queue().new_element
        assert el.html.body == "<div>html</div>"

    def test_st_html_with_nonhtml_filelike_str(self):
        """Test st.html with a string that's neither HTML-like nor a real file."""
        st.html("foo/fake.html")

        el = self.get_delta_from_queue().new_element
        assert el.html.body == "foo/fake.html"
