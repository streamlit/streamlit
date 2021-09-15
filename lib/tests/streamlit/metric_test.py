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

"""metric unit tests."""
from tests import testutil
import streamlit as st

from streamlit.errors import StreamlitAPIException
from streamlit.proto.Metric_pb2 import Metric as MetricProto


class MetricTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall metric protos and invalid input."""

    def test_no_value(self):
        st.metric("label_test", None)
        c = self.get_delta_from_queue().new_element.metric
        self.assertEqual(c.label, "label_test")
        # This is an em dash. Not a regular "-"
        self.assertEqual(c.body, "—")

    def test_label_and_value(self):
        """Test that metric can be called with label and value passed in."""
        st.metric("label_test", "123")

        c = self.get_delta_from_queue().new_element.metric
        self.assertEqual(c.label, "label_test")
        self.assertEqual(c.body, "123")
        self.assertEqual(c.color, MetricProto.MetricColor.GRAY)
        self.assertEqual(c.direction, MetricProto.MetricDirection.NONE)

    def test_label_and_value_and_delta_and_delta_color(self):
        """Test that metric can be called with label, value, delta, and delta
        colors passed in."""
        st.metric("label_test", "123", -321, "normal")
        c = self.get_delta_from_queue().new_element.metric
        self.assertEqual(c.label, "label_test")
        self.assertEqual(c.body, "123")
        self.assertEqual(c.delta, "-321")
        self.assertEqual(c.color, MetricProto.MetricColor.RED)
        self.assertEqual(c.direction, MetricProto.MetricDirection.DOWN)

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
            self.assertEqual(c.label, "label_test")
            self.assertEqual(proto_value, c.body)

    def test_delta_values(self):
        """Test that metric delta returns the correct proto value"""
        arg_values = [" -253", "+25", "26", 123, -123, 1.234, -1.5, None, ""]
        delta_values = ["-253", "+25", "26", "123", "-123", "1.234", "-1.5", "", ""]

        for arg_value, delta_value in zip(arg_values, delta_values):
            st.metric("label_test", "4312", arg_value)

            c = self.get_delta_from_queue().new_element.metric
            self.assertEqual(c.label, "label_test")
            self.assertEqual(delta_value, c.delta)

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
            st.metric("label_test", "4312", arg_delta_value, arg_delta_color_value)

            c = self.get_delta_from_queue().new_element.metric
            self.assertEqual(c.label, "label_test")
            self.assertEqual(c.color, color_value)
            self.assertEqual(c.direction, direction_value)

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
        self.assertEqual(len(all_deltas), 11)
        metric_proto = self.get_delta_from_queue().new_element.metric

        self.assertEqual(metric_proto.label, "Column 5")

    def test_invalid_label(self):
        with self.assertRaises(TypeError) as exc:
            st.metric(123, "-321")

        self.assertEqual(
            "'123' is not an accepted type. label only accepts: str",
            str(exc.exception),
        )

    def test_invalid_value(self):
        with self.assertRaises(TypeError) as exc:
            st.metric("Testing", [1, 2, 3])

        self.assertEqual(
            "'[1, 2, 3]' is not an accepted type. value only accepts: int, float, str, or None",
            str(exc.exception),
        )

    def test_invalid_delta(self):
        with self.assertRaises(TypeError) as exc:
            st.metric("Testing", "123", [123])

        self.assertEqual(
            "'[123]' is not an accepted type. delta only accepts: int, float, str, or None",
            str(exc.exception),
        )

    def test_invalid_delta_color(self):
        with self.assertRaises(StreamlitAPIException) as exc:
            st.metric("Hello World.", 123, 0, "Invalid")

        self.assertEqual(
            "'Invalid' is not an accepted value. delta_color only accepts: "
            "'normal', 'inverse', or 'off'",
            str(exc.exception),
        )
