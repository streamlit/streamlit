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

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class SpinnerTest(DeltaGeneratorTestCase):
    def test_spinner(self):
        """Test st.spinner."""
        with st.spinner("some text"):
            # Without the timeout, the spinner is sometimes not available
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "some text"
            assert not el.spinner.cache
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_transient")
        assert len(last_delta.new_transient.elements) == 0
        assert not el.spinner.show_time

    def test_spinner_for_caching(self):
        """Test st.spinner in cache functions."""
        with st.spinner("some text", _cache=True):
            # Without the timeout, the spinner is sometimes not available
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "some text"
            assert el.spinner.cache
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_transient")
        assert len(last_delta.new_transient.elements) == 0

    def test_spinner_time(self):
        """Test st.spinner with show_time."""
        with st.spinner("some text", show_time=True):
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "some text"
            assert el.spinner.show_time
        # Check if it gets reset to st.empty()
        last_delta = self.get_delta_from_queue()
        assert last_delta.HasField("new_transient")
        assert len(last_delta.new_transient.elements) == 0

    def test_spinner_with_width(self):
        """Test st.spinner with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for index, (
            width_value,
            expected_width_spec,
            field_name,
            field_value,
        ) in enumerate(test_cases):
            with self.subTest(width_value=width_value):
                with st.spinner(f"test text {index}", width=width_value):
                    time.sleep(0.7)
                    el = self.get_delta_from_queue().new_transient.elements[0]
                    assert el.spinner.text == f"test text {index}"

                    assert (
                        el.width_config.WhichOneof("width_spec") == expected_width_spec
                    )
                    assert getattr(el.width_config, field_name) == field_value

    def test_spinner_with_invalid_width(self):
        """Test st.spinner with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    with st.spinner("test text", width=width_value):
                        time.sleep(0.1)
                assert expected_error_message in str(exc.value)

    def test_spinner_default_width(self):
        """Test that st.spinner defaults to content width."""
        with st.spinner("test text"):
            time.sleep(0.7)
            el = self.get_delta_from_queue().new_transient.elements[0]
            assert el.spinner.text == "test text"
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_CONTENT.value
            )
            assert el.width_config.use_content is True

    def test_spinner_standalone_displays_immediately(self):
        """Test that st.spinner displays the spinner immediately when used as a
        standalone placeholder (not as a context manager), without any delay.
        """
        st.spinner("loading")
        delta = self.get_delta_from_queue()
        # The standalone spinner is shown immediately as a transient element.
        assert delta.HasField("new_transient")
        assert delta.new_transient.elements[0].spinner.text == "loading"
        assert not delta.new_transient.elements[0].spinner.cache

    def test_spinner_standalone_can_be_replaced(self):
        """Test that calling a display method on the returned placeholder clears
        the spinner and replaces it with that content (like st.empty).
        """
        placeholder = st.spinner("loading")
        placeholder.success("done")

        deltas = self.get_all_deltas_from_queue()
        # The spinner content is replaced by the success alert.
        assert deltas[-1].new_element.alert.body == "done"
        # The last transient delta clears the spinner.
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        assert len(transient_deltas[-1].new_transient.elements) == 0

    def test_spinner_standalone_empty_clears(self):
        """Test that calling .empty() on the placeholder clears the spinner."""
        placeholder = st.spinner("loading")
        placeholder.empty()

        deltas = self.get_all_deltas_from_queue()
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        assert len(transient_deltas[-1].new_transient.elements) == 0
        # An empty element occupies the placeholder's position.
        assert deltas[-1].new_element.HasField("empty")

    def test_spinner_context_manager_reuses_slot(self):
        """Test that content written inside a `with st.spinner()` block reuses
        the spinner's slot, so the spinner does not reserve a persistent layout
        slot (matching the classic context-manager behavior).
        """
        st.write("before")
        with st.spinner("loading"):
            time.sleep(0.7)
            st.write("inside")
        st.write("after")

        markdown_messages = [
            msg
            for msg in self.forward_msg_queue._queue
            if msg.HasField("delta")
            and msg.delta.HasField("new_element")
            and msg.delta.new_element.HasField("markdown")
        ]
        paths = {
            msg.delta.new_element.markdown.body: tuple(msg.metadata.delta_path)
            for msg in markdown_messages
        }
        # "inside" reuses the spinner's slot (index 1), "after" is at index 2.
        assert paths["before"] == (0, 0)
        assert paths["inside"] == (0, 1)
        assert paths["after"] == (0, 2)

    def test_nested_spinners_stack_transient_elements(self):
        """Test that nested `with st.spinner()` blocks both stay visible by
        sharing the same transient-element list.
        """
        with st.spinner("outer"):
            with st.spinner("inner"):
                time.sleep(0.7)
                # While both blocks are active, the latest transient delta should
                # contain both spinners.
                transient = self.get_delta_from_queue().new_transient
                spinner_texts = [el.spinner.text for el in transient.elements]
                assert spinner_texts == ["outer", "inner"]

    def test_spinner_returns_placeholder(self):
        """Test that st.spinner returns a SpinnerPlaceholder instance."""
        from streamlit.elements.spinner import SpinnerPlaceholder

        placeholder = st.spinner("loading")
        assert isinstance(placeholder, SpinnerPlaceholder)

    def test_spinner_context_manager_fast_block_shows_nothing(self):
        """Test that a `with st.spinner()` block finishing within the delay does
        not leave a spinner displayed (anti-flicker behavior is preserved).
        """
        with st.spinner("loading"):
            # Finishes immediately, well within DELAY_SECS, so the delayed timer
            # never fires.
            pass

        deltas = self.get_all_deltas_from_queue()
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        # The eagerly-shown spinner is cleared in __enter__ and never re-shown.
        assert len(transient_deltas[-1].new_transient.elements) == 0

    def test_spinner_placeholder_rejects_unknown_attribute(self):
        """Test that accessing an unknown attribute on the placeholder raises
        AttributeError without clearing the displayed spinner.
        """
        placeholder = st.spinner("loading")
        with pytest.raises(AttributeError):
            _ = placeholder.not_a_real_method

        deltas = self.get_all_deltas_from_queue()
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        # The spinner is still displayed (the incidental access did not clear it).
        assert len(transient_deltas[-1].new_transient.elements) == 1

    def test_spinner_placeholder_access_without_call_does_not_clear(self):
        """Test that merely accessing (or probing via hasattr) a display method
        does not clear the spinner; only calling the method replaces it.
        """
        placeholder = st.spinner("loading")

        # Incidental probes that resolve real method names must not destroy the
        # standalone spinner.
        assert hasattr(placeholder, "success")
        _ = placeholder.write
        assert getattr(placeholder, "markdown", None) is not None

        deltas = self.get_all_deltas_from_queue()
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        # The spinner is still displayed; no replacement happened on access.
        assert len(transient_deltas[-1].new_transient.elements) == 1

        # Calling the method does replace the spinner.
        placeholder.success("done")
        deltas = self.get_all_deltas_from_queue()
        assert deltas[-1].new_element.alert.body == "done"
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        assert len(transient_deltas[-1].new_transient.elements) == 0

    def test_spinner_placeholder_rejects_non_callable_attribute(self):
        """Test that accessing a non-callable DeltaGenerator attribute (e.g. the
        ``dg`` property) raises AttributeError without clearing the spinner.
        """
        placeholder = st.spinner("loading")
        with pytest.raises(AttributeError):
            _ = placeholder.dg

        deltas = self.get_all_deltas_from_queue()
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        assert len(transient_deltas[-1].new_transient.elements) == 1

    def test_spinner_context_manager_after_replacement_does_not_reshow(self):
        """Test that re-entering a replaced placeholder as a context manager does
        not re-show the spinner over the replacement content.
        """
        placeholder = st.spinner("loading")
        placeholder.success("done")

        with placeholder:
            time.sleep(0.7)

        deltas = self.get_all_deltas_from_queue()
        transient_deltas = [d for d in deltas if d.HasField("new_transient")]
        # The spinner is not re-displayed after it was replaced.
        assert len(transient_deltas[-1].new_transient.elements) == 0
        # The replacement content is still the last rendered element.
        assert deltas[-1].new_element.alert.body == "done"

    def test_spinner_without_session_context_is_noop(self):
        """Test that st.spinner is a no-op when there is no script run context."""
        from unittest.mock import patch

        from streamlit.delta_generator import DeltaGenerator
        from streamlit.errors import NoSessionContext

        with patch.object(
            DeltaGenerator, "_transient", side_effect=NoSessionContext("no ctx")
        ):
            placeholder = st.spinner("loading")
            # Nothing is enqueued when there is no session context.
            assert not self.get_all_deltas_from_queue()
            # The placeholder still works as a no-op context manager.
            with placeholder:
                pass
            assert not self.get_all_deltas_from_queue()
