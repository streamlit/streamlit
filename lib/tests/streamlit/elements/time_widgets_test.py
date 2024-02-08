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

import datetime

from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.time_widgets import _adjust_years
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StreamlitAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_time_input(self):
        """Test st.time_input."""
        value = datetime.time(8, 45)
        st.time_input("Set an alarm for", value)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.time_input.default, "08:45")
        self.assertEqual(el.time_input.step, datetime.timedelta(minutes=15).seconds)

    def test_st_time_input_with_step(self):
        """Test st.time_input with step."""
        value = datetime.time(9, 00)
        st.time_input("Set an alarm for", value, step=datetime.timedelta(minutes=5))

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.time_input.default, "09:00")
        self.assertEqual(el.time_input.step, datetime.timedelta(minutes=5).seconds)

    def test_st_time_input_exceptions(self):
        """Test st.time_input exceptions."""
        value = datetime.time(9, 00)
        with self.assertRaises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=True)
        with self.assertRaises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=(90, 0))
        with self.assertRaises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=1)
        with self.assertRaises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=59)
        with self.assertRaises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=datetime.timedelta(hours=24))
        with self.assertRaises(StreamlitAPIException):
            st.time_input("Set an alarm for", value, step=datetime.timedelta(days=1))


@parameterized.expand(
    [
        # Test adding one year to a regular date:
        (datetime.date(2021, 1, 1), 1, datetime.date(2022, 1, 1)),
        # Test adding one year to a leap day, resulting in a non-leap year (Feb 28):
        (datetime.date(2020, 2, 29), 1, datetime.date(2021, 2, 28)),
        # Test subtracting one year from a leap day, adjusting to the previous year's Feb 28.
        (datetime.date(2020, 2, 29), -1, datetime.date(2019, 2, 28)),
        # Non-leap year, regular date
        (datetime.date(2021, 3, 15), 1, datetime.date(2022, 3, 15)),
        # Leap year to leap year:
        (datetime.date(2020, 2, 29), 4, datetime.date(2024, 2, 29)),
        # Subtracting years from a non-leap year date
        (datetime.date(2019, 3, 15), -1, datetime.date(2018, 3, 15)),
        # Adding 100 years, including a century leap year:
        (datetime.date(1920, 4, 10), 100, datetime.date(2020, 4, 10)),
        # End of year date
        (datetime.date(2019, 12, 31), 1, datetime.date(2020, 12, 31)),
    ]
)
def test_adjust_years(
    input_date: datetime.date, years: int, expected_date: datetime.date
):
    """Test that `_adjust_years` correctly` adjusts the year of a date."""
    assert _adjust_years(input_date, years) == expected_date
