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

import pytest

import streamlit as st
from streamlit.elements.empty import SkeletonPlaceholder
from streamlit.errors import StreamlitInvalidHeightError, StreamlitInvalidWidthError
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StSkeletonAPITest(DeltaGeneratorTestCase):
    """Test st.skeleton Public API."""

    def test_skeleton_returns_placeholder(self) -> None:
        """Test that st.skeleton returns a SkeletonPlaceholder."""
        placeholder = st.skeleton()
        assert isinstance(placeholder, SkeletonPlaceholder)

    def test_skeleton_default_dimensions(self) -> None:
        """Test default dimensions: 100px height and stretch width."""
        st.skeleton()

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert el.skeleton.height == 100
        assert el.height_config.pixel_height == 100
        assert el.width_config.use_stretch is True

    def test_skeleton_custom_pixel_height(self) -> None:
        """Test that st.skeleton accepts custom pixel height."""
        st.skeleton(height=200)

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert el.skeleton.height == 200
        assert el.height_config.pixel_height == 200

    def test_skeleton_stretch_height(self) -> None:
        """Test that st.skeleton accepts 'stretch' height."""
        st.skeleton(height="stretch")

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert not el.skeleton.HasField("height")
        assert el.height_config.use_stretch is True

    def test_skeleton_custom_pixel_width(self) -> None:
        """Test that st.skeleton accepts custom pixel width."""
        st.skeleton(width=300)

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert el.width_config.pixel_width == 300

    def test_skeleton_stretch_width(self) -> None:
        """Test that st.skeleton accepts 'stretch' width explicitly."""
        st.skeleton(width="stretch")

        delta = self.get_delta_from_queue()
        el = delta.new_element
        assert el.width_config.use_stretch is True

    def test_skeleton_invalid_height(self) -> None:
        """Test that negative height raises an error."""
        with pytest.raises(StreamlitInvalidHeightError):
            st.skeleton(height=-100)

    def test_skeleton_invalid_width(self) -> None:
        """Test that negative width raises an error."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.skeleton(width=-100)

    def test_skeleton_invalid_height_string(self) -> None:
        """Test that invalid height string raises an error."""
        with pytest.raises(StreamlitInvalidHeightError):
            st.skeleton(height="invalid")  # type: ignore[arg-type]

    def test_skeleton_invalid_width_string(self) -> None:
        """Test that invalid width string raises an error."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.skeleton(width="invalid")  # type: ignore[arg-type]


class SkeletonContextManagerTest(DeltaGeneratorTestCase):
    """Test st.skeleton context manager functionality."""

    def test_context_manager_clears_on_exit(self) -> None:
        """Test that skeleton clears when exiting context manager."""
        with st.skeleton():
            pass

        delta = self.get_delta_from_queue()
        assert delta.new_element.HasField("empty")

    def test_context_manager_clears_on_exception(self) -> None:
        """Test that skeleton clears even when exception is raised."""
        try:
            with st.skeleton():
                raise ValueError("Test exception")
        except ValueError:
            pass

        delta = self.get_delta_from_queue()
        assert delta.new_element.HasField("empty")

    def test_context_manager_propagates_exception(self) -> None:
        """Test that exceptions are propagated from context manager."""
        with pytest.raises(ValueError, match="Test exception"):
            with st.skeleton():
                raise ValueError("Test exception")


class SkeletonPlaceholderTest(DeltaGeneratorTestCase):
    """Test SkeletonPlaceholder standalone functionality."""

    def test_placeholder_replacement(self) -> None:
        """Test that placeholder can be replaced with content."""
        placeholder = st.skeleton()
        placeholder.markdown("Hello")

        delta = self.get_delta_from_queue()
        assert delta.new_element.HasField("markdown")
        assert delta.new_element.markdown.body == "Hello"

    def test_placeholder_empty(self) -> None:
        """Test that placeholder can be cleared with empty()."""
        placeholder = st.skeleton()
        placeholder.empty()

        delta = self.get_delta_from_queue()
        assert delta.new_element.HasField("empty")

    def test_placeholder_delegates_to_delta_generator(self) -> None:
        """Test that placeholder delegates attribute access to DeltaGenerator."""
        placeholder = st.skeleton()

        assert hasattr(placeholder, "markdown")
        assert hasattr(placeholder, "dataframe")
        assert hasattr(placeholder, "empty")
        assert hasattr(placeholder, "write")

    def test_placeholder_container(self) -> None:
        """Test that placeholder can use container for multiple elements."""
        placeholder = st.skeleton()
        with placeholder.container():
            st.write("First")
            st.write("Second")

        delta = self.get_delta_from_queue()
        assert delta.add_block is not None
