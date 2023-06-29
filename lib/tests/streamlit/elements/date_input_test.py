# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

"""date_input unit test."""

from datetime import date, datetime, timedelta

from parameterized import parameterized
from pytest import raises

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class DateInputTest(DeltaGeneratorTestCase):
    """Test ability to marshall date_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.date_input("the label")

        c = self.get_delta_from_queue().new_element.date_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )
        self.assertLessEqual(
            datetime.strptime(c.default[0], "%Y/%m/%d").date(), datetime.now().date()
        )
        self.assertEqual(c.disabled, False)

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.date_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.date_input
        self.assertEqual(c.disabled, True)

    @parameterized.expand(
        [
            (date(1970, 1, 1), ["1970/01/01"]),
            (datetime(2019, 7, 6, 21, 15), ["2019/07/06"]),
            ([], []),
            ([datetime(2019, 7, 6, 21, 15)], ["2019/07/06"]),
            (
                [datetime(2019, 7, 6, 21, 15), datetime(2019, 7, 6, 21, 15)],
                ["2019/07/06", "2019/07/06"],
            ),
        ]
    )
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.date_input("the label", arg_value)

        c = self.get_delta_from_queue().new_element.date_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.default, proto_value)

    @parameterized.expand(
        [
            (date(1961, 4, 12), "1951/04/12", "1971/04/12"),
            (date(2020, 2, 29), "2010/02/28", "2030/02/28"),
            # TODO: Find a way to mock date.today()
            #       Add test for empty value list case
            ([date(2021, 4, 26)], "2011/04/26", "2031/04/26"),
            ([date(2007, 2, 4), date(2012, 1, 3)], "1997/02/04", "2022/01/03"),
        ]
    )
    def test_min_max_values(self, arg_value, min_date_value, max_date_value):
        """Test that it calculates min, max date value range if not provided"""
        st.date_input("the label", arg_value)

        c = self.get_delta_from_queue().new_element.date_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.min, min_date_value)
        self.assertEqual(c.max, max_date_value)

    @parameterized.expand(
        [
            (
                datetime.today(),
                datetime.today() + timedelta(days=7),
                datetime.today() + timedelta(days=14),
            ),
            (
                datetime.today() + timedelta(days=8),
                datetime.today(),
                datetime.today() + timedelta(days=7),
            ),
            (
                [datetime.today(), datetime.today() + timedelta(2)],
                datetime.today() + timedelta(days=7),
                datetime.today() + timedelta(days=14),
            ),
            (
                [datetime.today(), datetime.today() + timedelta(8)],
                datetime.today() + timedelta(days=7),
                datetime.today() + timedelta(days=14),
            ),
            (
                [datetime.today(), datetime.today() + timedelta(8)],
                datetime.today(),
                datetime.today() + timedelta(days=7),
            ),
        ]
    )
    def test_value_out_of_range(self, value, min_date, max_date):
        with raises(StreamlitAPIException) as exc_message:
            st.date_input(
                "the label", value=value, min_value=min_date, max_value=max_date
            )
        if isinstance(value, (date, datetime)):
            value = [value]
        value = [v.date() if isinstance(v, datetime) else v for v in value]
        assert (
            f"The default `value` of {value} must lie between the `min_value` of {min_date.date()} "
            f"and the `max_value` of {max_date.date()}, inclusively."
            == str(exc_message.value)
        )

    @parameterized.expand(
        [
            (datetime.today(), datetime.today(), datetime.today() + timedelta(days=14)),
            (
                datetime.today() + timedelta(days=14),
                datetime.today(),
                datetime.today() + timedelta(days=14),
            ),
            (
                datetime.today() + timedelta(days=10),
                datetime.today(),
                datetime.today() + timedelta(days=14),
            ),
            (
                [datetime.today() + timedelta(1), datetime.today() + timedelta(2)],
                datetime.today(),
                datetime.today() + timedelta(days=14),
            ),
            (
                [datetime.today(), datetime.today() + timedelta(14)],
                datetime.today(),
                datetime.today() + timedelta(days=14),
            ),
        ]
    )
    def test_value_in_range(self, value, min_date, max_date):
        st.date_input("the label", value=value, min_value=min_date, max_value=max_date)

    def test_range_session_state(self):
        """Test a range set by session state."""
        date_range_input = [datetime.today(), datetime.today() + timedelta(2)]
        state = st.session_state
        state["date_range"] = date_range_input[:]

        date_range = st.date_input(
            "select a date range",
            key="date_range",
        )

        assert date_range == date_range_input

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, col2 = st.columns(2)

        with col1:
            st.date_input("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        self.assertEqual(len(all_deltas), 4)
        date_input_proto = self.get_delta_from_queue().new_element.date_input

        self.assertEqual(date_input_proto.label, "foo")

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.date_input("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.date_input
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.date_input("the label", label_visibility="wrong_value")
        self.assertEqual(
            str(e.exception),
            "Unsupported label_visibility option 'wrong_value'. Valid values are "
            "'visible', 'hidden' or 'collapsed'.",
        )
