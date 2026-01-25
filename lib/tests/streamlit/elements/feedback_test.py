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

"""st.feedback unit tests."""

from __future__ import annotations

from typing import Literal
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.feedback import FeedbackSerde
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Feedback_pb2 import Feedback as FeedbackProto
from streamlit.runtime.state.session_state import get_script_run_ctx
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class TestFeedbackSerde:
    """Tests for the FeedbackSerde serializer/deserializer.

    The serde uses string as wire format to distinguish three states:
    - None (field not set): No UI interaction -> use default
    - "" (empty string): User cleared -> return None
    - "2" (string): User selected -> return int
    """

    def test_serialize_value_to_string(self):
        """Test that int value is serialized to string."""
        serde = FeedbackSerde()
        assert serde.serialize(3) == "3"

    def test_serialize_none_to_empty_string(self):
        """Test that None is serialized to empty string (cleared state)."""
        serde = FeedbackSerde()
        assert serde.serialize(None) == ""

    def test_deserialize_string_value_to_int(self):
        """Test that string value is deserialized to int."""
        serde = FeedbackSerde()
        assert serde.deserialize("3") == 3

    def test_deserialize_none_returns_default(self):
        """Test that None (no UI interaction) returns default value."""
        serde = FeedbackSerde(default_value=2)
        assert serde.deserialize(None) == 2

    def test_deserialize_none_without_default(self):
        """Test that None returns None when no default is set."""
        serde = FeedbackSerde()
        assert serde.deserialize(None) is None

    def test_deserialize_empty_string_returns_none(self):
        """Test that empty string (cleared state) returns None, even with default."""
        serde = FeedbackSerde(default_value=2)
        # This is the key behavior: empty string means "user cleared"
        # and should return None, not the default
        assert serde.deserialize("") is None

    def test_clearing_with_default_set(self):
        """Regression test: clearing should work even when default is set.

        When a user has default=2 and clicks to deselect, the widget should
        return None, not revert to the default.
        """
        serde = FeedbackSerde(default_value=2)

        # Initial state: no interaction -> returns default
        assert serde.deserialize(None) == 2

        # User selects option 1
        assert serde.deserialize("1") == 1

        # User clears (clicks selected option again) -> returns None, NOT default
        assert serde.deserialize("") is None
        assert serde.deserialize("") != 2  # Explicitly verify it's not the default


class TestFeedbackCommand(DeltaGeneratorTestCase):
    """Tests for the st.feedback command."""

    @parameterized.expand(
        [
            ("thumbs", FeedbackProto.FeedbackType.THUMBS),
            ("faces", FeedbackProto.FeedbackType.FACES),
            ("stars", FeedbackProto.FeedbackType.STARS),
        ]
    )
    def test_feedback_type_options(
        self,
        option: Literal["thumbs", "faces", "stars"],
        expected_type: FeedbackProto.FeedbackType.ValueType,
    ):
        """Test that each feedback type option is correctly converted to proto."""
        st.feedback(option)

        delta = self.get_delta_from_queue().new_element.feedback
        assert delta.type == expected_type

    def test_invalid_option_literal(self):
        """Test that invalid option raises StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as e:
            st.feedback("foo")
        assert str(e.value) == (
            "The options argument to st.feedback must be one of "
            "['thumbs', 'faces', 'stars']. The argument passed was 'foo'."
        )

    @parameterized.expand([(0,), (1,)])
    def test_widget_state_changed_via_session_state(self, session_state_index: int):
        """Test that widget state can be set via session_state."""
        st.session_state.feedback_key = session_state_index
        val = st.feedback("thumbs", key="feedback_key")
        assert val == session_state_index

    def test_default_value_thumbs(self):
        """Test that default value is set correctly for thumbs."""
        val = st.feedback("thumbs", default=1)
        assert val == 1

        delta = self.get_delta_from_queue().new_element.feedback
        assert delta.default == 1

    def test_default_value_faces(self):
        """Test that default value is set correctly for faces."""
        val = st.feedback("faces", default=3)
        assert val == 3

        delta = self.get_delta_from_queue().new_element.feedback
        assert delta.default == 3

    def test_default_value_stars(self):
        """Test that default value is set correctly for stars."""
        val = st.feedback("stars", default=2)
        assert val == 2

        delta = self.get_delta_from_queue().new_element.feedback
        assert delta.default == 2

    def test_no_default_returns_none(self):
        """Test that widget returns None when no default is set."""
        val = st.feedback("thumbs")
        assert val is None

    def test_invalid_default_for_thumbs(self):
        """Test that invalid default for thumbs raises exception."""
        with pytest.raises(StreamlitAPIException) as e:
            st.feedback("thumbs", default=2)
        assert "must be a number between 0 and 1" in str(e.value)

    def test_invalid_default_for_faces(self):
        """Test that invalid default for faces raises exception."""
        with pytest.raises(StreamlitAPIException) as e:
            st.feedback("faces", default=5)
        assert "must be a number between 0 and 4" in str(e.value)

    def test_invalid_default_for_stars(self):
        """Test that invalid default for stars raises exception."""
        with pytest.raises(StreamlitAPIException) as e:
            st.feedback("stars", default=-1)
        assert "must be a number between 0 and 4" in str(e.value)

    def test_disabled_state(self):
        """Test that disabled state is set correctly."""
        st.feedback("thumbs", disabled=True)

        delta = self.get_delta_from_queue().new_element.feedback
        assert delta.disabled is True

    def test_enabled_state(self):
        """Test that enabled state is the default."""
        st.feedback("thumbs")

        delta = self.get_delta_from_queue().new_element.feedback
        assert delta.disabled is False

    @parameterized.expand([("string_key",), (0,), (None,)])
    def test_key_types(self, key: str | int | None):
        """Test that different key types are handled correctly."""
        st.feedback("thumbs", key=key)

        delta = self.get_delta_from_queue().new_element.feedback
        assert delta.id.endswith(f"-{key}")

    def test_on_change_callback_registered(self):
        """Test that on_change callback is registered."""
        st.feedback("thumbs", on_change=lambda: None)

        ctx = get_script_run_ctx()
        assert ctx is not None
        session_state = ctx.session_state._state
        widget_id = session_state.get_widget_states()[0].id
        metadata = session_state._new_widget_state.widget_metadata.get(widget_id)
        assert metadata is not None
        assert metadata.callback is not None

    def test_outside_form(self):
        """Test that form_id is empty outside of a form."""
        st.feedback("thumbs")

        proto = self.get_delta_from_queue().new_element.feedback
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form_id is set correctly inside of a form."""
        with st.form("form"):
            st.feedback("thumbs")

        # 2 elements: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        proto = self.get_delta_from_queue(1).new_element.feedback
        assert proto.form_id == form_proto.form.form_id

    def test_inside_column(self):
        """Test that st.feedback works correctly inside of a column."""
        col1, _ = st.columns(2)

        with col1:
            st.feedback("thumbs")

        # 4 elements: 1 horizontal block, 2 columns, 1 widget
        all_deltas = self.get_all_deltas_from_queue()
        assert len(all_deltas) == 4

        proto = self.get_delta_from_queue().new_element.feedback
        assert proto.type == FeedbackProto.FeedbackType.THUMBS


class TestFeedbackWidthConfig(DeltaGeneratorTestCase):
    """Tests for st.feedback width configuration."""

    def test_default_width_is_content(self):
        """Test that default width is content."""
        st.feedback("thumbs")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_stretch_width(self):
        """Test that stretch width is set correctly."""
        st.feedback("thumbs", width="stretch")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.width_config.use_stretch is True

    def test_pixel_width(self):
        """Test that pixel width is set correctly."""
        st.feedback("thumbs", width=100)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 100


class TestFeedbackStableId(DeltaGeneratorTestCase):
    """Tests for st.feedback widget ID stability."""

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render
            st.feedback(
                key="feedback_key",
                disabled=False,
                width="content",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                default=0,
                options="thumbs",
            )
            proto1 = self.get_delta_from_queue().new_element.feedback
            id1 = proto1.id

            # Second render with different non-whitelisted params
            st.feedback(
                key="feedback_key",
                disabled=True,
                width="stretch",
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                default=1,
                options="thumbs",
            )
            proto2 = self.get_delta_from_queue().new_element.feedback
            id2 = proto2.id
            assert id1 == id2

    def test_id_changes_with_different_options(self):
        """Test that the widget ID changes when options change."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.feedback("thumbs", key="feedback_key_1")
            proto1 = self.get_delta_from_queue().new_element.feedback
            id1 = proto1.id

            st.feedback("faces", key="feedback_key_1")
            proto2 = self.get_delta_from_queue().new_element.feedback
            id2 = proto2.id
            assert id1 != id2

    def test_different_feedback_types_have_different_ids(self):
        """Test that different feedback types produce different IDs without key."""
        st.feedback("thumbs", key="thumbs_id")
        proto_thumbs = self.get_delta_from_queue().new_element.feedback

        st.feedback("faces", key="faces_id")
        proto_faces = self.get_delta_from_queue().new_element.feedback

        st.feedback("stars", key="stars_id")
        proto_stars = self.get_delta_from_queue().new_element.feedback

        assert proto_thumbs.id != proto_faces.id
        assert proto_faces.id != proto_stars.id
        assert proto_thumbs.id != proto_stars.id


class TestFeedbackDuplicateId(DeltaGeneratorTestCase):
    """Tests for st.feedback duplicate ID error messages."""

    def test_duplicate_element_id_error_message(self):
        """Test that duplicate widget ID produces helpful error message."""
        with pytest.raises(StreamlitAPIException) as exception:
            st.feedback("thumbs")
            st.feedback("thumbs")

        # Make sure the correct name is used in the error message
        assert "feedback" in str(exception.value)


# AppTest-based integration tests
def test_apptest_feedback_clearing_with_default():
    """Test that feedback can be cleared even when a default is set.

    Regression test: Previously, clearing a feedback widget with a default
    would revert to the default value instead of returning None.
    """
    from streamlit.testing.v1 import AppTest

    def script():
        import streamlit as st

        result = st.feedback("thumbs", default=1, key="test_feedback")
        st.write(f"Result: {result}")

    at = AppTest.from_function(script).run()
    feedback = at.feedback[0]

    # Initial state: default is selected
    assert feedback.value == 1

    # Select a different option
    at = feedback.set_value(0).run()
    feedback = at.feedback[0]
    assert feedback.value == 0

    # Clear the selection (set to None)
    at = feedback.set_value(None).run()
    feedback = at.feedback[0]
    # Key assertion: value should be None, NOT revert to default (1)
    assert feedback.value is None


def test_apptest_feedback_no_default_clearing():
    """Test that feedback without default can be set and cleared."""
    from streamlit.testing.v1 import AppTest

    def script():
        import streamlit as st

        result = st.feedback("stars", key="test_feedback")
        st.write(f"Result: {result}")

    at = AppTest.from_function(script).run()
    feedback = at.feedback[0]

    # Initial state: no selection
    assert feedback.value is None

    # Select option 3
    at = feedback.set_value(3).run()
    feedback = at.feedback[0]
    assert feedback.value == 3

    # Clear the selection
    at = feedback.set_value(None).run()
    feedback = at.feedback[0]
    assert feedback.value is None


def test_apptest_feedback_value_retained_on_rerun():
    """Test that feedback value is retained across reruns."""
    from streamlit.testing.v1 import AppTest

    def script():
        import streamlit as st

        st.feedback("faces", key="test_feedback")
        st.button("Rerun")

    at = AppTest.from_function(script).run()

    # Set a value
    at = at.feedback[0].set_value(2).run()
    assert at.feedback[0].value == 2

    # Trigger a rerun via button click
    at = at.button[0].click().run()

    # Value should be retained
    assert at.feedback[0].value == 2
