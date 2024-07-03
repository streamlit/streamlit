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
        except Exception:
            pytest.fail("Should not raise exception")

    def test_invalid_icon_raises_exception(self):
        """Test that passing an invalid icon raises an exception."""

        with pytest.raises(StreamlitAPIException):
            st.Page("page.py", icon="hello world")

    def test_valid_icon(self):
        """Test that passing a valid icon does not raise an exception."""

        st.Page("page.py", icon="😱")
        # Provide an assertion to ensure no error
        assert True

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
