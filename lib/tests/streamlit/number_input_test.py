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

"""number_input unit test."""

from tests import testutil
import streamlit as st
from parameterized import parameterized
import pytest


class NumberInputTest(testutil.DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no value."""
        st.number_input("the label")

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, 0.0)

    def test_default_value_when_min_is_passed(self):
        st.number_input("the label", min_value=1, max_value=10)

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, 1)

    def test_value_between_range(self):
        st.number_input("the label", 0, 11, 10)

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, 10)
        self.assertEqual(c.min, 0)
        self.assertEqual(c.max, 11)

    def test_default_step_when_a_value_is_int(self):
        st.number_input("the label", value=10)

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.step, 1.0)

    def test_default_step_when_a_value_is_float(self):
        st.number_input("the label", value=10.5)

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual("%0.2f" % c.step, "0.01")

    def test_default_format_int(self):
        st.number_input("the label", value=10)

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.format, "%d")

    def test_default_format_float(self):
        st.number_input("the label", value=10.5)

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.format, "%0.2f")

    def test_format_int_and_default_step(self):
        st.number_input("the label", value=10, format="%d")

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.format, "%d")
        self.assertEqual(c.step, 1)

    def test_format_float_and_default_step(self):
        st.number_input("the label", value=10.0, format="%f")

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.format, "%f")
        self.assertEqual("%0.2f" % c.step, "0.01")

    def test_value_outrange(self):
        with pytest.raises(ValueError) as exc_message:
            st.number_input("the label", 11, 0, 10)
        assert (
            "The default `value` of 10 must lie between the `min_value` of "
            "11 and the `max_value` of 0, inclusively." == str(exc_message.value)
        )
