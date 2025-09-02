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
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.commands.navigation import convert_to_streamlit_page
from streamlit.errors import StreamlitAPIException
from streamlit.navigation.page import StreamlitPage
from streamlit.proto.Navigation_pb2 import Navigation as NavigationProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.testutil import patch_config_options


@patch("pathlib.Path.is_file", MagicMock(return_value=True))
class NavigationTest(DeltaGeneratorTestCase):
    """Test st.navigation"""

    def test_no_pages(self):
        """Test that an error is thrown with no pages"""
        with pytest.raises(StreamlitAPIException):
            st.navigation([])

    def test_single_page(self):
        """Test that a single page is returned"""
        single_page = st.Page("page1.py")
        page = st.navigation([single_page])
        assert page == single_page

    def test_single_page_with_path(self):
        """Test that a single page is returned with a Path object"""
        single_page = st.Page(Path("page1.py"))
        page = st.navigation([single_page])
        assert page == single_page

    def test_first_page_is_default(self):
        """Test that the first page is returned if there are multiple pages and no default"""
        single_page = st.Page("page1.py")
        page = st.navigation([single_page, st.Page("page2.py"), st.Page("page3.py")])
        assert page == single_page
        assert page._default

    def test_default_page_returned_if_specified(self):
        """Test that the first page is returned if there are multiple pages and no default"""
        default_page = st.Page("page3.py", default=True)
        page = st.navigation([st.Page("page1.py"), st.Page("page2.py"), default_page])
        assert page == default_page
        assert page._default

    def test_multiple_defaults_raises_APIException(self):
        """Test that an error is thrown if multiple defaults are specified"""
        with pytest.raises(StreamlitAPIException):
            st.navigation(
                [st.Page("page1.py", default=True), st.Page("page2.py", default=True)]
            )

    def test_same_url_paths_raises_APIException(self):
        """Test that an error is thrown if same url_paths are specified"""
        with pytest.raises(StreamlitAPIException):
            st.navigation(
                [
                    st.Page("page1.py", url_path="foo"),
                    st.Page("page2.py", url_path="foo"),
                ]
            )

    def test_same_inferred_url_paths_raises_APIException(self):
        """Test that an error is thrown if the same inferred url_paths are specified"""
        with pytest.raises(StreamlitAPIException):
            st.navigation(
                [
                    st.Page("page1.py", url_path="foo"),
                    st.Page("foo.py"),
                ]
            )

    def test_page_found_by_hash(self):
        found_page = st.Page("page2.py")
        self.script_run_ctx.pages_manager.set_script_intent(found_page._script_hash, "")
        page = st.navigation([st.Page("page1.py"), found_page, st.Page("page3.py")])
        assert page == found_page

    def test_page_found_by_name(self):
        found_page = st.Page("page2.py")
        self.script_run_ctx.pages_manager.set_script_intent("", "page2")
        page = st.navigation([st.Page("page1.py"), found_page, st.Page("page3.py")])
        assert page == found_page
        assert self.script_run_ctx.page_script_hash == found_page._script_hash

    def test_page_not_found_by_name(self):
        default_page = st.Page("page1.py")
        self.script_run_ctx.pages_manager.set_script_intent("", "bad_page")
        page = st.navigation([default_page, st.Page("page2.py"), st.Page("page3.py")])
        c = self.get_message_from_queue(-2)
        assert c.HasField("page_not_found")
        assert page == default_page
        assert self.script_run_ctx.page_script_hash == default_page._script_hash

    def test_page_not_found_by_hash_returns_default(self):
        default_page = st.Page("page1.py")
        self.script_run_ctx.pages_manager.set_script_intent("bad_hash", "")
        page = st.navigation([default_page, st.Page("page2.py"), st.Page("page3.py")])
        assert page == default_page
        assert self.script_run_ctx.page_script_hash == default_page._script_hash

    def test_navigation_message(self):
        st.navigation(
            {
                "Section 1": [st.Page("page1.py")],
                "Section 2": [st.Page("page2.py"), st.Page("page3.py")],
            }
        )
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].section_header == "Section 1"
        assert c.app_pages[1].section_header == "Section 2"
        assert c.app_pages[2].section_header == "Section 2"
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default
        assert c.position == NavigationProto.Position.SIDEBAR
        assert not c.expanded
        assert c.sections == ["Section 1", "Section 2"]

    def test_navigation_message_with_position(self):
        st.navigation(
            [st.Page("page1.py"), st.Page("page2.py"), st.Page("page3.py")],
            position="hidden",
        )
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].section_header == ""
        assert c.app_pages[1].section_header == ""
        assert c.app_pages[2].section_header == ""
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default
        assert c.position == NavigationProto.Position.HIDDEN
        assert not c.expanded
        assert c.sections == [""]

    @patch_config_options({"client.showSidebarNavigation": False})
    def test_navigation_message_with_sidebar_nav_config(self):
        st.navigation(
            [st.Page("page1.py"), st.Page("page2.py"), st.Page("page3.py")],
        )
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].section_header == ""
        assert c.app_pages[1].section_header == ""
        assert c.app_pages[2].section_header == ""
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default
        assert c.position == NavigationProto.Position.HIDDEN
        assert not c.expanded
        assert c.sections == [""]

    def test_navigation_message_with_expanded(self):
        st.navigation(
            [st.Page("page1.py"), st.Page("page2.py"), st.Page("page3.py")],
            expanded=True,
        )
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].section_header == ""
        assert c.app_pages[1].section_header == ""
        assert c.app_pages[2].section_header == ""
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default
        assert c.position == NavigationProto.Position.SIDEBAR
        assert c.expanded
        assert c.sections == [""]

    def test_convert_to_streamlit_page_with_string(self):
        """Test converting string path to StreamlitPage"""
        page = convert_to_streamlit_page("page1.py")
        assert isinstance(page, StreamlitPage)
        assert isinstance(page._page, Path)
        assert str(page._page) == str(Path("page1.py").absolute())

    def test_convert_to_streamlit_page_with_function(self):
        """Test converting function to StreamlitPage"""

        def test_page():
            pass

        page = convert_to_streamlit_page(test_page)
        assert isinstance(page, StreamlitPage)
        assert page._page == test_page

    def test_convert_to_streamlit_page_with_streamlit_page(self):
        """Test passing StreamlitPage directly"""
        original_page = st.Page("page1.py")
        page = convert_to_streamlit_page(original_page)
        assert page == original_page

    def test_convert_to_streamlit_page_invalid_type(self):
        """Test that invalid types raise exception"""
        with pytest.raises(StreamlitAPIException) as exc_info:
            convert_to_streamlit_page(123)
        assert "Invalid page type" in str(exc_info.value)

    def test_navigation_with_string_list(self):
        """Test navigation with list of strings"""
        pages = ["page1.py", "page2.py", "page3.py"]
        page = st.navigation(pages)
        assert isinstance(page, StreamlitPage)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default

    def test_navigation_with_function_list(self):
        """Test navigation with list of functions"""

        def page1():
            pass

        def page2():
            pass

        pages = [page1, page2]
        page = st.navigation(pages)
        assert isinstance(page, StreamlitPage)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 2
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default

    def test_navigation_with_mixed_list(self):
        """Test navigation with mixed list of strings, functions and StreamlitPages"""

        def page2():
            pass

        pages = ["page1.py", page2, st.Page("page3.py")]
        page = st.navigation(pages)
        assert isinstance(page, StreamlitPage)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default

    def test_navigation_with_sections_and_mixed_types(self):
        """Test navigation with sections containing mixed types"""

        def page2():
            pass

        pages = {"Section 1": ["page1.py", page2], "Section 2": [st.Page("page3.py")]}
        st.navigation(pages)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].section_header == "Section 1"
        assert c.app_pages[1].section_header == "Section 1"
        assert c.app_pages[2].section_header == "Section 2"

    def test_navigation_duplicate_paths_with_mixed_types(self):
        """Test that duplicate paths raise exception with mixed types"""

        def foo():
            pass

        with pytest.raises(StreamlitAPIException):
            st.navigation(
                [
                    "foo.py",
                    foo,  # This should create same URL path as foo.py
                ]
            )

    def test_convert_to_streamlit_page_with_pathlib_path(self):
        """Test converting pathlib.Path to StreamlitPage"""
        page = convert_to_streamlit_page(Path("page1.py"))
        assert isinstance(page, StreamlitPage)
        assert isinstance(page._page, Path)
        assert str(page._page) == str(Path("page1.py").absolute())

    def test_navigation_with_pathlib_path_list(self):
        """Test navigation with list of pathlib.Path"""
        pages = [Path("page1.py"), Path("page2.py"), Path("page3.py")]
        page = st.navigation(pages)
        assert isinstance(page, StreamlitPage)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default

    def test_navigation_with_mixed_list_including_pathlib_path(self):
        """Test navigation with mixed list including pathlib.Path"""

        def page2():
            pass

        pages = [Path("page1.py"), page2, st.Page("page3.py")]
        page = st.navigation(pages)
        assert isinstance(page, StreamlitPage)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default

    def test_navigation_with_sections_and_mixed_types_including_pathlib_path(self):
        """Test navigation with sections containing mixed types, including pathlib.Path"""

        def page2():
            pass

        pages = {
            "Section 1": [Path("page1.py"), page2],
            "Section 2": [st.Page("page3.py")],
        }
        st.navigation(pages)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.app_pages[0].section_header == "Section 1"
        assert c.app_pages[1].section_header == "Section 1"
        assert c.app_pages[2].section_header == "Section 2"

    def test_navigation_sends_prefixed_emoji_icons(self):
        """Test navigation with pages with emoji icons prefix them correctly"""

        page = st.navigation(
            [
                st.Page("page1.py", icon="🚀"),
                st.Page("page2.py", icon=":material/settings:"),
            ]
        )
        assert isinstance(page, StreamlitPage)
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 2
        assert c.app_pages[0].icon == "emoji:🚀"
        assert c.app_pages[1].icon == ":material/settings:"

    def test_navigation_duplicate_paths_with_mixed_types_including_pathlib_path(
        self,
    ):
        """Test that duplicate paths raise exception with mixed types, including pathlib.Path"""

        def foo():
            pass

        with pytest.raises(StreamlitAPIException):
            st.navigation(
                [
                    Path("foo.py"),
                    foo,  # This should create same URL path as foo.py
                ]
            )

    def test_navigation_with_path_and_string_same_name(self):
        with pytest.raises(StreamlitAPIException):
            st.navigation(
                [
                    Path("foo.py"),
                    "foo.py",
                ]
            )

    def test_navigation_with_top_position(self):
        """Test that position="top" produces NavigationProto.Position.TOP"""
        st.navigation(
            [st.Page("page1.py"), st.Page("page2.py"), st.Page("page3.py")],
            position="top",
        )
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 3
        assert c.position == NavigationProto.Position.TOP
        assert c.app_pages[0].is_default
        assert not c.app_pages[1].is_default
        assert not c.app_pages[2].is_default

    def test_navigation_with_invalid_position(self):
        """Test that invalid position value raises appropriate error"""
        with pytest.raises(StreamlitAPIException) as exc_info:
            st.navigation(
                [st.Page("page1.py"), st.Page("page2.py")],
                position="foo",  # Invalid position
            )
        assert "Invalid position" in str(exc_info.value) or "position must be" in str(
            exc_info.value
        )

    def test_navigation_top_position_no_fallback_with_config(self):
        """Test that position="top" remains TOP even when client.showSidebarNavigation=False"""
        with patch_config_options({"client.showSidebarNavigation": False}):
            st.navigation(
                [st.Page("page1.py"), st.Page("page2.py"), st.Page("page3.py")],
                position="top",
            )
            c = self.get_message_from_queue().navigation
            assert (
                c.position == NavigationProto.Position.TOP
            )  # Should remain TOP, not fallback to HIDDEN

    def test_navigation_with_sidebar_position_explicit(self):
        """Test that position="sidebar" produces NavigationProto.Position.SIDEBAR"""
        st.navigation(
            [st.Page("page1.py"), st.Page("page2.py")],
            position="sidebar",
        )
        c = self.get_message_from_queue().navigation
        assert c.position == NavigationProto.Position.SIDEBAR

    def test_navigation_with_hidden_position_explicit(self):
        """Test that position="hidden" produces NavigationProto.Position.HIDDEN"""
        st.navigation(
            [st.Page("page1.py"), st.Page("page2.py")],
            position="hidden",
        )
        c = self.get_message_from_queue().navigation
        assert c.position == NavigationProto.Position.HIDDEN

    def test_navigation_top_position_with_sections(self):
        """Test top navigation with sections"""
        st.navigation(
            {
                "Section 1": [st.Page("page1.py"), st.Page("page2.py")],
                "Section 2": [st.Page("page3.py"), st.Page("page4.py")],
            },
            position="top",
        )
        c = self.get_message_from_queue().navigation
        assert len(c.app_pages) == 4
        assert c.position == NavigationProto.Position.TOP
        assert c.app_pages[0].section_header == "Section 1"
        assert c.app_pages[1].section_header == "Section 1"
        assert c.app_pages[2].section_header == "Section 2"
        assert c.app_pages[3].section_header == "Section 2"
        assert c.sections == ["Section 1", "Section 2"]

    def test_navigation_position_parameter_type(self):
        """Test that position parameter only accepts valid literal values"""
        # Test with valid positions - should not raise
        for pos in ["sidebar", "hidden", "top"]:
            st.navigation([st.Page("page1.py")], position=pos)
            self.get_message_from_queue()  # Clear queue

        # Test with invalid type
        with pytest.raises(StreamlitAPIException):
            st.navigation([st.Page("page1.py")], position=123)  # type: ignore
