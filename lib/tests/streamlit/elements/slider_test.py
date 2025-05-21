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

"""slider unit test."""

from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.js_number import JSNumber
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidWidthError,
    StreamlitValueAboveMaxError,
    StreamlitValueBelowMinError,
)
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class SliderTest(DeltaGeneratorTestCase):
    """Test ability to marshall slider protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.slider("the label")

        c = self.get_delta_from_queue().new_element.slider
        assert c.label == "the label"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == [0]
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.slider("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.slider
        assert c.disabled

    PST = timezone(timedelta(hours=-8), "PST")
    AWARE_DT = datetime(2020, 1, 1, tzinfo=PST)
    AWARE_DT_END = datetime(2020, 1, 5, tzinfo=PST)
    AWARE_TIME = time(12, 00, tzinfo=PST)
    AWARE_TIME_END = time(21, 00, tzinfo=PST)
    # datetimes are serialized in proto as micros since epoch
    AWARE_DT_MICROS = 1577836800000000
    AWARE_DT_END_MICROS = 1578182400000000
    AWARE_TIME_MICROS = 946728000000000
    AWARE_TIME_END_MICROS = 946760400000000

    @parameterized.expand(
        [
            (1, [1], 1),  # int
            ((0, 1), [0, 1], (0, 1)),  # int tuple
            ([0, 1], [0, 1], (0, 1)),  # int list
            (0.5, [0.5], 0.5),  # float
            ((0.2, 0.5), [0.2, 0.5], (0.2, 0.5)),  # float tuple
            ([0.2, 0.5], [0.2, 0.5], (0.2, 0.5)),  # float list
            (np.int64(1), [1], 1),  # numpy int
            (np.int32(1), [1], 1),  # numpy int
            (np.single(0.5), [0.5], 0.5),  # numpy float
            (np.double(0.5), [0.5], 0.5),  # numpy float
            (AWARE_DT, [AWARE_DT_MICROS], AWARE_DT),  # datetime
            (
                (AWARE_DT, AWARE_DT_END),  # datetime tuple
                [AWARE_DT_MICROS, AWARE_DT_END_MICROS],
                (AWARE_DT, AWARE_DT_END),
            ),
            (
                [AWARE_DT, AWARE_DT_END],  # datetime list
                [AWARE_DT_MICROS, AWARE_DT_END_MICROS],
                (AWARE_DT, AWARE_DT_END),
            ),
            (AWARE_TIME, [AWARE_TIME_MICROS], AWARE_TIME),  # datetime
            (
                (AWARE_TIME, AWARE_TIME_END),  # datetime tuple
                [AWARE_TIME_MICROS, AWARE_TIME_END_MICROS],
                (AWARE_TIME, AWARE_TIME_END),
            ),
            (
                [AWARE_TIME, AWARE_TIME_END],  # datetime list
                [AWARE_TIME_MICROS, AWARE_TIME_END_MICROS],
                (AWARE_TIME, AWARE_TIME_END),
            ),
        ]
    )
    def test_value_types(self, value, proto_value, return_value):
        """Test that it supports different types of values."""
        ret = st.slider("the label", value=value)

        assert ret == return_value

        c = self.get_delta_from_queue().new_element.slider
        assert c.label == "the label"
        assert c.default == proto_value

    @parameterized.expand(
        [
            "5",  # str
            5j,  # complex
            b"5",  # bytes
        ]
    )
    def test_invalid_types(self, value):
        """Test that it rejects invalid types, specifically things that are *almost* numbers"""
        with pytest.raises(StreamlitAPIException):
            st.slider("the label", value=value)

    @parameterized.expand(
        [
            (1, 2, 1, 1),
            (np.int64(1), 2, 1, 1),
            (1, np.int64(2), 1, 1),
            (1, 2, np.int64(1), 1),
            (np.single(0.5), 1.5, 0.5, 0.5),
        ]
    )
    def test_matching_types(self, min_value, max_value, value, return_value):
        """Test that NumPy types are seen as compatible with numerical Python types"""
        ret = st.slider(
            "the label", min_value=min_value, max_value=max_value, value=value
        )
        assert ret == return_value

    NAIVE_DT = datetime(2020, 2, 1)
    NAIVE_DT_END = datetime(2020, 2, 4)
    NAIVE_TIME = time(6, 20, 34)
    NAIVE_TIME_END = time(20, 6, 43)
    DATE_START = date(2020, 4, 5)
    DATE_END = date(2020, 6, 6)

    @parameterized.expand(
        [
            (NAIVE_DT, NAIVE_DT),  # naive datetime
            ((NAIVE_DT, NAIVE_DT_END), (NAIVE_DT, NAIVE_DT_END)),
            ([NAIVE_DT, NAIVE_DT_END], (NAIVE_DT, NAIVE_DT_END)),
            (NAIVE_TIME, NAIVE_TIME),  # naive time
            ((NAIVE_TIME, NAIVE_TIME_END), (NAIVE_TIME, NAIVE_TIME_END)),
            ([NAIVE_TIME, NAIVE_TIME_END], (NAIVE_TIME, NAIVE_TIME_END)),
            (DATE_START, DATE_START),  # date (always naive)
            ((DATE_START, DATE_END), (DATE_START, DATE_END)),
            ([DATE_START, DATE_END], (DATE_START, DATE_END)),
        ]
    )
    def test_naive_timelikes(self, value, return_value):
        """Ignore proto values (they change based on testing machine's timezone)"""
        ret = st.slider("the label", value=value)
        c = self.get_delta_from_queue().new_element.slider

        assert ret == return_value
        assert c.label == "the label"

    def test_range_session_state(self):
        """Test a range set by session state."""
        state = st.session_state
        state["slider"] = [10, 20]

        slider = st.slider(
            "select a range",
            min_value=0,
            max_value=100,
            key="slider",
        )

        assert slider == [10, 20]

    def test_value_greater_than_min(self):
        ret = st.slider("Slider label", 10, 100, 0)
        c = self.get_delta_from_queue().new_element.slider

        assert ret == 0
        assert c.min == 0

    def test_value_smaller_than_max(self):
        ret = st.slider("Slider label", 10, 100, 101)
        c = self.get_delta_from_queue().new_element.slider

        assert ret == 101
        assert c.max == 101

    def test_max_min(self):
        ret = st.slider("Slider label", 101, 100, 101)
        c = self.get_delta_from_queue().new_element.slider

        assert ret == 101
        assert c.min == 100
        assert c.max == 101

    def test_min_equals_max(self):
        with pytest.raises(StreamlitAPIException):
            st.slider("oh no", min_value=10, max_value=10)
        with pytest.raises(StreamlitAPIException):
            date = datetime(2024, 4, 3)
            st.slider("datetime", min_value=date, max_value=date)

    def test_value_out_of_bounds(self):
        # Max int
        with pytest.raises(StreamlitAPIException) as exc:
            max_value = JSNumber.MAX_SAFE_INTEGER + 1
            st.slider("Label", max_value=max_value)
        assert "`max_value` (%s) must be <= (1 << 53) - 1" % str(max_value) == str(
            exc.value
        )

        # Min int
        with pytest.raises(StreamlitAPIException) as exc:
            min_value = JSNumber.MIN_SAFE_INTEGER - 1
            st.slider("Label", min_value=min_value)
        assert "`min_value` (%s) must be >= -((1 << 53) - 1)" % str(min_value) == str(
            exc.value
        )

        # Max float
        with pytest.raises(StreamlitAPIException) as exc:
            max_value = 2e308
            st.slider("Label", value=0.5, max_value=max_value)
        assert "`max_value` (%s) must be <= 1.797e+308" % str(max_value) == str(
            exc.value
        )

        # Min float
        with pytest.raises(StreamlitAPIException) as exc:
            min_value = -2e308
            st.slider("Label", value=0.5, min_value=min_value)
        assert "`min_value` (%s) must be >= -1.797e+308" % str(min_value) == str(
            exc.value
        )

    def test_step_zero(self):
        with pytest.raises(StreamlitAPIException) as exc:
            st.slider("Label", min_value=0, max_value=10, step=0)
        assert str(exc.value) == "Slider components cannot be passed a `step` of 0."

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.slider("foo")

        proto = self.get_delta_from_queue().new_element.slider
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.slider("foo")

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        slider_proto = self.get_delta_from_queue(1).new_element.slider
        assert slider_proto.form_id == form_proto.form.form_id

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, col2 = st.columns(2)

        with col1:
            st.slider("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        slider_proto = self.get_delta_from_queue().new_element.slider

        assert slider_proto.label == "foo"

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.slider("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.slider
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.slider("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.slider("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_should_raise_exception_when_session_state_value_out_of_range(self):
        """Test out of range using st.session_state to set slider values beyond min/max."""
        # Test for integer values
        with pytest.raises(StreamlitValueAboveMaxError) as e:
            st.session_state.slider = 10
            st.slider("slider", min_value=1, max_value=5, key="slider")
        assert str(e.value) == "The `value` 10 is greater than the `max_value` 5."
        with pytest.raises(StreamlitValueBelowMinError) as e:
            st.session_state.slider_1 = 10
            st.slider("slider_1", min_value=15, max_value=20, key="slider_1")
        assert str(e.value) == "The `value` 10 is less than the `min_value` 15."

        # Test for dates
        with pytest.raises(StreamlitValueAboveMaxError) as e:
            st.session_state.slider_2 = date(2025, 1, 1)
            st.slider(
                "slider_2",
                min_value=date(2024, 1, 1),
                max_value=date(2024, 12, 31),
                key="slider_2",
            )
        assert (
            str(e.value)
            == "The `value` 2025-01-01 is greater than the `max_value` 2024-12-31."
        )

        with pytest.raises(StreamlitValueBelowMinError) as e:
            st.session_state.slider_3 = date(2023, 1, 1)
            st.slider(
                "slider_3",
                min_value=date(2024, 1, 1),
                max_value=date(2024, 12, 31),
                key="slider_3",
            )
        assert (
            str(e.value)
            == "The `value` 2023-01-01 is less than the `min_value` 2024-01-01."
        )


class SliderWidthTest(DeltaGeneratorTestCase):
    def test_slider_with_width_pixels(self):
        """Test that slider can be displayed with a specific width in pixels."""
        st.slider("Label", min_value=0, max_value=10, width=500)
        c = self.get_delta_from_queue().new_element.slider
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 500

    def test_slider_with_width_stretch(self):
        """Test that slider can be displayed with a width of 'stretch'."""
        st.slider("Label", min_value=0, max_value=10, width="stretch")
        c = self.get_delta_from_queue().new_element.slider
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch is True

    def test_slider_with_default_width(self):
        """Test that the default width is used when not specified."""
        st.slider("Label", min_value=0, max_value=10)
        c = self.get_delta_from_queue().new_element.slider
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch is True

    @parameterized.expand(
        [
            ("invalid_string", "invalid"),
            ("negative", -1),
            ("zero", 0),
            ("float", 100.5),
        ]
    )
    def test_width_config_invalid(self, name, invalid_width):
        """Test width config with various invalid values."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.slider("the label", width=invalid_width)


def test_id_stability():
    def script():
        import streamlit as st

        st.slider("slider", key="slider")

    at = AppTest.from_function(script).run()
    s1 = at.slider[0]
    at = s1.set_value(5).run()
    s2 = at.slider[0]

    assert s1.id == s2.id
