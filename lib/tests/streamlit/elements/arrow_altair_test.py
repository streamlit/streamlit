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

import json
from datetime import date
from functools import reduce
from typing import Any, Callable

import altair as alt
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements import arrow_altair as altair
from streamlit.elements.arrow_altair import ChartType
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import bytes_to_data_frame
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit import pyspark_mocks, snowpark_mocks


def _deep_get(dictionary, *keys):
    return reduce(
        lambda d, key: d.get(key, None) if isinstance(d, dict) else None,
        keys,
        dictionary,
    )


ST_CHART_ARGS = [
    (st.area_chart, "area"),
    (st.bar_chart, "bar"),
    (st.line_chart, "line"),
    (st.scatter_chart, "circle"),
]


class ArrowAltairTest(DeltaGeneratorTestCase):
    """Test ability to marshall arrow_altair_chart proto."""

    def test_altair_chart(self):
        """Test that it can be called with args."""
        df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
        chart = alt.Chart(df).mark_bar().encode(x="a", y="b")
        EXPECTED_DATAFRAME = pd.DataFrame(
            {
                "a": ["A", "B", "C", "D"],
                "b": [28, 55, 43, 91],
            }
        )

        st.altair_chart(chart)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart

        self.assertEqual(proto.HasField("data"), False)
        self.assertEqual(len(proto.datasets), 1)
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data), EXPECTED_DATAFRAME
        )

        spec_dict = json.loads(proto.spec)
        self.assertEqual(
            spec_dict["encoding"],
            {
                "y": {"field": "b", "type": "quantitative"},
                "x": {"field": "a", "type": "nominal"},
            },
        )
        self.assertEqual(spec_dict["data"], {"name": proto.datasets[0].name})
        self.assertIn(spec_dict["mark"], ["bar", {"type": "bar"}])
        self.assertTrue("encoding" in spec_dict)

    def test_date_column_utc_scale(self):
        """Test that columns with date values have UTC time scale"""
        df = pd.DataFrame(
            {"index": [date(2019, 8, 9), date(2019, 8, 10)], "numbers": [1, 10]}
        ).set_index("index")

        chart, _ = altair._generate_chart(ChartType.LINE, df)
        st.altair_chart(chart)
        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        spec_dict = json.loads(proto.spec)

        # The x axis should have scale="utc", because it uses date values.
        x_scale = _deep_get(spec_dict, "encoding", "x", "scale", "type")
        self.assertEqual(x_scale, "utc")

        # The y axis should _not_ have scale="utc", because it doesn't
        # use date values.
        y_scale = _deep_get(spec_dict, "encoding", "y", "scale", "type")
        self.assertNotEqual(y_scale, "utc")

    @parameterized.expand(
        [
            ("streamlit", "streamlit"),
            (None, ""),
        ]
    )
    def test_theme(self, theme_value, proto_value):
        df = pd.DataFrame(
            {"index": [date(2019, 8, 9), date(2019, 8, 10)], "numbers": [1, 10]}
        ).set_index("index")

        chart, _ = altair._generate_chart(ChartType.LINE, df)
        st.altair_chart(chart, theme=theme_value)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.arrow_vega_lite_chart.theme, proto_value)

    def test_bad_theme(self):
        df = pd.DataFrame(
            {"index": [date(2019, 8, 9), date(2019, 8, 10)], "numbers": [1, 10]}
        ).set_index("index")

        chart, _ = altair._generate_chart(ChartType.LINE, df)
        with self.assertRaises(StreamlitAPIException) as exc:
            st.altair_chart(chart, theme="bad_theme")

        self.assertEqual(
            f'You set theme="bad_theme" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.',
            str(exc.exception),
        )


class ArrowChartsTest(DeltaGeneratorTestCase):
    """Test Arrow charts."""

    @parameterized.expand(ST_CHART_ARGS)
    def test_empty_chart(self, chart_command: Callable, altair_type: str):
        """Test arrow chart with no arguments."""
        EXPECTED_DATAFRAME = pd.DataFrame()

        # Make some mutations that arrow_altair.prep_data() does.
        column_names = list(
            EXPECTED_DATAFRAME.columns
        )  # list() converts RangeIndex, etc, to regular list.
        str_column_names = [str(c) for c in column_names]
        EXPECTED_DATAFRAME.columns = pd.Index(str_column_names)

        chart_command()

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart

        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])

        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_implicit_x_and_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st.line_chart with implicit x and y."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[20, "b", 30], [20, "c", 50]],
            columns=["a", "color--p5bJXXpQgvPz6yvQMFiy", "value--p5bJXXpQgvPz6yvQMFiy"],
        )

        chart_command(df, x="a", y=["b", "c"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(chart_spec["encoding"]["x"]["field"], "a")
        self.assertEqual(
            chart_spec["encoding"]["y"]["field"], "value--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_pyspark_dataframe(
        self, chart_command: Callable, altair_type: str
    ):
        spark_df = pyspark_mocks.DataFrame(is_numpy_arr=True)

        chart_command(spark_df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(
            chart_spec["encoding"]["x"]["field"], "index--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["y"]["field"], "value--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        output_df = bytes_to_data_frame(proto.datasets[0].data.data)

        self.assertEqual(len(output_df.columns), 3)
        self.assertEqual(output_df.columns[0], "index--p5bJXXpQgvPz6yvQMFiy")
        self.assertEqual(output_df.columns[1], "color--p5bJXXpQgvPz6yvQMFiy")
        self.assertEqual(output_df.columns[2], "value--p5bJXXpQgvPz6yvQMFiy")

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_snowpark_dataframe(
        self, chart_command: Callable, altair_type: str
    ):
        snow_df = snowpark_mocks.DataFrame()

        chart_command(snow_df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(
            chart_spec["encoding"]["x"]["field"], "index--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["y"]["field"], "value--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        output_df = bytes_to_data_frame(proto.datasets[0].data.data)

        self.assertEqual(len(output_df.columns), 3)
        self.assertEqual(output_df.columns[0], "index--p5bJXXpQgvPz6yvQMFiy")
        self.assertEqual(output_df.columns[1], "color--p5bJXXpQgvPz6yvQMFiy")
        self.assertEqual(output_df.columns[2], "value--p5bJXXpQgvPz6yvQMFiy")

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_explicit_x_and_implicit_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st.line_chart with explicit x and implicit y."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[20, "b", 30], [20, "c", 50]],
            columns=["a", "color--p5bJXXpQgvPz6yvQMFiy", "value--p5bJXXpQgvPz6yvQMFiy"],
        )

        chart_command(df, x="a")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(chart_spec["encoding"]["x"]["field"], "a")
        self.assertEqual(
            chart_spec["encoding"]["y"]["field"], "value--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_implicit_x_and_explicit_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st.line_chart with implicit x and explicit y."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, 30]], columns=["index--p5bJXXpQgvPz6yvQMFiy", "b"]
        )

        chart_command(df, y="b")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(
            chart_spec["encoding"]["x"]["field"], "index--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(chart_spec["encoding"]["y"]["field"], "b")
        self.assertFalse("color" in chart_spec["encoding"])

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_implicit_x_and_explicit_y_sequence(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st.line_chart with implicit x and explicit y sequence."""
        df = pd.DataFrame([[20, 30, 50, 60]], columns=["a", "b", "c", "d"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, "b", 30], [0, "c", 50]],
            columns=[
                "index--p5bJXXpQgvPz6yvQMFiy",
                "color--p5bJXXpQgvPz6yvQMFiy",
                "value--p5bJXXpQgvPz6yvQMFiy",
            ],
        )

        chart_command(df, y=["b", "c"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(
            chart_spec["encoding"]["x"]["field"], "index--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["y"]["field"], "value--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_explicit_x_and_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test x/y-support for built-in charts."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30]], columns=["a", "b"])

        chart_command(df, x="a", y="b", width=640, height=480)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        self.assertEqual(chart_spec["encoding"]["x"]["field"], "a")
        self.assertEqual(chart_spec["encoding"]["y"]["field"], "b")

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_explicit_x_and_y_sequence(
        self, chart_command: Callable, altair_type: str
    ):
        """Test support for explicit wide-format tables (i.e. y is a sequence)."""
        df = pd.DataFrame([[20, 30, 50, 60]], columns=["a", "b", "c", "d"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[20, "b", 30], [20, "c", 50]],
            columns=["a", "color--p5bJXXpQgvPz6yvQMFiy", "value--p5bJXXpQgvPz6yvQMFiy"],
        )

        chart_command(df, x="a", y=["b", "c"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(chart_spec["encoding"]["x"]["field"], "a")
        self.assertEqual(
            chart_spec["encoding"]["y"]["field"], "value--p5bJXXpQgvPz6yvQMFiy"
        )
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_color_value(self, chart_command: Callable, altair_type: str):
        """Test color support for built-in charts."""
        df = pd.DataFrame([[20, 30]], columns=["a", "b"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30]], columns=["a", "b"])

        chart_command(df, x="a", y="b", color="#f00")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertEqual(chart_spec["encoding"]["color"]["value"], "#f00")

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_color_column(self, chart_command: Callable, altair_type: str):
        """Test color support for built-in charts."""
        df = pd.DataFrame(
            {
                "x": [0, 1, 2],
                "y": [22, 21, 20],
                "tuple3_int_color": [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
                "tuple4_int_int_color": [
                    [255, 0, 0, 51],
                    [0, 255, 0, 51],
                    [0, 0, 255, 51],
                ],
                "tuple4_int_float_color": [
                    [255, 0, 0, 0.2],
                    [0, 255, 0, 0.2],
                    [0, 0, 255, 0.2],
                ],
                "tuple3_float_color": [
                    [1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0],
                ],
                "tuple4_float_float_color": [
                    [1.0, 0.0, 0.0, 0.2],
                    [0.0, 1.0, 0.0, 0.2],
                    [0.0, 0.0, 1.0, 0.2],
                ],
                "hex3_color": ["#f00", "#0f0", "#00f"],
                "hex4_color": ["#f008", "#0f08", "#00f8"],
                "hex6_color": ["#ff0000", "#00ff00", "#0000ff"],
                "hex8_color": ["#ff000088", "#00ff0088", "#0000ff88"],
            }
        )

        color_columns = sorted(set(df.columns))
        color_columns.remove("x")
        color_columns.remove("y")

        expected_values = pd.DataFrame(
            {
                "tuple3": ["rgb(255, 0, 0)", "rgb(0, 255, 0)", "rgb(0, 0, 255)"],
                "tuple4": [
                    "rgba(255, 0, 0, 0.2)",
                    "rgba(0, 255, 0, 0.2)",
                    "rgba(0, 0, 255, 0.2)",
                ],
                "hex3": ["#f00", "#0f0", "#00f"],
                "hex6": ["#ff0000", "#00ff00", "#0000ff"],
                "hex4": ["#f008", "#0f08", "#00f8"],
                "hex8": ["#ff000088", "#00ff0088", "#0000ff88"],
            }
        )

        def get_expected_color_values(col_name):
            for prefix, expected_color_values in expected_values.items():
                if col_name.startswith(prefix):
                    return expected_color_values

        for color_column in color_columns:
            expected_color_values = get_expected_color_values(color_column)

            chart_command(df, x="x", y="y", color=color_column)

            proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
            chart_spec = json.loads(proto.spec)

            self.assertEqual(chart_spec["encoding"]["color"]["field"], color_column)

            # Manually-specified colors should not have a legend
            self.assertEqual(chart_spec["encoding"]["color"]["legend"], None)

            # Manually-specified colors are set via the color scale's range property.
            self.assertTrue(chart_spec["encoding"]["color"]["scale"]["range"])

            proto_df = bytes_to_data_frame(proto.datasets[0].data.data)

            pd.testing.assert_series_equal(
                proto_df[color_column],
                expected_color_values,
                check_names=False,
            )

    @parameterized.expand(ST_CHART_ARGS)
    def test_chart_with_explicit_x_plus_y_and_color_sequence(
        self, chart_command: Callable, altair_type: str
    ):
        """Test color support for built-in charts with wide-format table."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        EXPECTED_DATAFRAME = pd.DataFrame(
            [[20, "b", 30], [20, "c", 50]],
            columns=["a", "color--p5bJXXpQgvPz6yvQMFiy", "value--p5bJXXpQgvPz6yvQMFiy"],
        )

        chart_command(df, x="a", y=["b", "c"], color=["#f00", "#0ff"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])

        # Color should be set to the melted column name.
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        # Automatically-specified colors should have no legend title.
        self.assertEqual(chart_spec["encoding"]["color"]["title"], " ")

        # Automatically-specified colors should have a legend
        self.assertNotEqual(chart_spec["encoding"]["color"]["legend"], None)

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(
        [[None], [[]], [tuple()]],
    )
    def test_chart_with_empty_color(self, color_arg: Any):
        """Test color support for built-in charts with wide-format table."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30]], columns=["a", "b"])

        st.line_chart(df, x="a", y="b", color=color_arg)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        # Color should be set to the melted column name.
        self.assertEqual(getattr(chart_spec["encoding"], "color", None), None)

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(
        [
            (st.area_chart, "a", "foooo"),
            (st.bar_chart, "not-valid", "b"),
            (st.line_chart, "foo", "bar"),
            (st.line_chart, None, "bar"),
            (st.line_chart, "foo", None),
            (st.line_chart, "a", ["b", "foo"]),
            (st.line_chart, None, "variable"),
            (st.line_chart, "variable", ["a", "b"]),
        ]
    )
    def test_chart_with_x_y_invalid_input(
        self,
        chart_command: Callable,
        x: str,
        y: str,
    ):
        """Test x/y support for built-in charts with invalid input."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        with pytest.raises(StreamlitAPIException):
            chart_command(df, x=x, y=y)

    def test_chart_with_x_y_on_sliced_data(
        self,
    ):
        """Test x/y-support for built-in charts on sliced data."""
        df = pd.DataFrame([[20, 30, 50], [60, 70, 80]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30], [60, 70]], columns=["a", "b"])[1:]

        # Use all data after first item
        st.line_chart(df[1:], x="a", y="b")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertEqual(chart_spec["encoding"]["x"]["field"], "a")
        self.assertEqual(chart_spec["encoding"]["y"]["field"], "b")

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    def test_line_chart_with_named_index(self):
        """Test st.line_chart with a named index."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        df.set_index("a", inplace=True)

        EXPECTED_DATAFRAME = pd.DataFrame(
            [[20, "b", 30], [20, "c", 50]],
            index=[0, 1],
            columns=["a", "color--p5bJXXpQgvPz6yvQMFiy", "value--p5bJXXpQgvPz6yvQMFiy"],
        )

        st.line_chart(df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], ["line", {"type": "line"}])

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_unused_columns_are_dropped(
        self, chart_command: Callable, altair_type: str
    ):
        """Test built-in charts drop columns that are not used."""

        df = pd.DataFrame(
            [[5, 10, 20, 30, 35, 40, 50, 60]],
            columns=["z", "a", "b", "c", "x", "d", "e", "f"],
        )

        if chart_command == st.scatter_chart:
            chart_command(df, x="a", y="c", color="d", size="e")
            EXPECTED_DATAFRAME = pd.DataFrame(
                [[10, 40, 50, 30]], columns=["a", "d", "e", "c"]
            )
        else:
            chart_command(df, x="a", y="c", color="d")

            EXPECTED_DATAFRAME = pd.DataFrame([[10, 40, 30]], columns=["a", "d", "c"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        json.loads(proto.spec)

        self.assert_output_df_is_correct_and_input_is_untouched(
            orig_df=df, expected_df=EXPECTED_DATAFRAME, chart_proto=proto
        )

    @parameterized.expand(
        [
            (st.area_chart, "area"),
            (st.bar_chart, "bar"),
            (st.line_chart, "line"),
        ]
    )
    def test_chart_with_bad_color_arg(self, chart_command: Callable, altair_type: str):
        """Test that we throw a pretty exception when colors arg is wrong."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        too_few_args = ["#f00", ["#f00"], (1, 0, 0, 0.5)]
        too_many_args = [["#f00", "#0ff"], [(1, 0, 0), (0, 0, 1)]]
        bad_args = ["foo", "blue"]

        for color_arg in too_few_args:
            with self.assertRaises(StreamlitAPIException) as exc:
                chart_command(df, y=["a", "b"], color=color_arg)

            self.assertTrue("The list of colors" in str(exc.exception))

        for color_arg in too_many_args:
            with self.assertRaises(StreamlitAPIException) as exc:
                chart_command(df, y="a", color=color_arg)

            self.assertTrue("The list of colors" in str(exc.exception))

        for color_arg in bad_args:
            with self.assertRaises(StreamlitAPIException) as exc:
                chart_command(df, y="a", color=color_arg)

            self.assertTrue(
                "This does not look like a valid color argument" in str(exc.exception)
            )

    def assert_output_df_is_correct_and_input_is_untouched(
        self, orig_df, expected_df, chart_proto
    ):
        """Test that when we modify the outgoing DF we don't mutate the input DF."""
        output_df = bytes_to_data_frame(chart_proto.datasets[0].data.data)

        self.assertNotEqual(id(orig_df), id(output_df))
        self.assertNotEqual(id(orig_df), id(expected_df))
        self.assertNotEqual(id(output_df), id(expected_df))

        pd.testing.assert_frame_equal(output_df, expected_df)
