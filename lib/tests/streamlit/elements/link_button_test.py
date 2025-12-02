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

"""link_button unit tests."""

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class LinkButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall link_button protos."""

    def test_just_label(self):
        """Test that it can be called with label and string or bytes data."""
        st.link_button("the label", url="https://streamlit.io")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.label == "the label"
        assert c.type == "secondary"
        assert not c.disabled
        # Default is ignore_rerun=True
        assert c.ignore_rerun is True

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.link_button("the label", url="https://streamlit.io", disabled=True)

        c = self.get_delta_from_queue().new_element.link_button
        assert c.disabled

    def test_url_exist(self):
        """Test that file url exist in proto."""
        st.link_button("the label", url="https://streamlit.io")

        c = self.get_delta_from_queue().new_element.link_button
        assert "https://streamlit.io" in c.url

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_type(self, type):
        """Test that it can be called with type param."""
        st.link_button("the label", url="https://streamlit.io", type=type)

        c = self.get_delta_from_queue().new_element.link_button
        assert c.type == type

    def test_emoji_icon(self):
        """Test that it can be called with an emoji icon."""
        st.link_button("the label", url="https://streamlit.io", icon="🎈")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.icon == "🎈"

    def test_material_icon(self):
        """Test that it can be called with a material icon."""
        st.link_button("the label", url="https://streamlit.io", icon=":material/bolt:")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.icon == ":material/bolt:"

    def test_invalid_icon(self):
        """Test that an error is raised if an invalid icon is provided."""
        with pytest.raises(StreamlitAPIException) as e:
            st.link_button("the label", url="https://streamlit.io", icon="invalid")
        assert str(e.value) == (
            'The value "invalid" is not a valid emoji. '
            "Shortcodes are not allowed, please use a single character instead."
        )

    def test_on_click_ignore(self):
        """Test that on_click='ignore' sets ignore_rerun to True."""
        st.link_button("the label", url="https://streamlit.io", on_click="ignore")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.ignore_rerun is True
        # No ID assigned when ignore_rerun is True and no shortcut
        assert c.id == ""

    def test_on_click_none(self):
        """Test that on_click=None sets ignore_rerun to True (backward compatible)."""
        st.link_button("the label", url="https://streamlit.io", on_click=None)

        c = self.get_delta_from_queue().new_element.link_button
        assert c.ignore_rerun is True

    def test_on_click_rerun(self):
        """Test that on_click='rerun' sets ignore_rerun to False."""
        st.link_button("the label", url="https://streamlit.io", on_click="rerun")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.ignore_rerun is False
        # ID is assigned when click handling is enabled
        assert c.id != ""

    def test_on_click_callable(self):
        """Test that on_click=callable sets ignore_rerun to False."""

        def my_callback():
            pass

        st.link_button("the label", url="https://streamlit.io", on_click=my_callback)

        c = self.get_delta_from_queue().new_element.link_button
        assert c.ignore_rerun is False
        assert c.id != ""

    def test_on_click_rerun_returns_bool(self):
        """Test that on_click='rerun' returns a bool."""
        result = st.link_button(
            "the label", url="https://streamlit.io", on_click="rerun"
        )
        assert isinstance(result, bool)
        assert result is False  # Default value

    def test_on_click_ignore_returns_delta_generator(self):
        """Test that on_click='ignore' returns a DeltaGenerator."""
        result = st.link_button(
            "the label", url="https://streamlit.io", on_click="ignore"
        )
        # When ignore_rerun is True, returns DeltaGenerator (not bool)
        assert result is not True
        assert result is not False

    def test_key_sets_element_id(self):
        """Test that key parameter sets the element id."""
        st.link_button("the label", url="https://streamlit.io", key="my_link_button")

        c = self.get_delta_from_queue().new_element.link_button
        # ID is set when key is provided
        assert c.id != ""

    def test_key_without_on_click(self):
        """Test that key works without on_click (ignore_rerun is still True)."""
        st.link_button("the label", url="https://streamlit.io", key="my_link")

        c = self.get_delta_from_queue().new_element.link_button
        assert c.ignore_rerun is True
        assert c.id != ""
