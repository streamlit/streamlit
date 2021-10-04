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

"""number_input unit test."""

from unittest.mock import patch
import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.js_number import JSNumber
from streamlit.proto.Alert_pb2 import Alert as AlertProto
from streamlit.proto.NumberInput_pb2 import NumberInput
from tests import testutil


class NumberInputTest(testutil.DeltaGeneratorTestCase):
    def test_data_type(self):
        """Test that NumberInput.type is set to the proper
        NumberInput.DataType value
        """
        st.number_input("Label", value=0)
        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(NumberInput.INT, c.data_type)

        st.number_input("Label", value=0.5)
        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(NumberInput.FLOAT, c.data_type)

    def test_min_value_zero_sets_default_value(self):
        st.number_input("Label", 0, 10)
        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.default, 0)  # the 0 we provided, not 0.0!

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.number_input("the label")

        c = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, 0.0)
        self.assertEqual(c.has_min, False)
        self.assertEqual(c.has_max, False)

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
        self.assertEqual(c.has_min, True)
        self.assertEqual(c.has_max, True)

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
        with pytest.raises(StreamlitAPIException) as exc_message:
            st.number_input("the label", 11, 0, 10)
        assert (
            "The default `value` of 10 must lie between the `min_value` of "
            "11 and the `max_value` of 0, inclusively." == str(exc_message.value)
        )

    def test_accept_valid_formats(self):
        # note: We decided to accept %u even though it is slightly problematic.
        #       See https://github.com/streamlit/streamlit/pull/943
        SUPPORTED = "adifFeEgGuXxo"
        for char in SUPPORTED:
            st.number_input("any label", format="%" + char)
            c = self.get_delta_from_queue().new_element.number_input
            self.assertEqual(c.format, "%" + char)

    def test_warns_on_float_type_with_int_format(self):
        st.number_input("the label", value=5.0, format="%d")

        c = self.get_delta_from_queue(-2).new_element.alert
        self.assertEqual(c.format, AlertProto.WARNING)
        self.assertEqual(
            c.body,
            "Warning: NumberInput value below has type float, but format %d displays as integer.",
        )

    def test_warns_on_int_type_with_float_format(self):
        st.number_input("the label", value=5, format="%0.2f")

        c = self.get_delta_from_queue(-2).new_element.alert
        self.assertEqual(c.format, AlertProto.WARNING)
        self.assertEqual(
            c.body,
            "Warning: NumberInput value below has type int so is displayed as int despite format string %0.2f.",
        )

    def test_error_on_unsupported_formatters(self):
        UNSUPPORTED = "pAn"
        for char in UNSUPPORTED:
            with pytest.raises(StreamlitAPIException) as exc_message:
                st.number_input("any label", value=3.14, format="%" + char)

    def test_error_on_invalid_formats(self):
        BAD_FORMATS = [
            "blah",
            "a%f",
            "a%.3f",
            "%d%d",
        ]
        for fmt in BAD_FORMATS:
            with pytest.raises(StreamlitAPIException) as exc_message:
                st.number_input("any label", value=3.14, format=fmt)

    def test_value_out_of_bounds(self):
        # Max int
        with pytest.raises(StreamlitAPIException) as exc:
            value = JSNumber.MAX_SAFE_INTEGER + 1
            st.number_input("Label", value=value)
        self.assertEqual(
            "`value` (%s) must be <= (1 << 53) - 1" % str(value), str(exc.value)
        )

        # Min int
        with pytest.raises(StreamlitAPIException) as exc:
            value = JSNumber.MIN_SAFE_INTEGER - 1
            st.number_input("Label", value=value)
        self.assertEqual(
            "`value` (%s) must be >= -((1 << 53) - 1)" % str(value), str(exc.value)
        )

        # Max float
        with pytest.raises(StreamlitAPIException) as exc:
            value = 2e308
            st.number_input("Label", value=value)
        self.assertEqual(
            "`value` (%s) must be <= 1.797e+308" % str(value), str(exc.value)
        )

        # Min float
        with pytest.raises(StreamlitAPIException) as exc:
            value = -2e308
            st.number_input("Label", value=value)
        self.assertEqual(
            "`value` (%s) must be >= -1.797e+308" % str(value), str(exc.value)
        )

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.number_input("foo")

        proto = self.get_delta_from_queue().new_element.number_input
        self.assertEqual(proto.form_id, "")

    @patch("streamlit._is_running_with_streamlit", new=True)
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.number_input("foo")

        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        number_input_proto = self.get_delta_from_queue(1).new_element.number_input
        self.assertEqual(number_input_proto.form_id, form_proto.form.form_id)

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""

        col1, col2 = st.columns(2)
        with col1:
            st.number_input("foo", 0, 10)

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        self.assertEqual(len(all_deltas), 4)
        number_input_proto = self.get_delta_from_queue().new_element.number_input

        self.assertEqual(number_input_proto.label, "foo")
        self.assertEqual(number_input_proto.step, 1.0)
        self.assertEqual(number_input_proto.default, 0)
