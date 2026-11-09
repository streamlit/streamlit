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
from streamlit.runtime.scriptrunner_utils.exceptions import StopException
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
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

    def _loading_block_messages(self) -> list:
        return [
            msg
            for msg in self.forward_msg_queue._queue
            if msg.HasField("delta") and msg.delta.HasField("add_block")
        ]

    def test_context_manager_writes_into_loading_block(self) -> None:
        """Elements written inside the block, including via the placeholder, fill the slot."""
        with st.skeleton(height=120) as placeholder:
            st.markdown("Loaded")
            placeholder.markdown("Also loaded")

        block_msgs = self._loading_block_messages()
        # Content was drawn, so the frontend clears the skeleton itself and the
        # block isn't re-sent.
        assert len(block_msgs) == 1
        block = block_msgs[0].delta.add_block
        assert block.loading.skeleton_height.pixel_height == 120
        # A pixel skeleton height sizes the skeleton, not the block.
        assert block.height_config.use_content
        assert block.allow_empty

        block_path = list(block_msgs[0].metadata.delta_path)
        first_path = self.get_message_from_queue(-2).metadata.delta_path
        second_path = self.get_message_from_queue().metadata.delta_path
        assert list(first_path) == [*block_path, 0]
        assert list(second_path) == [*block_path, 1]

    def test_context_manager_pixel_width_limits_the_slot(self) -> None:
        """An integer width sizes the loading block, including the re-sent one."""
        with st.skeleton(width=300):
            pass

        first, last = self._loading_block_messages()
        assert first.delta.add_block.width_config.pixel_width == 300
        assert last.delta.add_block.width_config.pixel_width == 300

    def test_context_manager_replaces_skeleton_slot(self) -> None:
        """The loading block takes the skeleton's own position."""
        st.markdown("Before")
        with st.skeleton():
            st.markdown("Loaded")
        st.markdown("After")

        # The loading block replaces the skeleton at [0, 1] (the queue merges them).
        block_msg = self._loading_block_messages()[0]
        assert list(block_msg.metadata.delta_path) == [0, 1]
        after_msg = self.get_message_from_queue()
        assert list(after_msg.metadata.delta_path) == [0, 2]

    def test_context_manager_clears_skeleton_when_nothing_is_written(self) -> None:
        """A block that draws nothing re-sends the block without the skeleton."""
        with st.skeleton(height="stretch"):
            pass

        first, last = self._loading_block_messages()
        assert first.delta.add_block.loading.skeleton_height.use_stretch
        assert not last.delta.add_block.HasField("loading")
        # The cleared block is hidden while empty, so it doesn't add a gap.
        assert not last.delta.add_block.allow_empty
        assert list(last.metadata.delta_path) == list(first.metadata.delta_path)
        # A stretch skeleton's block stretches too, including after it's cleared.
        assert first.delta.add_block.height_config.use_stretch
        assert last.delta.add_block.height_config.use_stretch

    def test_context_manager_clears_on_exception(self) -> None:
        """Test that skeleton clears even when exception is raised."""
        try:
            with st.skeleton():
                st.markdown("Partial")
                raise ValueError("Test exception")
        except ValueError:
            pass

        last = self._loading_block_messages()[-1]
        assert not last.delta.add_block.HasField("loading")

    def test_context_manager_propagates_exception(self) -> None:
        """Test that exceptions are propagated from context manager."""
        with pytest.raises(ValueError, match="Test exception"):
            with st.skeleton():
                raise ValueError("Test exception")

    def test_context_manager_propagates_stop_exception(self) -> None:
        """Test that st.stop() control flow is not suppressed."""
        with pytest.raises(StopException):
            with st.skeleton():
                raise StopException()

    def test_context_manager_marks_skeleton_slot(self) -> None:
        """Code inside the block runs in a skeleton slot, and only there."""
        assert not ThreadState.get().in_skeleton_slot
        with st.skeleton():
            assert ThreadState.get().in_skeleton_slot
            with st.skeleton():
                assert ThreadState.get().in_skeleton_slot
            assert ThreadState.get().in_skeleton_slot
        assert not ThreadState.get().in_skeleton_slot

        with pytest.raises(ValueError, match="Boom"):
            with st.skeleton():
                raise ValueError("Boom")
        assert not ThreadState.get().in_skeleton_slot

    def test_context_manager_after_standalone_is_allowed(self) -> None:
        """Test that entering the context manager after standalone use does not
        raise; the context manager simply takes over the placeholder's slot."""
        placeholder = st.skeleton()
        placeholder.markdown("Hello")  # Use in standalone mode first

        # Mixing modes is permissive (no error); the context manager takes over.
        with placeholder:
            pass

        last = self._loading_block_messages()[-1]
        assert not last.delta.add_block.HasField("loading")

    def test_spinner_is_marked_as_label_only_inside_skeleton(self) -> None:
        """A spinner in a skeleton slot labels the skeleton; others render alone."""
        with patch("streamlit.elements.spinner.DELAY_SECS", 0.01):
            with st.skeleton():
                with st.spinner("Fetching data..."):
                    time.sleep(0.2)
                    transient = self.get_delta_from_queue().new_transient
                    spinner = transient.elements[0].spinner
                    assert spinner.text == "Fetching data..."
                    assert spinner.in_skeleton_slot

            with st.spinner("Fetching data..."):
                time.sleep(0.2)
                transient = self.get_delta_from_queue().new_transient
                assert not transient.elements[0].spinner.in_skeleton_slot


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
