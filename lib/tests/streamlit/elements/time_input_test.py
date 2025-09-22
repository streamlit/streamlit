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

"""time_input unit test."""

from datetime import datetime, time, timedelta
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class TimeInputTest(DeltaGeneratorTestCase):
    """Test ability to marshall time_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.time_input("the label")

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label == "the label"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert datetime.strptime(c.default, "%H:%M").time() <= datetime.now().time()
        assert c.HasField("default")
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.time_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.disabled

    def test_none_value(self):
        """Test that it can be called with None as initial value."""
        st.time_input("the label", value=None)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label == "the label"
        # If a proto property is null is not determined by this value,
        # but by the check via the HasField method:
        assert c.default == ""
        assert not c.HasField("default")

    @parameterized.expand(
        [
            (time(8, 45), "08:45"),
            (datetime(2019, 7, 6, 21, 15), "21:15"),
            ("21:15:00", "21:15"),
            ("21:15:10.123", "21:15"),
            ("2019-07-06 21:15:10.123", "21:15"),
        ]
    )
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.time_input("the label", arg_value)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label == "the label"
        assert c.default == proto_value

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, _ = st.columns([3, 2])

        with col1:
            st.time_input("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        time_input_proto = self.get_delta_from_queue().new_element.time_input

        assert time_input_proto.label == "foo"

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.time_input("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.time_input
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.time_input("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_st_time_input(self):
        """Test st.time_input."""
        value = time(8, 45)
        st.time_input("Set an alarm for", value)

        el = self.get_delta_from_queue().new_element
        assert el.time_input.default == "08:45"
        assert el.time_input.step == timedelta(minutes=15).seconds

    def test_st_time_input_with_step(self):
        """Test st.time_input with step."""
        value = time(9, 00)
        st.time_input("Set an alarm for", value, step=timedelta(minutes=5))

        el = self.get_delta_from_queue().new_element
        assert el.time_input.default == "09:00"
        assert el.time_input.step == timedelta(minutes=5).seconds

    def test_st_time_input_exceptions(self):
        """Test st.time_input exceptions."""
        value = time(9, 00)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=True)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=(90, 0))
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=1)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=59)
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=timedelta(hours=24))
        with pytest.raises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=timedelta(days=1))

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.time_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.time_input("the label")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.time_input("the label", width=200)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 200

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.time_input("the label", width="stretch")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_invalid_width(self, width):
        """Test that invalid width values raise exceptions."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.time_input("the label", width=width)

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params (keep whitelisted kwargs stable)
            st.time_input(
                label="Label 1",
                key="time_input_key",
                value=time(8, 45),
                help="Help 1",
                disabled=False,
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                # Whitelisted kwargs:
                step=timedelta(minutes=15),
            )
            c1 = self.get_delta_from_queue().new_element.time_input
            id1 = c1.id

            # Second render with different non-whitelisted params but same key
            st.time_input(
                label="Label 2",
                key="time_input_key",
                value=time(9, 0),
                help="Help 2",
                disabled=True,
                width=200,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                # Keep whitelisted the same to ensure ID stability
                step=timedelta(minutes=15),
            )
            c2 = self.get_delta_from_queue().new_element.time_input
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("step", timedelta(minutes=15), timedelta(minutes=5)),
        ]
    )
    def test_whitelisted_stable_key_kwargs(self, kwarg_name, value1, value2):
        """Test that the widget ID changes when a whitelisted kwarg changes even when the key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs = {
                "label": "Label",
                "key": "time_input_key",
                # keep other params stable
                "value": time(8, 45),
                "step": value1,
            }

            st.time_input(**base_kwargs)
            c1 = self.get_delta_from_queue().new_element.time_input
            id1 = c1.id

            base_kwargs[kwarg_name] = value2
            st.time_input(**base_kwargs)
            c2 = self.get_delta_from_queue().new_element.time_input
            id2 = c2.id
            assert id1 != id2


def test_time_input_interaction():
    """Test interactions with an empty time_input widget."""

    def script():
        import streamlit as st

        st.time_input("the label", value=None)

    at = AppTest.from_function(script).run()
    time_input = at.time_input[0]
    assert time_input.value is None

    # Input a time:
    at = time_input.set_value(time(8, 45)).run()
    time_input = at.time_input[0]
    assert time_input.value == time(8, 45)

    # # Clear the value
    at = time_input.set_value(None).run()
    time_input = at.time_input[0]
    assert time_input.value is None


def test_None_session_state_value_retained():
    def script():
        import streamlit as st

        if "time_input" not in st.session_state:
            st.session_state["time_input"] = None

        st.time_input("time_input", key="time_input")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.time_input[0].value is None
