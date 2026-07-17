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

"""page_link unit tests."""

from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonLikeIconPosition_pb2 import (
    ButtonLikeIconPosition as ProtoButtonLikeIconPosition,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PageLinkTest(DeltaGeneratorTestCase):
    """Test ability to marshall page_link protos."""

    def test_external_http_page(self):
        """Test that it can be called with an external http page link."""
        st.page_link(page="http://example.com", label="HTTP Test")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "HTTP Test"
        assert c.page == "http://example.com"
        assert c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    def test_external_https_page(self):
        """Test that it can be called with an external https page link."""
        st.page_link(page="https://example.com", label="HTTPS Test")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "HTTPS Test"
        assert c.page == "https://example.com"
        assert c.external
        assert not c.disabled

    def test_external_no_label(self):
        """Test that page_link throws an StreamlitAPIException on external link, no label."""
        with pytest.raises(StreamlitAPIException):
            st.page_link(page="http://example.com")

    def test_icon(self):
        """Test that it can be called with icon param."""
        st.page_link(page="https://streamlit.io", label="the label", icon="🐶")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.icon == "🐶"
        assert c.icon_position == ProtoButtonLikeIconPosition.LEFT

    def test_icon_position(self):
        """Test that custom icon positions are serialized."""
        st.page_link(
            page="https://streamlit.io",
            label="the label",
            icon="🐶",
            icon_position="right",
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.icon_position == ProtoButtonLikeIconPosition.RIGHT

    def test_disabled(self):
        """Test that it can be called with disabled param."""
        st.page_link(page="https://streamlit.io", label="the label", disabled=True)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.disabled

    def test_help(self):
        """Test that it can be called with help param."""
        st.page_link(
            page="https://streamlit.io", label="the label", help="Some help text"
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.help == "Some help text"

    def test_query_params(self):
        """Test that it can be called with query_params param."""
        st.page_link(
            page="https://streamlit.io",
            label="the label",
            query_params={"foo": "bar", "baz": [1, 2]},
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.query_string == "foo=bar&baz=1&baz=2"

    def test_query_params_list_of_tuples(self):
        """Test that it can be called with query_params as list of tuples."""
        st.page_link(
            page="https://streamlit.io",
            label="the label",
            query_params=[("foo", "bar"), ("baz", "1"), ("baz", "2")],
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.query_string == "foo=bar&baz=1&baz=2"

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_label(self):
        """Test that st.page_link accepts an st.Page, but does not uses its title"""
        page = st.Page("foo.py", title="Bar Test")
        st.page_link(page=page, label="Foo Test")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Foo Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_without_label(self):
        """Test that st.page_link accepts an st.Page, but will use its title if necessary"""
        page = st.Page("foo.py", title="Bar Test")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_url_path(self):
        """Test that st.page_link accepts an st.Page, but will use the url_path if necessary"""
        page = st.Page("foo.py", title="Bar Test", url_path="bar")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "bar"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_icon_passed_to_page_link_takes_precedence(self):
        """Test that st.page_link icon param overrides page icon"""
        page = st.Page("foo.py", title="Bar Test", icon="🎈")
        st.page_link(page=page, icon="🌟")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == "🌟"  # Icon parameter of st.page_link takes precedence
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_icon(self):
        """Test that st.page_link accepts an st.Page, will use its icon"""
        page = st.Page("foo.py", title="Bar Test", icon="🎈")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == "🎈"
        assert c.help == ""

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_none_icon(self):
        """Test that st.page_link handles None icon from StreamlitPage correctly"""
        # None icon defaults to empty string in StreamlitPage
        page = st.Page("foo.py", title="Bar Test", icon=None)
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Bar Test"
        assert c.page_script_hash == page._script_hash
        assert c.page == "foo"
        assert not c.external
        assert not c.disabled
        assert c.icon == ""  # None icon should become empty string (default st st.Page)
        assert c.help == ""

    def test_external_streamlit_page(self):
        """Test that st.page_link works with an external StreamlitPage object."""
        page = st.Page("https://docs.streamlit.io", title="Docs", icon="📖")
        st.page_link(page=page)

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Docs"
        assert c.page == "https://docs.streamlit.io"
        assert c.external
        assert c.icon == "📖"
        assert not c.disabled

    def test_external_streamlit_page_with_label_override(self):
        """Test that st.page_link label overrides external StreamlitPage title."""
        page = st.Page("https://docs.streamlit.io", title="Docs")
        st.page_link(page=page, label="Custom Label")

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "Custom Label"
        assert c.page == "https://docs.streamlit.io"
        assert c.external

    def test_empty_string_icon_for_external_page_should_raise_exception(self):
        """Test that st.page_link with empty string icon raises an exception for external pages."""

        with pytest.raises(StreamlitAPIException) as exc_info:
            st.page_link(page="https://example.com", label="Test", icon="")

        assert 'The value "" is not a valid emoji' in str(exc_info.value)

    def test_whitespace_only_icon_for_external_page_should_raise_exception(self):
        """Test that st.page_link with whitespace-only icon raises an exception for external pages."""

        with pytest.raises(StreamlitAPIException) as exc_info:
            st.page_link(page="https://example.com", label="Test", icon="   ")

        assert 'The value "   " is not a valid emoji' in str(exc_info.value)

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_mismatched_file_path_raises(self):
        """Linking to an ``st.Page`` whose file path does not match the page
        registered under the same ``url_path`` raises.

        Regression coverage for https://github.com/streamlit/streamlit/issues/10572.
        """
        st.navigation([st.Page("page1.py", url_path="foo")])

        bad_page = st.Page("other.py", url_path="foo")
        with pytest.raises(StreamlitAPIException, match=r"different page is "):
            st.page_link(bad_page)

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_with_inferred_url_path_mismatch_raises(self):
        """Linking to ``st.Page("foo.py")`` (url_path inferred as ``foo``)
        raises when a different file is registered under ``url_path="foo"``."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        with pytest.raises(StreamlitAPIException, match=r"different page is "):
            st.page_link(st.Page("foo.py"))

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_callable_with_file_registered_raises(self):
        """Linking to a callable-based ``st.Page`` raises when the registered
        page sharing its ``url_path`` is file-based."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        def some_callable() -> None:
            pass

        with pytest.raises(StreamlitAPIException, match=r"is a callable"):
            st.page_link(st.Page(some_callable, url_path="foo"))

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_matching_source_does_not_raise(self):
        """An ``st.Page`` whose source matches the registered page is accepted
        by validation."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        matching = st.Page("page1.py", url_path="foo")
        st.page_link(matching)

    @patch("pathlib.Path.is_file", MagicMock(return_value=True))
    def test_st_page_unregistered_url_path_does_not_raise(self):
        """If no page with the given ``url_path`` is registered (no hash
        collision), validation is skipped — preserving previous behavior for
        apps that don't use ``st.navigation``."""
        st.navigation([st.Page("page1.py", url_path="foo")])

        st.page_link(st.Page("other.py", url_path="bar"))
