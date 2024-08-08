# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from typing import Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.testing.v1.app_test import AppTest
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.data_mocks import (
    SHARED_TEST_CASES,
    CaseMetadata,
)


class SliderTest(DeltaGeneratorTestCase):
    """Test ability to marshall select slider protos."""

    def test_no_value(self):
        """Test that it can be called with no value."""
        st.select_slider("the label", options=["red", "orange", "yellow"])

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, "the label")
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )
        self.assertEqual(c.default, [0])
        self.assertEqual(c.min, 0)
        self.assertEqual(c.max, 2)
        self.assertEqual(c.step, 1)

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.select_slider(
            "the label", options=["red", "orange", "yellow"], disabled=True
        )

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.disabled, True)

    @parameterized.expand(
        SHARED_TEST_CASES,
    )
    def test_option_types(self, name: str, input_data: Any, metadata: CaseMetadata):
        """Test that it supports different types of options."""
        if len(metadata.expected_sequence) == 0:
            # Empty option sequences are not supported
            # in select slider -> skip the test
            with pytest.raises(StreamlitAPIException):
                st.select_slider("the label", input_data)
            return

        st.select_slider("the label", input_data)

        c = self.get_delta_from_queue().new_element.slider
        assert c.label == "the label"
        assert {str(item) for item in c.options} == {
            str(item) for item in metadata.expected_sequence
        }

    @parameterized.expand([("red", [1, 2, 3]), (("red", "green"), ["red", 2, 3])])
    def test_invalid_values(self, value, options):
        """Test that it raises an error on invalid value"""
        with pytest.raises(ValueError):
            st.select_slider("the label", value=value, options=options)

    def test_invalid_options(self):
        """Test that it raises an error on an empty options"""
        with pytest.raises(StreamlitAPIException):
            st.select_slider("the label", options=[])

    def test_none_value(self):
        """Test that it allows None as a valid option"""
        st.select_slider("the label", options=[1, None, 3])
        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [1])

    def test_range(self):
        """Test that a range is specified correctly."""
        st.select_slider(
            "the label", value=("red", "yellow"), options=["red", "orange", "yellow"]
        )

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [0, 2])

    def test_range_out_of_order(self):
        """Test a range that is out of order."""
        st.select_slider(
            "the label", value=("yellow", "red"), options=["red", "orange", "yellow"]
        )

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [0, 2])

    def test_range_session_state(self):
        """Test a range set by session state."""
        state = st.session_state
        state["colors"] = ("red", "orange")

        colors = st.select_slider(
            "select colors",
            options=["red", "orange", "yellow"],
            key="colors",
        )

        assert colors == ("red", "orange")

    def test_format_func(self):
        """Test that format_func sends down correct strings of the options."""
        DAYS_OF_WEEK = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ]
        st.select_slider(
            "the label",
            value=1,
            options=[0, 1, 2, 3, 4, 5, 6],
            format_func=lambda x: DAYS_OF_WEEK[x],
        )

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [1])
        self.assertEqual(c.options, DAYS_OF_WEEK)

    def test_numpy_array_no_value(self):
        """Test that it can be called with options=numpy array, no value"""
        st.select_slider("the label", options=np.array([1, 2, 3, 4]))

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [0])

    def test_numpy_array_with_value(self):
        """Test that it can be called with options=numpy array"""
        st.select_slider("the label", value=3, options=np.array([1, 2, 3, 4]))

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [2])

    def test_numpy_array_with_range(self):
        """Test that it can be called with options=numpy array, value=range"""
        st.select_slider(
            "the label", value=(2, 5), options=np.array([1, 2, 3, 4, 5, 6])
        )

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [1, 4])

    def test_numpy_array_with_invalid_value(self):
        """Test that it raises an error on invalid value"""
        with pytest.raises(ValueError):
            st.select_slider(
                "the label", value=10, options=np.array([1, 2, 3, 4, 5, 6])
            )

    def test_pandas_series_no_value(self):
        """Test that it can be called with options=pandas series, no value"""
        st.select_slider("the label", options=pd.Series([1, 2, 3, 4, 5]))

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [0])

    def test_pandas_series_with_value(self):
        """Test that it can be called with options=pandas series"""
        st.select_slider("the label", value=3, options=pd.Series([1, 2, 3, 4, 5]))

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [2])

    def test_pandas_series_with_range(self):
        """Test that it can be called with options=pandas series, value=range"""
        st.select_slider(
            "the label", value=(2, 5), options=pd.Series([1, 2, 3, 4, 5, 6])
        )

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.default, [1, 4])

    def test_pandas_series_with_invalid_value(self):
        """Test that it raises an error on invalid value"""
        with pytest.raises(ValueError):
            st.select_slider(
                "the label", value=10, options=pd.Series([1, 2, 3, 4, 5, 6])
            )

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.select_slider("foo", ["bar", "baz"])

        proto = self.get_delta_from_queue().new_element.slider
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.select_slider("foo", ["bar", "baz"])

        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        select_slider_proto = self.get_delta_from_queue(1).new_element.slider
        self.assertEqual(select_slider_proto.form_id, form_proto.form.form_id)

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.select_slider(
            "the label",
            options=["red", "orange"],
            label_visibility=label_visibility_value,
        )

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.select_slider(
                "the label", options=["red", "orange"], label_visibility="wrong_value"
            )
        self.assertEqual(
            str(e.exception),
            "Unsupported label_visibility option 'wrong_value'. Valid values are "
            "'visible', 'hidden' or 'collapsed'.",
        )

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.select_slider("the label", ["option 1", "option 2"]))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        self.assertEqual(el.type, "CachedWidgetWarning")
        self.assertTrue(el.is_warning)


def test_select_slider_enum_coercion():
    """Test E2E Enum Coercion on a select_slider."""

    def script():
        from enum import Enum

        import streamlit as st

        class EnumA(Enum):
            A = 1
            B = 2
            C = 3

        selected = st.select_slider("my_enum", EnumA, value=EnumA.A)
        st.text(id(selected.__class__))
        st.text(id(EnumA))
        st.text(selected in EnumA)

    at = AppTest.from_function(script).run()

    def test_enum():
        select_slider = at.select_slider[0]
        original_class = select_slider.value.__class__
        select_slider.set_value(original_class.C).run()
        assert at.text[0].value == at.text[1].value, "Enum Class ID not the same"
        assert at.text[2].value == "True", "Not all enums found in class"

    with patch_config_options({"runner.enumCoercion": "nameOnly"}):
        test_enum()
    with patch_config_options({"runner.enumCoercion": "off"}):
        with pytest.raises(AssertionError):
            test_enum()  # expect a failure with the config value off.


def test_select_slider_enum_coercion_multivalue():
    """Test E2E Enum Coercion on a selectbox."""

    def script():
        from enum import Enum

        import streamlit as st

        class EnumA(Enum):
            A = 1
            B = 2
            C = 3

        selected_list = st.select_slider("my_enum", EnumA, value=[EnumA.A, EnumA.C])
        st.text(id(selected_list[0].__class__))
        st.text(id(EnumA))
        st.text(all(selected in EnumA for selected in selected_list))

    at = AppTest.from_function(script).run()

    def test_enum():
        select_slider = at.select_slider[0]
        original_class = select_slider.value[0].__class__
        select_slider.set_value([original_class.A, original_class.B]).run()
        assert at.text[0].value == at.text[1].value, "Enum Class ID not the same"
        assert at.text[2].value == "True", "Not all enums found in class"

    with patch_config_options({"runner.enumCoercion": "nameOnly"}):
        test_enum()
    with patch_config_options({"runner.enumCoercion": "off"}):
        with pytest.raises(AssertionError):
            test_enum()  # expect a failure with the config value off.
