# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from streamlit.errors import StreamlitAPIException
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
