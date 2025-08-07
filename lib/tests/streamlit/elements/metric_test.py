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

"""metric unit tests."""

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.policies import _LOGGER
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.proto.Metric_pb2 import Metric as MetricProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import (
    HeightConfigFields,
    WidthConfigFields,
)


class MetricTest(DeltaGeneratorTestCase):
    """Test ability to marshall metric protos and invalid input."""

    def test_no_value(self):
        st.metric("label_test", None)
        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        # This is an em dash. Not a regular "-"
        assert c.body == "—"
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )

    def test_label_and_value(self):
        """Test that metric can be called with label and value passed in."""
        st.metric("label_test", "123")

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert c.color == MetricProto.MetricColor.GRAY
        assert c.direction == MetricProto.MetricDirection.NONE
        assert not c.show_border

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that metric can be called with label_visibility param."""
        st.metric("label_test", "123", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert c.label_visibility.value == proto_value

    def test_border(self):
        """Test that metric can be called with border param."""
        st.metric("label_test", "123", border=True)

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert c.show_border

    def test_label_and_value_and_delta_and_delta_color(self):
        """Test that metric can be called with label, value, delta, and delta
        colors passed in."""
        st.metric("label_test", "123", -321, delta_color="normal")
        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert c.delta == "-321"
        assert c.color == MetricProto.MetricColor.RED
        assert c.direction == MetricProto.MetricDirection.DOWN

    def test_value(self):
        """Test that metric delta returns the correct proto value"""
        arg_values = ["some str", 123, -1.234, None]
        proto_values = [
            "some str",
            "123",
            "-1.234",
            "—",
        ]

        for arg_value, proto_value in zip(arg_values, proto_values):
            st.metric("label_test", arg_value)

            c = self.get_delta_from_queue().new_element.metric
            assert c.label == "label_test"
            assert proto_value == c.body

    def test_delta_values(self):
        """Test that metric delta returns the correct proto value"""
        arg_values = [" -253", "+25", "26", 123, -123, 1.234, -1.5, None, ""]
        delta_values = ["-253", "+25", "26", "123", "-123", "1.234", "-1.5", "", ""]

        for arg_value, delta_value in zip(arg_values, delta_values):
            st.metric("label_test", "4312", arg_value)

            c = self.get_delta_from_queue().new_element.metric
            assert c.label == "label_test"
            assert delta_value == c.delta

    def test_delta_color(self):
        """Test that metric delta colors returns the correct proto value."""
        arg_delta_values = ["-123", -123, -1.23, "123", 123, 1.23, None, ""]
        arg_delta_color_values = [
            "normal",
            "inverse",
            "off",
            "normal",
            "inverse",
            "off",
            "normal",
            "normal",
        ]
        color_values = [
            MetricProto.MetricColor.RED,
            MetricProto.MetricColor.GREEN,
            MetricProto.MetricColor.GRAY,
            MetricProto.MetricColor.GREEN,
            MetricProto.MetricColor.RED,
            MetricProto.MetricColor.GRAY,
            MetricProto.MetricColor.GRAY,
            MetricProto.MetricColor.GRAY,
        ]
        direction_values = [
            MetricProto.MetricDirection.DOWN,
            MetricProto.MetricDirection.DOWN,
            MetricProto.MetricDirection.DOWN,
            MetricProto.MetricDirection.UP,
            MetricProto.MetricDirection.UP,
            MetricProto.MetricDirection.UP,
            MetricProto.MetricDirection.NONE,
            MetricProto.MetricDirection.NONE,
        ]

        for (
            arg_delta_value,
            arg_delta_color_value,
            color_value,
            direction_value,
        ) in zip(
            arg_delta_values, arg_delta_color_values, color_values, direction_values
        ):
            st.metric(
                "label_test", "4312", arg_delta_value, delta_color=arg_delta_color_value
            )

            c = self.get_delta_from_queue().new_element.metric
            assert c.label == "label_test"
            assert c.color == color_value
            assert c.direction == direction_value

    def test_metric_in_column(self):
        col1, col2, col3, col4, col5 = st.columns(5)
        with col1:
            st.metric("Column 1", 123, 123)
        with col2:
            st.metric("Column 2", 123, 123)
        with col3:
            st.metric("Column 3", 123, 123)
        col4.metric("Column 4", -123, -123)
        col5.metric("Column 5", "-123", 0)

        all_deltas = self.get_all_deltas_from_queue()

        # 11 elements will be created: 1 horizontal block, 5 columns, 5 widget
        assert len(all_deltas) == 11
        metric_proto = self.get_delta_from_queue().new_element.metric

        assert metric_proto.label == "Column 5"

    def test_invalid_label(self):
        with pytest.raises(TypeError) as exc:
            st.metric(123, "-321")

        assert str(exc.value) == (
            "'123' is of type <class 'int'>, which is not an accepted type. "
            "label only accepts: str. Please convert the label to an accepted type."
        )

    def test_invalid_label_visibility(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.metric("label_test", "123", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_empty_label_warning(self):
        """Test that a warning is logged if st.metric was called with empty label."""

        with self.assertLogs(_LOGGER) as logs:
            st.metric(label="", value="123")

        assert (
            "`label` got an empty value. This is discouraged for accessibility reasons"
            in logs.records[0].msg
        )
        # Check that the stack trace is included in the warning message:
        assert logs.records[0].stack_info is not None

    def test_invalid_value(self):
        with pytest.raises(TypeError) as exc:
            st.metric("Testing", [1, 2, 3])

        assert str(exc.value) == (
            "'[1, 2, 3]' is of type <class 'list'>, which is not an accepted type. "
            "value only accepts: int, float, str, or None. "
            "Please convert the value to an accepted type."
        )

    def test_invalid_delta(self):
        with pytest.raises(TypeError) as exc:
            st.metric("Testing", "123", [123])

        assert str(exc.value) == (
            "'[123]' is of type <class 'list'>, which is not an accepted type. "
            "delta only accepts: int, float, str, or None. "
            "Please convert the value to an accepted type."
        )

    def test_invalid_delta_color(self):
        with pytest.raises(StreamlitAPIException) as exc:
            st.metric("Hello World.", 123, 0, delta_color="Invalid")

        assert (
            str(exc.value)
            == "'Invalid' is not an accepted value. delta_color only accepts: 'normal', 'inverse', or 'off'"
        )

    def test_help(self):
        st.metric("label_test", value="500", help="   help text")
        c = self.get_delta_from_queue().new_element.metric
        assert c.help == "help text"

    def test_height_default(self):
        """Test that height defaults to content."""
        st.metric("label_test", "123")

        c = self.get_delta_from_queue().new_element
        assert c.metric.label == "label_test"
        assert c.metric.body == "123"
        assert (
            c.height_config.WhichOneof("height_spec")
            == HeightConfigFields.USE_CONTENT.value
        )
        assert c.height_config.use_content

    def test_height_types(self):
        """Test that metric can be called with different height types."""
        test_cases = [
            (500, HeightConfigFields.PIXEL_HEIGHT.value, "pixel_height", 500),
            ("stretch", HeightConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", HeightConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for height_value, expected_height_spec, field_name, field_value in test_cases:
            with self.subTest(height_value=height_value):
                st.metric("label_test", "123", height=height_value)

                c = self.get_delta_from_queue().new_element
                assert c.metric.label == "label_test"
                assert c.metric.body == "123"
                assert c.height_config.WhichOneof("height_spec") == expected_height_spec
                assert getattr(c.height_config, field_name) == field_value

    def test_invalid_height(self):
        """Test that metric raises an error with invalid height."""
        test_cases = [
            (
                "invalid",
                "Invalid height value: 'invalid'. Height must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Invalid height value: -100. Height must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid height value: 0. Height must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Invalid height value: 100.5. Height must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for height_value, expected_error_message in test_cases:
            with self.subTest(height_value=height_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.metric("label_test", "123", height=height_value)

                assert str(exc.value) == expected_error_message

    def test_width_types(self):
        """Test that metric can be called with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
            (None, WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                if width_value is None:
                    st.metric("label_test", "123")
                else:
                    st.metric("label_test", "123", width=width_value)

                c = self.get_delta_from_queue().new_element
                assert c.metric.label == "label_test"
                assert c.metric.body == "123"
                assert c.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(c.width_config, field_name) == field_value

    def test_invalid_width(self):
        """Test that metric raises an error with invalid width."""
        test_cases = [
            (
                "invalid",
                "Invalid width value: 'invalid'. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Invalid width value: -100. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid width value: 0. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Invalid width value: 100.5. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.metric("label_test", "123", width=width_value)

                assert str(exc.value) == expected_error_message

    def test_chart_data_none(self):
        """Test that metric works with default chart_data=None."""
        st.metric("label_test", "123")

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert len(c.chart_data) == 0

    def test_chart_data_valid_list(self):
        """Test that metric can be called with valid chart_data list."""
        chart_data = [1, 2, 3, 4, 5]
        st.metric("label_test", "123", chart_data=chart_data)

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert list(c.chart_data) == [1.0, 2.0, 3.0, 4.0, 5.0]

    def test_chart_data_valid_mixed_numeric(self):
        """Test that metric can be called with mixed numeric types in chart_data."""
        chart_data = [1, 2.5, -3, 0, 10.7]
        st.metric("label_test", "123", chart_data=chart_data)

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert list(c.chart_data) == [1.0, 2.5, -3.0, 0.0, 10.7]

    def test_chart_data_string_numbers(self):
        """Test that metric can convert string numbers in chart_data."""
        chart_data = ["1", "2.5", "-3", "0"]
        st.metric("label_test", "123", chart_data=chart_data)

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert list(c.chart_data) == [1.0, 2.5, -3.0, 0.0]

    def test_chart_data_empty_list(self):
        """Test that metric works with empty chart_data list."""
        st.metric("label_test", "123", chart_data=[])

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert len(c.chart_data) == 0

    def test_chart_data_invalid_values(self):
        """Test that metric raises error with invalid chart_data values."""
        chart_data = [1, 2, "invalid", 4]

        with pytest.raises(StreamlitAPIException) as exc:
            st.metric("label_test", "123", chart_data=chart_data)

        assert "Only numeric values are supported for chart data sequence" in str(
            exc.value
        )
        assert "'invalid' is of type <class 'str'>" in str(exc.value)
        assert "cannot be converted to float" in str(exc.value)

    def test_chart_data_invalid_non_sequence(self):
        """Test that metric raises error with invalid chart_data non-sequence values."""
        chart_data = [1, 2, {"invalid": "dict"}, 4]

        with pytest.raises(StreamlitAPIException) as exc:
            st.metric("label_test", "123", chart_data=chart_data)

        assert "Only numeric values are supported for chart data sequence" in str(
            exc.value
        )

    @parameterized.expand(
        [
            ("line", MetricProto.ChartType.LINE),
            ("bar", MetricProto.ChartType.BAR),
            ("area", MetricProto.ChartType.AREA),
        ]
    )
    def test_chart_type_valid_values(self, chart_type_value, expected_proto_value):
        """Test that metric can be called with valid chart_type values."""
        st.metric("label_test", "123", chart_type=chart_type_value)

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert c.chart_type == expected_proto_value

    def test_chart_type_default(self):
        """Test that chart_type defaults to line."""
        st.metric("label_test", "123")

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert c.chart_type == MetricProto.ChartType.LINE

    def test_chart_data_and_chart_type_together(self):
        """Test that metric can be called with both chart_data and chart_type."""
        chart_data = [10, 20, 15, 25, 30]
        st.metric("label_test", "123", chart_data=chart_data, chart_type="bar")

        c = self.get_delta_from_queue().new_element.metric
        assert c.label == "label_test"
        assert c.body == "123"
        assert list(c.chart_data) == [10.0, 20.0, 15.0, 25.0, 30.0]
        assert c.chart_type == MetricProto.ChartType.BAR
