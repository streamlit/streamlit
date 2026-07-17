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

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitValueError
from tests.conftest import enable_mpa_v2_mode
from tests.delta_generator_test_case import DeltaGeneratorTestCase


@patch("pathlib.Path.is_file", MagicMock(return_value=True))
class StPagesTest(DeltaGeneratorTestCase):
    """Test st.Page"""

    def test_cannot_infer_title_raises_exception(self):
        """Test that passing a page without a title raises an exception."""

        class Foo:
            def __call__(self):
                pass

        with pytest.raises(StreamlitAPIException):
            st.Page(Foo())

        try:
            st.Page(Foo(), title="Hello")
        except Exception as e:
            pytest.fail("Should not raise exception: " + str(e))

    def test_invalid_icon_raises_exception(self):
        """Test that passing an invalid icon raises an exception."""

        with pytest.raises(StreamlitAPIException):
            st.Page("page.py", icon="hello world")

    def test_valid_icon(self):
        """Test that passing a valid icon does not raise an exception."""

        st.Page("page.py", icon="😱")
        # Provide an assertion to ensure no error
        assert True

    def test_empty_string_icon_should_raise_exception(self):
        """Test that passing an empty string icon raises an exception."""

        with pytest.raises(StreamlitAPIException) as exc_info:
            st.Page("page.py", icon="")

        assert 'The value "" is not a valid emoji' in str(exc_info.value)

    def test_whitespace_only_icon_should_raise_exception(self):
        """Test that passing a whitespace-only icon raises an exception."""

        with pytest.raises(StreamlitAPIException) as exc_info:
            st.Page("page.py", icon="   ")

        assert 'The value "   " is not a valid emoji' in str(exc_info.value)

    def test_script_hash_for_paths_are_different(self):
        """Tests that script hashes are different when url path (inferred or not) is unique"""
        assert st.Page("page1.py")._script_hash != st.Page("page2.py")._script_hash
        assert (
            st.Page(lambda: True, url_path="path_1")._script_hash
            != st.Page(lambda: True, url_path="path_2")._script_hash
        )

    def test_url_path_is_inferred_from_filename(self):
        """Tests that url path is inferred from filename if not provided"""
        page = st.Page("page_8.py")
        assert page.url_path == "page_8"

    def test_url_path_is_inferred_from_function_name(self):
        """Tests that url path is inferred from function name if not provided"""

        def page_9():
            pass

        page = st.Page(page_9)
        assert page.url_path == "page_9"

    def test_url_path_overrides_if_specified(self):
        """Tests that url path specified directly overrides inferred path"""
        page = st.Page("page_8.py", url_path="my_url_path")
        assert page.url_path == "my_url_path"

    def test_url_path_strips_leading_slash(self):
        """Tests that url path strips leading slash if provided"""
        page = st.Page("page_8.py", url_path="/my_url_path")
        assert page.url_path == "my_url_path"

    def test_url_path_strips_trailing_slash(self):
        """Tests that url path strips leading slash if provided"""
        page = st.Page("page_8.py", url_path="my_url_path/")
        assert page.url_path == "my_url_path"

    def test_url_path_is_empty_string_if_default(self):
        """Tests that url path is "" if the page is the default page"""

        def page_9():
            pass

        page = st.Page(page_9, default=True)
        assert page.url_path == ""

    def test_non_default_pages_cannot_have_empty_url_path(self):
        """Tests that an error is raised if the empty url path is provided for a non-default page"""

        def page_9():
            pass

        with pytest.raises(StreamlitAPIException):
            st.Page(page_9, url_path="")

    def test_non_default_pages_cannot_have_nested_url_path(self):
        """Tests that an error is raised if the url path contains a nested path"""

        def page_9():
            pass

        with pytest.raises(StreamlitAPIException):
            st.Page(page_9, url_path="foo/bar")

    def test_page_with_no_title_raises_api_exception(self):
        """Tests that an error is raised if the title is empty or inferred to be empty"""

        with pytest.raises(StreamlitAPIException):
            st.Page("_.py")

        def page_9():
            pass

        with pytest.raises(StreamlitAPIException):
            st.Page(page_9, title="    ")

    def test_page_run_cannot_run_standalone(self):
        """Test that a page cannot run standalone."""
        with pytest.raises(StreamlitAPIException):
            st.Page("page.py").run()

    def test_page_run_can_be_run_if_ordained(self):
        """Test that a page can be run if ordained."""

        enable_mpa_v2_mode(self.script_run_ctx.pages_manager)

        page = st.Page(lambda: True)
        page._can_be_called = True
        page.run()
        # Provide an assertion to ensure no error
        assert True

    def test_non_default_pages_cannot_have_slash_only_url_path(self) -> None:
        """Tests that an error is raised if the url path contains only slashes
        or slashes with whitespace."""
        slash_only_paths = ["/", "//", "///", "////", "///   ", "/\t/", "  /  "]
        for url_path in slash_only_paths:
            with pytest.raises(StreamlitAPIException, match="empty"):
                st.Page(lambda: None, url_path=url_path)


# NOTE: This test needs to live outside of the StPagesTest class because the class-level
# @patch mocking the return value of `is_file` takes precedence over the method level
# patch.
@patch("pathlib.Path.is_file", MagicMock(return_value=False))
def test_st_Page_throws_error_if_path_is_invalid():
    with pytest.raises(StreamlitAPIException) as e:
        st.Page("nonexistent.py")
    assert (
        str(e.value)
        == "Unable to create Page. The file `nonexistent.py` could not be found."
    )

    with pytest.raises(StreamlitAPIException) as e:
        st.Page(Path("nonexistent2.py"))
    assert (
        str(e.value)
        == "Unable to create Page. The file `nonexistent2.py` could not be found."
    )


@patch("pathlib.Path.is_file", MagicMock(return_value=True))
class StPagesVisibilityTest(DeltaGeneratorTestCase):
    """Test st.Page visibility parameter"""

    def test_visibility_default_is_visible(self):
        """Test that the default visibility is 'visible'."""
        page = st.Page("page.py")
        assert page.visibility == "visible"

    def test_visibility_can_be_set_to_hidden(self):
        """Test that visibility can be set to 'hidden'."""
        page = st.Page("page.py", visibility="hidden")
        assert page.visibility == "hidden"

    def test_invalid_visibility_raises_exception(self):
        """Test that passing an invalid visibility value raises an exception."""
        with pytest.raises(StreamlitValueError) as exc_info:
            st.Page("page.py", visibility="invalid")
        assert "visibility" in str(exc_info.value)
        assert "visible" in str(exc_info.value)
        assert "hidden" in str(exc_info.value)


class TestExternalUrlSupport(DeltaGeneratorTestCase):
    """Test external URL support in st.Page."""

    def test_external_url_requires_title(self):
        """Test that external URL pages require a title parameter."""
        with pytest.raises(StreamlitAPIException) as exc_info:
            st.Page("https://docs.streamlit.io")

        assert "External URL pages require a `title` parameter" in str(exc_info.value)

    def test_external_url_with_title(self):
        """Test that external URL pages can be created with a title."""
        page = st.Page("https://docs.streamlit.io", title="Docs")
        assert page.title == "Docs"
        assert page.is_external is True
        assert page.external_url == "https://docs.streamlit.io"

    def test_external_url_with_http(self):
        """Test that http URLs are also supported."""
        page = st.Page("http://example.com", title="Example")
        assert page.is_external is True
        assert page.external_url == "http://example.com"

    def test_external_url_cannot_be_default(self):
        """Test that external URL pages cannot be set as default."""
        with pytest.raises(StreamlitAPIException) as exc_info:
            st.Page("https://docs.streamlit.io", title="Docs", default=True)

        assert "External URL pages cannot be set as the default page" in str(
            exc_info.value
        )

    def test_external_url_with_icon(self):
        """Test that external URL pages can have icons."""
        page = st.Page(
            "https://docs.streamlit.io", title="Docs", icon=":material/open_in_new:"
        )
        assert page.icon == ":material/open_in_new:"

    def test_external_url_infers_url_path_from_title(self):
        """Test that url_path is inferred from title for external URLs."""
        page = st.Page("https://docs.streamlit.io", title="Streamlit Docs")
        assert page.url_path == "streamlit_docs"

    def test_external_url_custom_url_path(self):
        """Test that custom url_path can be set for external URLs."""
        page = st.Page(
            "https://docs.streamlit.io", title="Docs", url_path="custom_path"
        )
        assert page.url_path == "custom_path"

    def test_external_url_whitespace_padded_url_path(self):
        """Test that external URL url_path strips leading and trailing whitespace."""
        page = st.Page("https://docs.streamlit.io", title="Docs", url_path="  docs  ")
        assert page.url_path == "docs"

    def test_internal_page_is_not_external(self):
        """Test that internal pages (file paths) are not marked as external."""
        with patch("pathlib.Path.is_file", MagicMock(return_value=True)):
            page = st.Page("page.py")
            assert page.is_external is False
            assert page.external_url is None

    def test_callable_page_is_not_external(self):
        """Test that callable pages are not marked as external."""
        page = st.Page(lambda: True, title="Test")
        assert page.is_external is False
        assert page.external_url is None

    def test_external_url_run_does_nothing(self):
        """Test that run() on an external URL page does nothing and no code is executed."""
        page = st.Page("https://docs.streamlit.io", title="Docs")
        page._can_be_called = True

        # External pages return early in run() without executing any code
        page.run()

        # After run, _can_be_called should be False
        assert page._can_be_called is False

    @parameterized.expand(
        [
            ("ampersand", "FAQ & Help", "faq_help"),
            ("apostrophe_question", "What's New?", "whats_new"),
            ("slash", "A/B Testing", "ab_testing"),
            ("hash", "Search #1", "search_1"),
        ]
    )
    def test_external_url_url_path_sanitization(
        self, _name: str, title: str, expected_url_path: str
    ) -> None:
        """Verify special characters are sanitized from url_path."""
        page = st.Page("https://example.com", title=title)
        assert page.url_path == expected_url_path

    def test_external_url_url_path_normalizes_non_space_whitespace(self):
        """Test that tabs and newlines are normalized to underscores."""
        page = st.Page("https://example.com", title="Docs\tand\nHelp")
        assert page.url_path == "docs_and_help"

    @parameterized.expand(
        [
            ("sanitized_to_empty", "&#?", None),
            ("explicit_empty", "Docs", ""),
            ("slashes_only", "Test", "///"),
        ]
    )
    def test_external_url_empty_url_path_raises_error(
        self, _name: str, title: str, url_path: str | None
    ) -> None:
        """Verify that url_path resolving to empty raises an error."""
        kwargs: dict = {"title": title}
        if url_path is not None:
            kwargs["url_path"] = url_path
        with pytest.raises(StreamlitAPIException, match="URL path cannot be empty"):
            st.Page("https://example.com", **kwargs)

    def test_external_url_cannot_have_nested_url_path(self):
        """Test that external URL pages cannot have nested url_path."""
        with pytest.raises(StreamlitAPIException) as exc_info:
            st.Page("https://example.com", title="Test", url_path="foo/bar")

        assert "nested path" in str(exc_info.value)

    @parameterized.expand(
        [
            ("empty", ""),
            ("whitespace_only", "   "),
        ]
    )
    def test_external_url_blank_title_raises_error(
        self, _name: str, title: str
    ) -> None:
        """Verify that empty or whitespace-only title raises an error."""
        with pytest.raises(StreamlitAPIException, match=r"(?i)title"):
            st.Page("https://example.com", title=title, url_path="valid_path")

    @parameterized.expand(
        [
            ("javascript", "javascript:alert(1)"),
            ("javascript_void", "javascript:void(0)"),
            ("javascript_upper", "JAVASCRIPT:alert(1)"),
            ("vbscript", "vbscript:MsgBox(1)"),
            ("data_html", "data:text/html,<script>alert(1)</script>"),
        ]
    )
    def test_dangerous_url_schemes_not_treated_as_external(
        self, _name: str, url: str
    ) -> None:
        """Verify that dangerous URL schemes are not treated as external URLs.

        Only http:// and https:// URLs should be recognized as external pages.
        Dangerous schemes like javascript: and data: must be rejected.
        """
        with pytest.raises(StreamlitAPIException):
            st.Page(url, title="Malicious")
