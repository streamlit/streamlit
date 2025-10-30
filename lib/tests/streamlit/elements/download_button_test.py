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

"""download_button unit test."""

import pytest
from parameterized import parameterized

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class DownloadButtonTest(DeltaGeneratorTestCase):
    """Test ability to marshall download_button protos."""

    @parameterized.expand([("hello world",), (b"byteshere",)])
    def test_just_label(self, data):
        """Test that it can be called with label and string or bytes data."""
        st.download_button("the label", data=data)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.label == "the label"
        assert c.type == "secondary"
        assert not c.disabled
        assert not c.ignore_rerun

    def test_emoji_icon(self):
        """Test that it can be called with emoji icon."""
        st.download_button("the label", icon="⚡", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.icon == "⚡"

    def test_material_icon(self):
        """Test that it can be called with material icon."""
        st.download_button("the label", icon=":material/thumb_up:", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.icon == ":material/thumb_up:"

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.download_button("the label", data="juststring", disabled=True)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.disabled

    def test_url_exist(self):
        """Test that file url exist in proto."""
        st.download_button("the label", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        assert "/media/" in c.url

    def test_sets_ignore_rerun(self):
        """Test that it can be called with on_click="ignore"."""
        st.download_button("the label", data="juststring", on_click="ignore")

        c = self.get_delta_from_queue().new_element.download_button
        assert c.ignore_rerun

    @parameterized.expand(["primary", "secondary", "tertiary"])
    def test_type(self, type):
        """Test that it can be called with type param."""
        st.download_button("the label", data="Streamlit", type=type)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.type == type

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.download_button("the label", data="juststring"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_callable_data_string(self):
        """Test that it can be called with a callable returning string data."""

        def get_data():
            return "hello from callable"

        st.download_button("the label", data=get_data)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.label == "the label"
        assert "/media/" in c.url

    def test_callable_data_bytes(self):
        """Test that it can be called with a callable returning bytes data."""

        def get_data():
            return b"bytes from callable"

        st.download_button("the label", data=get_data)

        c = self.get_delta_from_queue().new_element.download_button
        assert c.label == "the label"
        assert "/media/" in c.url

    def test_callable_invoked(self):
        """Test that the callable is actually invoked when creating the download button."""
        invocation_count = []

        def get_data():
            invocation_count.append(1)
            return "data"

        st.download_button("the label", data=get_data)

        assert len(invocation_count) == 1

    def test_callable_with_exception(self):
        """Test error handling when callable raises an exception."""

        def get_data():
            raise ValueError("Error in callable")

        with pytest.raises(ValueError, match="Error in callable"):
            st.download_button("the label", data=get_data)

    def test_callable_deferred_execution(self):
        """Test that callable is NOT invoked until st.download_button() executes.

        This test ensures deferred execution - the callable should not be
        invoked when it's just defined or passed as an argument, only when
        the download button is actually created.
        """
        invocation_count = []

        def get_data():
            invocation_count.append(1)
            return "deferred data"

        # Callable is defined but not yet passed to download_button
        assert len(invocation_count) == 0, (
            "Callable should not be invoked on definition"
        )

        # Pass callable to download_button - this is when it should be invoked
        st.download_button("the label", data=get_data)

        # Now it should have been called exactly once
        assert len(invocation_count) == 1, (
            "Callable should be invoked when download_button executes"
        )

        # Verify the button was created correctly
        c = self.get_delta_from_queue().new_element.download_button
        assert c.label == "the label"
        assert "/media/" in c.url
