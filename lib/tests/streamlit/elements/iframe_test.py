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

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

import streamlit as st
from streamlit.elements.iframe import IframeMixin, _is_file, marshall
from streamlit.errors import StreamlitAPIException
from streamlit.proto.IFrame_pb2 import IFrame as IFrameProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


@pytest.mark.parametrize(
    "tab_index",
    [None, -1, 0, 1, 100],
    ids=["none", "minus_one", "zero", "one", "large"],
)
def test_marshall_with_valid_tab_index(tab_index: int | None) -> None:
    """Test that valid tab_index values are correctly marshalled."""
    proto = IFrameProto()
    marshall(proto, src="https://example.com", tab_index=tab_index)

    if tab_index is not None:
        assert proto.tab_index == tab_index


@pytest.mark.parametrize(
    "invalid_value",
    ["0", 1.5, True, [], {}, -2, -100],
    ids=["string", "float", "bool", "list", "dict", "minus_two", "minus_hundred"],
)
def test_marshall_with_invalid_tab_index(invalid_value: object) -> None:
    """Test that invalid tab_index types and values raise StreamlitAPIException."""
    proto = IFrameProto()
    with pytest.raises(StreamlitAPIException):
        marshall(proto, src="https://example.com", tab_index=invalid_value)


def test_marshall_basic_fields() -> None:
    """Test that basic fields are set correctly on proto."""
    proto = IFrameProto()
    marshall(proto, src="https://example.com")

    assert proto.src == "https://example.com"
    assert proto.scrolling is False


def test_is_file_with_null_byte_string() -> None:
    """Test that _is_file returns False for paths that raise ValueError (e.g., null bytes)."""
    # Strings with a null byte raise ValueError on many platforms when passed to Path
    assert _is_file("invalid\x00path") is False


def test_is_file_with_path_raising_oserror() -> None:
    """Test that _is_file returns False when Path.is_file raises an OSError."""
    with patch("streamlit.elements.iframe.Path") as mock_path:
        mock_path.return_value.is_file.side_effect = OSError("filesystem error")
        assert _is_file("/some/path") is False


def test_is_file_with_long_string() -> None:
    """Test that _is_file short-circuits for very long strings (likely HTML)."""
    long_html = "x" * 5000
    assert _is_file(long_html) is False


def test_is_file_with_html_tag_substring() -> None:
    """Test that _is_file short-circuits for strings containing '<'."""
    assert _is_file("not<a>file") is False


def test_iframe_mixin_dg_returns_self() -> None:
    """``IframeMixin.dg`` returns the mixin instance."""

    class _OnlyIframe(IframeMixin):
        pass

    iframe_mixin = _OnlyIframe()
    assert iframe_mixin.dg is iframe_mixin


class IFrameComponentTest(DeltaGeneratorTestCase):
    """Test the streamlit.components.v1.iframe and html functions."""

    def test_iframe_no_width_uses_stretch_width_config(self):
        """Test that components.iframe without width uses 'stretch' in width_config."""
        st.components.v1.iframe("https://example.com")

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True
        assert element.height_config.pixel_height == 150

        assert element.iframe.src == "https://example.com"

    def test_iframe_with_width_uses_pixel_width_config(self):
        """Test that components.iframe with width uses pixel value in width_config."""
        st.components.v1.iframe("https://example.com", width=300, height=200)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 300
        assert element.height_config.pixel_height == 200

        assert element.iframe.src == "https://example.com"

    def test_iframe_with_width_no_height_uses_default_height(self):
        """Test that components.iframe with width but no height uses default height."""
        st.components.v1.iframe("https://example.com", width=300)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 300
        assert element.height_config.pixel_height == 150

        assert element.iframe.src == "https://example.com"

    def test_html_no_width_uses_stretch_width_config(self):
        """Test that components.html without width uses 'stretch' in width_config."""
        st.components.v1.html("<h1>Test</h1>")

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert element.width_config.use_stretch is True
        assert element.height_config.pixel_height == 150

        assert element.iframe.srcdoc == "<h1>Test</h1>"

    def test_html_with_width_uses_pixel_width_config(self):
        """Test that components.html with width uses pixel value in width_config."""
        st.components.v1.html("<h1>Test</h1>", width=400, height=300)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 400
        assert element.height_config.pixel_height == 300

        assert element.iframe.srcdoc == "<h1>Test</h1>"

    def test_iframe_with_zero_width_and_height(self):
        """Test that components.iframe accepts both width=0 and height=0."""
        st.components.v1.iframe("https://example.com", width=0, height=0)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 0
        assert element.height_config.pixel_height == 0

        assert element.iframe.src == "https://example.com"

    def test_html_with_zero_width_and_height(self):
        """Test that components.html accepts both width=0 and height=0."""
        st.components.v1.html("<h1>Test</h1>", width=0, height=0)

        element = self.get_delta_from_queue().new_element

        assert (
            element.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert element.width_config.pixel_width == 0
        assert element.height_config.pixel_height == 0

        assert element.iframe.srcdoc == "<h1>Test</h1>"


class StIframeTest(DeltaGeneratorTestCase):
    """Test the st.iframe function (new public API)."""

    def test_iframe_with_url(self):
        """Test st.iframe with an absolute URL."""
        st.iframe("https://example.com", height=600)

        element = self.get_delta_from_queue().new_element

        assert element.iframe.src == "https://example.com"
        assert element.iframe.scrolling is True
        assert element.width_config.use_stretch is True
        assert element.height_config.pixel_height == 600

    def test_iframe_with_data_url(self):
        """Test st.iframe with a data: URL."""
        st.iframe("data:text/html,<h1>Hello</h1>", height=100)

        element = self.get_delta_from_queue().new_element

        assert element.iframe.src == "data:text/html,<h1>Hello</h1>"

    def test_iframe_with_relative_url(self):
        """Test st.iframe with a relative URL (starts with /)."""
        st.iframe("/app/static/report.html", height=400)

        element = self.get_delta_from_queue().new_element

        assert element.iframe.src == "/app/static/report.html"

    def test_iframe_with_html_string(self):
        """Test st.iframe with raw HTML content (fallback)."""
        html_content = "<h1>Hello World</h1><p>This is a test.</p>"
        st.iframe(html_content, height=200)

        element = self.get_delta_from_queue().new_element

        assert element.iframe.srcdoc == html_content
        assert element.height_config.pixel_height == 200

    def test_iframe_with_pixel_width(self):
        """Test st.iframe with explicit pixel width."""
        st.iframe("https://example.com", width=500, height=400)

        element = self.get_delta_from_queue().new_element

        assert element.width_config.pixel_width == 500

    def test_iframe_with_width_stretch(self):
        """Test st.iframe with width='stretch'."""
        st.iframe("https://example.com", width="stretch", height=400)

        element = self.get_delta_from_queue().new_element

        assert element.width_config.use_stretch is True

    def test_iframe_with_width_content(self):
        """Test st.iframe with width='content' for srcdoc content."""
        st.iframe("<h1>Test</h1>", width="content", height=400)

        element = self.get_delta_from_queue().new_element

        assert element.width_config.use_content is True
        # Raw srcdoc is passed; frontend handles script injection
        assert element.iframe.srcdoc == "<h1>Test</h1>"

    def test_iframe_default_height_content_fallback(self):
        """Test height='content' behavior: auto-sizing for srcdoc, fallback for URLs."""
        # For URLs: falls back to 400px due to cross-origin restrictions
        st.iframe("https://example.com")
        element = self.get_delta_from_queue().new_element
        assert element.height_config.pixel_height == 400

        # For HTML strings: uses auto-sizing via use_content height config
        st.iframe("<h1>Hello</h1>")
        element = self.get_delta_from_queue().new_element
        assert element.height_config.use_content is True
        # Raw srcdoc is passed; frontend handles script injection
        assert element.iframe.srcdoc == "<h1>Hello</h1>"

    def test_iframe_width_content_fallback_for_url(self):
        """Test width='content' falls back to stretch for URLs."""
        st.iframe("https://example.com", width="content")
        element = self.get_delta_from_queue().new_element
        # URL cannot be measured, so falls back to stretch
        assert element.width_config.use_stretch is True

    def test_iframe_width_content_for_srcdoc(self):
        """Test width='content' works for srcdoc content."""
        st.iframe("<h1>Hello</h1>", width="content", height=100)
        element = self.get_delta_from_queue().new_element
        assert element.width_config.use_content is True
        # Raw srcdoc is passed; frontend handles script injection
        assert element.iframe.srcdoc == "<h1>Hello</h1>"

    def test_iframe_with_pixel_height(self):
        """Test st.iframe with explicit pixel height."""
        st.iframe("https://example.com", height=800)

        element = self.get_delta_from_queue().new_element

        assert element.height_config.pixel_height == 800

    def test_iframe_with_height_stretch(self):
        """Test st.iframe with height='stretch'."""
        st.iframe("https://example.com", height="stretch")

        element = self.get_delta_from_queue().new_element

        assert element.height_config.use_stretch is True

    def test_iframe_with_tab_index(self):
        """Test st.iframe with valid tab_index values."""
        # Positive tab_index
        st.iframe("https://example.com", height=400, tab_index=5)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.tab_index == 5

        # Negative tab_index (-1 is valid)
        st.iframe("https://example.com", height=400, tab_index=-1)
        element = self.get_delta_from_queue().new_element
        assert element.iframe.tab_index == -1

    def test_iframe_with_invalid_tab_index_raises(self):
        """Test that invalid tab_index values raise an exception."""
        with pytest.raises(StreamlitAPIException):
            st.iframe("https://example.com", height=400, tab_index=-2)

    def test_iframe_with_invalid_width_raises(self):
        """Test that invalid width values raise an exception."""
        with pytest.raises(StreamlitAPIException):
            st.iframe("https://example.com", width="invalid", height=400)

    def test_iframe_with_invalid_height_raises(self):
        """Test that invalid height values raise an exception."""
        with pytest.raises(StreamlitAPIException):
            st.iframe("https://example.com", height="invalid")


class StIframeLocalFileTest(DeltaGeneratorTestCase):
    """Test st.iframe with local files."""

    def test_iframe_with_local_html_file(self):
        """Test st.iframe with a local HTML file embeds via srcdoc."""
        html_content = "<html><body><h1>Test</h1></body></html>"

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".html", delete=False, encoding="utf-8"
        ) as f:
            f.write(html_content)
            temp_path = Path(f.name)

        try:
            st.iframe(str(temp_path), height=500)

            element = self.get_delta_from_queue().new_element

            assert element.iframe.srcdoc == html_content
            assert element.iframe.src == ""  # src should be empty for srcdoc
            assert element.height_config.pixel_height == 500
        finally:
            temp_path.unlink()

    def test_iframe_with_path_object(self):
        """Test st.iframe with a Path object for HTML file."""
        html_content = "<html><body><p>Path test</p></body></html>"

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".html", delete=False, encoding="utf-8"
        ) as f:
            f.write(html_content)
            temp_path = Path(f.name)

        try:
            st.iframe(temp_path, height=400)

            element = self.get_delta_from_queue().new_element

            assert element.iframe.srcdoc == html_content
        finally:
            temp_path.unlink()

    def test_iframe_with_htm_extension(self):
        """Test st.iframe recognizes .htm as HTML file."""
        html_content = "<html><body><h2>HTM file</h2></body></html>"

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".htm", delete=False, encoding="utf-8"
        ) as f:
            f.write(html_content)
            temp_path = Path(f.name)

        try:
            st.iframe(str(temp_path), height=300)

            element = self.get_delta_from_queue().new_element

            assert element.iframe.srcdoc == html_content
        finally:
            temp_path.unlink()

    def test_iframe_with_nonexistent_file_raises(self):
        """Test st.iframe raises error for non-existent file path object."""
        with pytest.raises(StreamlitAPIException, match="Unable to read file"):
            st.iframe(Path("/nonexistent/path/to/file.html"), height=400)

    def test_iframe_with_nonexistent_file_string_treated_as_html(self):
        """Test that a string that's not a file or URL is treated as HTML."""
        # A string that doesn't exist as a file and isn't a URL is treated as HTML
        st.iframe("some random text", height=100)

        element = self.get_delta_from_queue().new_element

        assert element.iframe.srcdoc == "some random text"

    def test_iframe_with_non_html_local_file(self):
        """Test st.iframe uploads non-HTML local files and sets iframe.src."""
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".pdf", delete=False) as f:
            # Write some bytes that resemble a PDF header
            f.write(b"%PDF-1.4 test content")
            temp_path = Path(f.name)

        try:
            st.iframe(str(temp_path), height=250)

            element = self.get_delta_from_queue().new_element

            # Non-HTML files should not be embedded via srcdoc
            assert element.iframe.srcdoc == ""
            # The file should be uploaded and exposed via a media URL
            assert element.iframe.src != ""
            assert element.iframe.src.startswith("/media/")
        finally:
            temp_path.unlink()

    def test_iframe_with_unreadable_html_file_raises(self):
        """Test st.iframe raises an exception when reading an HTML file fails."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".html", delete=False, encoding="utf-8"
        ) as f:
            f.write("<html></html>")
            temp_path = Path(f.name)

        try:
            with patch(
                "streamlit.elements.iframe.open",
                side_effect=PermissionError("denied"),
            ):
                with pytest.raises(StreamlitAPIException, match="Unable to read file"):
                    st.iframe(str(temp_path), height=400)
        finally:
            temp_path.unlink()

    def test_iframe_with_unreadable_non_html_file_raises(self):
        """Test st.iframe raises an exception when reading a non-HTML file fails."""
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4")
            temp_path = Path(f.name)

        try:
            with patch(
                "streamlit.elements.iframe.open",
                side_effect=PermissionError("denied"),
            ):
                with pytest.raises(StreamlitAPIException, match="Unable to read file"):
                    st.iframe(str(temp_path), height=400)
        finally:
            temp_path.unlink()

    def test_iframe_with_non_html_file_without_runtime(self):
        """Test st.iframe sets src to empty when runtime is not available."""
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 test")
            temp_path = Path(f.name)

        try:
            with patch("streamlit.elements.iframe.runtime.exists", return_value=False):
                st.iframe(str(temp_path), height=300)

                element = self.get_delta_from_queue().new_element
                # Without runtime, src should be empty for non-HTML files
                assert element.iframe.src == ""
                assert element.iframe.srcdoc == ""
        finally:
            temp_path.unlink()
