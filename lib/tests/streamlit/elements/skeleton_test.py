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

import time
from unittest.mock import patch

import pytest

import streamlit as st
from streamlit.elements.lib.skeleton_placeholder import SkeletonPlaceholder
from streamlit.errors import StreamlitInvalidHeightError, StreamlitInvalidWidthError
from streamlit.proto.Skeleton_pb2 import Skeleton as SkeletonProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StSkeletonAPITest(DeltaGeneratorTestCase):
    """Test st.skeleton Public API."""

    def test_skeleton_returns_placeholder(self) -> None:
        """Test that st.skeleton returns a SkeletonPlaceholder."""
        placeholder = st.skeleton()
        assert isinstance(placeholder, SkeletonPlaceholder)

    def test_skeleton_default_dimensions(self) -> None:
        """Test default dimensions: no explicit height and stretch width.

        With no height, the proto height is left unset and no height is added
        to the layout config so the frontend can resolve the default element
        height.
        """
        placeholder = st.skeleton()

        assert not placeholder._skeleton_proto.HasField("height")
        assert placeholder._layout_config is not None
        assert placeholder._layout_config.height is None
        assert placeholder._layout_config.width == "stretch"

    def test_skeleton_explicit_none_height(self) -> None:
        """Test that passing height=None behaves like the default."""
        placeholder = st.skeleton(height=None)

        assert not placeholder._skeleton_proto.HasField("height")
        assert placeholder._layout_config is not None
        assert placeholder._layout_config.height is None

    def test_internal_skeleton_is_deprecated(self) -> None:
        """Test that the internal _skeleton() emits a deprecation warning
        pointing to the public st.skeleton(), while still rendering."""
        with patch(
            "streamlit.elements.skeleton.show_deprecation_warning"
        ) as mock_warning:
            st.empty()._skeleton(height=120)

        mock_warning.assert_called_once()
        message = mock_warning.call_args.args[0]
        assert "_skeleton" in message
        assert "st.skeleton" in message

        # The skeleton still renders, but the height arg is ignored (the proto
        # height field is deprecated), so it always uses the default height.
        el = self.get_delta_from_queue().new_element
        assert el.HasField("skeleton")
        assert not el.skeleton.HasField("height")

    def test_internal_skeleton_without_height(self) -> None:
        """Test that the internal _skeleton() leaves the proto height unset
        when no height is provided."""
        # Mock the deprecation warning to keep the test isolated from the
        # show_once global state and the enqueued warning element.
        with patch("streamlit.elements.skeleton.show_deprecation_warning"):
            st.empty()._skeleton()

        el = self.get_delta_from_queue().new_element
        assert el.skeleton == SkeletonProto()

    def test_skeleton_pixel_height(self) -> None:
        """Test that st.skeleton accepts a custom pixel height.

        The height is carried by the layout config; the deprecated proto height
        field is no longer set.
        """
        placeholder = st.skeleton(height=200)

        assert not placeholder._skeleton_proto.HasField("height")
        assert placeholder._layout_config is not None
        assert placeholder._layout_config.height == 200

    def test_skeleton_stretch_height(self) -> None:
        """Test that st.skeleton accepts 'stretch' height."""
        placeholder = st.skeleton(height="stretch")

        assert not placeholder._skeleton_proto.HasField("height")
        assert placeholder._layout_config is not None
        assert placeholder._layout_config.height == "stretch"

    def test_skeleton_pixel_width(self) -> None:
        """Test that st.skeleton accepts custom pixel width."""
        placeholder = st.skeleton(width=300)

        assert placeholder._layout_config is not None
        assert placeholder._layout_config.width == 300

    def test_skeleton_stretch_width(self) -> None:
        """Test that st.skeleton accepts 'stretch' width explicitly."""
        placeholder = st.skeleton(width="stretch")

        assert placeholder._layout_config is not None
        assert placeholder._layout_config.width == "stretch"

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

    def test_skeleton_content_width_not_supported(self) -> None:
        """Test that "content" width is rejected (skeleton has no content width)."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.skeleton(width="content")  # type: ignore[arg-type]

    def test_skeleton_content_height_not_supported(self) -> None:
        """Test that "content" height is rejected."""
        with pytest.raises(StreamlitInvalidHeightError):
            st.skeleton(height="content")  # type: ignore[arg-type]


class SkeletonContextManagerTest(DeltaGeneratorTestCase):
    """Test st.skeleton context manager functionality."""

    def test_context_manager_uses_transient_elements(self) -> None:
        """Test that context manager mode uses transient elements (0.5s delay pattern)."""
        # Patch the delay to a smaller value for faster tests.
        # Use 0.1s with 0.3s sleep (200ms buffer) to avoid CI flakiness.
        # A 10ms buffer (0.01s delay, 0.02s sleep) is too tight under load.
        with patch("streamlit.elements.lib.skeleton_placeholder._DELAY_SECS", 0.1):
            with st.skeleton():
                # Sleep longer than the patched delay to ensure timer fires
                time.sleep(0.3)
                # Check the skeleton element was enqueued as a transient
                create_delta = self.get_delta_from_queue()
                assert create_delta.HasField("new_transient")
                assert create_delta.new_transient.elements[0].HasField("skeleton")

            # After exiting, the clear message should be in the queue
            clear_delta = self.get_delta_from_queue()
            assert clear_delta.HasField("new_transient")
            # Clear message has empty elements list
            assert len(clear_delta.new_transient.elements) == 0

    def test_context_manager_clears_on_exception(self) -> None:
        """Test that skeleton clears even when exception is raised."""
        try:
            with st.skeleton():
                raise ValueError("Test exception")
        except ValueError:
            pass

        # Should still have the transient clear message
        delta = self.get_delta_from_queue()
        assert delta.HasField("new_transient")

    def test_context_manager_propagates_exception(self) -> None:
        """Test that exceptions are propagated from context manager."""
        with pytest.raises(ValueError, match="Test exception"):
            with st.skeleton():
                raise ValueError("Test exception")

    def test_context_manager_after_standalone_is_allowed(self) -> None:
        """Test that entering the context manager after standalone use does not
        raise; the context manager simply takes over the placeholder's slot."""
        placeholder = st.skeleton()
        placeholder.markdown("Hello")  # Use in standalone mode first

        # Mixing modes is permissive (no error); the context manager takes over.
        with placeholder:
            pass

        # On exit, the transient skeleton is cleared (context-manager mode ran).
        delta = self.get_delta_from_queue()
        assert delta.HasField("new_transient")
        assert len(delta.new_transient.elements) == 0

    def test_context_manager_reuse_shows_skeleton_again(self) -> None:
        """Test that reusing the same placeholder as a context manager shows the
        delayed skeleton again (the display flag is reset on re-entry)."""
        placeholder = st.skeleton()

        with patch("streamlit.elements.lib.skeleton_placeholder._DELAY_SECS", 0.1):
            # First use of the context manager.
            with placeholder:
                time.sleep(0.3)

            # Second use of the same placeholder must show the skeleton again.
            with placeholder:
                time.sleep(0.3)
                create_delta = self.get_delta_from_queue()
                assert create_delta.HasField("new_transient")
                assert create_delta.new_transient.elements[0].HasField("skeleton")


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
