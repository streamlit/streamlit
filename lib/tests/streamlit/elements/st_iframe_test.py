# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import (
    HeightConfigFields,
    WidthConfigFields,
)


class TestStIframeUrl(DeltaGeneratorTestCase):
    """Tests for st.iframe with URL inputs."""

    def test_absolute_url_http(self) -> None:
        """Test that http URLs are correctly set as src."""
        st.iframe("http://example.com", height=500)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.src == "http://example.com"
        assert element.iframe.WhichOneof("type") == "src"
        assert element.height_config.pixel_height == 500

    def test_absolute_url_https(self) -> None:
        """Test that https URLs are correctly set as src."""
        st.iframe("https://docs.streamlit.io", height=600)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.src == "https://docs.streamlit.io"

    def test_data_url(self) -> None:
        """Test that data URLs are correctly set as src."""
        st.iframe("data:text/html,<h1>Hello</h1>", height=100)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.src == "data:text/html,<h1>Hello</h1>"

    def test_relative_url(self) -> None:
        """Test that relative URLs starting with / are set as src."""
        st.iframe("/app/static/report.html", height=400)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.src == "/app/static/report.html"

    def test_url_with_content_height_falls_back(self) -> None:
        """Test that height='content' with URL falls back to 400px."""
        st.iframe("https://example.com")
        element = self.get_delta_from_queue().new_element
        assert element.height_config.pixel_height == 400
        assert element.iframe.content_height is False


class TestStIframeHtml(DeltaGeneratorTestCase):
    """Tests for st.iframe with HTML string inputs."""

    def test_html_string(self) -> None:
        """Test that plain HTML strings are set as srcdoc."""
        st.iframe("<h1>Hello World</h1>")
        element = self.get_delta_from_queue().new_element
        assert element.iframe.srcdoc == "<h1>Hello World</h1>"
        assert element.iframe.WhichOneof("type") == "srcdoc"

    def test_html_string_with_content_height(self) -> None:
        """Test that content_height is set for HTML strings with height='content'."""
        st.iframe("<p>Auto height</p>")
        element = self.get_delta_from_queue().new_element
        assert element.iframe.content_height is True
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_CONTENT.value
        )

    def test_html_string_with_pixel_height(self) -> None:
        """Test that pixel height works for HTML strings."""
        st.iframe("<p>Fixed height</p>", height=200)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.srcdoc == "<p>Fixed height</p>"
        assert element.height_config.pixel_height == 200
        assert element.iframe.content_height is False

    def test_plain_text_treated_as_html(self) -> None:
        """Test that plain text that isn't a URL or file is treated as HTML."""
        st.iframe("foo", height=100)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.srcdoc == "foo"


class TestStIframeLocalFile(DeltaGeneratorTestCase):
    """Tests for st.iframe with local file inputs."""

    def test_html_file_with_path_object(self) -> None:
        """Test that HTML files via Path objects are read as srcdoc."""
        with tempfile.NamedTemporaryFile(
            suffix=".html", mode="w", delete=False, encoding="utf-8"
        ) as f:
            f.write("<h1>Local HTML</h1>")
            temp_path = Path(f.name)

        try:
            st.iframe(temp_path)
            element = self.get_delta_from_queue().new_element
            assert element.iframe.srcdoc == "<h1>Local HTML</h1>"
            assert element.iframe.content_height is True
        finally:
            os.remove(temp_path)

    def test_html_file_with_string_path(self) -> None:
        """Test that HTML files via string paths are read as srcdoc."""
        with tempfile.TemporaryDirectory() as tmpdir:
            original_cwd = os.getcwd()
            try:
                os.chdir(tmpdir)
                Path("test.htm").write_text("<p>HTM file</p>", encoding="utf-8")
                st.iframe("test.htm")
            finally:
                os.chdir(original_cwd)

        element = self.get_delta_from_queue().new_element
        assert element.iframe.srcdoc == "<p>HTM file</p>"

    def test_xhtml_file(self) -> None:
        """Test that .xhtml files are read as srcdoc."""
        with tempfile.NamedTemporaryFile(
            suffix=".xhtml", mode="w", delete=False, encoding="utf-8"
        ) as f:
            f.write("<p>XHTML file</p>")
            temp_path = Path(f.name)

        try:
            st.iframe(temp_path)
            element = self.get_delta_from_queue().new_element
            assert element.iframe.srcdoc == "<p>XHTML file</p>"
        finally:
            os.remove(temp_path)

    @patch("streamlit.elements.iframe.runtime")
    def test_non_html_file_uses_media_storage(self, mock_runtime: MagicMock) -> None:
        """Test that non-HTML files are uploaded to media storage."""
        mock_instance = MagicMock()
        mock_instance.media_file_mgr.add.return_value = "/media/test123"
        mock_runtime.exists.return_value = True
        mock_runtime.get_instance.return_value = mock_instance

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 test content")
            temp_path = Path(f.name)

        try:
            st.iframe(temp_path, height=600)
            element = self.get_delta_from_queue().new_element
            assert element.iframe.src == "/media/test123"
            assert element.iframe.content_height is False
            assert element.height_config.pixel_height == 600
        finally:
            os.remove(temp_path)

    def test_nonexistent_path_object_raises(self) -> None:
        """Test that a Path object pointing to a nonexistent file raises."""
        with pytest.raises(StreamlitAPIException, match="File not found"):
            st.iframe(Path("/nonexistent/file.html"))

    def test_nonexistent_string_path_treated_as_html(self) -> None:
        """Test that a string path that doesn't exist is treated as HTML."""
        st.iframe("nonexistent_file.html", height=100)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.srcdoc == "nonexistent_file.html"


class TestStIframeLayout(DeltaGeneratorTestCase):
    """Tests for st.iframe width and height configuration."""

    def test_default_width_is_stretch(self) -> None:
        """Test that default width is 'stretch'."""
        st.iframe("<p>Test</p>", height=100)
        element = self.get_delta_from_queue().new_element
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )

    def test_pixel_width(self) -> None:
        """Test that pixel width is set correctly."""
        st.iframe("<p>Test</p>", width=500, height=100)
        element = self.get_delta_from_queue().new_element
        assert element.width_config.pixel_width == 500

    def test_content_width(self) -> None:
        """Test that 'content' width is set correctly."""
        st.iframe("<p>Test</p>", width="content", height=100)
        element = self.get_delta_from_queue().new_element
        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )

    def test_stretch_height(self) -> None:
        """Test that 'stretch' height is set correctly."""
        st.iframe("<p>Test</p>", height="stretch")
        element = self.get_delta_from_queue().new_element
        assert (
            element.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_STRETCH.value
        )

    def test_invalid_width_raises(self) -> None:
        """Test that invalid width values raise an error."""
        with pytest.raises(StreamlitAPIException):
            st.iframe("<p>Test</p>", width="invalid")  # type: ignore[arg-type]

    def test_invalid_height_raises(self) -> None:
        """Test that invalid height values raise an error."""
        with pytest.raises(StreamlitAPIException):
            st.iframe("<p>Test</p>", height="invalid")  # type: ignore[arg-type]


class TestStIframeScrollingAndTabIndex(DeltaGeneratorTestCase):
    """Tests for st.iframe scrolling and tab_index behavior."""

    def test_scrolling_always_true(self) -> None:
        """Test that scrolling is always enabled for st.iframe."""
        st.iframe("<p>Test</p>", height=100)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.scrolling is True

    def test_tab_index(self) -> None:
        """Test that tab_index is set correctly."""
        st.iframe("<p>Test</p>", height=100, tab_index=0)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.tab_index == 0

    def test_tab_index_negative(self) -> None:
        """Test that negative tab_index (-1) is accepted."""
        st.iframe("<p>Test</p>", height=100, tab_index=-1)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.tab_index == -1

    def test_tab_index_none(self) -> None:
        """Test that tab_index=None doesn't set the field."""
        st.iframe("<p>Test</p>", height=100)
        element = self.get_delta_from_queue().new_element
        assert not element.iframe.HasField("tab_index")

    def test_invalid_tab_index_raises(self) -> None:
        """Test that invalid tab_index values raise an error."""
        with pytest.raises(StreamlitAPIException):
            st.iframe("<p>Test</p>", height=100, tab_index=-2)

    def test_bool_tab_index_raises(self) -> None:
        """Test that boolean tab_index values raise an error."""
        with pytest.raises(StreamlitAPIException):
            st.iframe("<p>Test</p>", height=100, tab_index=True)  # type: ignore[arg-type]


class TestStIframeInputDetection(DeltaGeneratorTestCase):
    """Tests for st.iframe input type detection order."""

    def test_path_object_takes_priority(self) -> None:
        """Test that Path objects are always treated as file paths."""
        with tempfile.NamedTemporaryFile(
            suffix=".html", mode="w", delete=False, encoding="utf-8"
        ) as f:
            f.write("<p>File content</p>")
            temp_path = Path(f.name)

        try:
            st.iframe(temp_path)
            element = self.get_delta_from_queue().new_element
            assert element.iframe.srcdoc == "<p>File content</p>"
        finally:
            os.remove(temp_path)

    def test_url_detected_before_file_check(self) -> None:
        """Test that URLs are detected before checking for files."""
        st.iframe("https://example.com", height=100)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.src == "https://example.com"
