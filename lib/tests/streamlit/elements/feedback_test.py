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
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class TestFeedbackSerde:
    """Tests for the FeedbackSerde serializer/deserializer."""

    def test_serialize_value(self):
        serde = FeedbackSerde()
        assert serde.serialize(3) == 3

    def test_serialize_none(self):
        serde = FeedbackSerde()
        assert serde.serialize(None) is None

    def test_deserialize_value(self):
        serde = FeedbackSerde()
        assert serde.deserialize(3) == 3

    def test_deserialize_none_returns_default(self):
        serde = FeedbackSerde(default_value=2)
        assert serde.deserialize(None) == 2

    def test_deserialize_none_without_default(self):
        serde = FeedbackSerde()
        assert serde.deserialize(None) is None


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
        """Test that pixel width is set correctly when above threshold."""
        st.feedback("thumbs", width=100)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 100

    def test_small_width_converted_to_content_thumbs(self):
        """Test that small pixel widths are converted to content for thumbs."""
        # With default 16px base font: thumbs threshold ~55px (3.125rem x 16 x 1.1)
        st.feedback("thumbs", width=30)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_small_width_converted_to_content_faces(self):
        """Test that small pixel widths are converted to content for faces."""
        # With default 16px base font: faces threshold ~141px (8rem x 16 x 1.1)
        st.feedback("faces", width=100)

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_adequate_width_preserved_thumbs(self):
        """Test that adequate pixel widths are preserved for thumbs."""
        st.feedback("thumbs", width=100, key="thumbs_adequate")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 100

    def test_adequate_width_preserved_stars(self):
        """Test that adequate pixel widths are preserved for stars."""
        st.feedback("stars", width=200, key="stars_adequate")

        el = self.get_delta_from_queue().new_element
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.width_config.pixel_width == 200

    def test_threshold_adapts_to_base_font_size(self):
        """Test that the conversion threshold adapts to theme.baseFontSize."""
        # Test with 20px base font size (larger than default 16px)
        # Threshold calculation: 3.125rem x 20 x 1.1 = 68.75px (thumbs)
        with patch_config_options({"theme.baseFontSize": 20}):
            st.feedback("thumbs", width=65, key="thumbs_20px_font")
            el = self.get_delta_from_queue().new_element
            # At 20px base font, 65px is below threshold, converts to content
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_CONTENT.value
            )
            assert el.width_config.use_content is True

        # At 16px base font, same 65px width is above threshold, preserved
        with patch_config_options({"theme.baseFontSize": 16}):
            st.feedback("thumbs", width=65, key="thumbs_16px_font")
            el = self.get_delta_from_queue().new_element
            assert (
                el.width_config.WhichOneof("width_spec")
                == WidthConfigFields.PIXEL_WIDTH.value
            )
            assert el.width_config.pixel_width == 65


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
