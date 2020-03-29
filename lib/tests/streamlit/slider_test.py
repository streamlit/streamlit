# Copyright 2018-2020 Streamlit Inc.
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
from streamlit.js_number import JSNumber
from tests import testutil


class SliderTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall slider protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.slider("the label")

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, [0])

    @parameterized.expand(
        [
            (1, [1], 1),  # int
            ((0, 1), [0, 1], (0, 1)),  # int tuple
            ([0, 1], [0, 1], (0, 1)),  # int list
            (0.5, [0.5], 0.5),  # float
            ((0.2, 0.5), [0.2, 0.5], (0.2, 0.5)),  # float tuple
            ([0.2, 0.5], [0.2, 0.5], (0.2, 0.5)),  # float list
        ]
    )
    def test_value_types(self, value, proto_value, return_value):
        """Test that it supports different types of values."""
        ret = st.slider("the label", value=value)

        self.assertEqual(ret, return_value)

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, proto_value)

    def test_value_greater_than_min(self):
        with pytest.raises(StreamlitAPIException) as exc_slider:
            st.slider("Slider label", 10, 100, 0)
        self.assertEqual(
            "The default `value` of 0 must lie between the `min_value` of 10 "
            "and the `max_value` of 100, inclusively.",
            str(exc_slider.value),
        )

    def test_value_smaller_than_max(self):
        with pytest.raises(StreamlitAPIException) as exc_slider:
            st.slider("Slider label", 10, 100, 101)
        self.assertEqual(
            "The default `value` of 101 must lie between the `min_value` of "
            "10 and the `max_value` of 100, inclusively.",
            str(exc_slider.value),
        )

    def test_max_min(self):
        with pytest.raises(StreamlitAPIException) as exc_slider:
            st.slider("Slider label", 101, 100, 101)
        self.assertEqual(
            "The default `value` of 101 must lie between the `min_value` of "
            "101 and the `max_value` of 100, inclusively.",
            str(exc_slider.value),
        )

    def test_value_out_of_bounds(self):
        # Max int
        with pytest.raises(StreamlitAPIException) as exc:
            max_value = JSNumber.MAX_SAFE_INTEGER + 1
            st.slider("Label", max_value=max_value)
        self.assertEqual(
            "`max_value` (%s) must be <= (1 << 53) - 1" % str(max_value), str(exc.value)
        )

        # Min int
        with pytest.raises(StreamlitAPIException) as exc:
            min_value = JSNumber.MIN_SAFE_INTEGER - 1
            st.slider("Label", min_value=min_value)
        self.assertEqual(
            "`min_value` (%s) must be >= -((1 << 53) - 1)" % str(min_value),
            str(exc.value),
        )

        # Max float
        with pytest.raises(StreamlitAPIException) as exc:
            max_value = 2e308
            st.slider("Label", value=0.5, max_value=max_value)
        self.assertEqual(
            "`max_value` (%s) must be <= 1.797e+308" % str(max_value), str(exc.value)
        )

        # Min float
        with pytest.raises(StreamlitAPIException) as exc:
            min_value = -2e308
            st.slider("Label", value=0.5, min_value=min_value)
        self.assertEqual(
            "`min_value` (%s) must be >= -1.797e+308" % str(min_value), str(exc.value)
        )
