# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

from tests import testutil
import streamlit as st
from parameterized import parameterized
import pytest


class SliderTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall slider protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.slider("the label")

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, [0.0])

    @parameterized.expand(
        [
            (0, [0.0], 0),
            (0.0, [0.0], 0.0),
            ((0, 1), [0.0, 1.0], (0, 1)),
            ([0, 1], [0.0, 1.0], (0, 1)),
            ((0.0, 1.0), [0.0, 1.0], (0.0, 1.0)),
            ([0.0, 1.0], [0.0, 1.0], (0.0, 1.0)),
        ]
    )
    def test_value_types(self, arg_value, proto_value, return_value):
        """Test that it supports different types of values."""
        ret = st.slider("the label", value=arg_value)

        self.assertEqual(ret, return_value)

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, proto_value)

    def test_value_greater_than_min(self):
        with pytest.raises(ValueError) as exc_slider:
            st.slider("Slider label", 10, 100, 0)
        assert (
            "The default `value` of 0 must lie between the `min_value` of "
            "10 and the `max_value` of 100, inclusively." == str(exc_slider.value)
        )

    def test_value_smaller_than_max(self):
        with pytest.raises(ValueError) as exc_slider:
            st.slider("Slider label", 10, 100, 101)
        assert (
            "The default `value` of 101 "
            "must lie between the `min_value` of 10 "
            "and the `max_value` of 100, inclusively." == str(exc_slider.value)
        )

    def test_max_min(self):
        with pytest.raises(ValueError) as exc_slider:
            st.slider("Slider label", 101, 100, 101)
        assert (
            "The default `value` of 101 "
            "must lie between the `min_value` of 101 "
            "and the `max_value` of 100, inclusively." == str(exc_slider.value)
        )
