# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""slider unit test."""

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests import testutil


class SliderTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall slider protos."""

    def test_no_value(self):
        """Test that it can be called with no value."""
        st.select_slider("the label", options=["red", "orange", "yellow"])

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, [0])
        self.assertEqual(c.min, 0)
        self.assertEqual(c.max, 2)
        self.assertEqual(c.step, 1)

    @parameterized.expand([("red", [1, 2, 3]), (("red", "green"), ["red", 2, 3])])
    def test_invalid_values(self, value, options):
        """Test that it raises an error on invalid value"""
        with pytest.raises(ValueError) as exc_message:
            st.select_slider("the label", value=value, options=options)

    def test_invalid_options(self):
        """Test that it raises an error on an empty options"""
        with pytest.raises(StreamlitAPIException) as exc_message:
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
