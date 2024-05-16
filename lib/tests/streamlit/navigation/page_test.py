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

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class PagesManagerTest(DeltaGeneratorTestCase):
    """Test st.Page"""

    def test_cannot_infer_title_raises_exception(self):
        """Test that passing a page without a title raises an exception."""

        class Foo:
            def __call__(self):
                pass

        with pytest.raises(StreamlitAPIException):
            st.Page(Foo())

    def test_invalid_icon_raises_exception(self):
        """Test that passing an invalid icon raises an exception."""

        with pytest.raises(StreamlitAPIException):
            st.Page("page.py", icon="hello world")

    def test_valid_icon(self):
        """Test that passing an valid icon does not raise an exception."""

        st.Page("page.py", icon="😱")
        # Provide an assertion to ensure no error
        assert True

    def test_script_hash_for_paths_are_different(self):
        assert st.Page("page1.py")._script_hash != st.Page("page2.py")._script_hash
        assert (
            st.Page(lambda: True, title="Title 1")._script_hash
            != st.Page(lambda: True, title="Title 2")._script_hash
        )

    def test_page_run_cannot_be_run_automatically(self):
        """Test that a page cannot be run automatically."""
        with pytest.raises(StreamlitAPIException):
            st.Page("page.py").run()

    def test_page_run_cannot_be_run_if_ordained(self):
        """Test that a page can be run if ordained."""

        # Indicates we are in V2
        self.script_run_ctx.pages_manager.set_pages({})

        page = st.Page(lambda: True)
        page._can_be_called = True
        page.run()
        # Provide an assertion to ensure no error
        assert True
