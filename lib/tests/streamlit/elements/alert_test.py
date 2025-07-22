# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.Alert_pb2 import Alert
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class AlertAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    @parameterized.expand([(st.error,), (st.warning,), (st.info,), (st.success,)])
    def test_st_alert_exceptions(self, alert_func):
        """Test that alert functions throw an exception when a non-emoji is given as an icon."""
        with pytest.raises(StreamlitAPIException):
            alert_func("some alert", icon="hello world")

    @parameterized.expand([(st.error,), (st.warning,), (st.info,), (st.success,)])
    def test_st_alert_width_validation(self, alert_func):
        """Test that alert functions throw an exception when an invalid width is provided."""
        with pytest.raises(StreamlitInvalidWidthError) as e:
            alert_func("some alert", width="invalid")
        assert "Invalid width value" in str(e.value)
        assert "Width must be either an integer (pixels) or 'stretch'" in str(e.value)

    @parameterized.expand([(st.error,), (st.warning,), (st.info,), (st.success,)])
    def test_st_alert_negative_width(self, alert_func):
        """Test that alert functions throw an exception when a negative width is provided."""
        with pytest.raises(StreamlitInvalidWidthError) as e:
            alert_func("some alert", width=-100)
        assert "Invalid width value" in str(e.value)
        assert "Width must be either an integer (pixels) or 'stretch'" in str(e.value)


class StErrorAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_error(self):
        """Test st.error."""
        st.error("some error")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some error"
        assert el.alert.format == Alert.ERROR
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_error_with_icon(self):
        """Test st.error with icon."""
        st.error("some error", icon="😱")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some error"
        assert el.alert.icon == "😱"
        assert el.alert.format == Alert.ERROR
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_error_with_width_pixels(self):
        """Test st.error with width in pixels."""
        st.error("some error", width=500)

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some error"
        assert el.alert.format == Alert.ERROR
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.alert.width_config.pixel_width == 500

    def test_st_error_with_width_stretch(self):
        """Test st.error with width set to stretch."""
        st.error("some error", width="stretch")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some error"
        assert el.alert.format == Alert.ERROR
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch


class StInfoAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_info(self):
        """Test st.info."""
        st.info("some info")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some info"
        assert el.alert.format == Alert.INFO
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_info_with_icon(self):
        """Test st.info with icon."""
        st.info("some info", icon="❓")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some info"
        assert el.alert.icon == "❓"
        assert el.alert.format == Alert.INFO
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_info_with_width_pixels(self):
        """Test st.info with width in pixels."""
        st.info("some info", width=500)

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some info"
        assert el.alert.format == Alert.INFO
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.alert.width_config.pixel_width == 500

    def test_st_info_with_width_stretch(self):
        """Test st.info with width set to stretch."""
        st.info("some info", width="stretch")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some info"
        assert el.alert.format == Alert.INFO
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch


class StSuccessAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_success(self):
        """Test st.success."""
        st.success("some success")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some success"
        assert el.alert.format == Alert.SUCCESS
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_success_with_icon(self):
        """Test st.success with icon."""
        st.success("some success", icon="✅")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some success"
        assert el.alert.icon == "✅"
        assert el.alert.format == Alert.SUCCESS
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_success_with_width_pixels(self):
        """Test st.success with width in pixels."""
        st.success("some success", width=500)

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some success"
        assert el.alert.format == Alert.SUCCESS
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.alert.width_config.pixel_width == 500

    def test_st_success_with_width_stretch(self):
        """Test st.success with width set to stretch."""
        st.success("some success", width="stretch")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some success"
        assert el.alert.format == Alert.SUCCESS
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch


class StWarningAPITest(DeltaGeneratorTestCase):
    """Test ability to marshall Alert proto."""

    def test_st_warning(self):
        """Test st.warning."""
        st.warning("some warning")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some warning"
        assert el.alert.format == Alert.WARNING
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_warning_with_icon(self):
        """Test st.warning with icon."""
        st.warning("some warning", icon="⚠️")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some warning"
        assert el.alert.icon == "⚠️"
        assert el.alert.format == Alert.WARNING
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch

    def test_st_warning_with_width_pixels(self):
        """Test st.warning with width in pixels."""
        st.warning("some warning", width=500)

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some warning"
        assert el.alert.format == Alert.WARNING
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert el.alert.width_config.pixel_width == 500

    def test_st_warning_with_width_stretch(self):
        """Test st.warning with width set to stretch."""
        st.warning("some warning", width="stretch")

        el = self.get_delta_from_queue().new_element
        assert el.alert.body == "some warning"
        assert el.alert.format == Alert.WARNING
        assert (
            el.alert.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert el.alert.width_config.use_stretch
