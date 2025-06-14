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
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


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

    def test_st_html_with_width(self):
        """Test st.html with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                st.html("<p>test html</p>", width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.html.body == "<p>test html</p>"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_st_html_with_invalid_width(self):
        """Test st.html with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Invalid width value: 'invalid'. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Invalid width value: -100. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid width value: 0. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Invalid width value: 100.5. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.html("<p>test html</p>", width=width_value)

                assert str(exc.value) == expected_error_message

    def test_st_html_default_width(self):
        """Test that st.html defaults to stretch width."""
        st.html("<p>test html</p>")

        el = self.get_delta_from_queue().new_element
        assert el.html.body == "<p>test html</p>"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_st_html_style_only_no_width_config(self):
        """Test that st.html with only style tags doesn't apply width configuration."""
        st.html("<style>.test { color: red; }</style>", width=300)

        # The style tag should be enqueued to the event delta generator
        style_msg = self.get_message_from_queue()
        assert style_msg.metadata.delta_path == [2, 0]

        # Check that html body is the expected style tag
        style_el = self.get_delta_from_queue().new_element
        assert style_el.html.body == "<style>.test { color: red; }</style>"

        # Verify that no width configuration is applied for style-only HTML
        assert not style_el.HasField("width_config")

    def test_st_html_with_nonhtml_filelike_str(self):
        """Test st.html with a string that's neither HTML-like nor a real file."""
        st.html("foo/fake.html")

        el = self.get_delta_from_queue().new_element
        assert el.html.body == "foo/fake.html"
