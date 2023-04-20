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

import datetime

import streamlit as st
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
