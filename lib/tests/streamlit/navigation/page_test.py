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

import unittest

from streamlit.navigation.page import Page, StreamlitPage
from streamlit.errors import StreamlitAPIException

import streamlit as st

from tests.delta_generator_test_case import DeltaGeneratorTestCase


class TestClassIdentity(unittest.TestCase):
    """st.Page must be a proper class, not a factory function."""

    def test_page_is_a_class(self):
        """Page must be a type/class, not a plain function."""
        self.assertIsInstance(Page, type)

    def test_instance_type_is_page(self):
        """type(st.Page(...)) should return Page, not StreamlitPage."""
        with patch("pathlib.Path.is_file", return_value=True):
            page = Page("page.py")
        self.assertIs(type(page), Page)

    def test_type_name_is_page(self):
        """The class name seen via type().__name__ must be 'Page'."""
        with patch("pathlib.Path.is_file", return_value=True):
            page = Page("page.py")
        self.assertEqual(type(page).__name__, "Page")

    def test_streamlit_page_alias_is_same_class(self):
        """StreamlitPage kept as deprecated alias — must be the same object as Page."""
        self.assertIs(StreamlitPage, Page)

    def test_isinstance_with_deprecated_alias(self):
        """Existing code using isinstance(x, StreamlitPage) must still work."""
        with patch("pathlib.Path.is_file", return_value=True):
            page = Page("page.py")
        self.assertIsInstance(page, StreamlitPage)

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

        # Indicates we are in V2
        self.script_run_ctx.pages_manager.set_pages({})

        page = st.Page(lambda: True)
        page._can_be_called = True
        page.run()
        # Provide an assertion to ensure no error
        assert True


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

if __name__ == "__main__":
    unittest.main(verbosity=2)
