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

from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Alert_pb2 import Alert
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class AlertAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    @parameterized.expand([(st.error,), (st.warning,), (st.info,), (st.success,)])
    def test_st_alert_exceptions(self, alert_func):
        """Test that alert functions throw an exception when a non-emoji is given as an icon."""
        with self.assertRaises(StreamlitAPIException):
            alert_func("some alert", icon="hello world")


class StErrorAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_error(self):
        """Test st.error."""
        st.error("some error")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some error")
        self.assertEqual(el.alert.format, Alert.ERROR)

    def test_st_error_with_icon(self):
        """Test st.error with icon."""
        st.error("some error", icon="😱")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some error")
        self.assertEqual(el.alert.icon, "😱")
        self.assertEqual(el.alert.format, Alert.ERROR)


class StInfoAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_info(self):
        """Test st.info."""
        st.info("some info")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some info")
        self.assertEqual(el.alert.format, Alert.INFO)

    def test_st_info_with_icon(self):
        """Test st.info with icon."""
        st.info("some info", icon="👉🏻")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some info")
        self.assertEqual(el.alert.icon, "👉🏻")
        self.assertEqual(el.alert.format, Alert.INFO)


class StSuccessAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_success(self):
        """Test st.success."""
        st.success("some success")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some success")
        self.assertEqual(el.alert.format, Alert.SUCCESS)

    def test_st_success_with_icon(self):
        """Test st.success with icon."""
        st.success("some success", icon="✅")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some success")
        self.assertEqual(el.alert.icon, "✅")
        self.assertEqual(el.alert.format, Alert.SUCCESS)


class StWarningAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_warning(self):
        """Test st.warning."""
        st.warning("some warning")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some warning")
        self.assertEqual(el.alert.format, Alert.WARNING)

    def test_st_warning_with_icon(self):
        """Test st.warning with icon."""
        st.warning("some warning", icon="⚠️")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some warning")
        self.assertEqual(el.alert.icon, "⚠️")
        self.assertEqual(el.alert.format, Alert.WARNING)
