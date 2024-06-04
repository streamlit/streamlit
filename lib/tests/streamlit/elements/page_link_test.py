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

"""page_link unit tests."""

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
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

    def test_use_container_width_can_be_set_to_true(self):
        """Test use_container_width can be set to true."""
        st.page_link(
            page="https://streamlit.io", label="the label", use_container_width=True
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.use_container_width == True

    def test_use_container_width_can_be_set_to_false(self):
        """Test use_container_width can be set to false."""
        st.page_link(
            page="https://streamlit.io", label="the label", use_container_width=False
        )

        c = self.get_delta_from_queue().new_element.page_link
        assert c.label == "the label"
        assert c.page == "https://streamlit.io"
        assert c.external
        assert c.use_container_width == False

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
